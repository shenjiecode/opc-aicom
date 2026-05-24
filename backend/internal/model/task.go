package model

import (
	"time"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// Task represents a task in the system.
type Task struct {
	ID              uint           `gorm:"primaryKey" json:"id"`
	UserID          uint           `gorm:"not null;index" json:"user_id"`
	Title           string         `gorm:"not null" json:"title"`
	Description     string         `json:"description"`
	Budget          float64        `gorm:"type:decimal(10,2)" json:"budget"`
	Type            string         `gorm:"not null;default:'dev'" json:"type"`
	Level           string         `gorm:"not null;default:'medium'" json:"level"`
	Status          string         `gorm:"not null;default:'open'" json:"status"`
	Urgent          bool           `gorm:"default:false" json:"urgent"`
	DurationDays    int            `gorm:"default:0" json:"duration_days"`
	Progress        int            `gorm:"default:0" json:"progress"`
	Deadline        *time.Time     `json:"deadline"`
	ApplicantsCount int            `gorm:"default:0" json:"applicants_count"`
	EscrowPoints   int            `gorm:"default:0" json:"escrow_points"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt  `gorm:"index" json:"-"`

	// Enterprise publish flow fields
	ContractID     *uint           `gorm:"index" json:"contract_id"`
	BudgetMin     decimal.Decimal `gorm:"type:decimal(10,2)" json:"budget_min"`
	BudgetMax     decimal.Decimal `gorm:"type:decimal(10,2)" json:"budget_max"`
	Priority      string          `gorm:"type:varchar(20)" json:"priority"`
	RequiredSkills string         `gorm:"type:text" json:"required_skills"`
	EstimatedDays int            `gorm:"default:0" json:"estimated_days"`
}

// TableName specifies the table name for GORM.
func (Task) TableName() string {
	return "tasks"
}

// TaskFilter defines filters for querying tasks
type TaskFilter struct {
	UserID *uint  // Filter by owner
	Type   string // Filter by type
	Level  string // Filter by level
	Status string // Filter by status
}