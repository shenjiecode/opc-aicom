package repository

import (
	"gorm.io/gorm"
	"github.com/opc-aicom/backend/internal/model"
)

type AgentRepository struct {
	db *gorm.DB
}

func NewAgentRepository(db *gorm.DB) *AgentRepository {
	return &AgentRepository{db: db}
}

func (r *AgentRepository) List() ([]*model.Agent, error) {
	var agents []*model.Agent
	err := r.db.Model(&model.Agent{}).Order("id ASC").Find(&agents).Error
	if err != nil {
		return nil, err
	}
	return agents, nil
}