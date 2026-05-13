package model

import (
	"time"

	"gorm.io/gorm"
)

type Service struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Title       string         `gorm:"not null;size:255" json:"title"`
	Subtitle    string         `gorm:"size:255" json:"subtitle"`
	Description string         `gorm:"type:text" json:"description"`
	Tags        string         `gorm:"type:text" json:"tags"` // JSON array string
	Status      string         `gorm:"size:50;index" json:"status"` // "内测中" or "已上线"
	ThemeColor  string         `gorm:"size:100" json:"theme_color"` // tailwind gradient classes
	IconEmoji   string         `gorm:"size:50" json:"icon_emoji"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (Service) TableName() string {
	return "services"
}