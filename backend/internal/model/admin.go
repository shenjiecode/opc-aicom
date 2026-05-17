package model

import (
	"time"

	"gorm.io/gorm"
)

// ReviewStatus represents the review status
type ReviewStatus string

const (
	ReviewStatusPending  ReviewStatus = "pending"
	ReviewStatusApproved ReviewStatus = "approved"
	ReviewStatusRejected ReviewStatus = "rejected"
)

// ReviewType represents what is being reviewed
type ReviewType string

const (
	ReviewTypePost   ReviewType = "post"
	ReviewTypeEvent  ReviewType = "event"
	ReviewTypeTask   ReviewType = "task"
)

// ReviewRecord represents a content review record
type ReviewRecord struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Type        ReviewType     `gorm:"type:varchar(20);not null;index" json:"type"`
	TargetID    uint           `gorm:"not null;index" json:"target_id"`
	ReviewerID  uint           `gorm:"index" json:"reviewer_id"`
	Status      ReviewStatus   `gorm:"type:varchar(20);not null;default:pending;index" json:"status"`
	Reason      string         `gorm:"type:text" json:"reason"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	// Relations
	Reviewer User `gorm:"foreignKey:ReviewerID" json:"-"`
}

// TableName specifies the table name for GORM
func (ReviewRecord) TableName() string {
	return "review_records"
}

// SystemAgentConfig represents configuration for system-level agents (Bit, LittleO)
type SystemAgentConfig struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	AgentType    string         `gorm:"uniqueIndex;size:50;not null" json:"agent_type"` // "bit" or "little_o"
	Name         string         `gorm:"size:255;not null" json:"name"`
	Description  string         `gorm:"type:text" json:"description"`
	SystemPrompt string         `gorm:"type:text" json:"system_prompt"`
	Model        string         `gorm:"size:100" json:"model"`         // LLM model name
	Temperature  float64        `gorm:"type:decimal(3,2);default:0.7" json:"temperature"`
	MaxTokens    int            `gorm:"default:4096" json:"max_tokens"`
	MCPTools     string         `gorm:"type:json" json:"mcp_tools"`    // JSON array of MCP tool names
	DailyLimit   int            `gorm:"default:1000" json:"daily_limit"`
	Enabled      bool           `gorm:"default:true" json:"enabled"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name for GORM
func (SystemAgentConfig) TableName() string {
	return "system_agent_configs"
}
