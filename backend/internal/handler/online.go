package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/model"
	"gorm.io/gorm"
)

// OnlineUserResponse represents an online user in the response
type OnlineUserResponse struct {
	UserID      uint      `json:"userId"`
	Username    string    `json:"username"`
	Avatar      *string   `json:"avatar"`
	Role        string    `json:"role"`
	LastActive  time.Time `json:"lastActive"`
	IsOnline    bool      `json:"isOnline"`
}

// OnlineUsersResponse represents the response for online users list
type OnlineUsersResponse struct {
	Users      []OnlineUserResponse `json:"users"`
	OnlineCount int                 `json:"onlineCount"`
	TotalCount  int                 `json:"totalCount"`
}

// GetOnlineUsers handles getting online users list
// POST /api/user/online
func GetOnlineUsers(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Online threshold: 15 minutes
		onlineThreshold := time.Now().Add(-15 * time.Minute)

		// Get all users with their last_active_at
		// MySQL-compatible ordering: put NULL values last
		var users []model.User
		if err := db.Order("last_active_at IS NULL, last_active_at DESC").Limit(50).Find(&users).Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Database error",
			})
			return
		}

		// Convert to response format
		var onlineUsers []OnlineUserResponse
		onlineCount := 0

		for _, user := range users {
			isOnline := false
			if user.LastActiveAt != nil && user.LastActiveAt.After(onlineThreshold) {
				isOnline = true
				onlineCount++
			}

			onlineUsers = append(onlineUsers, OnlineUserResponse{
				UserID:     user.ID,
				Username:   user.Username,
				Avatar:     user.Avatar,
				Role:       user.Role,
				LastActive: func() time.Time {
					if user.LastActiveAt != nil {
						return *user.LastActiveAt
					}
					return time.Time{}
				}(),
				IsOnline: isOnline,
			})
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: OnlineUsersResponse{
				Users:       onlineUsers,
				OnlineCount: onlineCount,
				TotalCount:  len(users),
			},
		})
	}
}
