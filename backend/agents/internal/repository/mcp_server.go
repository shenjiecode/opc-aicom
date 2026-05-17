package repository

import (
	"github.com/opc-aicom/backend/agents/internal/model"
	"gorm.io/gorm"
)

type MCPServerRepository struct {
	db *gorm.DB
}

func NewMCPServerRepository(db *gorm.DB) *MCPServerRepository {
	return &MCPServerRepository{db: db}
}

func (r *MCPServerRepository) Create(server *model.MCPServer) error {
	return r.db.Create(server).Error
}

func (r *MCPServerRepository) GetByID(id uint) (*model.MCPServer, error) {
	var server model.MCPServer
	err := r.db.First(&server, id).Error
	if err != nil {
		return nil, err
	}
	return &server, nil
}

func (r *MCPServerRepository) GetByName(name string) (*model.MCPServer, error) {
	var server model.MCPServer
	err := r.db.Where("name = ?", name).First(&server).Error
	if err != nil {
		return nil, err
	}
	return &server, nil
}

func (r *MCPServerRepository) List(offset, limit int) ([]model.MCPServer, int64, error) {
	var servers []model.MCPServer
	var total int64

	if err := r.db.Model(&model.MCPServer{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := r.db.Order("created_at DESC").Offset(offset).Limit(limit).Find(&servers).Error
	return servers, total, err
}

func (r *MCPServerRepository) ListActive() ([]model.MCPServer, error) {
	var servers []model.MCPServer
	err := r.db.Where("status = ?", model.MCPServerStatusActive).Find(&servers).Error
	return servers, err
}

func (r *MCPServerRepository) Update(server *model.MCPServer) error {
	return r.db.Save(server).Error
}

func (r *MCPServerRepository) UpdateStatus(name string, status string, errMsg string) error {
	updates := map[string]interface{}{
		"status": status,
	}
	if errMsg != "" {
		updates["error_message"] = errMsg
	}
	return r.db.Model(&model.MCPServer{}).Where("name = ?", name).Updates(updates).Error
}

func (r *MCPServerRepository) Delete(id uint) error {
	return r.db.Delete(&model.MCPServer{}, id).Error
}

func (r *MCPServerRepository) DeleteByName(name string) error {
	return r.db.Where("name = ?", name).Delete(&model.MCPServer{}).Error
}
