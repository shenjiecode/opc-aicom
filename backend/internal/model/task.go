package model

import (
	"time"

	"gorm.io/gorm"
)

// Task represents a task in the system.
type Task struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	UserID         uint           `gorm:"not null;index" json:"user_id"`
	Title          string         `gorm:"not null" json:"title"`
	Description   string         `json:"description"`
	Budget         float64        `gorm:"type:decimal(10,2)" json:"budget"`
	Type           string         `gorm:"not null;default:'dev'" json:"type"`
	Level          string         `gorm:"not null;default:'medium'" json:"level"`
	Status         string         `gorm:"not null;default:'open'" json:"status"`
	Urgent         bool           `gorm:"default:false" json:"urgent"`
	Progress       int            `gorm:"default:0" json:"progress"`
	Deadline       *time.Time     `json:"deadline"`
	ApplicantsCount int          `gorm:"default:0" json:"applicants_count"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name for GORM.
func (Task) TableName() string {
	return "tasks"
}

// TaskFilter defines filters for querying tasks
type TaskFilter struct {
	UserID *uint   // Filter by owner
	Type   string  // Filter by type
	Level  string  // Filter by level
	Status string  // Filter by status
}