package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ActivityTracker creates a middleware that tracks user activity
// Updates last_active_at timestamp for authenticated users
func ActivityTracker(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Only track activity for authenticated users
		userID, ok := GetUserID(c)
		if ok && userID > 0 {
			// Update last_active_at asynchronously to not block the request
			go func(uid uint) {
				now := time.Now()
				db.Model(&struct {
					ID uint `gorm:"primaryKey"`
				}{}).Table("users").Where("id = ?", uid).Update("last_active_at", now)
			}(userID)
		}
		c.Next()
	}
}
