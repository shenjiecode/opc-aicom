package handler

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/middleware"
	"github.com/opc-aicom/backend/internal/model"
	"github.com/opc-aicom/backend/internal/service"
	"gorm.io/gorm"
)

// ComputeRechargeHandler handles compute credits recharge requests
type ComputeRechargeHandler struct {
	db             *gorm.DB
	alibabaService *service.AlibabaCloudService
}

// NewComputeRechargeHandler creates a new ComputeRechargeHandler
func NewComputeRechargeHandler(db *gorm.DB, alibabaService *service.AlibabaCloudService) *ComputeRechargeHandler {
	return &ComputeRechargeHandler{
		db:             db,
		alibabaService: alibabaService,
	}
}

// ComputeRechargeRequest represents the recharge request body
type ComputeRechargeRequest struct {
	PointsAmount int `json:"points_amount" binding:"required,min=1"`
}

// ComputeRechargeResponse represents the recharge response
type ComputeRechargeResponse struct {
	OrderNo        string `json:"order_no"`
	PointsDeducted int    `json:"points_deducted"`
	CreditsAdded   int    `json:"credits_added"`
	NewPointsBal   int    `json:"new_points_balance"`
	NewCreditBal   int    `json:"new_credit_balance"`
}

// RechargeCompute handles compute credits recharge
// POST /api/mall/recharge-compute
func (h *ComputeRechargeHandler) RechargeCompute(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, UnifiedResponse{
			Code:    401,
			Message: "未登录",
		})
		return
	}

	var req ComputeRechargeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "参数错误：积分数量必须大于等于1",
		})
		return
	}

	// Validate points_amount >= 1
	if req.PointsAmount < 1 {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "积分数量必须大于等于1",
		})
		return
	}

	// Get user asset
	var asset model.UserAsset
	if err := h.db.Where("user_id = ?", userID).First(&asset).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusPaymentRequired, UnifiedResponse{
				Code:    402,
				Message: "积分不足",
				Data: gin.H{
					"required":  req.PointsAmount,
					"available": 0,
					"shortage":  req.PointsAmount,
				},
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "查询资产失败",
		})
		return
	}

	// Check user has sufficient points
	if asset.Points < req.PointsAmount {
		c.JSON(http.StatusPaymentRequired, UnifiedResponse{
			Code:    402,
			Message: "积分不足",
			Data: gin.H{
				"required":  req.PointsAmount,
				"available": asset.Points,
				"shortage":  req.PointsAmount - asset.Points,
			},
		})
		return
	}

	// Generate order number
	orderNo := fmt.Sprintf("CR-%d-%d", userID, time.Now().UnixNano())

	// Create pending order
	order := model.PointsOrder{
		OrderNo:       orderNo,
		UserID:        userID,
		OrderType:     model.OrderTypeComputeRecharge,
		PointsAmount:  req.PointsAmount,
		CreditAmount:  req.PointsAmount, // 1:1 mapping
		ExchangeRate:  1.0,
		Status:        "pending",
	}

	var response ComputeRechargeResponse

	// Use transaction for atomic operation
	err := h.db.Transaction(func(tx *gorm.DB) error {
		// Create order
		if err := tx.Create(&order).Error; err != nil {
			return fmt.Errorf("failed to create order: %w", err)
		}

		// Call AlibabaCloudService.SyncCredit()
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		if err := h.alibabaService.SyncCredit(ctx, fmt.Sprintf("%d", userID), req.PointsAmount); err != nil {
			return fmt.Errorf("failed to sync credit: %w", err)
		}

		// Deduct points
		asset.Points -= req.PointsAmount
		if err := tx.Save(&asset).Error; err != nil {
			return fmt.Errorf("failed to deduct points: %w", err)
		}

		// Add to AlibabaCredit and ComputeHours (1:1 mapping)
		asset.AlibabaCredit += req.PointsAmount
		asset.ComputeHours += float64(req.PointsAmount)
		if err := tx.Save(&asset).Error; err != nil {
			return fmt.Errorf("failed to add credits: %w", err)
		}

		// Update order to completed
		now := time.Now()
		order.Status = "completed"
		order.CompletedAt = &now
		if err := tx.Save(&order).Error; err != nil {
			return fmt.Errorf("failed to update order: %w", err)
		}

		// Create transaction record
		transaction := model.CreditTransaction{
			UserID:       userID,
			Type:         model.CreditTypeConsume,
			Amount:       -req.PointsAmount,
			BalanceAfter: asset.Points,
			Description:  fmt.Sprintf("充值计算积分: %d", req.PointsAmount),
			RelatedID:    &order.ID,
			RelatedType:  "compute_recharge",
		}
		if err := tx.Create(&transaction).Error; err != nil {
			return fmt.Errorf("failed to create transaction: %w", err)
		}

		response = ComputeRechargeResponse{
			OrderNo:        orderNo,
			PointsDeducted: req.PointsAmount,
			CreditsAdded:   req.PointsAmount,
			NewPointsBal:   asset.Points,
			NewCreditBal:   asset.AlibabaCredit,
		}

		return nil
	})

	if err != nil {
		// Rollback order on failure
		h.db.Model(&order).Updates(map[string]interface{}{
			"status":       "failed",
			"cancelled_at": time.Now(),
		})

		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: fmt.Sprintf("充值失败: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, UnifiedResponse{
		Code:    0,
		Message: "充值成功",
		Data:    response,
	})
}
