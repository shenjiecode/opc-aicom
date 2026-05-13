package model

import (
	"time"

	"gorm.io/gorm"
)

// Resource represents an AI Resource (IP or Expert)
type Resource struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Title       string         `gorm:"not null;size:255" json:"title"`
	Category    string         `gorm:"not null;size:100;index" json:"category"`
	Description string         `gorm:"type:text" json:"description"`
	IconEmoji   string         `gorm:"size:50" json:"icon_emoji"`
	IconBgColor string         `gorm:"size:50" json:"icon_bg_color"`
	IconColor   string         `gorm:"size:50" json:"icon_color"`
	Publisher   string         `gorm:"size:100" json:"publisher"`
	Rating      float64        `gorm:"type:decimal(3,1);default:5.0" json:"rating"`
	AuthCount   int            `gorm:"default:0" json:"auth_count"`
	Price       int            `gorm:"default:0" json:"price"` // in points
	Type        string         `gorm:"not null;size:50;index;default:'ip'" json:"type"` // "ip" or "expert"
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (Resource) TableName() string {
	return "resources"
}