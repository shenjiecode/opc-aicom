package handler

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/model"
	"gorm.io/gorm"
)

var (
	ErrInvalidPoints  = errors.New("points must be greater than 0")
	ErrInvalidUserID  = errors.New("invalid user id")
	ErrUserNotFound   = errors.New("user not found")
)

// AdminAllocateRequest represents the points allocation request
type AdminAllocateRequest struct {
	UserID    uint       `json:"user_id" binding:"required"`
	Points    int        `json:"points" binding:"required,gt=0"`
	Reason    string     `json:"reason" binding:"required"`
	ExpiresAt *time.Time `json:"expires_at"`
}

// AdminPointsHandler handles admin points operations
type AdminPointsHandler struct {
	db *gorm.DB
}

// NewAdminPointsHandler creates a new admin points handler
func NewAdminPointsHandler(db *gorm.DB) *AdminPointsHandler {
	return &AdminPointsHandler{db: db}
}

// AllocatePoints allocates points to a user
// POST /api/admin/points/allocate
func (h *AdminPointsHandler) AllocatePoints(c *gin.Context) {
	var req AdminAllocateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid request: " + err.Error(),
		})
		return
	}

	// Validate request
	if req.Points <= 0 {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: ErrInvalidPoints.Error(),
		})
		return
	}

	// Check if user exists
	var user model.User
	if err := h.db.First(&user, req.UserID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: ErrUserNotFound.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "database error",
		})
		return
	}

	// Calculate expiry (default 1 year from now)
	expiresAt := time.Now().AddDate(1, 0, 0)
	if req.ExpiresAt != nil {
		expiresAt = *req.ExpiresAt
	}

	// Create points batch
	batch := &model.PointsBatch{
		UserID:    req.UserID,
		Points:    req.Points,
		Source:    model.PointsSourceAdminAllocate,
		ExpiresAt: expiresAt,
		Status:    model.PointsStatusActive,
	}

	if err := h.db.Create(batch).Error; err != nil {
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to allocate points: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, UnifiedResponse{
		Code:    0,
		Message: "points allocated successfully",
		Data:    batch,
	})
}
