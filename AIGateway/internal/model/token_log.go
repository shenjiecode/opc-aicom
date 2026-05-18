package model

import (
	"time"

	"github.com/shopspring/decimal"
)

// TokenLogStatus represents the status of a token log entry.
type TokenLogStatus string

const (
	TokenLogStatusSuccess TokenLogStatus = "success"
	TokenLogStatusFailed  TokenLogStatus = "failed"
)

// AITokenLog represents a token consumption tracking record.
type AITokenLog struct {
	ID               uint            `gorm:"primaryKey" json:"id"`
	VirtualKeyID     uint            `gorm:"not null;index" json:"virtual_key_id"`           // FK to ai_virtual_keys
	ChannelID        uint            `gorm:"not null" json:"channel_id"`                     // FK to ai_channels
	Model            string          `gorm:"size:100;not null;index" json:"model"`           // Model used
	PromptTokens     int             `gorm:"not null;default:0" json:"prompt_tokens"`        // Input tokens
	CompletionTokens int             `gorm:"not null;default:0" json:"completion_tokens"`    // Output tokens
	TotalTokens      int             `gorm:"not null;default:0" json:"total_tokens"`         // Total
	Cost             decimal.Decimal `gorm:"type:decimal(10,6);not null" json:"cost"`        // Calculated cost
	RequestID        string          `gorm:"size:64;not null;uniqueIndex" json:"request_id"` // Unique request ID
	LatencyMs        int             `gorm:"not null;default:0" json:"latency_ms"`           // Response latency in milliseconds
	Status           TokenLogStatus  `gorm:"type:varchar(20);default:success" json:"status"` // "success", "failed"
	ErrorMessage     string          `gorm:"type:text" json:"error_message"`                 // Error message if failed
	CreatedAt        time.Time       `json:"created_at"`

	// Relations
	VirtualKey AIVirtualKey `gorm:"foreignKey:VirtualKeyID" json:"-"`
	Channel    AIChannel    `gorm:"foreignKey:ChannelID" json:"-"`
}

// TableName specifies the table name for GORM.
func (AITokenLog) TableName() string {
	return "ai_token_logs"
}
