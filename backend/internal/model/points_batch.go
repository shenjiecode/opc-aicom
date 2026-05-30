package model

import (
	"time"

	"gorm.io/gorm"
)

// PointsSource represents the source of points allocation.
type PointsSource string

const (
	// PointsSourceAdminAllocate represents admin-allocated points.
	PointsSourceAdminAllocate PointsSource = "admin_allocate"
	// PointsSourceTaskReward represents task reward points.
	PointsSourceTaskReward PointsSource = "task_reward"
)

// PointsStatus represents the status of a points batch.
type PointsStatus string

const (
	// PointsStatusActive means the points are available to use.
	PointsStatusActive PointsStatus = "active"
	// PointsStatusExpired means the points have expired.
	PointsStatusExpired PointsStatus = "expired"
	// PointsStatusUsed means the points have been fully used.
	PointsStatusUsed PointsStatus = "used"
)

// PointsBatch represents a batch of points with FIFO expiry tracking.
// Each batch has its own expiration time for FIFO (First In, First Out) consumption.
type PointsBatch struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	UserID    uint           `gorm:"index;not null" json:"user_id"`
	Points    int            `gorm:"not null" json:"points"`
	Source    PointsSource   `gorm:"type:varchar(20);not null" json:"source"`
	ExpiresAt time.Time      `gorm:"not null" json:"expires_at"`
	Status    PointsStatus   `gorm:"type:varchar(20);not null;default:active" json:"status"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name for GORM.
func (PointsBatch) TableName() string {
	return "points_batches"
}
