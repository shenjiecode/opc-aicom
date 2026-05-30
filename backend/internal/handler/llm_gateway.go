package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/middleware"
	"github.com/opc-aicom/backend/internal/model"
	"gorm.io/gorm"
)

// LLMGatewayHandler handles LLM gateway/API key requests
type LLMGatewayHandler struct {
	db *gorm.DB
}

// NewLLMGatewayHandler creates a new LLMGatewayHandler
func NewLLMGatewayHandler(db *gorm.DB) *LLMGatewayHandler {
	return &LLMGatewayHandler{db: db}
}

// GatewayResponse represents gateway info response
type GatewayResponse struct {
	ID          uint   `json:"id"`
	APIKey      string `json:"api_key"`      // Masked for security
	KeyName     string `json:"key_name"`
	Quota       int64  `json:"quota"`
	UsedTokens  int64  `json:"used_tokens"`
	CreditsUsed int    `json:"credits_used"`
	Remaining   int64  `json:"remaining"`
	Status      string `json:"status"`
	ExpiresAt   string `json:"expires_at,omitempty"`
	CreatedAt   string `json:"created_at"`
}

// GetMyGateway returns current user's gateway/API key info
// GET /api/gateway/my
func (h *LLMGatewayHandler) GetMyGateway(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未登录"})
		return
	}

	var gateway model.LLMGateway
	err := h.db.Where("user_id = ?", userID).First(&gateway).Error

	if err == gorm.ErrRecordNotFound {
		c.JSON(http.StatusOK, gin.H{
			"code":    0,
			"message": "success",
			"data":    nil,
		})
		return
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "查询失败"})
		return
	}

	// Mask API key for security (show only last 8 chars)
	maskedKey := ""
	if len(gateway.APIKey) > 8 {
		maskedKey = "sk-****" + gateway.APIKey[len(gateway.APIKey)-8:]
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": GatewayResponse{
			ID:          gateway.ID,
			APIKey:      maskedKey,
			KeyName:     gateway.KeyName,
			Quota:       gateway.Quota,
			UsedTokens:  gateway.UsedTokens,
			CreditsUsed: gateway.CreditsUsed,
			Remaining:   gateway.Quota - gateway.UsedTokens,
			Status:      gateway.Status,
			ExpiresAt:   formatTime(gateway.ExpiresAt),
			CreatedAt:   gateway.CreatedAt.Format("2006-01-02 15:04:05"),
		},
	})
}

// CreateGatewayRequest represents a create gateway request
type CreateGatewayRequest struct {
	KeyName string `json:"key_name"`
	Quota   int64  `json:"quota"`
}

// CreateGateway creates a gateway for the current user
// POST /api/gateway/create
func (h *LLMGatewayHandler) CreateGateway(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未登录"})
		return
	}

	// Check if user already has a gateway
	var existingGateway model.LLMGateway
	err := h.db.Where("user_id = ?", userID).First(&existingGateway).Error
	if err == nil {
		// Gateway exists, return it
		maskedKey := ""
		if len(existingGateway.APIKey) > 8 {
			maskedKey = "sk-****" + existingGateway.APIKey[len(existingGateway.APIKey)-8:]
		}
		c.JSON(http.StatusOK, gin.H{
			"code":    0,
			"message": "已存在API Key",
			"data": GatewayResponse{
				ID:          existingGateway.ID,
				APIKey:      maskedKey,
				KeyName:     existingGateway.KeyName,
				Quota:       existingGateway.Quota,
				UsedTokens:  existingGateway.UsedTokens,
				CreditsUsed: existingGateway.CreditsUsed,
				Remaining:   existingGateway.Quota - existingGateway.UsedTokens,
				Status:      existingGateway.Status,
				CreatedAt:   existingGateway.CreatedAt.Format("2006-01-02 15:04:05"),
			},
		})
		return
	}

	var req CreateGatewayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		req.KeyName = "Default Key"
		req.Quota = 1000000 // Default 1M tokens
	}

	if req.Quota <= 0 {
		req.Quota = 1000000
	}

	// Generate API key
	apiKey, err := generateAPIKey()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "生成API Key失败"})
		return
	}

	gateway := model.LLMGateway{
		UserID:     userID,
		APIKey:     apiKey,
		KeyName:    req.KeyName,
		Quota:      req.Quota,
		UsedTokens: 0,
		Status:     model.GatewayStatusActive,
	}

	if err := h.db.Create(&gateway).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "创建失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": GatewayResponse{
			ID:          gateway.ID,
			APIKey:      apiKey, // Return full key only on creation
			KeyName:     gateway.KeyName,
			Quota:       gateway.Quota,
			UsedTokens:  gateway.UsedTokens,
			CreditsUsed: gateway.CreditsUsed,
			Remaining:   gateway.Quota - gateway.UsedTokens,
			Status:      gateway.Status,
			CreatedAt:   gateway.CreatedAt.Format("2006-01-02 15:04:05"),
		},
	})
}

// UsageResponse represents usage statistics response
type UsageResponse struct {
	Quota       int64  `json:"quota"`
	UsedTokens  int64  `json:"used_tokens"`
	CreditsUsed int    `json:"credits_used"`
	Remaining   int64  `json:"remaining"`
	UsagePercent float64 `json:"usage_percent"`
}

// GetUsage returns usage statistics for the current user's gateway
// POST /api/gateway/usage
func (h *LLMGatewayHandler) GetUsage(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未登录"})
		return
	}

	var gateway model.LLMGateway
	err := h.db.Where("user_id = ?", userID).First(&gateway).Error

	if err == gorm.ErrRecordNotFound {
		c.JSON(http.StatusOK, gin.H{
			"code":    0,
			"message": "success",
			"data": UsageResponse{
				Quota:       0,
				UsedTokens:  0,
				CreditsUsed: 0,
				Remaining:   0,
				UsagePercent: 0,
			},
		})
		return
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "查询失败"})
		return
	}

	usagePercent := float64(0)
	if gateway.Quota > 0 {
		usagePercent = float64(gateway.UsedTokens) / float64(gateway.Quota) * 100
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": UsageResponse{
			Quota:        gateway.Quota,
			UsedTokens:   gateway.UsedTokens,
			CreditsUsed:  gateway.CreditsUsed,
		Remaining:    gateway.Quota - gateway.UsedTokens,
		UsagePercent: usagePercent,
		},
	})
}

// GatewayConfigResponse represents gateway config response
type GatewayConfigResponse struct {
	ID          uint   `json:"id"`
	APIKey      string `json:"api_key"` // Masked
	GatewayURL  string `json:"gateway_url"`
	Source      string `json:"source"`
	Quota       int64  `json:"quota"`
	UsedTokens  int64  `json:"used_tokens"`
	Remaining   int64  `json:"remaining"`
	UsagePercent float64 `json:"usage_percent"`
	Status      string `json:"status"`
}

// GetGatewayConfig returns gateway configuration
// GET /api/gateway/config
func (h *LLMGatewayHandler) GetGatewayConfig(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未登录"})
		return
	}

	var gateway model.LLMGateway
	err := h.db.Where("user_id = ?", userID).First(&gateway).Error

	if err == gorm.ErrRecordNotFound {
		c.JSON(http.StatusOK, gin.H{
			"code":    0,
			"message": "success",
			"data":    nil,
		})
		return
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "查询失败"})
		return
	}

	// Mask API key - show only last 4 chars
	maskedKey := ""
	if len(gateway.APIKey) > 4 {
		maskedKey = "*" + gateway.APIKey[len(gateway.APIKey)-4:]
	}

	usagePercent := float64(0)
	if gateway.Quota > 0 {
		usagePercent = float64(gateway.UsedTokens) / float64(gateway.Quota) * 100
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": GatewayConfigResponse{
			ID:           gateway.ID,
			APIKey:       maskedKey,
			GatewayURL:   gateway.GatewayURL,
			Source:       gateway.Source,
			Quota:        gateway.Quota,
			UsedTokens:   gateway.UsedTokens,
			Remaining:    gateway.Quota - gateway.UsedTokens,
			UsagePercent: usagePercent,
			Status:       gateway.Status,
		},
	})
}

// UpdateGatewayConfigRequest represents update config request
type UpdateGatewayConfigRequest struct {
	GatewayURL string `json:"gateway_url"`
}

// UpdateGatewayConfig updates gateway configuration
// PUT /api/gateway/config
func (h *LLMGatewayHandler) UpdateGatewayConfig(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未登录"})
		return
	}

	var req UpdateGatewayConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请求参数错误"})
		return
	}

	var gateway model.LLMGateway
	err := h.db.Where("user_id = ?", userID).First(&gateway).Error

	if err == gorm.ErrRecordNotFound {
		c.JSON(http.StatusOK, gin.H{
			"code":    0,
			"message": "success",
			"data":    nil,
		})
		return
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "查询失败"})
		return
	}

	// Update GatewayURL if provided
	if req.GatewayURL != "" {
		gateway.GatewayURL = req.GatewayURL
	}

	if err := h.db.Save(&gateway).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "更新失败"})
		return
	}

	// Mask API key for response
	maskedKey := ""
	if len(gateway.APIKey) > 4 {
		maskedKey = "*" + gateway.APIKey[len(gateway.APIKey)-4:]
	}

	usagePercent := float64(0)
	if gateway.Quota > 0 {
		usagePercent = float64(gateway.UsedTokens) / float64(gateway.Quota) * 100
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": GatewayConfigResponse{
			ID:           gateway.ID,
			APIKey:       maskedKey,
			GatewayURL:   gateway.GatewayURL,
			Source:       gateway.Source,
			Quota:        gateway.Quota,
			UsedTokens:   gateway.UsedTokens,
			Remaining:    gateway.Quota - gateway.UsedTokens,
			UsagePercent: usagePercent,
			Status:       gateway.Status,
		},
	})
}

// formatTime formats a time pointer to string
func formatTime(t *time.Time) string {
	if t == nil {
		return ""
	}
	return t.Format("2006-01-02 15:04:05")
}