package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	jwtpkg "github.com/opc-aicom/backend/internal/pkg/jwt"
)

// AuthMiddleware creates a JWT authentication middleware
// Token can be provided via Cookie (preferred) or Authorization header (fallback)
func AuthMiddleware(jwtSecret string, cookieName string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var tokenString string

		// First, try to get token from cookie
		tokenFromCookie, err := c.Cookie(cookieName)
		if err == nil && tokenFromCookie != "" {
			tokenString = tokenFromCookie
		}

		// Fallback: try Authorization header
		if tokenString == "" {
			authHeader := c.GetHeader("Authorization")
			if authHeader != "" {
				// Extract token from "Bearer <token>"
				parts := strings.SplitN(authHeader, " ", 2)
				if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
					tokenString = parts[1]
				}
			}
		}

		// No token found
		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			c.Abort()
			return
		}

		// Parse and validate token
		claims, err := jwtpkg.ParseToken(tokenString, jwtSecret)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			c.Abort()
			return
		}

		// Set user info in context
		c.Set("userID", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("claims", claims)

		c.Next()
	}
}

// GetUserID extracts user ID from gin context (after AuthMiddleware)
func GetUserID(c *gin.Context) (uint, bool) {
	userID, exists := c.Get("userID")
	if !exists {
		return 0, false
	}
	id, ok := userID.(uint)
	return id, ok
}

// GetUsername extracts username from gin context (after AuthMiddleware)
func GetUsername(c *gin.Context) (string, bool) {
	username, exists := c.Get("username")
	if !exists {
		return "", false
	}
	name, ok := username.(string)
	return name, ok
}

// GetClaims extracts full claims from gin context (after AuthMiddleware)
func GetClaims(c *gin.Context) (*jwtpkg.Claims, bool) {
claims, exists := c.Get("claims")
if !exists {
return nil, false
}
cclaims, ok := claims.(*jwtpkg.Claims)
return cclaims, ok
}

// RequireRoleMiddleware creates a middleware that checks for specific roles
// This middleware should be used after AuthMiddleware
func RequireRoleMiddleware(allowedRoles []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user role from context (set by AuthMiddleware or AdminAuthMiddleware)
		userRole, exists := c.Get("userRole")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{"error": "role information not available"})
			c.Abort()
			return
		}

		role, ok := userRole.(string)
		if !ok {
			c.JSON(http.StatusForbidden, gin.H{"error": "invalid role format"})
			c.Abort()
			return
		}

		// Check if user role is in allowed roles
		allowed := false
		for _, allowedRole := range allowedRoles {
			if role == allowedRole {
				allowed = true
				break
			}
		}

		if !allowed {
			c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
			c.Abort()
			return
		}

		c.Next()
	}
}
