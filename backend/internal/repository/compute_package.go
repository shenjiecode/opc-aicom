package repository

import (
	"github.com/opc-aicom/backend/internal/model"
	"gorm.io/gorm"
)

// ComputePackageRepository handles compute_package database operations.
type ComputePackageRepository struct {
	db *gorm.DB
}

// NewComputePackageRepository creates a new ComputePackageRepository.
func NewComputePackageRepository(db *gorm.DB) *ComputePackageRepository {
	return &ComputePackageRepository{db: db}
}

// Create creates a new compute package.
func (r *ComputePackageRepository) Create(pkg *model.ComputePackage) error {
	return r.db.Create(pkg).Error
}

// GetByID retrieves a compute package by ID.
func (r *ComputePackageRepository) GetByID(id uint) (*model.ComputePackage, error) {
	var pkg model.ComputePackage
	err := r.db.First(&pkg, id).Error
	if err != nil {
		return nil, err
	}
	return &pkg, nil
}

// GetActive retrieves all active compute packages.
func (r *ComputePackageRepository) GetActive() ([]*model.ComputePackage, error) {
	var packages []*model.ComputePackage
	err := r.db.Where("status = ?", model.ComputePackageStatusActive).Order("sort_order ASC").Find(&packages).Error
	return packages, err
}

// GetAll retrieves all compute packages.
func (r *ComputePackageRepository) GetAll() ([]*model.ComputePackage, error) {
	var packages []*model.ComputePackage
	err := r.db.Find(&packages).Error
	return packages, err
}

// Update updates a compute package.
func (r *ComputePackageRepository) Update(pkg *model.ComputePackage) error {
	return r.db.Save(pkg).Error
}

// Delete soft deletes a compute package.
func (r *ComputePackageRepository) Delete(id uint) error {
	return r.db.Delete(&model.ComputePackage{}, id).Error
}
