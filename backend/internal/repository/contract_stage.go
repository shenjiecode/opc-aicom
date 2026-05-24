package repository

import (
	"github.com/opc-aicom/backend/internal/model"
	"gorm.io/gorm"
)

// ContractStageRepository handles contract_stage database operations.
type ContractStageRepository struct {
	db *gorm.DB
}

// NewContractStageRepository creates a new ContractStageRepository.
func NewContractStageRepository(db *gorm.DB) *ContractStageRepository {
	return &ContractStageRepository{db: db}
}

// Create creates a new contract stage.
func (r *ContractStageRepository) Create(stage *model.ContractStage) error {
	return r.db.Create(stage).Error
}

// GetByID retrieves a contract stage by ID.
func (r *ContractStageRepository) GetByID(id uint) (*model.ContractStage, error) {
	var stage model.ContractStage
	err := r.db.First(&stage, id).Error
	if err != nil {
		return nil, err
	}
	return &stage, nil
}

// GetByContractID retrieves all stages for a contract.
func (r *ContractStageRepository) GetByContractID(contractID uint) ([]*model.ContractStage, error) {
	var stages []*model.ContractStage
	err := r.db.Where("contract_id = ?", contractID).Order("created_at ASC").Find(&stages).Error
	return stages, err
}

// GetAll retrieves all contract stages.
func (r *ContractStageRepository) GetAll() ([]*model.ContractStage, error) {
	var stages []*model.ContractStage
	err := r.db.Find(&stages).Error
	return stages, err
}

// Update updates a contract stage.
func (r *ContractStageRepository) Update(stage *model.ContractStage) error {
	return r.db.Save(stage).Error
}

// Delete soft deletes a contract stage.
func (r *ContractStageRepository) Delete(id uint) error {
	return r.db.Delete(&model.ContractStage{}, id).Error
}
