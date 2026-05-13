package model

import (
	"time"

	"gorm.io/gorm"
)

type Agent struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	UserID        uint           `gorm:"index" json:"user_id"`
	Name          string         `gorm:"size:255;not null" json:"name"`
	Description   string         `gorm:"size:255" json:"description"`
	Status        string         `gorm:"size:50" json:"status"` // "运行中", "空闲"
	DrivenModel   string         `gorm:"size:100" json:"driven_model"`
	KnowledgeBase string         `gorm:"size:255" json:"knowledge_base"`
	CostPerUse    float64        `gorm:"type:decimal(10,2)" json:"cost_per_use"`
	ThemeColor    string         `gorm:"size:50" json:"theme_color"` // "indigo", "amber", "teal", etc.
	IconEmoji     string         `gorm:"size:50" json:"icon_emoji"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

func (Agent) TableName() string {
	return "agents"
}