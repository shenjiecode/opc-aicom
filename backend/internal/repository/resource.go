package repository

import (
	"gorm.io/gorm"
	"github.com/opc-aicom/backend/internal/model"
)

type ResourceRepository struct {
	db *gorm.DB
}

func NewResourceRepository(db *gorm.DB) *ResourceRepository {
	return &ResourceRepository{db: db}
}

func (r *ResourceRepository) List(page, pageSize int, resourceType string) ([]*model.Resource, int64, error) {
	var resources []*model.Resource
	var total int64

	offset := (page - 1) * pageSize
	
	query := r.db.Model(&model.Resource{})
	if resourceType != "" {
		query = query.Where("type = ?", resourceType)
	}

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&resources).Error
	if err != nil {
		return nil, 0, err
	}

	return resources, total, nil
}