package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/middleware"
	"github.com/opc-aicom/backend/internal/pkg/jwt"
	"github.com/opc-aicom/backend/pkg/config"
)

// RefreshToken handles token refresh
// POST /api/user/refresh (requires auth)
func RefreshToken(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get claims from context (set by auth middleware)
		claims, ok := middleware.GetClaims(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{
				Code:    401,
				Message: "unauthorized",
			})
			return
		}

		// Generate new token using existing claims
		newToken, err := jwt.RefreshToken(claims, cfg.JWT.Secret, cfg.JWT.ExpireHours)
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to refresh token",
			})
			return
		}

		// Set new cookie
		setAuthCookie(c, newToken, cfg)

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: gin.H{
				"expiresIn": cfg.JWT.ExpireHours * 3600, // seconds
			},
		})
	}
}
