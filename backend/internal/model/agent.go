package model

import (
	"time"

	"gorm.io/gorm"
)

// Agent represents an AI agent in the system.
type Agent struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	UserID   uint           `gorm:"not null;index" json:"user_id"`
	Name     string         `gorm:"size:255;not null" json:"name"`
	Status   string         `gorm:"size:50;default:'active'" json:"status"`
	CreatedAt time.Time    `json:"created_at"`
	UpdatedAt time.Time    `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name for GORM.
func (Agent) TableName() string {
	return "agents"
}