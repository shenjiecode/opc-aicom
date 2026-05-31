package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/middleware"
	"github.com/opc-aicom/backend/internal/model"
	"gorm.io/gorm"
)

// AdminVerificationReviewRequest represents the admin verification review request
type AdminVerificationReviewRequest struct {
	VerificationID uint   `json:"verification_id" binding:"required"`
	Action         string `json:"action" binding:"required"` // "approve" or "reject"
	Reason         string `json:"reason"`                   // Required if action is "reject"
}

// AdminVerificationReview handles admin verification review (approve/reject)
// POST /api/admin/verification/review
func AdminVerificationReview(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req AdminVerificationReviewRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "参数错误",
			})
			return
		}

		// Validate action
		if req.Action != "approve" && req.Action != "reject" {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "action 必须是 approve 或 reject",
			})
			return
		}

		// Get admin user ID
		adminID, ok := middleware.GetUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{
				Code:    401,
				Message: "未授权",
			})
			return
		}

		// Get verification record
		var verification model.Verification
		if err := db.First(&verification, req.VerificationID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, UnifiedResponse{
					Code:    404,
					Message: "认证记录不存在",
				})
				return
			}
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "数据库错误",
			})
			return
		}

		// Check if verification is already processed
		if verification.Status != model.VerificationStatusPending {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "该认证记录已被处理",
			})
			return
		}

		// Process based on action
		now := time.Now()
		if req.Action == "approve" {
			// Approve verification
			approveVerification(db, req.VerificationID, adminID, req.Reason)
			
			c.JSON(http.StatusOK, UnifiedResponse{
				Code:    0,
				Message: "审核成功",
				Data: gin.H{
					"verification_id": req.VerificationID,
					"status":          "approved",
				},
			})
		} else {
			// Reject verification
			if req.Reason == "" {
				c.JSON(http.StatusBadRequest, UnifiedResponse{
					Code:    400,
					Message: "拒绝审核时必须提供拒绝原因",
				})
				return
			}

			// Update verification record
			db.Model(&model.Verification{}).Where("id = ?", req.VerificationID).Updates(map[string]interface{}{
				"status":        model.VerificationStatusRejected,
				"reviewed_at":   now,
				"reviewed_by":   adminID,
				"review_remark": req.Reason,
			})

			// Update user verification status
			db.Model(&model.User{}).Where("id = ?", verification.UserID).Updates(map[string]interface{}{
				"verification_status": "rejected",
			})

			c.JSON(http.StatusOK, UnifiedResponse{
				Code:    0,
				Message: "审核已拒绝",
				Data: gin.H{
					"verification_id": req.VerificationID,
					"status":          "rejected",
					"reason":          req.Reason,
				},
			})
		}
	}
}
