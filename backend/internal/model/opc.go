package model

import (
	"time"

	"gorm.io/gorm"
)

// OPC represents an OPC (Open Computing Provider) in the system.
type OPC struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	Name         string         `gorm:"size:255;not null" json:"name"`
	ContactName  string         `gorm:"size:255" json:"contact_name"`
	ContactEmail string         `gorm:"size:255" json:"contact_email"`
	ContactPhone string         `gorm:"size:50" json:"contact_phone"`
	Status       string         `gorm:"default:pending" json:"status"` // pending, active, suspended
	ComputeQuota int            `gorm:"default:0" json:"compute_quota"` // GPU hours
	ComputeUsed  int            `gorm:"default:0" json:"compute_used"`
	Description  string         `gorm:"type:text" json:"description"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name for GORM.
func (OPC) TableName() string {
	return "opcs"
}
