package model

import (
	"time"

	"gorm.io/gorm"
)

// Application represents a task application in the system.
type Application struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	TaskID    uint           `gorm:"not null;index" json:"task_id"`
	UserID    uint           `gorm:"not null;index" json:"user_id"`
	Status    string         `gorm:"not null;default:'pending'" json:"status"`
	Message   string         `json:"message"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name for GORM.
func (Application) TableName() string {
	return "applications"
}
