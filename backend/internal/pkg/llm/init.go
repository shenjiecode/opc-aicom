package llm

import (
	"os"
)

func InitDefaultRegistry() *ProviderRegistry {
	registry := NewProviderRegistry()

	openaiKey := os.Getenv("OPENAI_API_KEY")
	openaiBaseURL := os.Getenv("OPENAI_BASE_URL")
	if openaiKey != "" {
		registry.Register("openai", NewOpenAIProvider(LLMConfig{
			APIKey:  openaiKey,
			BaseURL: openaiBaseURL,
		}))
		registry.SetDefault("chat", "openai")
		registry.SetDefault("streaming", "openai")
	}

	anthropicKey := os.Getenv("ANTHROPIC_API_KEY")
	anthropicBaseURL := os.Getenv("ANTHROPIC_BASE_URL")
	if anthropicKey != "" {
		registry.Register("anthropic", NewAnthropicProvider(LLMConfig{
			APIKey:  anthropicKey,
			BaseURL: anthropicBaseURL,
		}))
		if openaiKey == "" {
			registry.SetDefault("chat", "anthropic")
		}
	}

	return registry
}

func InitTestRegistry() *ProviderRegistry {
	registry := NewProviderRegistry()

	registry.Register("openai", NewOpenAIProvider(LLMConfig{
		APIKey:  "test-key",
		BaseURL: "https://api.openai.com/v1",
	}))
	registry.SetDefault("chat", "openai")

	registry.Register("anthropic", NewAnthropicProvider(LLMConfig{
		APIKey:  "test-key",
		BaseURL: "https://api.anthropic.com/v1",
	}))

	return registry
}