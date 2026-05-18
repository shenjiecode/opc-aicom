package model

import (
	"time"

	"github.com/shopspring/decimal"
)

// ModelStatus represents the status of an AI model.
type ModelStatus string

const (
	ModelStatusActive   ModelStatus = "active"
	ModelStatusDisabled ModelStatus = "disabled"
)

// AIModel represents a model configuration for AI API access.
type AIModel struct {
	ID          uint            `gorm:"primaryKey" json:"id"`
	Name        string          `gorm:"size:100;not null;uniqueIndex" json:"name"`       // Model name like "gpt-4o"
	Provider    string          `gorm:"size:50;not null;index" json:"provider"`          // "openai", "deepseek", "anthropic"
	ChannelID   uint            `gorm:"not null;index" json:"channel_id"`                // FK to ai_channels
	InputPrice  decimal.Decimal `gorm:"type:decimal(10,6);not null" json:"input_price"`  // Price per 1K input tokens
	OutputPrice decimal.Decimal `gorm:"type:decimal(10,6);not null" json:"output_price"` // Price per 1K output tokens
	MaxTokens   int             `gorm:"not null" json:"max_tokens"`                      // Max context length
	Status      ModelStatus     `gorm:"type:varchar(20);default:active" json:"status"`   // "active", "disabled"
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`

	// Relations
	Channel AIChannel `gorm:"foreignKey:ChannelID" json:"-"`
}

// TableName specifies the table name for GORM.
func (AIModel) TableName() string {
	return "ai_models"
}
