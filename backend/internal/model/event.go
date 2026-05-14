package model

import (
	"time"

	"gorm.io/gorm"
)

// Event represents a community event.
type Event struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	UserID      uint           `gorm:"not null;index" json:"user_id"` // 创建者ID
	Title       string         `gorm:"not null" json:"title"`
	Description string         `gorm:"type:text" json:"description"`
	CoverImage  string         `gorm:"size:255" json:"cover_image"`
	StartTime   time.Time      `json:"start_time"`
	EndTime     time.Time      `json:"end_time"`
	Location    string         `gorm:"size:255" json:"location"`
	Category    string         `gorm:"size:50;index" json:"category"`
	Tags        string         `gorm:"size:255" json:"tags"` // JSON string
	Badge       string         `gorm:"size:50" json:"badge"`
	Status      string         `gorm:"size:50" json:"status"` // e.g., 报名中, 即将开始, 已结束
	JoinedCount int            `gorm:"default:0" json:"joined_count"`
	LimitCount  int            `gorm:"default:0" json:"limit_count"`
	IsFeatured  bool           `gorm:"default:false" json:"is_featured"`
	ThemeColor  string         `gorm:"size:50" json:"theme_color"` // For card gradients
	ShareCode   string         `gorm:"size:32;uniqueIndex" json:"share_code"` // 分享码，用于生成二维码
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name for GORM.
func (Event) TableName() string {
	return "events"
}

// EventRegistration represents a user's registration for an event.
type EventRegistration struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	EventID   uint           `gorm:"not null;index" json:"event_id"`
	UserID    uint           `gorm:"not null;index" json:"user_id"`
	Status    string         `gorm:"size:20;default:'registered'" json:"status"` // registered, cancelled, attended
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name for GORM.
func (EventRegistration) TableName() string {
	return "event_registrations"
}

