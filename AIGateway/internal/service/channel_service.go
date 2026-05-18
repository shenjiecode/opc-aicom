package service

import (
	"errors"
	"strings"

	"github.com/opc-aicom/aigateway/internal/model"
	"gorm.io/gorm"
)

var (
	ErrChannelNotFound      = errors.New("channel not found")
	ErrChannelAlreadyExists = errors.New("channel already exists")
	ErrNoChannelForModel    = errors.New("no channel available for model")
)

// ChannelService manages AI provider channels.
type ChannelService struct {
	db *gorm.DB
}

// NewChannelService creates a new ChannelService.
func NewChannelService(db *gorm.DB) *ChannelService {
	return &ChannelService{db: db}
}

// CreateChannel creates a new AI provider channel.
func (s *ChannelService) CreateChannel(provider, name, baseURL, apiKey, models string) (*model.AIChannel, error) {
	channel := &model.AIChannel{
		Name:     name,
		Provider: provider,
		BaseURL:  baseURL,
		APIKey:   apiKey,
		Models:   models,
		Weight:   1,
		Status:   model.ChannelStatusActive,
		Priority: 0,
	}

	if err := s.db.Create(channel).Error; err != nil {
		return nil, err
	}

	return channel, nil
}

// GetChannel retrieves a channel by ID.
func (s *ChannelService) GetChannel(id uint) (*model.AIChannel, error) {
	var channel model.AIChannel
	if err := s.db.First(&channel, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrChannelNotFound
		}
		return nil, err
	}
	return &channel, nil
}

// ListChannels returns all channels.
func (s *ChannelService) ListChannels() ([]model.AIChannel, error) {
	var channels []model.AIChannel
	if err := s.db.Find(&channels).Error; err != nil {
		return nil, err
	}
	return channels, nil
}

// UpdateChannel updates a channel with the given fields.
func (s *ChannelService) UpdateChannel(id uint, updates map[string]interface{}) error {
	result := s.db.Model(&model.AIChannel{}).Where("id = ?", id).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrChannelNotFound
	}
	return nil
}

// DeleteChannel soft-deletes a channel by ID.
func (s *ChannelService) DeleteChannel(id uint) error {
	result := s.db.Delete(&model.AIChannel{}, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrChannelNotFound
	}
	return nil
}

// SelectChannelForModel selects an available channel for a specific model.
// It uses priority-based selection with weight-based load balancing.
func (s *ChannelService) SelectChannelForModel(modelName string) (*model.AIChannel, error) {
	var channels []model.AIChannel


	err := s.db.Where("status = ?", model.ChannelStatusActive).
		Where("models LIKE ?", "%"+modelName+"%").
		Order("priority DESC, weight DESC").
		Find(&channels).Error

	if err != nil {
		return nil, err
	}

	if len(channels) == 0 {
		return nil, ErrNoChannelForModel
	}


	var available []model.AIChannel
	for _, ch := range channels {
		if ch.CanUse() {
			available = append(available, ch)
		}
	}

	if len(available) == 0 {
		return nil, ErrNoChannelForModel
	}



	return &available[0], nil
}

// GetChannelsByProvider returns all channels for a specific provider.
func (s *ChannelService) GetChannelsByProvider(provider string) ([]model.AIChannel, error) {
	var channels []model.AIChannel
	if err := s.db.Where("provider = ?", provider).Find(&channels).Error; err != nil {
		return nil, err
	}
	return channels, nil
}

// GetActiveChannels returns all active channels.
func (s *ChannelService) GetActiveChannels() ([]model.AIChannel, error) {
	var channels []model.AIChannel
	if err := s.db.Where("status = ?", model.ChannelStatusActive).Find(&channels).Error; err != nil {
		return nil, err
	}
	return channels, nil
}

// IncrementFailedCount increments the failed count for a channel.
func (s *ChannelService) IncrementFailedCount(id uint) error {
	return s.db.Model(&model.AIChannel{}).Where("id = ?", id).
		UpdateColumn("failed_count", gorm.Expr("failed_count + 1")).Error
}

// ResetFailedCount resets the failed count for a channel.
func (s *ChannelService) ResetFailedCount(id uint) error {
	return s.db.Model(&model.AIChannel{}).Where("id = ?", id).
		Update("failed_count", 0).Error
}

// SupportsModel checks if a channel supports a specific model.
func SupportsModel(channel *model.AIChannel, modelName string) bool {
	models := strings.Split(channel.Models, ",")
	for _, m := range models {
		if strings.TrimSpace(m) == modelName {
			return true
		}
	}
	return false
}