package provider

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	// anthropicVersion is the required API version header
	anthropicVersion = "2023-06-01"
	// defaultMaxTokens is the default max_tokens for Anthropic (required field)
	defaultMaxTokens = 4096
)

// AnthropicProvider implements the Provider interface for Anthropic
type AnthropicProvider struct {
	config ProviderConfig
	client *http.Client
}

// NewAnthropicProvider creates a new Anthropic provider
func NewAnthropicProvider(config ProviderConfig) *AnthropicProvider {
	if config.BaseURL == "" {
		config.BaseURL = "https://api.anthropic.com/v1"
	}
	timeout := config.Timeout
	if timeout == 0 {
		timeout = 60
	}
	return &AnthropicProvider{
		config: config,
		client: &http.Client{
			Timeout: time.Duration(timeout) * time.Second,
		},
	}
}

// Name returns the provider name
func (p *AnthropicProvider) Name() string {
	return "anthropic"
}

// --- Anthropic-specific request/response types ---

// anthropicRequest represents the request body for Anthropic Messages API
type anthropicRequest struct {
	Model       string           `json:"model"`
	System      string           `json:"system,omitempty"`
	Messages    []anthropicMsg   `json:"messages"`
	MaxTokens   int              `json:"max_tokens"`
	Temperature float64          `json:"temperature,omitempty"`
	TopP        float64          `json:"top_p,omitempty"`
	Stream      bool             `json:"stream,omitempty"`
}

// anthropicMsg represents a message in Anthropic format
type anthropicMsg struct {
	Role    string `json:"role"`    // "user" or "assistant"
	Content string `json:"content"` // message content
}

// anthropicResponse represents the response from Anthropic Messages API
type anthropicResponse struct {
	ID      string              `json:"id"`
	Type    string              `json:"type"`
	Role    string              `json:"role"`
	Content []anthropicContent  `json:"content"`
	Model   string              `json:"model"`
	Usage   anthropicUsage      `json:"usage"`
	Error   *anthropicErrorObj  `json:"error,omitempty"`
}

// anthropicContent represents a content block in Anthropic response
type anthropicContent struct {
	Type string `json:"type"` // "text"
	Text string `json:"text,omitempty"`
}

// anthropicUsage represents token usage in Anthropic format
type anthropicUsage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

// anthropicErrorObj represents an error from Anthropic API
type anthropicErrorObj struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

// anthropicErrorResponse wraps the error response
type anthropicErrorResponse struct {
	Error anthropicErrorObj `json:"error"`
}

// --- Anthropic SSE streaming types ---

// anthropicSSEEvent represents a raw SSE event from Anthropic
type anthropicSSEEvent struct {
	Type         string               `json:"type"` // "message_start", "content_block_start", "content_block_delta", "content_block_stop", "message_delta", "message_stop"
	Message      *anthropicResponse   `json:"message,omitempty"`
	Delta        *anthropicSSEDelta   `json:"delta,omitempty"`
	ContentBlock *anthropicContent    `json:"content_block,omitempty"`
	Usage        *anthropicUsage      `json:"usage,omitempty"`
}

// anthropicSSEDelta represents a delta in Anthropic SSE stream
type anthropicSSEDelta struct {
	Type        string `json:"type"`         // "text_delta", "input_json_delta"
	Text        string `json:"text,omitempty"`
	StopReason  string `json:"stop_reason,omitempty"`
}

// convertToAnthropicRequest converts OpenAI-compatible ChatRequest to Anthropic format
func convertToAnthropicRequest(req *ChatRequest) anthropicRequest {
	systemPrompt := ""
	messages := make([]anthropicMsg, 0, len(req.Messages))

	for _, m := range req.Messages {
		switch m.Role {
		case "system":
			// Anthropic uses top-level "system" field instead of system messages
			if systemPrompt != "" {
				systemPrompt += "\n\n" + m.Content
			} else {
				systemPrompt = m.Content
			}
		case "user", "assistant":
			messages = append(messages, anthropicMsg{
				Role:    m.Role,
				Content: m.Content,
			})
		default:
			// Skip unknown roles
		}
	}

	maxTokens := req.MaxTokens
	if maxTokens == 0 {
		maxTokens = defaultMaxTokens
	}

	return anthropicRequest{
		Model:       req.Model,
		System:      systemPrompt,
		Messages:    messages,
		MaxTokens:   maxTokens,
		Temperature: req.Temperature,
		TopP:        req.TopP,
	}
}

// convertToChatResponse converts Anthropic response to OpenAI-compatible format
func convertToChatResponse(resp *anthropicResponse) *ChatResponse {
	content := ""
	for _, c := range resp.Content {
		if c.Type == "text" {
			content += c.Text
		}
	}

	finishReason := "stop"
	if len(resp.Content) == 0 {
		finishReason = ""
	}

	return &ChatResponse{
		ID:      resp.ID,
		Object:  "chat.completion",
		Created: time.Now().Unix(),
		Model:   resp.Model,
		Choices: []Choice{
			{
				Index: 0,
				Message: Message{
					Role:    "assistant",
					Content: content,
				},
				FinishReason: finishReason,
			},
		},
		Usage: Usage{
			PromptTokens:     resp.Usage.InputTokens,
			CompletionTokens: resp.Usage.OutputTokens,
			TotalTokens:      resp.Usage.InputTokens + resp.Usage.OutputTokens,
		},
	}
}

// ChatCompletion sends a non-streaming chat completion request
func (p *AnthropicProvider) ChatCompletion(ctx context.Context, req *ChatRequest) (*ChatResponse, error) {
	anthReq := convertToAnthropicRequest(req)

	body, err := json.Marshal(anthReq)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.config.BaseURL+"/messages", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", p.config.APIKey)
	httpReq.Header.Set("anthropic-version", anthropicVersion)

	resp, err := p.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	// Handle HTTP errors with Anthropic-specific error parsing
	if resp.StatusCode != http.StatusOK {
		var errResp anthropicErrorResponse
		if err := json.Unmarshal(respBody, &errResp); err == nil && errResp.Error.Message != "" {
			return nil, &ProviderError{
				Provider: "anthropic",
				Code:     errResp.Error.Type,
				Message:  errResp.Error.Message,
				HTTPCode: resp.StatusCode,
			}
		}
		return nil, &ProviderError{
			Provider: "anthropic",
			Code:     "http_error",
			Message:  string(respBody),
			HTTPCode: resp.StatusCode,
		}
	}

	var anthResp anthropicResponse
	if err := json.Unmarshal(respBody, &anthResp); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	if anthResp.Error != nil {
		return nil, &ProviderError{
			Provider: "anthropic",
			Code:     anthResp.Error.Type,
			Message:  anthResp.Error.Message,
			HTTPCode: resp.StatusCode,
		}
	}

	return convertToChatResponse(&anthResp), nil
}

// StreamChatCompletion sends a streaming chat completion request
func (p *AnthropicProvider) StreamChatCompletion(ctx context.Context, req *ChatRequest) (<-chan SSEEvent, error) {
	ch := make(chan SSEEvent, 100)

	anthReq := convertToAnthropicRequest(req)
	anthReq.Stream = true

	body, err := json.Marshal(anthReq)
	if err != nil {
		close(ch)
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.config.BaseURL+"/messages", bytes.NewReader(body))
	if err != nil {
		close(ch)
		return nil, fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", p.config.APIKey)
	httpReq.Header.Set("anthropic-version", anthropicVersion)
	httpReq.Header.Set("Accept", "text/event-stream")

	resp, err := p.client.Do(httpReq)
	if err != nil {
		close(ch)
		return nil, fmt.Errorf("send request: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		defer resp.Body.Close()
		bodyBytes, _ := io.ReadAll(resp.Body)

		var errResp anthropicErrorResponse
		if err := json.Unmarshal(bodyBytes, &errResp); err == nil && errResp.Error.Message != "" {
			close(ch)
			return nil, &ProviderError{
				Provider: "anthropic",
				Code:     errResp.Error.Type,
				Message:  errResp.Error.Message,
				HTTPCode: resp.StatusCode,
			}
		}

		close(ch)
		return nil, &ProviderError{
			Provider: "anthropic",
			Code:     "http_error",
			Message:  string(bodyBytes),
			HTTPCode: resp.StatusCode,
		}
	}

	go p.processSSEStream(resp.Body, ch)

	return ch, nil
}

// processSSEStream processes the SSE stream from Anthropic and converts to OpenAI format
func (p *AnthropicProvider) processSSEStream(body io.ReadCloser, ch chan<- SSEEvent) {
	defer close(ch)
	defer body.Close()

	var messageID string
	var model string
	var created int64 = time.Now().Unix()

	scanner := bufio.NewScanner(body)
	for scanner.Scan() {
		line := scanner.Text()

		// Skip empty lines
		if line == "" {
			continue
		}

		// Parse SSE format: "event: <type>" and "data: <json>"
		if strings.HasPrefix(line, "event: ") {
			// We handle events based on the data payload's type field
			continue
		}

		if !strings.HasPrefix(line, "data: ") {
			continue
		}

		data := strings.TrimPrefix(line, "data: ")

		var sseEvent anthropicSSEEvent
		if err := json.Unmarshal([]byte(data), &sseEvent); err != nil {
			ch <- SSEEvent{
				Event: "error",
				Data:  fmt.Sprintf(`{"error": "parse error: %s"}`, err.Error()),
			}
			continue
		}

		switch sseEvent.Type {
		case "message_start":
			// Capture message metadata
			if sseEvent.Message != nil {
				messageID = sseEvent.Message.ID
				model = sseEvent.Message.Model
			}

		case "content_block_start":
			// New content block starting - no data to emit yet
			// Could be a text block or tool_use block

		case "content_block_delta":
			// Text delta - convert to OpenAI chunk format
			if sseEvent.Delta != nil && sseEvent.Delta.Text != "" {
				chunkData, _ := json.Marshal(map[string]interface{}{
					"id":      messageID,
					"object":  "chat.completion.chunk",
					"created": created,
					"model":   model,
					"choices": []map[string]interface{}{
						{
							"index": 0,
							"delta": map[string]string{
								"content": sseEvent.Delta.Text,
							},
							"finish_reason": nil,
						},
					},
				})
				ch <- SSEEvent{
					Event: "message",
					Data:  string(chunkData),
				}
			}

		case "content_block_stop":
			// Content block ended - no action needed

		case "message_delta":
			// Message-level delta (contains stop_reason)
			if sseEvent.Delta != nil && sseEvent.Delta.StopReason != "" {
				finishReason := sseEvent.Delta.StopReason
				// Map Anthropic stop reasons to OpenAI format
				switch finishReason {
				case "end_turn":
					finishReason = "stop"
				case "max_tokens":
					finishReason = "length"
				}

				chunkData, _ := json.Marshal(map[string]interface{}{
					"id":      messageID,
					"object":  "chat.completion.chunk",
					"created": created,
					"model":   model,
					"choices": []map[string]interface{}{
						{
							"index": 0,
							"delta": map[string]string{},
							"finish_reason": finishReason,
						},
					},
				})
				ch <- SSEEvent{
					Event: "message",
					Data:  string(chunkData),
				}
			}

		case "message_stop":
			// Stream complete
			ch <- SSEEvent{
				Event: "done",
				Data:  "",
			}
			return

		case "error":
			errMsg := "unknown error"
			if sseEvent.Delta != nil && sseEvent.Delta.Text != "" {
				errMsg = sseEvent.Delta.Text
			}
			ch <- SSEEvent{
				Event: "error",
				Data:  fmt.Sprintf(`{"error": "%s"}`, errMsg),
			}
		}
	}

	if err := scanner.Err(); err != nil {
		ch <- SSEEvent{
			Event: "error",
			Data:  fmt.Sprintf(`{"error": "stream error: %s"}`, err.Error()),
		}
	}
}