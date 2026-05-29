package model

import (
	"time"

	"gorm.io/gorm"
)

// VirtualKeyStatus represents the status of a virtual API key.
type VirtualKeyStatus string

const (
	VirtualKeyStatusActive  VirtualKeyStatus = "active"
	VirtualKeyStatusRevoked VirtualKeyStatus = "revoked"
)

// AIVirtualKey represents a sub-account API key for the AI gateway.
type AIVirtualKey struct {
	ID        uint             `gorm:"primaryKey" json:"id"`
	Key       string           `gorm:"column:api_key;size:128;uniqueIndex;not null" json:"key"`       // The virtual API key (sk-xxx format)
	UserID    uint             `gorm:"not null;index" json:"user_id"`                 // OPC user ID
	Name      string           `gorm:"size:255;not null" json:"name"`                 // Key name/label
	Quota     int64            `gorm:"not null;default:0" json:"quota"`               // Token quota balance
	UsedQuota int64            `gorm:"not null;default:0" json:"used_quota"`          // Tokens used so far
	RateLimit int              `gorm:"default:60" json:"rate_limit"`                  // Requests per minute
	Status    VirtualKeyStatus `gorm:"type:varchar(20);default:active" json:"status"` // "active", "revoked"
	ExpiresAt *time.Time       `json:"expires_at"`
	CreatedAt time.Time        `json:"created_at"`
	UpdatedAt time.Time        `json:"updated_at"`
	DeletedAt gorm.DeletedAt   `gorm:"index" json:"-"`
}

// TableName specifies the table name for GORM.
func (AIVirtualKey) TableName() string {
	return "ai_virtual_keys"
}
