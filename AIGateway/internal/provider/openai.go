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

// OpenAIProvider implements the Provider interface for OpenAI
type OpenAIProvider struct {
	config ProviderConfig
	client *http.Client
}

// NewOpenAIProvider creates a new OpenAI provider
func NewOpenAIProvider(config ProviderConfig) *OpenAIProvider {
	if config.BaseURL == "" {
		config.BaseURL = "https://api.openai.com/v1"
	}
	timeout := config.Timeout
	if timeout == 0 {
		timeout = 60
	}
	return &OpenAIProvider{
		config: config,
		client: &http.Client{
			Timeout: time.Duration(timeout) * time.Second,
		},
	}
}

// Name returns the provider name
func (p *OpenAIProvider) Name() string {
	return "openai"
}

// openAIRequest represents the request body for OpenAI API
type openAIRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	Stream      bool      `json:"stream,omitempty"`
	MaxTokens   int       `json:"max_tokens,omitempty"`
	Temperature float64   `json:"temperature,omitempty"`
	TopP        float64   `json:"top_p,omitempty"`
}

// openAIResponse represents the response from OpenAI API
type openAIResponse struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	Model   string `json:"model"`
	Choices []struct {
		Index        int     `json:"index"`
		Message      Message `json:"message"`
		FinishReason string  `json:"finish_reason"`
		Delta        *struct {
			Role    string `json:"role,omitempty"`
			Content string `json:"content,omitempty"`
		} `json:"delta,omitempty"`
	} `json:"choices"`
	Usage Usage `json:"usage"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
		Code    string `json:"code"`
	} `json:"error,omitempty"`
}

// ChatCompletion sends a non-streaming chat completion request
func (p *OpenAIProvider) ChatCompletion(ctx context.Context, req *ChatRequest) (*ChatResponse, error) {
	openAIReq := openAIRequest{
		Model:       req.Model,
		Messages:    req.Messages,
		MaxTokens:   req.MaxTokens,
		Temperature: req.Temperature,
		TopP:        req.TopP,
	}

	body, err := json.Marshal(openAIReq)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.config.BaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+p.config.APIKey)

	resp, err := p.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	var openAIResp openAIResponse
	if err := json.Unmarshal(respBody, &openAIResp); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	if openAIResp.Error != nil {
		return nil, &ProviderError{
			Provider: "openai",
			Code:     openAIResp.Error.Code,
			Message:  openAIResp.Error.Message,
			HTTPCode: resp.StatusCode,
		}
	}

	if resp.StatusCode != http.StatusOK {
		return nil, &ProviderError{
			Provider: "openai",
			Code:     "http_error",
			Message:  string(respBody),
			HTTPCode: resp.StatusCode,
		}
	}

	choices := make([]Choice, len(openAIResp.Choices))
	for i, c := range openAIResp.Choices {
		choices[i] = Choice{
			Index:        c.Index,
			Message:      c.Message,
			FinishReason: c.FinishReason,
		}
	}

	return &ChatResponse{
		ID:      openAIResp.ID,
		Object:  openAIResp.Object,
		Created: openAIResp.Created,
		Model:   openAIResp.Model,
		Choices: choices,
		Usage:   openAIResp.Usage,
	}, nil
}

// StreamChatCompletion sends a streaming chat completion request
func (p *OpenAIProvider) StreamChatCompletion(ctx context.Context, req *ChatRequest) (<-chan SSEEvent, error) {
	ch := make(chan SSEEvent, 100)

	openAIReq := openAIRequest{
		Model:       req.Model,
		Messages:    req.Messages,
		Stream:      true,
		MaxTokens:   req.MaxTokens,
		Temperature: req.Temperature,
		TopP:        req.TopP,
	}

	body, err := json.Marshal(openAIReq)
	if err != nil {
		close(ch)
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.config.BaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		close(ch)
		return nil, fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+p.config.APIKey)
	httpReq.Header.Set("Accept", "text/event-stream")

	resp, err := p.client.Do(httpReq)
	if err != nil {
		close(ch)
		return nil, fmt.Errorf("send request: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		defer resp.Body.Close()
		bodyBytes, _ := io.ReadAll(resp.Body)
		close(ch)
		return nil, &ProviderError{
			Provider: "openai",
			Code:     "http_error",
			Message:  string(bodyBytes),
			HTTPCode: resp.StatusCode,
		}
	}

	go p.processSSEStream(resp.Body, ch)

	return ch, nil
}

// processSSEStream processes the SSE stream from OpenAI
func (p *OpenAIProvider) processSSEStream(body io.ReadCloser, ch chan<- SSEEvent) {
	defer close(ch)
	defer body.Close()

	scanner := bufio.NewScanner(body)
	for scanner.Scan() {
		line := scanner.Text()

		// Skip empty lines
		if line == "" {
			continue
		}

		// Parse SSE format: "data: {...}"
		if !strings.HasPrefix(line, "data: ") {
			continue
		}

		data := strings.TrimPrefix(line, "data: ")

		// Check for stream end
		if data == "[DONE]" {
			ch <- SSEEvent{
				Event: "done",
				Data:  "",
			}
			return
		}

		// Parse the JSON data
		var streamResp openAIResponse
		if err := json.Unmarshal([]byte(data), &streamResp); err != nil {
			ch <- SSEEvent{
				Event: "error",
				Data:  fmt.Sprintf(`{"error": "parse error: %s"}`, err.Error()),
			}
			continue
		}

		// Check for error in response
		if streamResp.Error != nil {
			ch <- SSEEvent{
				Event: "error",
				Data:  fmt.Sprintf(`{"error": "%s"}`, streamResp.Error.Message),
			}
			continue
		}

		// Convert to OpenAI-compatible SSE format
		if len(streamResp.Choices) > 0 && streamResp.Choices[0].Delta != nil {
			delta := streamResp.Choices[0].Delta
			chunkData, _ := json.Marshal(map[string]interface{}{
				"id":      streamResp.ID,
				"object":  "chat.completion.chunk",
				"created": streamResp.Created,
				"model":   streamResp.Model,
				"choices": []map[string]interface{}{
					{
						"index": streamResp.Choices[0].Index,
						"delta": map[string]string{
							"role":    delta.Role,
							"content": delta.Content,
						},
						"finish_reason": streamResp.Choices[0].FinishReason,
					},
				},
			})
			ch <- SSEEvent{
				Event: "message",
				Data:  string(chunkData),
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
