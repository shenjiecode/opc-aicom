package model

import (
	"time"

	"gorm.io/gorm"
)

// VerificationType 认证类型
type VerificationType string

const (
	VerificationTypePersonal  VerificationType = "personal"  // 个人实名认证
	VerificationTypeEnterprise VerificationType = "enterprise" // 企业认证
)

// VerificationStatus 认证状态
type VerificationStatus string

const (
	VerificationStatusPending  VerificationStatus = "pending"  // 待审核
	VerificationStatusApproved VerificationStatus = "approved" // 已通过
	VerificationStatusRejected VerificationStatus = "rejected" // 已拒绝
)

// Verification 认证申请记录
type Verification struct {
	ID             uint              `gorm:"primaryKey" json:"id"`
	UserID         uint              `gorm:"not null;index" json:"user_id"`
	Type           VerificationType  `gorm:"size:20;not null" json:"type"` // personal, enterprise
	Status         VerificationStatus `gorm:"default:pending" json:"status"` // pending, approved, rejected
	
	// 个人认证字段
	RealName       string `gorm:"size:100" json:"real_name"`
	IDCardNumber   string `gorm:"size:30" json:"id_card_number"`
	IDCardFront    string `gorm:"size:255" json:"id_card_front"`    // 身份证正面照片URL
	IDCardBack     string `gorm:"size:255" json:"id_card_back"`     // 身份证背面照片URL
	
	// 企业认证字段
	EnterpriseName     string `gorm:"size:255" json:"enterprise_name"`
	BusinessLicense    string `gorm:"size:255" json:"business_license"`      // 营业执照照片URL
	LicenseNumber      string `gorm:"size:50" json:"license_number"`        // 营业执照号
	LegalPersonName    string `gorm:"size:100" json:"legal_person_name"`    // 法人姓名
	UnifiedSocialCode  string `gorm:"size:50" json:"unified_social_code"`  // 统一社会信用代码
	
	// 审核信息
	ReviewedAt    *time.Time `json:"reviewed_at"`
	ReviewedBy    uint       `json:"reviewed_by"`       // 审核人ID
	ReviewRemark  string     `gorm:"size:500" json:"review_remark"` // 审核备注
	
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name for GORM.
func (Verification) TableName() string {
	return "verifications"
}
