package model

import (
	"time"

	"gorm.io/gorm"
)

// TaskNotification represents a notification sent to an agent about a task
type TaskNotification struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	TaskID        uint           `gorm:"index;not null" json:"task_id"`
	AgentID       uint           `gorm:"index;not null" json:"agent_id"`        // AgentInstance ID
	UserID       uint           `gorm:"index;not null" json:"user_id"`     // Owner of the agent
	TaskTitle     string         `gorm:"not null" json:"task_title"`
	TaskType      string         `gorm:"not null" json:"task_type"`        // Task type (dev, design, etc.)
	RequiredSkills string         `gorm:"type:text" json:"required_skills"` // JSON array of required skills

	// Status
	Status        string         `gorm:"not null;default:'pending'" json:"status"` // pending, viewed, accepted, rejected, expired

	// Timestamps
	NotifiedAt    time.Time     `json:"notified_at"`
	ViewedAt      *time.Time    `json:"viewed_at"`
	AcceptedAt    *time.Time    `json:"accepted_at"`
	RejectedAt   *time.Time    `json:"rejected_at"`
	CreatedAt    time.Time     `json:"created_at"`
	UpdatedAt    time.Time     `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

func (TaskNotification) TableName() string {
	return "task_notifications"
}

// TaskNotificationStatus constants
const (
	NotificationStatusPending  = "pending"
	NotificationStatusViewed   = "viewed"
	NotificationStatusAccepted  = "accepted"
	NotificationStatusRejected = "rejected"
	NotificationStatusExpired = "expired"
)