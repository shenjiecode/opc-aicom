package repository

import (
	"github.com/opc-aicom/backend/internal/model"
	"gorm.io/gorm"
)

// ContractRepository handles contract database operations.
type ContractRepository struct {
	db *gorm.DB
}

// NewContractRepository creates a new ContractRepository.
func NewContractRepository(db *gorm.DB) *ContractRepository {
	return &ContractRepository{db: db}
}

// Create creates a new contract.
func (r *ContractRepository) Create(contract *model.Contract) error {
	return r.db.Create(contract).Error
}

// GetByID retrieves a contract by ID.
func (r *ContractRepository) GetByID(id uint) (*model.Contract, error) {
	var contract model.Contract
	err := r.db.First(&contract, id).Error
	if err != nil {
		return nil, err
	}
	return &contract, nil
}

// GetByTask retrieves a contract by task ID.
func (r *ContractRepository) GetByTask(taskID uint) (*model.Contract, error) {
	var contract model.Contract
	err := r.db.Where("task_id = ?", taskID).First(&contract).Error
	if err != nil {
		return nil, err
	}
	return &contract, nil
}

// GetAll retrieves all contracts.
func (r *ContractRepository) GetAll() ([]*model.Contract, error) {
	var contracts []*model.Contract
	err := r.db.Find(&contracts).Error
	return contracts, err
}

// GetByUser retrieves contracts by user ID (as publisher or agent).
func (r *ContractRepository) GetByUser(userID uint) ([]*model.Contract, error) {
	var contracts []*model.Contract
	err := r.db.Where("publisher_id = ? OR agent_id = ?", userID, userID).Find(&contracts).Error
	return contracts, err
}

// Update updates a contract.
func (r *ContractRepository) Update(contract *model.Contract) error {
	return r.db.Save(contract).Error
}

// Delete soft deletes a contract.
func (r *ContractRepository) Delete(id uint) error {
	return r.db.Delete(&model.Contract{}, id).Error
}
