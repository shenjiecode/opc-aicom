package model

import (
	"time"

	"gorm.io/gorm"
)

// UserAsset represents user assets/points in the system.
type UserAsset struct {
	ID              uint           `gorm:"primaryKey" json:"id"`
	UserID          uint           `gorm:"uniqueIndex;not null" json:"user_id"`
	Points          int            `gorm:"default:0" json:"points"`
	Coupons         int            `gorm:"default:0" json:"coupons"`
	CouponsExpiring int            `gorm:"default:0" json:"coupons_expiring"`
	ComputeHours    float64        `gorm:"default:0" json:"compute_hours"`
	ComputeGPU      float64        `gorm:"default:0" json:"compute_gpu"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`

	// Relations
	User User `gorm:"foreignKey:UserID" json:"-"`
}

// TableName specifies the table name for GORM.
func (UserAsset) TableName() string {
	return "user_assets"
}