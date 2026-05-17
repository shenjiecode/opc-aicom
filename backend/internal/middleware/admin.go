package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// AdminRequired checks if the user has admin role
// Must be used after AuthMiddleware
// Note: Role is stored in User model, not in JWT claims currently
// The AdminAuthMiddleware in handler/admin.go handles full role check
func AdminRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get role from context (should be set by AdminAuthMiddleware)
		role, exists := c.Get("userRole")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{"error": "admin access required"})
			c.Abort()
			return
		}

		userRole, ok := role.(string)
		if !ok || userRole != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "admin access required"})
			c.Abort()
			return
		}

		c.Next()
	}
}

// AdminRequiredWithDB checks admin role from database
// Use this when role is not in JWT claims
func AdminRequiredWithDB(db interface{}) gin.HandlerFunc {
	return func(c *gin.Context) {
		// This will be implemented with actual DB check
		// For now, placeholder that checks context
		role, exists := c.Get("userRole")
		if exists && role == "admin" {
			c.Next()
			return
		}

		c.JSON(http.StatusForbidden, gin.H{"error": "admin access required"})
		c.Abort()
	}
}
