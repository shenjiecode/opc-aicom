package model

import (
	"time"

	"gorm.io/gorm"
)

// PointsOrder represents a points order transaction.
type PointsOrder struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	OrderNo       string         `gorm:"size:64;uniqueIndex;not null" json:"order_no"`
	UserID        uint           `gorm:"index;not null" json:"user_id"`
	OrderType     string         `gorm:"size:30;not null" json:"order_type"` // qoder_account, compute_recharge
	ProductID     uint           `json:"product_id"`
	ProductName  string         `gorm:"size:255" json:"product_name"`
	PointsAmount int            `gorm:"default:0" json:"points_amount"`
	CreditAmount int            `gorm:"default:0" json:"credit_amount"`
	ExchangeRate float64         `gorm:"type:decimal(10,4);default:1.0000" json:"exchange_rate"`
	Status       string         `gorm:"size:20;default:pending" json:"status"` // pending, paid, completed, cancelled, expired
	PaidAt       *time.Time     `json:"paid_at,omitempty"`
	CompletedAt  *time.Time    `json:"completed_at,omitempty"`
	CancelledAt  *time.Time    `json:"cancelled_at,omitempty"`
	ExpiresAt    *time.Time    `json:"expires_at,omitempty"`
	GatewayID    uint           `json:"gateway_id"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`

	// Relations
	User User `gorm:"foreignKey:UserID" json:"-"`
}

// TableName specifies the table name for GORM.
func (PointsOrder) TableName() string {
	return "points_orders"
}


// OrderType - Order type constants
const (
	OrderTypeQoderAccount   = "qoder_account"
	OrderTypeComputeRecharge = "compute_recharge"
)