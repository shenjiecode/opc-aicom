package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/opc-aicom/backend/internal/middleware"

	"github.com/opc-aicom/backend/internal/model"

	"gorm.io/gorm"
)

// PointsOrderListResponse represents the points order list response
type PointsOrderListResponse struct {
	List     []*model.PointsOrder `json:"list"`
	Total    int64               `json:"total"`
	Page     int                 `json:"page"`
	PageSize int                 `json:"pageSize"`
}

// PointsOrderDetailResponse represents the points order detail response
type PointsOrderDetailResponse struct {
	*model.PointsOrder
}

// GetPointsOrders handles getting user's points orders with pagination
// GET /api/orders (requires auth)
func GetPointsOrders(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user ID from context (set by auth middleware)
		userID, ok := middleware.GetUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{
				Code:    401,
				Message: "unauthorized",
			})
			return
		}

		// Get pagination params from query
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))

		if page < 1 {
			page = 1
		}
		if pageSize < 1 {
			pageSize = 10
		}
		if pageSize > 100 {
			pageSize = 100
		}

		// Calculate offset
		offset := (page - 1) * pageSize

		// Query orders by user ID
		var orders []*model.PointsOrder
		var total int64

		// Get total count
		if err := db.Model(&model.PointsOrder{}).Where("user_id = ?", userID).Count(&total).Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to count orders",
			})
			return
		}

		// Get paginated orders
		if err := db.Where("user_id = ?", userID).
			Order("created_at DESC").
			Offset(offset).
			Limit(pageSize).
			Find(&orders).Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to fetch orders",
			})
			return
		}

		// Return success response
		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: PointsOrderListResponse{
				List:     orders,
				Total:    total,
				Page:     page,
				PageSize: pageSize,
			},
		})
	}
}

// GetPointsOrderDetail handles getting order details by ID
// GET /api/orders/:id (requires auth)
func GetPointsOrderDetail(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user ID from context (set by auth middleware)
		userID, ok := middleware.GetUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{
				Code:    401,
				Message: "unauthorized",
			})
			return
		}

		// Get order ID from path param
		orderIDStr := c.Param("id")
		orderID, err := strconv.ParseUint(orderIDStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid order id",
			})
			return
		}

		// Query order by ID and user ID
		var order model.PointsOrder
		if err := db.Where("id = ? AND user_id = ?", orderID, userID).First(&order).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, UnifiedResponse{
					Code:    404,
					Message: "order not found",
				})
				return
			}
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to fetch order",
			})
			return
		}

		// Return success response
		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: PointsOrderDetailResponse{
				PointsOrder: &order,
			},
		})
	}
}