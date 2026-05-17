package repository

import (
	"github.com/opc-aicom/backend/internal/model"
	"gorm.io/gorm"
)

type AgentBabaSessionRepository struct {
	db *gorm.DB
}

func NewAgentBabaSessionRepository(db *gorm.DB) *AgentBabaSessionRepository {
	return &AgentBabaSessionRepository{db: db}
}

func (r *AgentBabaSessionRepository) Create(session *model.AgentBabaSession) error {
	return r.db.Create(session).Error
}

func (r *AgentBabaSessionRepository) GetByID(id uint) (*model.AgentBabaSession, error) {
	var session model.AgentBabaSession
	err := r.db.First(&session, id).Error
	if err != nil {
		return nil, err
	}
	return &session, nil
}

func (r *AgentBabaSessionRepository) GetByUserID(userID uint, offset, limit int) ([]model.AgentBabaSession, int64, error) {
	var sessions []model.AgentBabaSession
	var total int64

	query := r.db.Model(&model.AgentBabaSession{}).Where("user_id = ?", userID)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&sessions).Error
	return sessions, total, err
}

func (r *AgentBabaSessionRepository) Update(session *model.AgentBabaSession) error {
	return r.db.Save(session).Error
}

func (r *AgentBabaSessionRepository) UpdateStatus(id uint, status string, currentStep int) error {
	return r.db.Model(&model.AgentBabaSession{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"status":       status,
			"current_step": currentStep,
		}).Error
}

func (r *AgentBabaSessionRepository) Delete(id uint) error {
	return r.db.Delete(&model.AgentBabaSession{}, id).Error
}
