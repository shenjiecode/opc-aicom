package model

import (
	"time"

	"gorm.io/gorm"
)

// AgentInstance - 运行中的 Agent 实例
type AgentInstance struct {
	ID         uint   `gorm:"primaryKey" json:"id"`
	SessionID  uint   `gorm:"index;not null" json:"session_id"`
	UserID     uint   `gorm:"index;not null" json:"user_id"`
	Name       string `gorm:"size:255;not null" json:"name"`
	Description string `gorm:"type:text" json:"description"`

	// 运行配置 (JSON 格式)
	ConfigJSON     string `gorm:"type:text" json:"config_json"`      // AgentConfig
	SkillsJSON     string `gorm:"type:text" json:"skills_json"`      // []SkillConfig
	MCPServersJSON string `gorm:"type:text" json:"mcp_servers_json"` // []MCPServerConfig

	// Docker 相关
	ContainerID   string `gorm:"size:255;index" json:"container_id"`
	ContainerName string `gorm:"size:255;uniqueIndex" json:"container_name"`
	ImageName     string `gorm:"size:255" json:"image_name"`
	PortMapping   string `gorm:"type:text" json:"port_mapping"` // JSON: map[int]int

	// 状态
	Status       string `gorm:"size:50;index;default:creating" json:"status"` // creating, running, stopped, error
	HealthStatus string `gorm:"size:50;default:unknown" json:"health_status"` // healthy, unhealthy, unknown
	ErrorMessage string `gorm:"type:text" json:"error_message"`

	// 资源限制
	CPULimit    float64 `gorm:"type:decimal(10,2);default:1.0" json:"cpu_limit"` // CPU 核心数
	MemoryLimit int     `gorm:"default:512" json:"memory_limit"`                 // MB

	// 统计
	TotalRuns   int `gorm:"default:0" json:"total_runs"`
	SuccessRuns int `gorm:"default:0" json:"success_runs"`
	FailedRuns  int `gorm:"default:0" json:"failed_runs"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (AgentInstance) TableName() string {
	return "agent_instances"
}

// AgentInstanceStatus Agent 实例状态常量
const (
	InstanceStatusCreating = "creating"
	InstanceStatusRunning  = "running"
	InstanceStatusStopped  = "stopped"
	InstanceStatusError    = "error"
)

// HealthStatus 健康状态常量
const (
	HealthStatusHealthy   = "healthy"
	HealthStatusUnhealthy = "unhealthy"
	HealthStatusUnknown   = "unknown"
)
