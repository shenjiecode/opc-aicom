package model

import (
	"time"

	"gorm.io/gorm"
)

// APIEndpoint represents an API endpoint in the gateway
type APIEndpoint struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Name        string         `gorm:"size:255;not null" json:"name"`
	Path        string         `gorm:"size:255;not null;uniqueIndex" json:"path"`
	Method      string         `gorm:"size:10;not null" json:"method"` // GET, POST, etc.
	Status      string         `gorm:"default:active" json:"status"`   // active, disabled, deprecated
	QPSLimit    int            `gorm:"default:1000" json:"qps_limit"`
	Description string         `gorm:"type:text" json:"description"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name for GORM
func (APIEndpoint) TableName() string {
	return "api_endpoints"
}

// APIKey represents an API key for gateway access
type APIKey struct {
	ID         uint           `gorm:"primaryKey" json:"id"`
	KeyID      string         `gorm:"size:64;uniqueIndex;not null" json:"key_id"` // unique key identifier
	CreatorID  uint           `gorm:"not null;index" json:"creator_id"`
	Permission string         `gorm:"size:50;default:full" json:"permission"` // full, read, write
	Status     string         `gorm:"default:active" json:"status"`           // active, revoked
	ExpiresAt  *time.Time     `json:"expires_at"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name for GORM
func (APIKey) TableName() string {
	return "api_keys"
}