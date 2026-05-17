package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type LLMProvider interface {
	Chat(ctx context.Context, req *ChatRequest) (*ChatResponse, error)
	StreamChat(ctx context.Context, req *ChatRequest) (<-chan StreamChunk, error)
	GetModels() []string
}

type ChatRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	Temperature float64   `json:"temperature,omitempty"`
	MaxTokens   int       `json:"max_tokens,omitempty"`
	Tools       []Tool    `json:"tools,omitempty"`
	Stop        []string  `json:"stop,omitempty"`
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
	Name    string `json:"name,omitempty"`
}

type Tool struct {
	Type     string      `json:"type"`
	Function FunctionDef `json:"function"`
}

type FunctionDef struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
}

type ChatResponse struct {
	ID      string   `json:"id"`
	Model   string   `json:"model"`
	Choices []Choice `json:"choices"`
	Usage   Usage    `json:"usage"`
}

type Choice struct {
	Index        int     `json:"index"`
	Message      Message `json:"message"`
	FinishReason string  `json:"finish_reason"`
}

type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

type StreamChunk struct {
	Content      string
	FinishReason string
	Done         bool
	Error        error
}

type LLMConfig struct {
	APIKey  string
	BaseURL string
	Model   string
	Timeout time.Duration
}

type OpenAIProvider struct {
	config LLMConfig
	client *http.Client
}

func NewOpenAIProvider(config LLMConfig) *OpenAIProvider {
	if config.BaseURL == "" {
		config.BaseURL = "https://api.openai.com/v1"
	}
	if config.Timeout == 0 {
		config.Timeout = 30 * time.Second
	}
	return &OpenAIProvider{
		config: config,
		client: &http.Client{Timeout: config.Timeout},
	}
}

func (p *OpenAIProvider) Chat(ctx context.Context, req *ChatRequest) (*ChatResponse, error) {
	if req.Model == "" {
		req.Model = p.config.Model
	}
	if req.Model == "" {
		req.Model = "gpt-4-turbo"
	}

	body, err := json.Marshal(req)
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

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error: status=%d, body=%s", resp.StatusCode, string(bodyBytes))
	}

	var result ChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	return &result, nil
}

func (p *OpenAIProvider) StreamChat(ctx context.Context, req *ChatRequest) (<-chan StreamChunk, error) {
	ch := make(chan StreamChunk, 100)

	go func() {
		defer close(ch)

		if req.Model == "" {
			req.Model = p.config.Model
		}
		if req.Model == "" {
			req.Model = "gpt-4-turbo"
		}

		body, err := json.Marshal(req)
		if err != nil {
			ch <- StreamChunk{Error: fmt.Errorf("marshal request: %w", err)}
			return
		}

		httpReq, err := http.NewRequestWithContext(ctx, "POST", p.config.BaseURL+"/chat/completions", bytes.NewReader(body))
		if err != nil {
			ch <- StreamChunk{Error: fmt.Errorf("create request: %w", err)}
			return
		}

		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("Authorization", "Bearer "+p.config.APIKey)

		resp, err := p.client.Do(httpReq)
		if err != nil {
			ch <- StreamChunk{Error: fmt.Errorf("send request: %w", err)}
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			bodyBytes, _ := io.ReadAll(resp.Body)
			ch <- StreamChunk{Error: fmt.Errorf("API error: status=%d, body=%s", resp.StatusCode, string(bodyBytes))}
			return
		}

		decoder := json.NewDecoder(resp.Body)
		for {
			var streamResp struct {
				Choices []struct {
					Delta struct {
						Content string `json:"content"`
					} `json:"delta"`
					FinishReason string `json:"finish_reason"`
				} `json:"choices"`
			}

			err := decoder.Decode(&streamResp)
			if err == io.EOF {
				ch <- StreamChunk{Done: true}
				return
			}
			if err != nil {
				ch <- StreamChunk{Error: err}
				return
			}

			if len(streamResp.Choices) > 0 {
				ch <- StreamChunk{
					Content:      streamResp.Choices[0].Delta.Content,
					FinishReason: streamResp.Choices[0].FinishReason,
				}
			}
		}
	}()

	return ch, nil
}

func (p *OpenAIProvider) GetModels() []string {
	return []string{
		"gpt-4-turbo",
		"gpt-4",
		"gpt-3.5-turbo",
		"gpt-4o",
		"gpt-4o-mini",
	}
}

type AnthropicProvider struct {
	config LLMConfig
	client *http.Client
}

func NewAnthropicProvider(config LLMConfig) *AnthropicProvider {
	if config.BaseURL == "" {
		config.BaseURL = "https://api.anthropic.com/v1"
	}
	if config.Timeout == 0 {
		config.Timeout = 30 * time.Second
	}
	return &AnthropicProvider{
		config: config,
		client: &http.Client{Timeout: config.Timeout},
	}
}

type AnthropicRequest struct {
	Model       string          `json:"model"`
	System      string          `json:"system,omitempty"`
	Messages    []AnthropicMsg  `json:"messages"`
	MaxTokens   int             `json:"max_tokens"`
	Temperature float64         `json:"temperature,omitempty"`
	Tools       []AnthropicTool `json:"tools,omitempty"`
}

type AnthropicMsg struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type AnthropicTool struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	InputSchema map[string]interface{} `json:"input_schema"`
}

type AnthropicResponse struct {
	ID      string              `json:"id"`
	Type    string              `json:"type"`
	Role    string              `json:"role"`
	Content []AnthropicContent  `json:"content"`
	Model   string              `json:"model"`
	Usage   AnthropicUsage      `json:"usage"`
}

type AnthropicContent struct {
	Type string `json:"type"`
	Text string `json:"text,omitempty"`
}

type AnthropicUsage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

func (p *AnthropicProvider) Chat(ctx context.Context, req *ChatRequest) (*ChatResponse, error) {
	if req.Model == "" {
		req.Model = p.config.Model
	}
	if req.Model == "" {
		req.Model = "claude-3-sonnet-20240229"
	}

	systemPrompt := ""
	userMessages := []AnthropicMsg{}
	for _, m := range req.Messages {
		if m.Role == "system" {
			systemPrompt = m.Content
		} else {
			userMessages = append(userMessages, AnthropicMsg{
				Role:    m.Role,
				Content: m.Content,
			})
		}
	}

	anthropicReq := AnthropicRequest{
		Model:       req.Model,
		System:      systemPrompt,
		Messages:    userMessages,
		MaxTokens:   req.MaxTokens,
		Temperature: req.Temperature,
	}

	body, err := json.Marshal(anthropicReq)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.config.BaseURL+"/messages", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", p.config.APIKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")

	resp, err := p.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error: status=%d, body=%s", resp.StatusCode, string(bodyBytes))
	}

	var anthropicResp AnthropicResponse
	if err := json.NewDecoder(resp.Body).Decode(&anthropicResp); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	content := ""
	for _, c := range anthropicResp.Content {
		if c.Type == "text" {
			content += c.Text
		}
	}

	return &ChatResponse{
		ID:    anthropicResp.ID,
		Model: anthropicResp.Model,
		Choices: []Choice{
			{
				Message: Message{
					Role:    "assistant",
					Content: content,
				},
			},
		},
		Usage: Usage{
			PromptTokens:     anthropicResp.Usage.InputTokens,
			CompletionTokens: anthropicResp.Usage.OutputTokens,
			TotalTokens:      anthropicResp.Usage.InputTokens + anthropicResp.Usage.OutputTokens,
		},
	}, nil
}

func (p *AnthropicProvider) StreamChat(ctx context.Context, req *ChatRequest) (<-chan StreamChunk, error) {
	ch := make(chan StreamChunk, 100)
	return ch, fmt.Errorf("streaming not implemented for Anthropic")
}

func (p *AnthropicProvider) GetModels() []string {
	return []string{
		"claude-3-opus-20240229",
		"claude-3-sonnet-20240229",
		"claude-3-haiku-20240307",
		"claude-3-5-sonnet-20241022",
	}
}
