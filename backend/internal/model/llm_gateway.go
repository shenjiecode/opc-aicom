package model

import (
	"time"

	"gorm.io/gorm"
)

// LLMGateway - 用户API Key管理（用于AgentBaba）
type LLMGateway struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	UserID      uint           `gorm:"uniqueIndex;not null" json:"user_id"` // 每用户一个key
	APIKey      string         `gorm:"size:64;uniqueIndex;not null" json:"api_key"` // 生成的API Key (sk-xxx格式)
	KeyName     string         `gorm:"size:100" json:"key_name"`                    // 显示名称
	Quota       int64          `gorm:"default:1000000" json:"quota"`                // 配额（token数），默认100万
	UsedTokens  int64          `gorm:"default:0" json:"used_tokens"`                // 已使用token
	CreditsUsed int            `gorm:"default:0" json:"credits_used"`               // 已消费积分
	Status      string         `gorm:"size:20;default:active" json:"status"`        // active, revoked
	ExpiresAt   *time.Time     `json:"expires_at,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (LLMGateway) TableName() string {
	return "llm_gateways"
}

// GatewayStatus - Gateway状态常量
const (
	GatewayStatusActive  = "active"
	GatewayStatusRevoked = "revoked"
)