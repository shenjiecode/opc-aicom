package model

import (
	"time"

	"gorm.io/gorm"
)

// StageType represents the type of contract stage.
type StageType string

const (
	StageTypeSigning   StageType = "signing"
	StageTypeExecuting StageType = "executing"
	StageTypeAccepting StageType = "accepting"
	StageTypeCompleted StageType = "completed"
)

// ContractStageStatus represents the status of a contract stage.
type ContractStageStatus string

const (
	ContractStageStatusPending    ContractStageStatus = "pending"
	ContractStageStatusInProgress ContractStageStatus = "in_progress"
	ContractStageStatusCompleted  ContractStageStatus = "completed"
	ContractStageStatusFailed    ContractStageStatus = "failed"
)

// ContractStage represents a stage in a contract lifecycle.
type ContractStage struct {
	ID             uint               `gorm:"primaryKey" json:"id"`
	ContractID     uint              `gorm:"not null;index" json:"contract_id"`
	StageType      StageType         `gorm:"type:varchar(20);not null" json:"stage_type"`
	Status         ContractStageStatus `gorm:"type:varchar(20);default:pending" json:"status"`
	Description    string            `gorm:"type:text" json:"description"`
	Deliverables   string            `gorm:"type:json" json:"deliverables"`
	AIEvaluation   string            `gorm:"type:json" json:"ai_evaluation"`
	HumanDecision  string            `gorm:"type:varchar(50)" json:"human_decision"`
	StartedAt      *time.Time       `json:"started_at"`
	CompletedAt    *time.Time       `json:"completed_at"`
	CreatedAt       time.Time         `json:"created_at"`
	UpdatedAt       time.Time         `json:"updated_at"`
	DeletedAt       gorm.DeletedAt   `gorm:"index" json:"-"`

	// Relations
	Contract Contract `gorm:"foreignKey:ContractID" json:"-"`
}

// TableName specifies the table name for GORM.
func (ContractStage) TableName() string {
	return "contract_stages"
}