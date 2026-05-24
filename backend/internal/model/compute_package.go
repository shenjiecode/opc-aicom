package model

import (
	"time"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// ComputePackageType represents the type of compute package.
type ComputePackageType string

const (
	ComputePackageTypeQoder ComputePackageType = "qoder"
	ComputePackageTypeGPU  ComputePackageType = "gpu"
	ComputePackageTypeOther ComputePackageType = "other"
)

// ComputePackageStatus represents the status of a compute package.
type ComputePackageStatus string

const (
	ComputePackageStatusActive   ComputePackageStatus = "active"
	ComputePackageStatusInactive ComputePackageStatus = "inactive"
)

// ComputePackage represents a compute resource package.
type ComputePackage struct {
	ID           uint               `gorm:"primaryKey" json:"id"`
	Name         string             `gorm:"not null;size:255" json:"name"`
	Description  string             `gorm:"type:text" json:"description"`
	Type         ComputePackageType `gorm:"type:varchar(20);not null" json:"type"`
	Price        decimal.Decimal    `gorm:"type:decimal(10,2);not null" json:"price"` // 价格，积分单位
	Credits      int                `gorm:"not null" json:"credits"`                  // 额度数量
	DurationDays int                `gorm:"not null" json:"duration_days"`            // 有效期天数
	Specs        string             `gorm:"type:text" json:"specs"`                  // JSON - 规格详情如gpu_type, hours等
	Status       ComputePackageStatus `gorm:"type:varchar(20);default:active" json:"status"`
	SortOrder    int                `gorm:"not null;default:0" json:"sort_order"` // 排序
	CreatedAt    time.Time          `json:"created_at"`
	UpdatedAt    time.Time          `json:"updated_at"`
	DeletedAt    gorm.DeletedAt     `gorm:"index" json:"-"`
}

// TableName specifies the table name for GORM.
func (ComputePackage) TableName() string {
	return "compute_packages"
}
