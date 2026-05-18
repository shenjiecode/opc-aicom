package provider

import (
	"context"
)

// Provider defines the interface for AI provider adapters
type Provider interface {
	// ChatCompletion sends a chat completion request
	ChatCompletion(ctx context.Context, req *ChatRequest) (*ChatResponse, error)
	// StreamChatCompletion sends a streaming chat completion request
	StreamChatCompletion(ctx context.Context, req *ChatRequest) (<-chan SSEEvent, error)
	// Name returns the provider name
	Name() string
}

// Message represents a single message in a chat conversation
type Message struct {
	Role    string `json:"role"`    // "system", "user", "assistant"
	Content string `json:"content"` // message content
}

// ChatRequest represents a chat completion request (OpenAI-compatible format)
type ChatRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	Stream      bool      `json:"stream,omitempty"`
	MaxTokens   int       `json:"max_tokens,omitempty"`
	Temperature float64   `json:"temperature,omitempty"`
	TopP        float64   `json:"top_p,omitempty"`
}

// Choice represents a completion choice
type Choice struct {
	Index        int     `json:"index"`
	Message      Message `json:"message"`
	FinishReason string  `json:"finish_reason"`
}

// Usage represents token usage statistics
type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// ChatResponse represents a chat completion response (OpenAI-compatible format)
type ChatResponse struct {
	ID      string   `json:"id"`
	Object  string   `json:"object"`
	Created int64    `json:"created"`
	Model   string   `json:"model"`
	Choices []Choice `json:"choices"`
	Usage   Usage    `json:"usage"`
}

// SSEEvent represents a Server-Sent Event for streaming
type SSEEvent struct {
	Event string `json:"event"` // "message", "error", "done"
	Data  string `json:"data"`  // JSON payload
}

// ProviderConfig holds configuration for a provider
type ProviderConfig struct {
	APIKey  string
	BaseURL string
	Timeout int // timeout in seconds
}

// ProviderError represents an error from a provider
type ProviderError struct {
	Provider string
	Code     string
	Message  string
	HTTPCode int
}

func (e *ProviderError) Error() string {
	return e.Provider + ": " + e.Code + " - " + e.Message
}
