package service

import (
	"errors"

	"github.com/opc-aicom/aigateway/internal/model"
	"github.com/opc-aicom/aigateway/internal/provider"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

var (
	ErrModelNotFound      = errors.New("model not found")
	ErrModelAlreadyExists = errors.New("model already exists")
)

type ModelService struct {
	db *gorm.DB
}

func NewModelService(db *gorm.DB) *ModelService {
	return &ModelService{db: db}
}

func (s *ModelService) CreateModel(name, provider string, channelID uint, inputPrice, outputPrice decimal.Decimal, maxTokens int) (*model.AIModel, error) {
	m := &model.AIModel{
		Name:        name,
		Provider:    provider,
		ChannelID:   channelID,
		InputPrice:  inputPrice,
		OutputPrice: outputPrice,
		MaxTokens:   maxTokens,
		Status:      model.ModelStatusActive,
	}
	if err := s.db.Create(m).Error; err != nil {
		return nil, err
	}
	return m, nil
}

func (s *ModelService) GetModel(id uint) (*model.AIModel, error) {
	var m model.AIModel
	if err := s.db.First(&m, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrModelNotFound
		}
		return nil, err
	}
	return &m, nil
}

func (s *ModelService) ListModels() ([]model.AIModel, error) {
	var models []model.AIModel
	if err := s.db.Find(&models).Error; err != nil {
		return nil, err
	}
	return models, nil
}

func (s *ModelService) UpdateModel(id uint, updates map[string]interface{}) error {
	result := s.db.Model(&model.AIModel{}).Where("id = ?", id).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrModelNotFound
	}
	return nil
}

func (s *ModelService) DeleteModel(id uint) error {
	result := s.db.Delete(&model.AIModel{}, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrModelNotFound
	}
	return nil
}

func (s *ModelService) GetModelsByChannelID(channelID uint) ([]model.AIModel, error) {
	var models []model.AIModel
	if err := s.db.Where("channel_id = ?", channelID).Find(&models).Error; err != nil {
		return nil, err
	}
	return models, nil
}

func (s *ModelService) SyncBailianModels(channelID uint, bailianModels []provider.BailianModelItem) (int, error) {
	synced := 0
	for _, bm := range bailianModels {
		var existing model.AIModel
		err := s.db.Where("name = ?", bm.ID).First(&existing).Error
		if err == nil {
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return synced, err
		}

		m := &model.AIModel{
			Name:        bm.ID,
			Provider:    "alibaba",
			ChannelID:   channelID,
			InputPrice:  decimal.NewFromFloat(0.002),
			OutputPrice: decimal.NewFromFloat(0.006),
			MaxTokens:   32768,
			Status:      model.ModelStatusActive,
		}
		if err := s.db.Create(m).Error; err != nil {
			return synced, err
		}
		synced++
	}
	return synced, nil
}
