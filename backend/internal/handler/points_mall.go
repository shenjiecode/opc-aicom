package handler

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/middleware"
	"github.com/opc-aicom/backend/internal/model"
	"gorm.io/gorm"
)

// PointsMallHandler handles points mall related requests
type PointsMallHandler struct {
	db *gorm.DB
}

// NewPointsMallHandler creates a new PointsMallHandler
func NewPointsMallHandler(db *gorm.DB) *PointsMallHandler {
	return &PointsMallHandler{db: db}
}

// PackageResponse represents a compute package response
type PackageResponse struct {
	ID           uint   `json:"id"`
	Name         string `json:"name"`
	Description  string `json:"description"`
	Type         string `json:"type"`
	Price        string `json:"price"`
	Credits      int    `json:"credits"`
	DurationDays int    `json:"duration_days"`
	Specs        string `json:"specs"`
}

// ListPackages returns all active compute packages (public endpoint)
// GET /api/mall/packages
func (h *PointsMallHandler) ListPackages(c *gin.Context) {
	var packages []model.ComputePackage

	if err := h.db.Where("status = ?", model.ComputePackageStatusActive).
		Order("sort_order ASC, id ASC").
		Find(&packages).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "获取套餐列表失败"})
		return
	}

	var response []PackageResponse
	for _, pkg := range packages {
		response = append(response, PackageResponse{
			ID:           pkg.ID,
			Name:         pkg.Name,
			Description:  pkg.Description,
			Type:         string(pkg.Type),
			Price:        pkg.Price.String(),
			Credits:      pkg.Credits,
			DurationDays: pkg.DurationDays,
			Specs:        pkg.Specs,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    response,
	})
}

// PurchaseRequest represents a purchase request
type PurchaseRequest struct {
	PackageID uint `json:"package_id" binding:"required"`
}

// PurchaseResponse represents a purchase response
type PurchaseResponse struct {
	PackageID       uint   `json:"package_id"`
	PackageName     string `json:"package_name"`
	CreditsAdded    int    `json:"credits_added"`
	PointsDeducted int    `json:"points_deducted"`
	NewBalance      int    `json:"new_balance"`
	ExpiresAt       string `json:"expires_at"`
}

// Purchase purchases a compute package (auth required)
// POST /api/mall/purchase
func (h *PointsMallHandler) Purchase(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未登录"})
		return
	}

	var req PurchaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误"})
		return
	}

	// Find the package
	var pkg model.ComputePackage
	if err := h.db.Where("id = ? AND status = ?", req.PackageID, model.ComputePackageStatusActive).First(&pkg).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "套餐不存在或已下架"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "查询套餐失败"})
		return
	}

	// Get user asset
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
			c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "查询资产失败"})
			return
		}
	}

	// Convert price to int
	price := int(pkg.Price.IntPart())

	// Check if user has sufficient points
	if asset.Points < price {
		c.JSON(http.StatusPaymentRequired, gin.H{
			"code":    402,
			"message": "积分不足",
			"data": gin.H{
				"required":  price,
				"available": asset.Points,
				"shortage":  price - asset.Points,
			},
		})
		return
	}

	// Calculate expiration time
	expiresAt := time.Now().AddDate(0, 0, pkg.DurationDays)

	// Use transaction for atomic operation
	err := h.db.Transaction(func(tx *gorm.DB) error {
		// Deduct points
		asset.Points -= price
		if err := tx.Save(&asset).Error; err != nil {
			return err
		}

		// Add compute hours (credits)
		asset.ComputeHours += float64(pkg.Credits)
		if err := tx.Save(&asset).Error; err != nil {
			return err
		}

		// Create transaction record
		transaction := model.CreditTransaction{
			UserID:       userID,
			Type:         model.CreditTypeConsume,
			Amount:       -price,
			BalanceAfter: asset.Points,
			Description:  fmt.Sprintf("购买套餐: %s", pkg.Name),
			RelatedID:    &pkg.ID,
			RelatedType:  "compute_package",
		}
		if err := tx.Create(&transaction).Error; err != nil {
			return err
		}

		// Create user package record
		userPackage := model.UserPackage{
			UserID:           userID,
			PackageID:        pkg.ID,
			PackageName:      pkg.Name,
			PackageType:      pkg.Type,
			Credits:          pkg.Credits,
			RemainingCredits: pkg.Credits,
			DurationDays:     pkg.DurationDays,
			ExpiresAt:        expiresAt,
			Status:           model.UserPackageStatusActive,
		}
		if err := tx.Create(&userPackage).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "购买失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "购买成功",
		"data": PurchaseResponse{
			PackageID:       pkg.ID,
			PackageName:     pkg.Name,
			CreditsAdded:    pkg.Credits,
			PointsDeducted:  price,
			NewBalance:      asset.Points,
			ExpiresAt:       expiresAt.Format("2006-01-02 15:04:05"),
		},
	})
}

// UserPackageResponse represents a user's purchased package response
type UserPackageResponse struct {
	ID                uint   `json:"id"`
	PackageID        uint   `json:"package_id"`
	PackageName      string `json:"package_name"`
	PackageType      string `json:"package_type"`
	TotalCredits     int    `json:"total_credits"`
	RemainingCredits int    `json:"remaining_credits"`
	DurationDays     int    `json:"duration_days"`
	ExpiresAt        string `json:"expires_at"`
	Status           string `json:"status"`
	CreatedAt        string `json:"created_at"`
}

// ListMyPackages returns user's purchased packages (auth required)
// GET /api/mall/my-packages
func (h *PointsMallHandler) ListMyPackages(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未登录"})
		return
	}

	var packages []model.UserPackage
	if err := h.db.Where("user_id = ?", userID).Order("created_at DESC").Find(&packages).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "获取套餐列表失败"})
		return
	}

	var response []UserPackageResponse
	for _, pkg := range packages {
		// Update status if expired
		status := string(pkg.Status)
		if pkg.Status == model.UserPackageStatusActive && time.Now().After(pkg.ExpiresAt) {
			status = string(model.UserPackageStatusExpired)
		}

		response = append(response, UserPackageResponse{
			ID:                pkg.ID,
			PackageID:        pkg.PackageID,
			PackageName:      pkg.PackageName,
			PackageType:      string(pkg.PackageType),
			TotalCredits:     pkg.Credits,
			RemainingCredits: pkg.RemainingCredits,
			DurationDays:     pkg.DurationDays,
			ExpiresAt:        pkg.ExpiresAt.Format("2006-01-02 15:04:05"),
			Status:           status,
			CreatedAt:        pkg.CreatedAt.Format("2006-01-02 15:04:05"),
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    response,
	})
}

// MallBalanceResponse represents the points balance response for mall
type MallBalanceResponse struct {
	Balance int `json:"balance"`
}

// GetBalance returns user's current points balance (auth required)
// GET /api/mall/balance
func (h *PointsMallHandler) GetBalance(c *gin.Context) {
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
		"data":    MallBalanceResponse{Balance: asset.Points},
	})
}