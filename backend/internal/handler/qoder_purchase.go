package handler

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/opc-aicom/backend/internal/middleware"
	"github.com/opc-aicom/backend/internal/model"
	"github.com/opc-aicom/backend/internal/repository"
	"github.com/opc-aicom/backend/internal/service"
	"github.com/opc-aicom/backend/pkg/config"
	"gorm.io/gorm"
)

type QoderPurchaseHandler struct {
	db            *gorm.DB
	qoderService  *service.QoderService
	pointsService *service.PointsService
	batchRepo     *repository.PointsBatchRepository
}

func NewQoderPurchaseHandler(db *gorm.DB, cfg *config.QoderConfig) *QoderPurchaseHandler {
	batchRepo := repository.NewPointsBatchRepository(db)
	pointsService := service.NewPointsService(batchRepo)
	qoderService := service.NewQoderService(cfg)

	return &QoderPurchaseHandler{
		db:            db,
		qoderService:  qoderService,
		pointsService: pointsService,
		batchRepo:     batchRepo,
	}
}

type QoderPurchaseRequest struct {
	Email string `json:"email" binding:"required,email"`
}

type QoderPurchaseResponse struct {
	OrderNo        string `json:"order_no"`
	AccountID      string `json:"account_id"`
	AccountEmail   string `json:"account_email"`
	PointsDeducted int    `json:"points_deducted"`
	ExpiresAt      string `json:"expires_at"`
}

const QoderAccountPrice = 300

func (h *QoderPurchaseHandler) PurchaseQoder(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未登录"})
		return
	}

	var req QoderPurchaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误: 需要有效的邮箱地址"})
		return
	}

	availablePoints, err := h.pointsService.GetAvailablePoints(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "查询积分失败"})
		return
	}

	if availablePoints < QoderAccountPrice {
		c.JSON(http.StatusPaymentRequired, gin.H{
			"code":    402,
			"message": "积分不足",
			"data": gin.H{
				"required":  QoderAccountPrice,
				"available": availablePoints,
				"shortage":  QoderAccountPrice - availablePoints,
			},
		})
		return
	}

	orderNo := generateOrderNo()
	order := &model.PointsOrder{
		OrderNo:      orderNo,
		UserID:       userID,
		OrderType:    model.OrderTypeQoderAccount,
		ProductName:  "Qoder Monthly Account",
		PointsAmount: QoderAccountPrice,
		Status:       "pending",
		ExpiresAt:    timePtr(time.Now().Add(30 * time.Minute)),
	}

	if err := h.db.Create(order).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "创建订单失败"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	account, err := h.qoderService.CreateAccount(ctx, req.Email)
	if err != nil {
		now := time.Now()
		order.Status = "cancelled"
		order.CancelledAt = &now
		if updateErr := h.db.Save(order).Error; updateErr != nil {
			fmt.Printf("Failed to cancel order %s: %v\n", orderNo, updateErr)
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "创建Qoder账户失败: " + err.Error(),
		})
		return
	}

	var userAsset model.UserAsset
	err = h.db.Transaction(func(tx *gorm.DB) error {
		txBatchRepo := repository.NewPointsBatchRepository(tx)
		txPointsService := service.NewPointsService(txBatchRepo)

		_, err := txPointsService.DeductPoints(userID, QoderAccountPrice)
		if err != nil {
			return fmt.Errorf("deduct points failed: %w", err)
		}

		now := time.Now()
		order.Status = "completed"
		order.CompletedAt = &now
		if err := tx.Save(order).Error; err != nil {
			return fmt.Errorf("update order failed: %w", err)
		}

		if err := tx.Where("user_id = ?", userID).First(&userAsset).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				userAsset = model.UserAsset{
					UserID: userID,
					Points: 0,
				}
				if err := tx.Create(&userAsset).Error; err != nil {
					return fmt.Errorf("create user asset failed: %w", err)
				}
			} else {
				return fmt.Errorf("get user asset failed: %w", err)
			}
		}

		accountExpiresAt := time.Now().AddDate(0, 1, 0)
		userAsset.QoderAccount = account.ID
		userAsset.QoderExpiresAt = &accountExpiresAt
		if err := tx.Save(&userAsset).Error; err != nil {
			return fmt.Errorf("save qoder account failed: %w", err)
		}

		return nil
	})

	if err != nil {
		now := time.Now()
		order.Status = "cancelled"
		order.CancelledAt = &now
		if updateErr := h.db.Save(order).Error; updateErr != nil {
			fmt.Printf("Failed to cancel order %s after transaction failure: %v\n", orderNo, updateErr)
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "购买失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "购买成功",
		"data": QoderPurchaseResponse{
			OrderNo:        orderNo,
			AccountID:      account.ID,
			AccountEmail:   account.Email,
			PointsDeducted: QoderAccountPrice,
			ExpiresAt:      userAsset.QoderExpiresAt.Format("2006-01-02 15:04:05"),
		},
	})
}

func generateOrderNo() string {
	return "QO" + time.Now().Format("20060102150405") + uuid.New().String()[:8]
}

func timePtr(t time.Time) *time.Time {
	return &t
}