package model

import (
	"time"

	"gorm.io/gorm"
)

// Post represents a post in the system.
type Post struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	UserID        uint           `gorm:"not null;index" json:"user_id"`
	Title         string         `gorm:"not null" json:"title"`
	Excerpt       string         `gorm:"size:500" json:"excerpt"`
	Content       string         `gorm:"type:text;not null" json:"content"`
	Tags          string         `gorm:"size:255" json:"tags"`
	Badge         string         `gorm:"size:50" json:"badge"`
	Views         int            `gorm:"default:0" json:"views"`
	LikesCount    int            `gorm:"default:0" json:"likes_count"`
	CommentsCount int            `gorm:"default:0" json:"comments_count"`
	Shares        int            `gorm:"default:0" json:"shares"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name for GORM.
func (Post) TableName() string {
	return "posts"
}
