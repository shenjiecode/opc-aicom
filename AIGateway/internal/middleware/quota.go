package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/aigateway/internal/model"
	"github.com/opc-aicom/aigateway/internal/pkg/response"
)

// QuotaService defines the interface for quota operations
type QuotaService interface {
	CheckQuota(userID uint) (hasQuota bool, remaining int64, err error)
	DeductQuota(userID uint, amount int64) error
	GetQuotaUsage(userID uint) (used int64, quota int64, err error)
}

// QuotaMiddleware checks if user has quota remaining and blocks requests if exceeded
func QuotaMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		virtualKey := GetVirtualKey(c)
		if virtualKey == nil {
			response.Unauthorized(c, "no virtual key found")
			c.Abort()
			return
		}

		// Check if quota is set (0 means unlimited)
		if virtualKey.Quota > 0 {
			// Calculate remaining quota
			remaining := virtualKey.Quota - virtualKey.UsedQuota
			if remaining <= 0 {
				response.Forbidden(c, "quota exceeded, please purchase more tokens")
				c.Abort()
				return
			}
		}

		c.Next()
	}
}

// QuotaMiddlewareWithService checks quota using a quota service
func QuotaMiddlewareWithService(quotaService QuotaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		virtualKey := GetVirtualKey(c)
		if virtualKey == nil {
			response.Unauthorized(c, "no virtual key found")
			c.Abort()
			return
		}

		// Check quota via service
		hasQuota, _, err := quotaService.CheckQuota(virtualKey.UserID)
		if err != nil {
			response.InternalError(c, "failed to check quota")
			c.Abort()
			return
		}

		if !hasQuota {
			response.Forbidden(c, "quota exceeded, please purchase more tokens")
			c.Abort()
			return
		}

		c.Next()
	}
}

// CheckKeyQuota checks if a virtual key has remaining quota
func CheckKeyQuota(key *model.AIVirtualKey) bool {
	if key == nil {
		return false
	}

	// 0 means unlimited quota
	if key.Quota == 0 {
		return true
	}

	return key.Quota > key.UsedQuota
}

// GetRemainingQuota returns the remaining quota for a virtual key
func GetRemainingQuota(key *model.AIVirtualKey) int64 {
	if key == nil {
		return 0
	}

	// 0 means unlimited quota, return max int64
	if key.Quota == 0 {
		return 1<<63 - 1
	}

	remaining := key.Quota - key.UsedQuota
	if remaining < 0 {
		return 0
	}
	return remaining
}
