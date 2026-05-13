package model

import (
	"time"
)

// Like represents a like on a post in the system.
type Like struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	PostID    uint      `gorm:"not null;uniqueIndex:idx_like_post_user;index" json:"post_id"`
	UserID    uint      `gorm:"not null;uniqueIndex:idx_like_post_user" json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
}

// TableName specifies the table name for GORM.
func (Like) TableName() string {
	return "likes"
}
