package model

import (
	"time"

	"gorm.io/gorm"
)

// Event represents a community event.
type Event struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Title       string         `gorm:"not null" json:"title"`
	Description string         `gorm:"type:text" json:"description"`
	CoverImage  string         `gorm:"size:255" json:"cover_image"`
	StartTime   time.Time      `json:"start_time"`
	EndTime     time.Time      `json:"end_time"`
	Location    string         `gorm:"size:255" json:"location"`
	Category    string         `gorm:"size:50;index" json:"category"`
	Tags        string         `gorm:"size:255" json:"tags"` // JSON string
	Badge       string         `gorm:"size:50" json:"badge"`
	Status      string         `gorm:"size:50" json:"status"` // e.g., 报名中, 即将开始
	JoinedCount int            `gorm:"default:0" json:"joined_count"`
	LimitCount  int            `gorm:"default:0" json:"limit_count"`
	IsFeatured  bool           `gorm:"default:false" json:"is_featured"`
	ThemeColor  string         `gorm:"size:50" json:"theme_color"` // For card gradients
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name for GORM.
func (Event) TableName() string {
	return "events"
}
