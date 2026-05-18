package model

import (
	"time"

	"gorm.io/gorm"
)

// ChannelStatus represents the status of an AI channel.
type ChannelStatus string

const (
	ChannelStatusActive   ChannelStatus = "active"
	ChannelStatusDisabled ChannelStatus = "disabled"
)

type AIChannel struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Name        string         `gorm:"size:255;not null" json:"name"`
	Provider    string         `gorm:"size:50;not null;index" json:"provider"`
	BaseURL     string         `gorm:"size:512;not null" json:"base_url"`
	APIKey      string         `gorm:"size:512;not null" json:"-"`
	Models      string         `gorm:"type:text" json:"models"`
	Weight      int            `gorm:"default:1" json:"weight"`
	Status      ChannelStatus  `gorm:"type:varchar(20);default:active" json:"status"`
	Priority    int            `gorm:"default:0" json:"priority"`
	FailedCount int            `gorm:"default:0" json:"failed_count"`
	MaxRetries  int            `gorm:"default:3" json:"max_retries"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name for GORM.
func (AIChannel) TableName() string {
	return "ai_channels"
}

func (c *AIChannel) IsActive() bool {
	return c.Status == ChannelStatusActive
}

func (c *AIChannel) IsFailed() bool {
	return c.FailedCount >= c.MaxRetries
}

func (c *AIChannel) CanUse() bool {
	return c.IsActive() && !c.IsFailed()
}
