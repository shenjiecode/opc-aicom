package model

import (
	"time"

	"gorm.io/gorm"
)

// RequirementSessionStatus represents the status of a requirement session.
type RequirementSessionStatus string

const (
	RequirementSessionStatusDraft      RequirementSessionStatus = "draft"
	RequirementSessionStatusAnalyzing  RequirementSessionStatus = "analyzing"
	RequirementSessionStatusConfirmed  RequirementSessionStatus = "confirmed"
	RequirementSessionStatusPublished   RequirementSessionStatus = "published"
)

// RequirementSession represents a requirement analysis session.
type RequirementSession struct {
	ID               uint                     `gorm:"primaryKey" json:"id"`
	UserID           uint                     `gorm:"not null;index" json:"user_id"`
	InputType        string                   `gorm:"type:varchar(20);not null" json:"input_type"`
	InputContent     string                   `gorm:"type:text" json:"input_content"`
	PDFPath          string                   `gorm:"type:varchar(500)" json:"pdf_path"`
	AnalyzedResult   string                   `gorm:"type:json" json:"analyzed_result"`
	StructuredForm   string                   `gorm:"type:json" json:"structured_form"`
	Status           RequirementSessionStatus `gorm:"type:varchar(20);default:draft" json:"status"`
	TaskID           *uint                    `gorm:"index" json:"task_id"`
	CreatedAt        time.Time                `json:"created_at"`
	UpdatedAt        time.Time                `json:"updated_at"`
	DeletedAt        gorm.DeletedAt           `gorm:"index" json:"-"`

	// Relations
	User  User  `gorm:"foreignKey:UserID" json:"-"`
	Task  *Task `gorm:"foreignKey:TaskID" json:"-"`
}

// TableName specifies the table name for GORM.
func (RequirementSession) TableName() string {
	return "requirement_sessions"
}
