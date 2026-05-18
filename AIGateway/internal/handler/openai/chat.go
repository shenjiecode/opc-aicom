package openai

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/opc-aicom/aigateway/internal/middleware"
	"github.com/opc-aicom/aigateway/internal/model"
	"github.com/opc-aicom/aigateway/internal/pkg/response"
	"github.com/opc-aicom/aigateway/internal/provider"
	"github.com/opc-aicom/aigateway/internal/router"
)

// UsageService defines the interface for usage tracking
type UsageService interface {
	RecordUsage(virtualKeyID, channelID uint, modelName string, promptTokens, completionTokens int, cost float64, latencyMs int, status model.TokenLogStatus, errMsg string) error
	UpdateKeyUsage(virtualKeyID uint, tokensUsed int64) error
}

// ChatCompletionRequest represents the OpenAI-compatible chat completion request
type ChatCompletionRequest struct {
	Model       string           `json:"model" binding:"required"`
	Messages    []provider.Message `json:"messages" binding:"required"`
	Stream      bool             `json:"stream,omitempty"`
	MaxTokens   int              `json:"max_tokens,omitempty"`
	Temperature float64          `json:"temperature,omitempty"`
	TopP        float64          `json:"top_p,omitempty"`
}

// ChatCompletionHandler handles POST /v1/chat/completions
func ChatCompletionHandler(r *router.Router, usageService UsageService) gin.HandlerFunc {
	return func(c *gin.Context) {
		startTime := time.Now()

		// Get virtual key from context
		virtualKey := middleware.GetVirtualKey(c)
		if virtualKey == nil {
			response.Unauthorized(c, "no virtual key found")
			return
		}

		// Parse request body
		var req ChatCompletionRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.BadRequest(c, "invalid request body: "+err.Error())
			return
		}

		// Validate messages
		if len(req.Messages) == 0 {
			response.BadRequest(c, "messages cannot be empty")
			return
		}

		// Route to appropriate channel
		p, channel, err := r.RouteWithFallback(c.Request.Context(), req.Model)
		if err != nil {
			response.Error(c, 404, "model not found or no available channels: "+err.Error())
			return
		}

		// Build provider request
		providerReq := &provider.ChatRequest{
			Model:       req.Model,
			Messages:    req.Messages,
			MaxTokens:   req.MaxTokens,
			Temperature: req.Temperature,
			TopP:        req.TopP,
		}

		// Handle streaming vs non-streaming
		if req.Stream {
			handleStreamCompletion(c, r, p, channel, providerReq, virtualKey, usageService, startTime)
		} else {
			handleNonStreamCompletion(c, r, p, channel, providerReq, virtualKey, usageService, startTime)
		}
	}
}

// handleNonStreamCompletion handles non-streaming chat completion
func handleNonStreamCompletion(c *gin.Context, r *router.Router, p provider.Provider, channel *model.AIChannel, req *provider.ChatRequest, virtualKey *model.AIVirtualKey, usageService UsageService, startTime time.Time) {
	// Call provider
	resp, err := p.ChatCompletion(c.Request.Context(), req)
	if err != nil {
		latencyMs := int(time.Since(startTime).Milliseconds())
		recordError(usageService, virtualKey.ID, channel.ID, req.Model, latencyMs, err)
		r.MarkChannelFailed(req.Model, channel.ID)

		// Check for provider error
		if provErr, ok := err.(*provider.ProviderError); ok {
			response.ErrorWithStatus(c, provErr.HTTPCode, provErr.HTTPCode, provErr.Message)
			return
		}
		response.InternalError(c, "failed to complete request: "+err.Error())
		return
	}

	// Mark channel as successful
	r.MarkChannelSuccess(req.Model, channel.ID)

	// Calculate latency
	latencyMs := int(time.Since(startTime).Milliseconds())

	// Record usage
	cost := calculateCost(resp.Usage.PromptTokens, resp.Usage.CompletionTokens, channel)
	recordSuccess(usageService, virtualKey.ID, channel.ID, req.Model, resp.Usage.PromptTokens, resp.Usage.CompletionTokens, cost, latencyMs)

	// Update key usage
	if err := usageService.UpdateKeyUsage(virtualKey.ID, int64(resp.Usage.TotalTokens)); err != nil {
		// Log error but don't fail the request
		fmt.Printf("failed to update key usage: %v\n", err)
	}

	// Return OpenAI-compatible response
	c.JSON(http.StatusOK, resp)
}

// handleStreamCompletion handles streaming chat completion with SSE
func handleStreamCompletion(c *gin.Context, r *router.Router, p provider.Provider, channel *model.AIChannel, req *provider.ChatRequest, virtualKey *model.AIVirtualKey, usageService UsageService, startTime time.Time) {
	// Get SSE stream
	stream, err := p.StreamChatCompletion(c.Request.Context(), req)
	if err != nil {
		latencyMs := int(time.Since(startTime).Milliseconds())
		recordError(usageService, virtualKey.ID, channel.ID, req.Model, latencyMs, err)
		r.MarkChannelFailed(req.Model, channel.ID)

		if provErr, ok := err.(*provider.ProviderError); ok {
			response.ErrorWithStatus(c, provErr.HTTPCode, provErr.HTTPCode, provErr.Message)
			return
		}
		response.InternalError(c, "failed to start stream: "+err.Error())
		return
	}

	// Set SSE headers
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Transfer-Encoding", "chunked")

	// Stream events to client
	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		response.InternalError(c, "streaming not supported")
		return
	}

	var totalPromptTokens, totalCompletionTokens int
	streamSuccessful := true

	for event := range stream {
		switch event.Event {
		case "message":
			// Write SSE event
			c.Writer.WriteString(fmt.Sprintf("data: %s\n\n", event.Data))
			flusher.Flush()

			// Try to extract token usage from the chunk (if available)
			var chunk map[string]interface{}
			if err := json.Unmarshal([]byte(event.Data), &chunk); err == nil {
				// Some providers include usage in the final chunk
				if usage, ok := chunk["usage"].(map[string]interface{}); ok {
					if pt, ok := usage["prompt_tokens"].(float64); ok {
						totalPromptTokens = int(pt)
					}
					if ct, ok := usage["completion_tokens"].(float64); ok {
						totalCompletionTokens = int(ct)
					}
				}
			}

		case "done":
			// Send [DONE] marker
			c.Writer.WriteString("data: [DONE]\n\n")
			flusher.Flush()

		case "error":
			streamSuccessful = false
			// Send error as SSE event
			c.Writer.WriteString(fmt.Sprintf("data: %s\n\n", event.Data))
			flusher.Flush()
		}
	}

	// Calculate latency
	latencyMs := int(time.Since(startTime).Milliseconds())

	// Record usage
	if streamSuccessful {
		r.MarkChannelSuccess(req.Model, channel.ID)
		cost := calculateCost(totalPromptTokens, totalCompletionTokens, channel)
		recordSuccess(usageService, virtualKey.ID, channel.ID, req.Model, totalPromptTokens, totalCompletionTokens, cost, latencyMs)

		// Update key usage
		totalTokens := totalPromptTokens + totalCompletionTokens
		if totalTokens > 0 {
			if err := usageService.UpdateKeyUsage(virtualKey.ID, int64(totalTokens)); err != nil {
				fmt.Printf("failed to update key usage: %v\n", err)
			}
		}
	} else {
		r.MarkChannelFailed(req.Model, channel.ID)
		recordError(usageService, virtualKey.ID, channel.ID, req.Model, latencyMs, fmt.Errorf("stream error"))
	}
}

// calculateCost calculates the cost based on token usage
func calculateCost(promptTokens, completionTokens int, channel *model.AIChannel) float64 {
	// Basic cost calculation - in production, this would use model pricing
	// For now, use a simple formula
	return float64(promptTokens+completionTokens) * 0.0001
}

// recordSuccess records a successful usage
func recordSuccess(usageService UsageService, virtualKeyID, channelID uint, modelName string, promptTokens, completionTokens int, cost float64, latencyMs int) {
	requestID := uuid.New().String()
	err := usageService.RecordUsage(virtualKeyID, channelID, modelName, promptTokens, completionTokens, cost, latencyMs, model.TokenLogStatusSuccess, "")
	if err != nil {
		fmt.Printf("failed to record usage: %v, request_id=%s\n", err, requestID)
	}
}

// recordError records a failed usage
func recordError(usageService UsageService, virtualKeyID, channelID uint, modelName string, latencyMs int, reqErr error) {
	requestID := uuid.New().String()
	errMsg := ""
	if reqErr != nil {
		errMsg = reqErr.Error()
	}
	err := usageService.RecordUsage(virtualKeyID, channelID, modelName, 0, 0, 0, latencyMs, model.TokenLogStatusFailed, errMsg)
	if err != nil {
		fmt.Printf("failed to record error: %v, request_id=%s\n", err, requestID)
	}
}

// StreamWriter is a helper for writing SSE events
type StreamWriter struct {
	writer  io.Writer
	flusher http.Flusher
}

// NewStreamWriter creates a new stream writer
func NewStreamWriter(w io.Writer, f http.Flusher) *StreamWriter {
	return &StreamWriter{
		writer:  w,
		flusher: f,
	}
}

// WriteEvent writes an SSE event
func (sw *StreamWriter) WriteEvent(event, data string) error {
	_, err := fmt.Fprintf(sw.writer, "event: %s\ndata: %s\n\n", event, data)
	if err != nil {
		return err
	}
	sw.flusher.Flush()
	return nil
}

// WriteData writes SSE data (without event type)
func (sw *StreamWriter) WriteData(data string) error {
	_, err := fmt.Fprintf(sw.writer, "data: %s\n\n", data)
	if err != nil {
		return err
	}
	sw.flusher.Flush()
	return nil
}
