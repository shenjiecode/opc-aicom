package router

import (
	"context"
	"errors"
	"sync"

	"github.com/opc-aicom/aigateway/internal/model"
	"github.com/opc-aicom/aigateway/internal/provider"
	"github.com/opc-aicom/aigateway/internal/repository"
)

var (
	ErrModelNotFound      = errors.New("model not found")
	ErrNoChannelsForModel = errors.New("no channels available for model")
)

type Router struct {
	channelRepo repository.ChannelRepository
	modelRepo   repository.ModelRepository
	providers    map[string]provider.Provider
	selectors    map[string]*ChannelSelector
	mu           sync.RWMutex
}

func NewRouter(channelRepo repository.ChannelRepository, modelRepo repository.ModelRepository) *Router {
	return &Router{
		channelRepo: channelRepo,
		modelRepo:   modelRepo,
		providers:   make(map[string]provider.Provider),
		selectors:   make(map[string]*ChannelSelector),
	}
}

func (r *Router) RegisterProvider(name string, p provider.Provider) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.providers[name] = p
}

func (r *Router) Route(ctx context.Context, modelName string) (provider.Provider, error) {
	_, _, err := r.RouteWithFallback(ctx, modelName)
	if err != nil {
		return nil, err
	}

	r.mu.RLock()
	defer r.mu.RUnlock()

	selector, ok := r.selectors[modelName]
	if !ok {
		return nil, ErrModelNotFound
	}

	channel := selector.Select()
	if channel == nil {
		return nil, ErrNoChannelsForModel
	}

	p, ok := r.providers[channel.Provider]
	if !ok {
		return nil, ErrNoChannelsForModel
	}

	return p, nil
}

func (r *Router) RouteWithFallback(ctx context.Context, modelName string) (provider.Provider, *model.AIChannel, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	selector, ok := r.selectors[modelName]
	if !ok {
		if err := r.refreshSelector(ctx, modelName); err != nil {
			return nil, nil, err
		}
		selector = r.selectors[modelName]
	}

	channel := selector.Select()
	if channel == nil {
		return nil, nil, ErrNoChannelsForModel
	}

	p, ok := r.providers[channel.Provider]
	if !ok {
		selector.MarkFailed(channel.ID)
		return nil, nil, ErrNoChannelsForModel
	}

	return p, channel, nil
}

func (r *Router) MarkChannelFailed(modelName string, channelID uint) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if selector, ok := r.selectors[modelName]; ok {
		selector.MarkFailed(channelID)
	}
}

func (r *Router) MarkChannelSuccess(modelName string, channelID uint) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if selector, ok := r.selectors[modelName]; ok {
		selector.MarkSuccess(channelID)
	}
}

func (r *Router) Refresh(ctx context.Context) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.selectors = make(map[string]*ChannelSelector)

	models, err := r.modelRepo.GetActiveModels(ctx)
	if err != nil {
		return err
	}

	for _, m := range models {
		channels, err := r.channelRepo.GetActiveChannelsByModel(ctx, m.Name)
		if err != nil {
			continue
		}
		r.selectors[m.Name] = NewChannelSelector(channels)
	}

	return nil
}

func (r *Router) refreshSelector(ctx context.Context, modelName string) error {
	channels, err := r.channelRepo.GetActiveChannelsByModel(ctx, modelName)
	if err != nil {
		return ErrModelNotFound
	}

	if len(channels) == 0 {
		return ErrNoChannelsForModel
	}

	r.selectors[modelName] = NewChannelSelector(channels)
	return nil
}

func (r *Router) GetAvailableChannelCount(modelName string) int {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if selector, ok := r.selectors[modelName]; ok {
		return selector.GetAvailableCount()
	}
	return 0
}
