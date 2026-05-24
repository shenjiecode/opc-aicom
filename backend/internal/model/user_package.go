package model

import (
	"time"

	"gorm.io/gorm"
)

// UserPackageStatus represents the status of a user's purchased package.
type UserPackageStatus string

const (
	UserPackageStatusActive   UserPackageStatus = "active"
	UserPackageStatusExpired UserPackageStatus = "expired"
	UserPackageStatusUsed    UserPackageStatus = "used"
)

// UserPackage represents a user's purchased compute package.
type UserPackage struct {
	ID              uint              `gorm:"primaryKey" json:"id"`
	UserID          uint              `gorm:"not null;index" json:"user_id"`
	PackageID       uint              `gorm:"not null" json:"package_id"`
	PackageName     string            `gorm:"size:255;not null" json:"package_name"`
	PackageType     ComputePackageType `gorm:"type:varchar(20);not null" json:"package_type"`
	Credits         int               `gorm:"not null" json:"credits"`               // Total credits purchased
	RemainingCredits int              `gorm:"not null" json:"remaining_credits"`     // Remaining credits
	DurationDays    int               `gorm:"not null" json:"duration_days"`        // Validity period in days
	ExpiresAt       time.Time         `gorm:"not null" json:"expires_at"`          // Expiration time
	Status          UserPackageStatus `gorm:"type:varchar(20);default:active" json:"status"`
	CreatedAt       time.Time         `json:"created_at"`
	UpdatedAt       time.Time         `json:"updated_at"`
	DeletedAt       gorm.DeletedAt    `gorm:"index" json:"-"`

	// Relations
	Package ComputePackage `gorm:"foreignKey:PackageID" json:"-"`
}

// TableName specifies the table name for GORM.
func (UserPackage) TableName() string {
	return "user_packages"
}
