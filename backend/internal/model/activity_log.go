package model

import (
	"time"

	"gorm.io/gorm"
)

// ActivityLog represents an activity log in the system.
type ActivityLog struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	UserID      uint           `gorm:"not null;index" json:"user_id"`
	Icon        string         `gorm:"size:100" json:"icon"`
	Bg          string         `gorm:"size:50" json:"bg"`
	ContentHTML string         `gorm:"type:text" json:"content_html"`
	TimeStr     string         `gorm:"size:50" json:"time_str"`
	CreatedAt   time.Time      `json:"created_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name for GORM.
func (ActivityLog) TableName() string {
	return "activity_logs"
}
