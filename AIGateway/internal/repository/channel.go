package repository

import (
	"context"

	"github.com/opc-aicom/aigateway/internal/model"
)

// ChannelRepository defines the interface for channel data access
type ChannelRepository interface {
	// GetByID retrieves a channel by ID
	GetByID(ctx context.Context, id uint) (*model.AIChannel, error)

	// GetByProvider retrieves all channels for a specific provider
	GetByProvider(ctx context.Context, provider string) ([]*model.AIChannel, error)

	// GetActiveChannels retrieves all active channels
	GetActiveChannels(ctx context.Context) ([]*model.AIChannel, error)

	// GetActiveChannelsByModel retrieves active channels that support a specific model
	GetActiveChannelsByModel(ctx context.Context, modelName string) ([]*model.AIChannel, error)

	// UpdateStatus updates the channel status
	UpdateStatus(ctx context.Context, id uint, status model.ChannelStatus) error

	// IncrementFailedCount increments the failed count for a channel
	IncrementFailedCount(ctx context.Context, id uint) error

	// ResetFailedCount resets the failed count for a channel
	ResetFailedCount(ctx context.Context, id uint) error

	// GetChannelsByPriority retrieves channels ordered by priority (highest first)
	GetChannelsByPriority(ctx context.Context, modelName string) ([]*model.AIChannel, error)
}

// ModelRepository defines the interface for model data access
type ModelRepository interface {
	// GetByName retrieves a model configuration by name
	GetByName(ctx context.Context, name string) (*model.AIModel, error)

	// GetByChannelID retrieves all models for a specific channel
	GetByChannelID(ctx context.Context, channelID uint) ([]*model.AIModel, error)

	// GetActiveModels retrieves all active models
	GetActiveModels(ctx context.Context) ([]*model.AIModel, error)

	// GetModelWithChannel retrieves a model with its associated channel
	GetModelWithChannel(ctx context.Context, name string) (*model.AIModel, error)
}
