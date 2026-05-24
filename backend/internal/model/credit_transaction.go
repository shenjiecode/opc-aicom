package model

import (
	"time"

	"gorm.io/gorm"
)

// CreditTransactionType - 交易类型
type CreditTransactionType string

const (
	CreditTypeRecharge     CreditTransactionType = "recharge"     // 充值
	CreditTypeConsume      CreditTransactionType = "consume"      // 消费
	CreditTypeRefund       CreditTransactionType = "refund"       // 退款
	CreditTypeGift        CreditTransactionType = "gift"        // 赠送
	CreditTypeEscrowLock   CreditTransactionType = "escrow_lock"   // 托管锁定
	CreditTypeEscrowRelease CreditTransactionType = "escrow_release" // 托管释放
	CreditTypeEscrowDeduct CreditTransactionType = "escrow_deduct" // 托管扣除
)

// CreditTransaction - 积分流水记录
type CreditTransaction struct {
	ID           uint                  `gorm:"primaryKey" json:"id"`
	UserID       uint                  `gorm:"not null;index" json:"user_id"`
	Type         CreditTransactionType `gorm:"size:20;not null;index" json:"type"`
	Amount       int                   `gorm:"not null" json:"amount"`           // 正数为充值，负数为消费
	BalanceAfter int                   `gorm:"not null" json:"balance_after"`    // 交易后余额
	Description  string                `gorm:"size:255" json:"description"`      // 描述，如"充值100积分"、"Agent聊天消费"
	RelatedID    *uint                 `json:"related_id,omitempty"`             // 关联ID（如agent_instance_id）
	RelatedType string                `gorm:"size:50" json:"related_type"`      // 关联类型（如"agent_instance", "recharge_order"）
	Model        string                `gorm:"size:50" json:"model,omitempty"`   // 消费时的模型名
	TokensUsed   int                   `json:"tokens_used,omitempty"`            // 消费的token数
	CreatedAt    time.Time             `json:"created_at"`
	UpdatedAt    time.Time             `json:"updated_at"`
	DeletedAt    gorm.DeletedAt        `gorm:"index" json:"-"`
}

func (CreditTransaction) TableName() string {
	return "credit_transactions"
}