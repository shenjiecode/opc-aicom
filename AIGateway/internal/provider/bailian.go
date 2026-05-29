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

const DefaultBailianBaseURL = "https://dashscope.aliyuncs.com/compatible-mode/v1"

type BailianProvider struct {
	config ProviderConfig
	client *http.Client
}

func NewBailianProvider(config ProviderConfig) *BailianProvider {
	if config.BaseURL == "" {
		config.BaseURL = DefaultBailianBaseURL
	}
	timeout := config.Timeout
	if timeout == 0 {
		timeout = 60
	}
	return &BailianProvider{
		config: config,
		client: &http.Client{
			Timeout: time.Duration(timeout) * time.Second,
		},
	}
}

func (p *BailianProvider) Name() string {
	return "alibaba"
}

type bailianRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	Stream      bool      `json:"stream,omitempty"`
	MaxTokens   int       `json:"max_tokens,omitempty"`
	Temperature float64   `json:"temperature,omitempty"`
	TopP        float64   `json:"top_p,omitempty"`
}

type bailianResponse struct {
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

type bailianErrorResponse struct {
	Error struct {
		Message string `json:"message"`
		Type    string `json:"type"`
		Code    string `json:"code"`
	} `json:"error"`
}

type BailianModelItem struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	OwnedBy string `json:"owned_by"`
}

type BailianModelListResponse struct {
	Object string            `json:"object"`
	Data   []BailianModelItem `json:"data"`
}

func (p *BailianProvider) ChatCompletion(ctx context.Context, req *ChatRequest) (*ChatResponse, error) {
	bailianReq := bailianRequest{
		Model:       req.Model,
		Messages:    req.Messages,
		MaxTokens:   req.MaxTokens,
		Temperature: req.Temperature,
		TopP:        req.TopP,
	}

	body, err := json.Marshal(bailianReq)
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

	if resp.StatusCode != http.StatusOK {
		var errResp bailianErrorResponse
		if err := json.Unmarshal(respBody, &errResp); err == nil && errResp.Error.Message != "" {
			return nil, &ProviderError{
				Provider: "alibaba",
				Code:     errResp.Error.Code,
				Message:  errResp.Error.Message,
				HTTPCode: resp.StatusCode,
			}
		}
		return nil, &ProviderError{
			Provider: "alibaba",
			Code:     "http_error",
			Message:  string(respBody),
			HTTPCode: resp.StatusCode,
		}
	}

	var bResp bailianResponse
	if err := json.Unmarshal(respBody, &bResp); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	if bResp.Error != nil {
		return nil, &ProviderError{
			Provider: "alibaba",
			Code:     bResp.Error.Code,
			Message:  bResp.Error.Message,
			HTTPCode: resp.StatusCode,
		}
	}

	choices := make([]Choice, len(bResp.Choices))
	for i, c := range bResp.Choices {
		choices[i] = Choice{
			Index:        c.Index,
			Message:      c.Message,
			FinishReason: c.FinishReason,
		}
	}

	return &ChatResponse{
		ID:      bResp.ID,
		Object:  bResp.Object,
		Created: bResp.Created,
		Model:   bResp.Model,
		Choices: choices,
		Usage:   bResp.Usage,
	}, nil
}

func (p *BailianProvider) StreamChatCompletion(ctx context.Context, req *ChatRequest) (<-chan SSEEvent, error) {
	ch := make(chan SSEEvent, 100)

	bailianReq := bailianRequest{
		Model:       req.Model,
		Messages:    req.Messages,
		Stream:      true,
		MaxTokens:   req.MaxTokens,
		Temperature: req.Temperature,
		TopP:        req.TopP,
	}

	body, err := json.Marshal(bailianReq)
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

		var errResp bailianErrorResponse
		if err := json.Unmarshal(bodyBytes, &errResp); err == nil && errResp.Error.Message != "" {
			close(ch)
			return nil, &ProviderError{
				Provider: "alibaba",
				Code:     errResp.Error.Code,
				Message:  errResp.Error.Message,
				HTTPCode: resp.StatusCode,
			}
		}

		close(ch)
		return nil, &ProviderError{
			Provider: "alibaba",
			Code:     "http_error",
			Message:  string(bodyBytes),
			HTTPCode: resp.StatusCode,
		}
	}

	go p.processSSEStream(resp.Body, ch)

	return ch, nil
}

func (p *BailianProvider) processSSEStream(body io.ReadCloser, ch chan<- SSEEvent) {
	defer close(ch)
	defer body.Close()

	scanner := bufio.NewScanner(body)
	for scanner.Scan() {
		line := scanner.Text()

		if line == "" {
			continue
		}

		if !strings.HasPrefix(line, "data: ") {
			continue
		}

		data := strings.TrimPrefix(line, "data: ")

		if data == "[DONE]" {
			ch <- SSEEvent{
				Event: "done",
				Data:  "",
			}
			return
		}

		var streamResp bailianResponse
		if err := json.Unmarshal([]byte(data), &streamResp); err != nil {
			ch <- SSEEvent{
				Event: "error",
				Data:  fmt.Sprintf(`{"error": "parse error: %s"}`, err.Error()),
			}
			continue
		}

		if streamResp.Error != nil {
			ch <- SSEEvent{
				Event: "error",
				Data:  fmt.Sprintf(`{"error": "%s"}`, streamResp.Error.Message),
			}
			continue
		}

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

func (p *BailianProvider) ListModels(ctx context.Context) ([]BailianModelItem, error) {
	httpReq, err := http.NewRequestWithContext(ctx, "GET", p.config.BaseURL+"/models", nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

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

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("get models failed: %s", string(respBody))
	}

	var modelList BailianModelListResponse
	if err := json.Unmarshal(respBody, &modelList); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	return modelList.Data, nil
}
