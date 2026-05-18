package admin

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/aigateway/internal/model"
	"github.com/opc-aicom/aigateway/internal/pkg/response"
)

// UsageService defines the interface for usage statistics operations
type UsageService interface {
	GetAggregateStats(startTime, endTime time.Time) (*AggregateStats, error)
	GetUserStats(userID uint, startTime, endTime time.Time) (*UserStats, error)
	GetKeyStats(keyID uint, startTime, endTime time.Time) (*KeyStats, error)
	GetRecentLogs(limit int) ([]*model.AITokenLog, error)
	GetLogsByUser(userID uint, limit int) ([]*model.AITokenLog, error)
	GetLogsByKey(keyID uint, limit int) ([]*model.AITokenLog, error)
}

// AggregateStats represents aggregate usage statistics
type AggregateStats struct {
	TotalRequests     int64   `json:"total_requests"`
	TotalTokens       int64   `json:"total_tokens"`
	TotalPromptTokens int64   `json:"total_prompt_tokens"`
	TotalCompletionTokens int64 `json:"total_completion_tokens"`
	TotalCost         float64 `json:"total_cost"`
	AvgLatencyMs      int     `json:"avg_latency_ms"`
	SuccessRate       float64 `json:"success_rate"`
	ByModel           []ModelUsage `json:"by_model"`
	ByProvider        []ProviderUsage `json:"by_provider"`
}

// ModelUsage represents usage statistics for a specific model
type ModelUsage struct {
	Model            string  `json:"model"`
	Requests         int64   `json:"requests"`
	Tokens           int64   `json:"tokens"`
	PromptTokens     int64   `json:"prompt_tokens"`
	CompletionTokens int64   `json:"completion_tokens"`
	Cost             float64 `json:"cost"`
}

// ProviderUsage represents usage statistics for a specific provider
type ProviderUsage struct {
	Provider         string  `json:"provider"`
	Requests         int64   `json:"requests"`
	Tokens           int64   `json:"tokens"`
	PromptTokens     int64   `json:"prompt_tokens"`
	CompletionTokens int64   `json:"completion_tokens"`
	Cost             float64 `json:"cost"`
}

// UserStats represents usage statistics for a user
type UserStats struct {
	UserID           uint    `json:"user_id"`
	TotalRequests    int64   `json:"total_requests"`
	TotalTokens      int64   `json:"total_tokens"`
	TotalCost        float64 `json:"total_cost"`
	ByModel          []ModelUsage `json:"by_model"`
	ByKey            []KeyUsage `json:"by_key"`
}

// KeyStats represents usage statistics for a virtual key
type KeyStats struct {
	KeyID            uint    `json:"key_id"`
	KeyName          string  `json:"key_name"`
	TotalRequests    int64   `json:"total_requests"`
	TotalTokens      int64   `json:"total_tokens"`
	TotalCost        float64 `json:"total_cost"`
	QuotaUsed        int64   `json:"quota_used"`
	QuotaRemaining   int64   `json:"quota_remaining"`
	ByModel          []ModelUsage `json:"by_model"`
}

// KeyUsage represents usage statistics for a key
type KeyUsage struct {
	KeyID         uint    `json:"key_id"`
	KeyName       string  `json:"key_name"`
	Requests      int64   `json:"requests"`
	Tokens        int64   `json:"tokens"`
	Cost          float64 `json:"cost"`
}

// parseTimeRange parses start and end time from query parameters
func parseTimeRange(c *gin.Context) (time.Time, time.Time, error) {
	now := time.Now()
	
	startStr := c.DefaultQuery("start", now.AddDate(0, 0, -7).Format(time.RFC3339))
	endStr := c.DefaultQuery("end", now.Format(time.RFC3339))
	
	startTime, err := time.Parse(time.RFC3339, startStr)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	
	endTime, err := time.Parse(time.RFC3339, endStr)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	
	return startTime, endTime, nil
}

// GetUsageHandler handles GET /admin/usage - aggregate stats
func GetUsageHandler(usageService UsageService) gin.HandlerFunc {
	return func(c *gin.Context) {
		startTime, endTime, err := parseTimeRange(c)
		if err != nil {
			response.BadRequest(c, "invalid time range format, use RFC3339")
			return
		}

		stats, err := usageService.GetAggregateStats(startTime, endTime)
		if err != nil {
			response.InternalError(c, "failed to get usage stats: "+err.Error())
			return
		}

		response.Success(c, stats)
	}
}

// GetUserUsageHandler handles GET /admin/usage/user/:user_id
func GetUserUsageHandler(usageService UsageService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr := c.Param("user_id")
		userID, err := strconv.ParseUint(userIDStr, 10, 64)
		if err != nil {
			response.BadRequest(c, "invalid user id")
			return
		}

		startTime, endTime, err := parseTimeRange(c)
		if err != nil {
			response.BadRequest(c, "invalid time range format, use RFC3339")
			return
		}

		stats, err := usageService.GetUserStats(uint(userID), startTime, endTime)
		if err != nil {
			response.InternalError(c, "failed to get user usage stats: "+err.Error())
			return
		}

		response.Success(c, stats)
	}
}

// GetKeyUsageHandler handles GET /admin/usage/key/:key_id
func GetKeyUsageHandler(usageService UsageService) gin.HandlerFunc {
	return func(c *gin.Context) {
		keyIDStr := c.Param("key_id")
		keyID, err := strconv.ParseUint(keyIDStr, 10, 64)
		if err != nil {
			response.BadRequest(c, "invalid key id")
			return
		}

		startTime, endTime, err := parseTimeRange(c)
		if err != nil {
			response.BadRequest(c, "invalid time range format, use RFC3339")
			return
		}

		stats, err := usageService.GetKeyStats(uint(keyID), startTime, endTime)
		if err != nil {
			response.InternalError(c, "failed to get key usage stats: "+err.Error())
			return
		}

		response.Success(c, stats)
	}
}

// GetRecentLogsHandler handles GET /admin/usage/logs
func GetRecentLogsHandler(usageService UsageService) gin.HandlerFunc {
	return func(c *gin.Context) {
		limitStr := c.DefaultQuery("limit", "100")
		limit, err := strconv.Atoi(limitStr)
		if err != nil || limit <= 0 {
			limit = 100
		}
		if limit > 1000 {
			limit = 1000
		}

		logs, err := usageService.GetRecentLogs(limit)
		if err != nil {
			response.InternalError(c, "failed to get recent logs: "+err.Error())
			return
		}

		response.Success(c, logs)
	}
}

// GetUserLogsHandler handles GET /admin/usage/user/:user_id/logs
func GetUserLogsHandler(usageService UsageService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr := c.Param("user_id")
		userID, err := strconv.ParseUint(userIDStr, 10, 64)
		if err != nil {
			response.BadRequest(c, "invalid user id")
			return
		}

		limitStr := c.DefaultQuery("limit", "100")
		limit, err := strconv.Atoi(limitStr)
		if err != nil || limit <= 0 {
			limit = 100
		}
		if limit > 1000 {
			limit = 1000
		}

		logs, err := usageService.GetLogsByUser(uint(userID), limit)
		if err != nil {
			response.InternalError(c, "failed to get user logs: "+err.Error())
			return
		}

		response.Success(c, logs)
	}
}

// GetKeyLogsHandler handles GET /admin/usage/key/:key_id/logs
func GetKeyLogsHandler(usageService UsageService) gin.HandlerFunc {
	return func(c *gin.Context) {
		keyIDStr := c.Param("key_id")
		keyID, err := strconv.ParseUint(keyIDStr, 10, 64)
		if err != nil {
			response.BadRequest(c, "invalid key id")
			return
		}

		limitStr := c.DefaultQuery("limit", "100")
		limit, err := strconv.Atoi(limitStr)
		if err != nil || limit <= 0 {
			limit = 100
		}
		if limit > 1000 {
			limit = 1000
		}

		logs, err := usageService.GetLogsByKey(uint(keyID), limit)
		if err != nil {
			response.InternalError(c, "failed to get key logs: "+err.Error())
			return
		}

		response.Success(c, logs)
	}
}
