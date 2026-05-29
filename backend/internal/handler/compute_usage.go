package handler

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/middleware"
	"github.com/opc-aicom/backend/internal/model"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// ================== Compute Usage Handler ==================

// ComputeUsageHandler handles compute usage related requests
type ComputeUsageHandler struct {
	db *gorm.DB
}

// NewComputeUsageHandler creates a new ComputeUsageHandler
func NewComputeUsageHandler(db *gorm.DB) *ComputeUsageHandler {
	return &ComputeUsageHandler{db: db}
}

// ================== Request/Response Types ==================

// CreateComputeUsageRequest represents the request to create compute usage
type CreateComputeUsageRequest struct {
	PackageID    uint    `json:"package_id" binding:"required"`
	CreditsUsed string  `json:"credits_used" binding:"required"`
	ComputeHours float64 `json:"compute_hours"`
	ResourceType string `json:"resource_type"`
	ResourceID  uint   `json:"resource_id"`
	Description string `json:"description"`
}

// ComputeUsageResponse represents a compute usage record in responses
type ComputeUsageResponse struct {
	ID            uint    `json:"id"`
	UserID        uint    `json:"user_id"`
	PackageID     uint    `json:"package_id"`
	CreditsUsed  string  `json:"credits_used"`
	ComputeHours float64 `json:"compute_hours"`
	ResourceType string  `json:"resource_type"`
	ResourceID   uint    `json:"resource_id"`
	Description string  `json:"description"`
	CreatedAt    string  `json:"created_at"`
	UpdatedAt    string  `json:"updated_at"`
}

// ComputeUsageListRequest represents the list request with pagination
type ComputeUsageListRequest struct {
	Page     int    `json:"page"`
	PageSize int    `json:"pageSize"`
	PackageID uint   `json:"package_id"`
}

// ComputeUsageListResponse represents the list response
type ComputeUsageListResponse struct {
	List     []ComputeUsageResponse `json:"list"`
	Total    int64                  `json:"total"`
	Page     int                    `json:"page"`
	PageSize int                    `json:"pageSize"`
}

// ================== Handlers ==================

// CreateComputeUsage creates a new compute usage record
// POST /api/compute/usage
func (h *ComputeUsageHandler) CreateComputeUsage(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, UnifiedResponse{
			Code:    401,
			Message: "未登录",
		})
		return
	}

	var req CreateComputeUsageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "参数错误: " + err.Error(),
		})
		return
	}

	// Parse credits used
	creditsUsed, err := decimal.NewFromString(req.CreditsUsed)
	if err != nil || creditsUsed.IsNegative() {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "无效的 credits_used",
		})
		return
	}

	// Convert credits to int for deduction
	creditsInt := int(creditsUsed.IntPart())
	if creditsInt <= 0 {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "无效的 credits_used",
		})
		return
	}

	// Verify package exists
	var computePkg model.ComputePackage
	if err := h.db.First(&computePkg, req.PackageID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "套餐不存在",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "查询套餐失败",
		})
		return
	}

	// Get user's asset
	var asset model.UserAsset
	if err := h.db.Where("user_id = ?", userID).First(&asset).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "用户资产不存在",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "查询用户资产失败",
		})
		return
	}

	// Check balance
	if asset.Points < creditsInt {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "积分不足",
		})
		return
	}

	// Create compute usage record and deduct credits in transaction
	var usage model.ComputeUsage
	err = h.db.Transaction(func(tx *gorm.DB) error {
		// Create ComputeUsage record
		usage = model.ComputeUsage{
			UserID:        userID,
			PackageID:     req.PackageID,
			CreditsUsed:   creditsUsed,
			ComputeHours:  req.ComputeHours,
			ResourceType:  req.ResourceType,
			ResourceID:   req.ResourceID,
			Description:   req.Description,
		}
		if err := tx.Create(&usage).Error; err != nil {
			return err
		}

		// Check if this is a task-related compute usage with escrow
		deductAmount := creditsInt
		if req.ResourceType == "task" && req.ResourceID > 0 {
			var task model.Task
			if err := tx.First(&task, req.ResourceID).Error; err == nil && task.EscrowPoints > 0 {
				// Task has escrow points, use them first
				if task.EscrowPoints >= deductAmount {
					// Sufficient escrow - deduct from escrow only
					if err := tx.Model(&model.Task{}).Where("id = ?", task.ID).Update("escrow_points", gorm.Expr("escrow_points - ?", deductAmount)).Error; err != nil {
						return err
					}
					// Create credit transaction for escrow deduction
					transaction := model.CreditTransaction{
						UserID:       userID,
						Type:         model.CreditTypeEscrowDeduct,
						Amount:       -deductAmount,
						BalanceAfter: asset.Points,
						Description:  fmt.Sprintf("算力使用扣除托管积分: 任务 #%d, 金额 %d", req.ResourceID, deductAmount),
						RelatedID:    &req.ResourceID,
						RelatedType:  "task_escrow",
					}
					if err := tx.Create(&transaction).Error; err != nil {
						return err
					}
					return nil
				}
				// Insufficient escrow - deduct partial from escrow, remainder from user
				partialEscrow := task.EscrowPoints
				if err := tx.Model(&model.Task{}).Where("id = ?", task.ID).Update("escrow_points", gorm.Expr("escrow_points - ?", partialEscrow)).Error; err != nil {
					return err
				}
				// Create credit transaction for escrow deduction
				escrowTransaction := model.CreditTransaction{
					UserID:       userID,
					Type:         model.CreditTypeEscrowDeduct,
					Amount:       -partialEscrow,
					BalanceAfter: asset.Points,
					Description:  fmt.Sprintf("算力使用扣除托管积分(部分): 任务 #%d, 金额 %d", req.ResourceID, partialEscrow),
					RelatedID:    &req.ResourceID,
					RelatedType:  "task_escrow",
				}
				if err := tx.Create(&escrowTransaction).Error; err != nil {
					return err
				}
				// Deduct remaining from user asset
				remainder := deductAmount - partialEscrow
				asset.Points -= remainder
				if err := tx.Save(&asset).Error; err != nil {
					return err
				}
				// Create credit transaction for direct deduction
				directTransaction := model.CreditTransaction{
					UserID:       userID,
					Type:         model.CreditTypeConsume,
					Amount:       -remainder,
					BalanceAfter: asset.Points,
					Description:  fmt.Sprintf("算力使用积分消费: 金额 %d", remainder),
					RelatedID:    &req.ResourceID,
					RelatedType:  "compute_usage",
				}
				if err := tx.Create(&directTransaction).Error; err != nil {
					return err
				}
				return nil
			}
		}

		// No escrow or not a task - deduct from user asset directly
		asset.Points -= deductAmount
		if err := tx.Save(&asset).Error; err != nil {
			return err
		}

		// Create credit transaction for direct deduction
		transaction := model.CreditTransaction{
			UserID:       userID,
			Type:         model.CreditTypeConsume,
			Amount:       -deductAmount,
			BalanceAfter: asset.Points,
			Description:  fmt.Sprintf("算力使用积分消费: 金额 %d", deductAmount),
		}
		if err := tx.Create(&transaction).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "创建计算用量记录失败",
		})
		return
	}

	c.JSON(http.StatusOK, UnifiedResponse{
		Code:    0,
		Message: "success",
		Data: ComputeUsageResponse{
			ID:            usage.ID,
			UserID:        usage.UserID,
			PackageID:     usage.PackageID,
			CreditsUsed:   usage.CreditsUsed.String(),
			ComputeHours:  usage.ComputeHours,
			ResourceType:  usage.ResourceType,
			ResourceID:    usage.ResourceID,
			Description:   usage.Description,
			CreatedAt:     usage.CreatedAt.Format("2006-01-02 15:04:05"),
			UpdatedAt:     usage.UpdatedAt.Format("2006-01-02 15:04:05"),
		},
	})
}

// GetComputeUsageList returns user's compute usage history with pagination
// GET /api/compute/usage
func (h *ComputeUsageHandler) GetComputeUsageList(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, UnifiedResponse{
			Code:    401,
			Message: "未登录",
		})
		return
	}

	var req ComputeUsageListRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		req.Page = 1
		req.PageSize = 20
	}

	if req.Page < 1 {
		req.Page = 1
	}
	if req.PageSize < 1 || req.PageSize > 100 {
		req.PageSize = 20
	}

	query := h.db.Model(&model.ComputeUsage{}).Where("user_id = ?", userID)

	// Apply filters
	if req.PackageID > 0 {
		query = query.Where("package_id = ?", req.PackageID)
	}

	// Get total count
	var total int64
	query.Count(&total)

	// Get list
	offset := (req.Page - 1) * req.PageSize
	var usages []model.ComputeUsage
	query.Order("created_at DESC").Offset(offset).Limit(req.PageSize).Find(&usages)

	list := make([]ComputeUsageResponse, len(usages))
	for i, u := range usages {
		list[i] = ComputeUsageResponse{
			ID:            u.ID,
			UserID:        u.UserID,
			PackageID:     u.PackageID,
			CreditsUsed:   u.CreditsUsed.String(),
			ComputeHours:  u.ComputeHours,
			ResourceType:  u.ResourceType,
			ResourceID:    u.ResourceID,
			Description:   u.Description,
			CreatedAt:     u.CreatedAt.Format("2006-01-02 15:04:05"),
			UpdatedAt:     u.UpdatedAt.Format("2006-01-02 15:04:05"),
		}
	}

	c.JSON(http.StatusOK, UnifiedResponse{
		Code:    0,
		Message: "success",
		Data: ComputeUsageListResponse{
			List:     list,
			Total:    total,
			Page:     req.Page,
			PageSize: req.PageSize,
		},
	})
}

// GetComputeUsageDetail returns a single compute usage record
// GET /api/compute/usage/:id
func (h *ComputeUsageHandler) GetComputeUsageDetail(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, UnifiedResponse{
			Code:    401,
			Message: "未登录",
		})
		return
	}

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "无效的用量ID",
		})
		return
	}

	var usage model.ComputeUsage
	if err := h.db.Where("id = ? AND user_id = ?", id, userID).First(&usage).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "用量记录不存在",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "查询用量记录失败",
		})
		return
	}

	c.JSON(http.StatusOK, UnifiedResponse{
		Code:    0,
		Message: "success",
		Data: ComputeUsageResponse{
			ID:            usage.ID,
			UserID:        usage.UserID,
			PackageID:     usage.PackageID,
			CreditsUsed:   usage.CreditsUsed.String(),
			ComputeHours:  usage.ComputeHours,
			ResourceType:  usage.ResourceType,
			ResourceID:    usage.ResourceID,
			Description:   usage.Description,
			CreatedAt:     usage.CreatedAt.Format("2006-01-02 15:04:05"),
			UpdatedAt:     usage.UpdatedAt.Format("2006-01-02 15:04:05"),
		},
	})
}
