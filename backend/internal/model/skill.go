package model

import (
	"time"

	"gorm.io/gorm"
)

// Skill - Skill 库
type Skill struct {
	ID          uint   `gorm:"primaryKey" json:"id"`
	Name        string `gorm:"size:100;uniqueIndex;not null" json:"name"`
	DisplayName string `gorm:"size:255" json:"display_name"`
	Description string `gorm:"type:text" json:"description"`
	Category    string `gorm:"size:100;index" json:"category"` // browser, code, data, communication, etc.
	Tags        string `gorm:"type:text" json:"tags"`           // JSON: []string

	// Skill 来源
	Source   string `gorm:"size:50;index" json:"source"`   // "local", "mcp_marketplace"
	SourceID string `gorm:"size:255" json:"source_id"`     // MCP Marketplace ID

	// Skill 配置 (JSON Schema)
	ConfigSchemaJSON  string `gorm:"type:text" json:"config_schema_json"`  // ConfigSchema
	DefaultConfigJSON string `gorm:"type:text" json:"default_config_json"` // map[string]interface{}

	// MCP 相关
	MCPName string `gorm:"size:100" json:"mcp_name"` // MCP server name
	MCPTools string `gorm:"type:text" json:"mcp_tools"` // JSON: []string - 提供的工具列表

	// 元数据
	Version      string  `gorm:"size:50" json:"version"`
	Author       string  `gorm:"size:255" json:"author"`
	Rating       float64 `gorm:"type:decimal(3,2);default:0" json:"rating"`
	InstallCount int     `gorm:"default:0" json:"install_count"`

	// 状态
	Status string `gorm:"size:50;index;default:active" json:"status"` // active, deprecated

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (Skill) TableName() string {
	return "skills"
}

// SkillCategory Skill 分类常量
const (
	SkillCategoryBrowser       = "browser"
	SkillCategoryCode          = "code"
	SkillCategoryData          = "data"
	SkillCategoryCommunication = "communication"
	SkillCategoryFile          = "file"
	SkillCategorySearch        = "search"
	SkillCategoryOther         = "other"
)

// SkillStatus Skill 状态常量
const (
	SkillStatusActive     = "active"
	SkillStatusDeprecated = "deprecated"
)
