package model

import (
	"database/sql"
	"time"

	"gorm.io/gorm"
)

// AgentBabaSession - Agent 创建会话
type AgentBabaSession struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	UserID      uint           `gorm:"index;not null" json:"user_id"`
	Title       string         `gorm:"size:255" json:"title"`
	Description string         `gorm:"type:text" json:"description"` // 用户原始需求描述

	// 状态: draft, clarifying, configuring, building, testing, completed, failed
	Status      string `gorm:"size:50;index;default:draft" json:"status"`
	CurrentStep int    `gorm:"default:1" json:"current_step"` // 1-需求, 2-澄清, 3-匹配, 4-配置, 5-构建, 6-测试

	// 对话澄清相关 (JSON 格式)
	ClarificationJSON string `gorm:"type:text" json:"clarification_json"` // []ClarificationQuestion
	AnswersJSON       string `gorm:"type:text" json:"answers_json"`       // map[string]interface{}

	// Skill 匹配结果 (JSON 格式)
	MatchedSkillsJSON string `gorm:"type:text" json:"matched_skills_json"` // []MatchedSkill

	// 生成的配置 (JSON 格式)
	AgentConfigJSON string `gorm:"type:text" json:"agent_config_json"` // AgentConfig

	// 关联的 Agent 实例
	AgentInstanceID sql.NullInt64 `gorm:"index" json:"agent_instance_id"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (AgentBabaSession) TableName() string {
	return "agentbaba_sessions"
}

// SessionStatus 会话状态常量
const (
	SessionStatusDraft      = "draft"
	SessionStatusClarifying = "clarifying"
	SessionStatusConfiguring = "configuring"
	SessionStatusBuilding   = "building"
	SessionStatusTesting    = "testing"
	SessionStatusCompleted  = "completed"
	SessionStatusFailed     = "failed"
)
