package model

import (
	"time"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// ComputeUsage represents compute resource usage records.
type ComputeUsage struct {
	ID            uint            `gorm:"primaryKey" json:"id"`
	UserID        uint            `gorm:"not null;index" json:"user_id"`
	PackageID     uint            `gorm:"not null;index" json:"package_id"`
	CreditsUsed   decimal.Decimal `gorm:"type:decimal(10,2);not null" json:"credits_used"`
	ComputeHours  float64         `gorm:"default:0" json:"compute_hours"`
	ResourceType  string          `gorm:"size:50" json:"resource_type"`  // cpu, gpu, memory, etc.
	ResourceID    uint            `gorm:"index" json:"resource_id"`       // reference to resource
	Description  string          `gorm:"size:255" json:"description"`   // usage description
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
	DeletedAt      gorm.DeletedAt  `gorm:"index" json:"-"`

	// Relations
	User     User           `gorm:"foreignKey:UserID" json:"-"`
	Package  ComputePackage `gorm:"foreignKey:PackageID" json:"-"`
}

// TableName specifies the table name for GORM.
func (ComputeUsage) TableName() string {
	return "compute_usages"
}