package repository

import (
	"gorm.io/gorm"
	"github.com/opc-aicom/backend/internal/model"
)

type ServiceRepository struct {
	db *gorm.DB
}

func NewServiceRepository(db *gorm.DB) *ServiceRepository {
	return &ServiceRepository{db: db}
}

func (r *ServiceRepository) List(status string) ([]*model.Service, error) {
	var services []*model.Service
	
	query := r.db.Model(&model.Service{})
	if status != "" && status != "全部服务" {
		query = query.Where("status = ?", status)
	}

	err := query.Order("id ASC").Find(&services).Error
	if err != nil {
		return nil, err
	}

	return services, nil
}