package handler

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/middleware"
	"github.com/opc-aicom/backend/internal/model"
	"gorm.io/gorm"
)

// CreditHandler handles credit-related requests
type CreditHandler struct {
	db *gorm.DB
}

// NewCreditHandler creates a new CreditHandler
func NewCreditHandler(db *gorm.DB) *CreditHandler {
	return &CreditHandler{db: db}
}

// BalanceResponse represents the balance response
type BalanceResponse struct {
	Balance int `json:"balance"` // 海贝积分余额
}

// GetBalance returns user's current credit balance (Haibei)
// POST /api/credit/balance
func (h *CreditHandler) GetBalance(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未登录"})
		return
	}

	var asset model.UserAsset
	if err := h.db.Where("user_id = ?", userID).First(&asset).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			// Create default asset if not exists
			asset = model.UserAsset{
				UserID: userID,
				Points: 0,
			}
			if err := h.db.Create(&asset).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "创建资产记录失败"})
				return
			}
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "查询余额失败"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    BalanceResponse{Balance: asset.Points},
	})
}

// RechargeRequest represents a recharge request (admin only)
type RechargeRequest struct {
	UserEmail string `json:"user_email" binding:"required"`
	Amount    int    `json:"amount" binding:"required,min=1"`
}

// Recharge adds credits to a user's account (admin only)
// POST /api/admin/credit/recharge
func (h *CreditHandler) Recharge(c *gin.Context) {
	var req RechargeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误"})
		return
	}

	// Find user by email
	var user model.User
	if err := h.db.Where("username = ?", req.UserEmail).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "用户不存在"})
		return
	}

	// Get or create user asset
	var asset model.UserAsset
	if err := h.db.Where("user_id = ?", user.ID).First(&asset).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			asset = model.UserAsset{
				UserID: user.ID,
				Points: 0,
			}
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "查询资产失败"})
			return
		}
	}

	// Use transaction for atomic operation
	err := h.db.Transaction(func(tx *gorm.DB) error {
		// Update balance
		asset.Points += req.Amount
		if err := tx.Save(&asset).Error; err != nil {
			return err
		}

		// Create transaction record
		transaction := model.CreditTransaction{
			UserID:       user.ID,
			Type:         model.CreditTypeRecharge,
			Amount:       req.Amount,
			BalanceAfter: asset.Points,
			Description:  fmt.Sprintf("管理员充值%d积分", req.Amount),
			RelatedType:  "admin_recharge",
		}
		return tx.Create(&transaction).Error
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "充值失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"balance": asset.Points,
			"amount":  req.Amount,
		},
	})
}

// TransactionsRequest represents a transaction history request
type TransactionsRequest struct {
	Offset int `json:"offset"`
	Limit  int `json:"limit"`
}

// TransactionsResponse represents transaction history response
type TransactionsResponse struct {
	List  []model.CreditTransaction `json:"list"`
	Total int64                     `json:"total"`
}

// GetTransactions returns user's transaction history (paginated)
// POST /api/credit/transactions
func (h *CreditHandler) GetTransactions(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未登录"})
		return
	}

	var req TransactionsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		req.Offset = 0
		req.Limit = 20
	}
	if req.Limit <= 0 || req.Limit > 100 {
		req.Limit = 20
	}

	var transactions []model.CreditTransaction
	var total int64

	h.db.Model(&model.CreditTransaction{}).Where("user_id = ?", userID).Count(&total)
	h.db.Where("user_id = ?", userID).Order("created_at desc").Offset(req.Offset).Limit(req.Limit).Find(&transactions)

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": TransactionsResponse{
			List:  transactions,
			Total: total,
		},
	})
}

// ConsumeRequest represents a consume request (internal)
type ConsumeRequest struct {
	UserID      uint   `json:"user_id" binding:"required"`
	Model       string `json:"model" binding:"required"`
	TokensUsed  int    `json:"tokens_used" binding:"required,min=1"`
	RelatedID   *uint  `json:"related_id"`
	RelatedType string `json:"related_type"`
}

// Consume deducts credits from a user's account (internal API)
// POST /api/credit/consume
func (h *CreditHandler) Consume(c *gin.Context) {
	var req ConsumeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误"})
		return
	}

	// Calculate credits to deduct
	creditsToDeduct := model.CalculateCredits(req.Model, req.TokensUsed)

	// Get user asset
	var asset model.UserAsset
	if err := h.db.Where("user_id = ?", req.UserID).First(&asset).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "用户资产不存在"})
		return
	}

	// Check balance
	if asset.Points < creditsToDeduct {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "积分不足"})
		return
	}

	// Use transaction for atomic operation
	err := h.db.Transaction(func(tx *gorm.DB) error {
		// Update balance
		asset.Points -= creditsToDeduct
		if err := tx.Save(&asset).Error; err != nil {
			return err
		}

		// Create transaction record
		transaction := model.CreditTransaction{
			UserID:       req.UserID,
			Type:         model.CreditTypeConsume,
			Amount:       -creditsToDeduct,
			BalanceAfter: asset.Points,
			Description:  fmt.Sprintf("模型%s消费", req.Model),
			RelatedID:    req.RelatedID,
			RelatedType:  req.RelatedType,
			Model:        req.Model,
			TokensUsed:   req.TokensUsed,
		}
		return tx.Create(&transaction).Error
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "扣费失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"credits_deducted": creditsToDeduct,
			"balance":          asset.Points,
		},
	})
}

// DeductCredits is a helper function to deduct credits (used by agent_chat)
func (h *CreditHandler) DeductCredits(userID uint, modelName string, tokensUsed int, relatedID *uint, relatedType string) error {
	creditsToDeduct := model.CalculateCredits(modelName, tokensUsed)

	var asset model.UserAsset
	if err := h.db.Where("user_id = ?", userID).First(&asset).Error; err != nil {
		return fmt.Errorf("用户资产不存在")
	}

	if asset.Points < creditsToDeduct {
		return fmt.Errorf("积分不足，当前余额: %d, 需要: %d", asset.Points, creditsToDeduct)
	}

	return h.db.Transaction(func(tx *gorm.DB) error {
		asset.Points -= creditsToDeduct
		if err := tx.Save(&asset).Error; err != nil {
			return err
		}

		transaction := model.CreditTransaction{
			UserID:       userID,
			Type:         model.CreditTypeConsume,
			Amount:       -creditsToDeduct,
			BalanceAfter: asset.Points,
			Description:  fmt.Sprintf("模型%s消费", modelName),
			RelatedID:    relatedID,
			RelatedType:  relatedType,
			Model:        modelName,
			TokensUsed:   tokensUsed,
		}
		return tx.Create(&transaction).Error
	})
}

// generateAPIKey generates a random API key with sk- prefix
func generateAPIKey() (string, error) {
	bytes := make([]byte, 24)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return "sk-" + hex.EncodeToString(bytes), nil
}

// parseUintParam parses a uint parameter from query string
func parseUintParam(c *gin.Context, key string, defaultValue uint) uint {
	val := c.Query(key)
	if val == "" {
		return defaultValue
	}
	parsed, err := strconv.ParseUint(val, 10, 64)
	if err != nil {
		return defaultValue
	}
	return uint(parsed)
}

// GiftPoints adds points to a user's account as a gift (e.g., enterprise verification bonus)
// This is a helper function that can be called from other handlers like verification
func (h *CreditHandler) GiftPoints(userID uint, amount int, reason string) error {
	if amount <= 0 {
		return fmt.Errorf("gift amount must be positive")
	}

	// Get or create user asset
	var asset model.UserAsset
	if err := h.db.Where("user_id = ?", userID).First(&asset).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			asset = model.UserAsset{
				UserID:       userID,
				Points:       0,
				TotalGifted: 0,
			}
			if err := h.db.Create(&asset).Error; err != nil {
				return fmt.Errorf("创建资产记录失败: %w", err)
			}
		} else {
			return fmt.Errorf("查询资产失败: %w", err)
		}
	}

	// Use transaction for atomic operation
	return h.db.Transaction(func(tx *gorm.DB) error {
		// Update points and total gifted
		asset.Points += amount
		asset.TotalGifted += amount
		if err := tx.Save(&asset).Error; err != nil {
			return err
		}

		// Create transaction record
		transaction := model.CreditTransaction{
			UserID:       userID,
			Type:         model.CreditTypeGift,
			Amount:       amount,
			BalanceAfter: asset.Points,
			Description:  reason,
			RelatedType:  "gift",
		}
		return tx.Create(&transaction).Error
	})
}