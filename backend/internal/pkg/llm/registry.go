package llm

import (
	"fmt"
	"sync"
)

type ProviderRegistry struct {
	mu        sync.RWMutex
	providers map[string]LLMProvider
	defaults  map[string]string // category -> default provider
}

func NewProviderRegistry() *ProviderRegistry {
	return &ProviderRegistry{
		providers: make(map[string]LLMProvider),
		defaults:  make(map[string]string),
	}
}

func (r *ProviderRegistry) Register(name string, provider LLMProvider) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.providers[name] = provider
}

func (r *ProviderRegistry) Get(name string) (LLMProvider, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	provider, ok := r.providers[name]
	if !ok {
		return nil, fmt.Errorf("provider not found: %s", name)
	}
	return provider, nil
}

func (r *ProviderRegistry) SetDefault(category string, providerName string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.defaults[category] = providerName
}

func (r *ProviderRegistry) GetDefault(category string) (LLMProvider, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	name, ok := r.defaults[category]
	if !ok {
		name = "openai"
	}

	provider, ok := r.providers[name]
	if !ok {
		return nil, fmt.Errorf("default provider not found: %s", name)
	}
	return provider, nil
}

func (r *ProviderRegistry) ListProviders() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	names := make([]string, 0, len(r.providers))
	for name := range r.providers {
		names = append(names, name)
	}
	return names
}

func (r *ProviderRegistry) ListModels() map[string][]string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	result := make(map[string][]string)
	for name, provider := range r.providers {
		result[name] = provider.GetModels()
	}
	return result
}

func (r *ProviderRegistry) Remove(name string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.providers, name)
}