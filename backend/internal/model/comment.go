package model

import (
	"time"

	"gorm.io/gorm"
)

// Comment represents a comment on a post in the system.
type Comment struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	PostID    uint           `gorm:"not null;index" json:"post_id"`
	UserID    uint           `gorm:"not null;index" json:"user_id"`
	Content   string         `gorm:"type:text;not null" json:"content"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name for GORM.
func (Comment) TableName() string {
	return "comments"
}
