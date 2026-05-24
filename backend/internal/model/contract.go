package model

import (
	"time"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// ContractStatus represents the status of a contract.
type ContractStatus string

const (
	ContractStatusSigning  ContractStatus = "signing"
	ContractStatusExecuting ContractStatus = "executing"
	ContractStatusAccepting ContractStatus = "accepting"
	ContractStatusCompleted ContractStatus = "completed"
)

// Contract represents a contract between publisher and agent for a task.
type Contract struct {
	ID            uint            `gorm:"primaryKey" json:"id"`
	TaskID        uint            `gorm:"not null;index" json:"task_id"`
	PublisherID   uint            `gorm:"not null;index" json:"publisher_id"`
	AgentID       uint            `gorm:"not null;index" json:"agent_id"`
	Status        ContractStatus  `gorm:"type:varchar(20);default:signing" json:"status"`
	TotalAmount   decimal.Decimal `gorm:"type:decimal(10,2);not null" json:"total_amount"`
	EscrowAmount  decimal.Decimal `gorm:"type:decimal(10,2);not null" json:"escrow_amount"`
	SignedAt      *time.Time      `json:"signed_at"`
	CompletedAt   *time.Time      `json:"completed_at"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt  `gorm:"index" json:"-"`

	// Relations
	Task      Task      `gorm:"foreignKey:TaskID" json:"-"`
	Publisher User      `gorm:"foreignKey:PublisherID" json:"-"`
	Agent     User      `gorm:"foreignKey:AgentID" json:"-"`
}

// TableName specifies the table name for GORM.
func (Contract) TableName() string {
	return "contracts"
}