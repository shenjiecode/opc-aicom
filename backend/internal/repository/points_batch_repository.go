package repository

import (
	"time"

	"gorm.io/gorm"

	"github.com/opc-aicom/backend/internal/model"
)

// PointsBatchRepository handles database operations for points batches.
type PointsBatchRepository struct {
	db *gorm.DB
}

// NewPointsBatchRepository creates a new PointsBatchRepository.
func NewPointsBatchRepository(db *gorm.DB) *PointsBatchRepository {
	return &PointsBatchRepository{db: db}
}

// Create creates a new points batch.
func (r *PointsBatchRepository) Create(batch *model.PointsBatch) error {
	return r.db.Create(batch).Error
}

// Update updates a points batch.
func (r *PointsBatchRepository) Update(batch *model.PointsBatch) error {
	return r.db.Save(batch).Error
}

// GetByID retrieves a points batch by ID.
func (r *PointsBatchRepository) GetByID(id uint) (*model.PointsBatch, error) {
	var batch model.PointsBatch
	err := r.db.First(&batch, id).Error
	if err != nil {
		return nil, err
	}
	return &batch, nil
}

// GetActiveBatchesByUserID retrieves all active batches for a user, ordered by CreatedAt ASC (FIFO).
func (r *PointsBatchRepository) GetActiveBatchesByUserID(userID uint) ([]*model.PointsBatch, error) {
	var batches []*model.PointsBatch
	err := r.db.Where("user_id = ? AND status = ?", userID, model.PointsStatusActive).
		Order("created_at ASC").
		Find(&batches).Error
	if err != nil {
		return nil, err
	}
	return batches, nil
}

// GetExpiringBatches retrieves batches that will expire within the specified number of days.
func (r *PointsBatchRepository) GetExpiringBatches(userID uint, daysBeforeExpiry int) ([]*model.PointsBatch, error) {
	now := time.Now()
	expiryThreshold := now.AddDate(0, 0, daysBeforeExpiry)

	var batches []*model.PointsBatch
	err := r.db.Where("user_id = ? AND status = ? AND expires_at <= ? AND expires_at > ?",
		userID, model.PointsStatusActive, expiryThreshold, now).
		Order("expires_at ASC").
		Find(&batches).Error
	if err != nil {
		return nil, err
	}
	return batches, nil
}

// GetDB returns the underlying database connection for transaction support.
func (r *PointsBatchRepository) GetDB() *gorm.DB {
	return r.db
}
