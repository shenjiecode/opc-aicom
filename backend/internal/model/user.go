package model

import (
	"time"

	"gorm.io/gorm"
)

// User represents a user in the system.
type User struct {
ID           uint           `gorm:"primaryKey" json:"id"`
Username     string         `gorm:"size:255;uniqueIndex;not null" json:"username"`
PasswordHash string         `gorm:"not null" json:"-"`
Avatar       *string        `json:"avatar"`
Role         string         `gorm:"default:user" json:"role"`
Status       string         `gorm:"default:active" json:"status"` // active, banned, suspended
VipLevel     int            `gorm:"default:0" json:"vip_level"`
	VipExpiredAt *time.Time     `json:"vip_expired_at"`
	MatrixUsername string       `gorm:"size:255" json:"matrix_username"` // Matrix username for OPC-Matrix integration
LastActiveAt *time.Time     `json:"last_active_at"`
CreatedAt    time.Time      `json:"created_at"`
UpdatedAt    time.Time      `json:"updated_at"`
DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name for GORM.
func (User) TableName() string {
	return "users"
}
