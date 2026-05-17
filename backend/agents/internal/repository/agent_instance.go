package repository

import (
	"github.com/opc-aicom/backend/agents/internal/model"
	"gorm.io/gorm"
)

type AgentInstanceRepository struct {
	db *gorm.DB
}

func NewAgentInstanceRepository(db *gorm.DB) *AgentInstanceRepository {
	return &AgentInstanceRepository{db: db}
}

func (r *AgentInstanceRepository) Create(instance *model.AgentInstance) error {
	return r.db.Create(instance).Error
}

func (r *AgentInstanceRepository) GetByID(id uint) (*model.AgentInstance, error) {
	var instance model.AgentInstance
	err := r.db.First(&instance, id).Error
	if err != nil {
		return nil, err
	}
	return &instance, nil
}

func (r *AgentInstanceRepository) GetByContainerName(name string) (*model.AgentInstance, error) {
	var instance model.AgentInstance
	err := r.db.Where("container_name = ?", name).First(&instance).Error
	if err != nil {
		return nil, err
	}
	return &instance, nil
}

func (r *AgentInstanceRepository) GetBySessionID(sessionID uint) (*model.AgentInstance, error) {
	var instance model.AgentInstance
	err := r.db.Where("session_id = ?", sessionID).First(&instance).Error
	if err != nil {
		return nil, err
	}
	return &instance, nil
}

func (r *AgentInstanceRepository) ListByUserID(userID uint, offset, limit int) ([]model.AgentInstance, int64, error) {
	var instances []model.AgentInstance
	var total int64

	query := r.db.Model(&model.AgentInstance{}).Where("user_id = ?", userID)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&instances).Error
	return instances, total, err
}

func (r *AgentInstanceRepository) Update(instance *model.AgentInstance) error {
	return r.db.Save(instance).Error
}

func (r *AgentInstanceRepository) UpdateStatus(id uint, status string, healthStatus string) error {
	updates := map[string]interface{}{
		"status": status,
	}
	if healthStatus != "" {
		updates["health_status"] = healthStatus
	}
	return r.db.Model(&model.AgentInstance{}).Where("id = ?", id).Updates(updates).Error
}

func (r *AgentInstanceRepository) UpdateContainerInfo(id uint, containerID, containerName string) error {
	return r.db.Model(&model.AgentInstance{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"container_id":   containerID,
			"container_name": containerName,
		}).Error
}

func (r *AgentInstanceRepository) IncrementRuns(id uint, success bool) error {
	field := "failed_runs"
	if success {
		field = "success_runs"
	}
	return r.db.Model(&model.AgentInstance{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"total_runs": gorm.Expr("total_runs + 1"),
			field:        gorm.Expr(field + " + 1"),
		}).Error
}

func (r *AgentInstanceRepository) Delete(id uint) error {
	return r.db.Delete(&model.AgentInstance{}, id).Error
}
