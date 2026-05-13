package model

import (
	"time"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// OrderStatus represents the status of an order.
type OrderStatus string

const (
	OrderStatusPending   OrderStatus = "pending"
	OrderStatusPaid      OrderStatus = "paid"
	OrderStatusCompleted OrderStatus = "completed"
)

// Order represents an order in the system.
type Order struct {
	ID        uint            `gorm:"primaryKey" json:"id"`
	UserID    uint            `gorm:"not null;index" json:"user_id"`
	TaskID    uint            `gorm:"not null;index" json:"task_id"`
	Amount    decimal.Decimal `gorm:"type:decimal(10,2);not null" json:"amount"`
	Status    OrderStatus     `gorm:"type:varchar(20);default:pending" json:"status"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
	DeletedAt gorm.DeletedAt  `gorm:"index" json:"-"`

	// Relations
	User User `gorm:"foreignKey:UserID" json:"-"`
	Task Task `gorm:"foreignKey:TaskID" json:"-"`
}

// TableName specifies the table name for GORM.
func (Order) TableName() string {
	return "orders"
}
