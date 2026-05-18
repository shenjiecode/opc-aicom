package middleware

import (
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/aigateway/internal/model"
	"github.com/opc-aicom/aigateway/internal/pkg/response"
)

// KeyService defines the interface for virtual key operations
type KeyService interface {
	ValidateKey(keyString string) (*model.AIVirtualKey, error)
}

// ContextKey type for storing values in gin.Context
type ContextKey string

const (
	// VirtualKeyContextKey is the key for storing virtual key in context
	VirtualKeyContextKey ContextKey = "virtual_key"
	// UserIDContextKey is the key for storing user ID in context
	UserIDContextKey ContextKey = "user_id"
)

// AuthMiddleware validates Bearer token from Authorization header
// and sets key info in gin.Context
func AuthMiddleware(keyService KeyService) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			response.Unauthorized(c, "missing authorization header")
			c.Abort()
			return
		}

		// Parse Bearer token
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			response.Unauthorized(c, "invalid authorization format, expected 'Bearer <token>'")
			c.Abort()
			return
		}

		token := parts[1]
		if token == "" {
			response.Unauthorized(c, "empty bearer token")
			c.Abort()
			return
		}

		// Validate the virtual key
		virtualKey, err := keyService.ValidateKey(token)
		if err != nil {
			response.Unauthorized(c, "invalid or expired API key")
			c.Abort()
			return
		}

		// Check if key is active
		if virtualKey.Status != model.VirtualKeyStatusActive {
			response.Forbidden(c, "API key is revoked")
			c.Abort()
			return
		}

		// Check if key has expired
		if virtualKey.ExpiresAt != nil && virtualKey.ExpiresAt.Before(time.Now()) {
			response.Forbidden(c, "API key has expired")
			c.Abort()
			return
		}

		// Set key info in context
		c.Set(VirtualKeyContextKey, virtualKey)
		c.Set(UserIDContextKey, virtualKey.UserID)

		c.Next()
	}
}

// GetVirtualKey retrieves the virtual key from gin.Context
func GetVirtualKey(c *gin.Context) *model.AIVirtualKey {
	val, exists := c.Get(VirtualKeyContextKey)
	if !exists {
		return nil
	}
	return val.(*model.AIVirtualKey)
}

// GetUserID retrieves the user ID from gin.Context
func GetUserID(c *gin.Context) uint {
	val, exists := c.Get(UserIDContextKey)
	if !exists {
		return 0
	}
	return val.(uint)
}