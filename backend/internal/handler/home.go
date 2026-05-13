package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/model"
	"gorm.io/gorm"
)

// StatsResponse represents the home stats response
type StatsResponse struct {
	UserCount  int64 `json:"userCount"`
	PostCount  int64 `json:"postCount"`
	TaskCount  int64 `json:"taskCount"`
}

// GetStats handles getting home stats
// POST /api/home/stats
func GetStats(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var userCount int64
		var postCount int64
		var taskCount int64

		// Count users
		if err := db.Model(&model.User{}).Count(&userCount).Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to count users",
			})
			return
		}

		// Count posts
		if err := db.Model(&model.Post{}).Count(&postCount).Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to count posts",
			})
			return
		}

		// Count tasks
		if err := db.Model(&model.Task{}).Count(&taskCount).Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to count tasks",
			})
			return
		}

		// Return success response
		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: StatsResponse{
				UserCount: userCount,
				PostCount: postCount,
				TaskCount: taskCount,
			},
		})
	}
}