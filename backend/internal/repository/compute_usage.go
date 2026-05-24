package repository

import (
	"github.com/opc-aicom/backend/internal/model"
	"gorm.io/gorm"
)

// ComputeUsageRepository handles compute_usage database operations.
type ComputeUsageRepository struct {
	db *gorm.DB
}

// NewComputeUsageRepository creates a new ComputeUsageRepository.
func NewComputeUsageRepository(db *gorm.DB) *ComputeUsageRepository {
	return &ComputeUsageRepository{db: db}
}

// Create creates a new compute usage record.
func (r *ComputeUsageRepository) Create(usage *model.ComputeUsage) error {
	return r.db.Create(usage).Error
}

// GetByID retrieves a compute usage by ID.
func (r *ComputeUsageRepository) GetByID(id uint) (*model.ComputeUsage, error) {
	var usage model.ComputeUsage
	err := r.db.First(&usage, id).Error
	if err != nil {
		return nil, err
	}
	return &usage, nil
}

// GetByUser retrieves compute usage records by user ID.
func (r *ComputeUsageRepository) GetByUser(userID uint) ([]*model.ComputeUsage, error) {
	var usages []*model.ComputeUsage
	err := r.db.Where("user_id = ?", userID).Order("created_at DESC").Find(&usages).Error
	return usages, err
}

// GetAll retrieves all compute usage records.
func (r *ComputeUsageRepository) GetAll() ([]*model.ComputeUsage, error) {
	var usages []*model.ComputeUsage
	err := r.db.Find(&usages).Error
	return usages, err
}

// Update updates a compute usage record.
func (r *ComputeUsageRepository) Update(usage *model.ComputeUsage) error {
	return r.db.Save(usage).Error
}

// Delete soft deletes a compute usage record.
func (r *ComputeUsageRepository) Delete(id uint) error {
	return r.db.Delete(&model.ComputeUsage{}, id).Error
}