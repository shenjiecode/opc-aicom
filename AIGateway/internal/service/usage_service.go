package service

import (
	"crypto/rand"
	"encoding/hex"
	"time"

	"github.com/opc-aicom/aigateway/internal/model"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// UsageSummary represents aggregated usage statistics.
type UsageSummary struct {
	TotalPromptTokens     int
	TotalCompletionTokens int
	TotalTokens           int
	TotalCost             decimal.Decimal
	RequestCount          int
	SuccessCount          int
	FailedCount           int
}

// UsageService manages token usage tracking.
type UsageService struct {
	db *gorm.DB
}

// NewUsageService creates a new UsageService.
func NewUsageService(db *gorm.DB) *UsageService {
	return &UsageService{db: db}
}

// RecordUsage records a token usage log entry.
func (s *UsageService) RecordUsage(virtualKeyID, channelID uint, modelName string, promptTokens, completionTokens int, cost decimal.Decimal) error {
	requestID, err := generateRequestID()
	if err != nil {
		return err
	}

	log := &model.AITokenLog{
		VirtualKeyID:     virtualKeyID,
		ChannelID:        channelID,
		Model:            modelName,
		PromptTokens:     promptTokens,
		CompletionTokens: completionTokens,
		TotalTokens:      promptTokens + completionTokens,
		Cost:             cost,
		RequestID:        requestID,
		Status:           model.TokenLogStatusSuccess,
	}

	if err := s.db.Create(log).Error; err != nil {
		return err
	}

	return s.db.Model(&model.AIVirtualKey{}).Where("id = ?", virtualKeyID).
		UpdateColumn("used_quota", gorm.Expr("used_quota + ?", promptTokens+completionTokens)).Error
}

// RecordFailedUsage records a failed request.
func (s *UsageService) RecordFailedUsage(virtualKeyID, channelID uint, modelName string, errorMessage string) error {
	requestID, err := generateRequestID()
	if err != nil {
		return err
	}

	log := &model.AITokenLog{
		VirtualKeyID: virtualKeyID,
		ChannelID:    channelID,
		Model:        modelName,
		RequestID:    requestID,
		Status:       model.TokenLogStatusFailed,
		ErrorMessage: errorMessage,
	}

	return s.db.Create(log).Error
}

// GetUserUsage returns usage summary for a user within a time range.
func (s *UsageService) GetUserUsage(userID uint, startTime, endTime time.Time) (*UsageSummary, error) {
	var summary UsageSummary

	err := s.db.Model(&model.AITokenLog{}).
		Select(`
			COALESCE(SUM(prompt_tokens), 0) as total_prompt_tokens,
			COALESCE(SUM(completion_tokens), 0) as total_completion_tokens,
			COALESCE(SUM(total_tokens), 0) as total_tokens,
			COALESCE(SUM(cost), 0) as total_cost,
			COUNT(*) as request_count,
			SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
			SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
		`).
		Joins("JOIN ai_virtual_keys ON ai_virtual_keys.id = ai_token_logs.virtual_key_id").
		Where("ai_virtual_keys.user_id = ?", userID).
		Where("ai_token_logs.created_at >= ? AND ai_token_logs.created_at <= ?", startTime, endTime).
		Scan(&summary).Error

	if err != nil {
		return nil, err
	}

	return &summary, nil
}

// GetKeyUsage returns usage summary for a specific key within a time range.
func (s *UsageService) GetKeyUsage(keyID uint, startTime, endTime time.Time) (*UsageSummary, error) {
	var summary UsageSummary

	err := s.db.Model(&model.AITokenLog{}).
		Select(`
			COALESCE(SUM(prompt_tokens), 0) as total_prompt_tokens,
			COALESCE(SUM(completion_tokens), 0) as total_completion_tokens,
			COALESCE(SUM(total_tokens), 0) as total_tokens,
			COALESCE(SUM(cost), 0) as total_cost,
			COUNT(*) as request_count,
			SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
			SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
		`).
		Where("virtual_key_id = ?", keyID).
		Where("created_at >= ? AND created_at <= ?", startTime, endTime).
		Scan(&summary).Error

	if err != nil {
		return nil, err
	}

	return &summary, nil
}

// GetModelUsage returns usage summary for a specific model within a time range.
func (s *UsageService) GetModelUsage(modelName string, startTime, endTime time.Time) (*UsageSummary, error) {
	var summary UsageSummary

	err := s.db.Model(&model.AITokenLog{}).
		Select(`
			COALESCE(SUM(prompt_tokens), 0) as total_prompt_tokens,
			COALESCE(SUM(completion_tokens), 0) as total_completion_tokens,
			COALESCE(SUM(total_tokens), 0) as total_tokens,
			COALESCE(SUM(cost), 0) as total_cost,
			COUNT(*) as request_count,
			SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
			SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
		`).
		Where("model = ?", modelName).
		Where("created_at >= ? AND created_at <= ?", startTime, endTime).
		Scan(&summary).Error

	if err != nil {
		return nil, err
	}

	return &summary, nil
}

// GetChannelUsage returns usage summary for a specific channel within a time range.
func (s *UsageService) GetChannelUsage(channelID uint, startTime, endTime time.Time) (*UsageSummary, error) {
	var summary UsageSummary

	err := s.db.Model(&model.AITokenLog{}).
		Select(`
			COALESCE(SUM(prompt_tokens), 0) as total_prompt_tokens,
			COALESCE(SUM(completion_tokens), 0) as total_completion_tokens,
			COALESCE(SUM(total_tokens), 0) as total_tokens,
			COALESCE(SUM(cost), 0) as total_cost,
			COUNT(*) as request_count,
			SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
			SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
		`).
		Where("channel_id = ?", channelID).
		Where("created_at >= ? AND created_at <= ?", startTime, endTime).
		Scan(&summary).Error

	if err != nil {
		return nil, err
	}

	return &summary, nil
}

// generateRequestID creates a unique request ID.
func generateRequestID() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}