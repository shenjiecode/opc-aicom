package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/middleware"
	"github.com/opc-aicom/backend/internal/model"
	"gorm.io/gorm"
)

// PersonalVerificationRequest 个人实名认证请求
type PersonalVerificationRequest struct {
	RealName     string `json:"realName" binding:"required"`
	IDCardNumber string `json:"idCardNumber" binding:"required"`
	IDCardFront  string `json:"idCardFront"`
	IDCardBack   string `json:"idCardBack"`
}

// EnterpriseVerificationRequest 企业认证请求
type EnterpriseVerificationRequest struct {
	EnterpriseName    string `json:"enterpriseName" binding:"required"`
	LicenseNumber     string `json:"licenseNumber" binding:"required"`
	LegalPersonName   string `json:"legalPersonName" binding:"required"`
	UnifiedSocialCode string `json:"unifiedSocialCode" binding:"required"`
	BusinessLicense   string `json:"businessLicense"`
}

// SubmitPersonalVerification 提交个人实名认证
// POST /api/verification/personal
func SubmitPersonalVerification(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := middleware.GetUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{Code: 401, Message: "unauthorized"})
			return
		}

		var req PersonalVerificationRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{Code: 400, Message: "请填写完整的认证信息"})
			return
		}

		// 检查是否已有待审核或已通过的认证
		var existing model.Verification
		if err := db.Where("user_id = ? AND type = ? AND status IN ?",
			userID, model.VerificationTypePersonal, []model.VerificationStatus{
				model.VerificationStatusPending,
				model.VerificationStatusApproved,
			}).First(&existing).Error; err == nil {
			if existing.Status == model.VerificationStatusPending {
				c.JSON(http.StatusConflict, UnifiedResponse{Code: 409, Message: "您已有待审核的个人认证申请"})
				return
			}
			if existing.Status == model.VerificationStatusApproved {
				c.JSON(http.StatusConflict, UnifiedResponse{Code: 409, Message: "您已完成个人实名认证"})
				return
			}
		}

		// 创建认证记录
		verification := model.Verification{
			UserID:       userID,
			Type:         model.VerificationTypePersonal,
			Status:       model.VerificationStatusPending,
			RealName:     req.RealName,
			IDCardNumber: req.IDCardNumber,
			IDCardFront:  req.IDCardFront,
			IDCardBack:   req.IDCardBack,
		}

		if err := db.Create(&verification).Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{Code: 500, Message: "提交认证申请失败"})
			return
		}

		// 自动更新用户认证状态为 pending
		db.Model(&model.User{}).Where("id = ?", userID).Updates(map[string]interface{}{
			"verification_status": "pending",
			"real_name":           req.RealName,
		})

		// 自动审核通过（简化版，实际生产环境需要人工审核）
		approveVerification(db, verification.ID, 0, "系统自动审核通过")

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "个人实名认证提交成功",
			Data: gin.H{
				"verificationId": verification.ID,
				"status":         "approved",
			},
		})
	}
}

// SubmitEnterpriseVerification 提交企业认证
// POST /api/verification/enterprise
func SubmitEnterpriseVerification(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := middleware.GetUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{Code: 401, Message: "unauthorized"})
			return
		}

		var req EnterpriseVerificationRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{Code: 400, Message: "请填写完整的企业认证信息"})
			return
		}

		// 检查是否已有待审核或已通过的企业认证
		var existing model.Verification
		if err := db.Where("user_id = ? AND type = ? AND status IN ?",
			userID, model.VerificationTypeEnterprise, []model.VerificationStatus{
				model.VerificationStatusPending,
				model.VerificationStatusApproved,
			}).First(&existing).Error; err == nil {
			if existing.Status == model.VerificationStatusPending {
				c.JSON(http.StatusConflict, UnifiedResponse{Code: 409, Message: "您已有待审核的企业认证申请"})
				return
			}
			if existing.Status == model.VerificationStatusApproved {
				c.JSON(http.StatusConflict, UnifiedResponse{Code: 409, Message: "您已完成企业认证"})
				return
			}
		}

		// 创建认证记录
		verification := model.Verification{
			UserID:            userID,
			Type:              model.VerificationTypeEnterprise,
			Status:            model.VerificationStatusPending,
			EnterpriseName:    req.EnterpriseName,
			LicenseNumber:     req.LicenseNumber,
			LegalPersonName:   req.LegalPersonName,
			UnifiedSocialCode: req.UnifiedSocialCode,
			BusinessLicense:   req.BusinessLicense,
		}

		if err := db.Create(&verification).Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{Code: 500, Message: "提交认证申请失败"})
			return
		}

		// 更新用户认证状态为 pending
		db.Model(&model.User{}).Where("id = ?", userID).Updates(map[string]interface{}{
			"verification_status": "pending",
			"enterprise_name":     req.EnterpriseName,
		})

		// 自动审核通过（简化版，实际生产环境需要人工审核）
		approveVerification(db, verification.ID, 0, "系统自动审核通过")

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "企业认证提交成功",
			Data: gin.H{
				"verificationId": verification.ID,
				"status":         "approved",
			},
		})
	}
}

// GetVerificationStatus 获取认证状态
// GET /api/verification/status
func GetVerificationStatus(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := middleware.GetUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{Code: 401, Message: "unauthorized"})
			return
		}

		var verifications []model.Verification
		if err := db.Where("user_id = ?", userID).Order("created_at DESC").Find(&verifications).Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{Code: 500, Message: "获取认证状态失败"})
			return
		}

		// 获取用户当前状态
		var user model.User
		if err := db.First(&user, userID).Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{Code: 500, Message: "获取用户信息失败"})
			return
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: gin.H{
				"memberType":         user.MemberType,
				"verificationStatus": user.VerificationStatus,
				"realName":           user.RealName,
				"enterpriseName":     user.EnterpriseName,
				"verifications":      verifications,
			},
		})
	}
}

// approveVerification 审核通过认证并更新用户会员类型
func approveVerification(db *gorm.DB, verificationID uint, reviewerID uint, remark string) {
	now := time.Now()

	// 更新认证记录状态
	db.Model(&model.Verification{}).Where("id = ?", verificationID).Updates(map[string]interface{}{
		"status":       model.VerificationStatusApproved,
		"reviewed_at":  now,
		"reviewed_by":  reviewerID,
		"review_remark": remark,
	})

	// 获取认证记录以确定类型
	var verification model.Verification
	if err := db.First(&verification, verificationID).Error; err != nil {
		return
	}

	// 根据认证类型更新用户会员类型
	memberType := "personal"
	if verification.Type == model.VerificationTypeEnterprise {
		memberType = "enterprise"
	}

	db.Model(&model.User{}).Where("id = ?", verification.UserID).Updates(map[string]interface{}{
		"member_type":         memberType,
		"verification_status": "verified",
	})

	// 如果是企业认证，赠送10000积分
	if verification.Type == model.VerificationTypeEnterprise {
		creditHandler := NewCreditHandler(db)
		giftReason := "企业认证通过，系统赠送积分"
		if err := creditHandler.GiftPoints(verification.UserID, 10000, giftReason); err != nil {
			// Log error but don't fail the verification
			// In production, you'd want proper logging here
			_ = err
		}
	}
}