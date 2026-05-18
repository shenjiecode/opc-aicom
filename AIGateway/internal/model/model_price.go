package model

import (
	"time"

	"github.com/shopspring/decimal"
)

// AIModelPrice represents billing ratios for AI models.
type AIModelPrice struct {
	ID          uint            `gorm:"primaryKey" json:"id"`
	Model       string          `gorm:"size:100;not null;uniqueIndex" json:"model"`                // Model name
	InputRatio  decimal.Decimal `gorm:"type:decimal(10,4);not null;default:1" json:"input_ratio"`  // Billing ratio for input
	OutputRatio decimal.Decimal `gorm:"type:decimal(10,4);not null;default:1" json:"output_ratio"` // Billing ratio for output
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

// TableName specifies the table name for GORM.
func (AIModelPrice) TableName() string {
	return "ai_model_prices"
}
