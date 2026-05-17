package model

import (
	"time"

	"gorm.io/gorm"
)

// MCPServer - MCP 服务器配置
type MCPServer struct {
	ID          uint   `gorm:"primaryKey" json:"id"`
	Name        string `gorm:"size:100;uniqueIndex;not null" json:"name"`
	DisplayName string `gorm:"size:255" json:"display_name"`
	Description string `gorm:"type:text" json:"description"`

	// 连接配置
	TransportType string `gorm:"size:50;not null" json:"transport_type"` // stdio, http, websocket
	Command       string `gorm:"size:255" json:"command"`                // stdio 模式的命令
	Args          string `gorm:"type:text" json:"args"`                  // JSON: []string
	Env           string `gorm:"type:text" json:"env"`                   // JSON: map[string]string
	URL           string `gorm:"size:255" json:"url"`                    // http/websocket 模式的 URL

	// 工具列表 (JSON 格式)
	ToolsJSON string `gorm:"type:text" json:"tools_json"` // JSON: []MCPTool

	// 状态
	Status          string    `gorm:"size:50;index;default:inactive" json:"status"` // active, inactive, error
	LastHealthCheck time.Time `json:"last_health_check"`
	ErrorMessage    string    `gorm:"type:text" json:"error_message"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (MCPServer) TableName() string {
	return "mcp_servers"
}

// TransportType 传输类型常量
const (
	TransportStdio    = "stdio"
	TransportHTTP     = "http"
	TransportWebsocket = "websocket"
)

// MCPServerStatus MCP 服务器状态常量
const (
	MCPServerStatusActive   = "active"
	MCPServerStatusInactive = "inactive"
	MCPServerStatusError    = "error"
)
