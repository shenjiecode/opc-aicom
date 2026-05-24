package handler

import (
	"crypto/rand"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/middleware"
	"github.com/opc-aicom/backend/internal/model"
	"github.com/opc-aicom/backend/internal/pkg/jwt"
	"github.com/opc-aicom/backend/pkg/config"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// ================== Dashboard ==================

// DashboardStatsResponse represents the dashboard statistics
type DashboardStatsResponse struct {
	TotalUsers    int64 `json:"totalUsers"`
	TotalPosts    int64 `json:"totalPosts"`
	TotalEvents   int64 `json:"totalEvents"`
	TotalTasks    int64 `json:"totalTasks"`
	TotalOrders   int64 `json:"totalOrders"`
	PendingReviews int64 `json:"pendingReviews"`
	NewUsersToday int64 `json:"newUsersToday"`
	ActiveUsers   int64 `json:"activeUsers"`
}

// DashboardTodoResponse represents a todo item
type DashboardTodoResponse struct {
	ID        uint   `json:"id"`
	Type      string `json:"type"`
	Title     string `json:"title"`
	CreatedAt time.Time `json:"createdAt"`
}

// DashboardResponse represents the full dashboard data
type DashboardResponse struct {
	Stats DashboardStatsResponse `json:"stats"`
	Todos []DashboardTodoResponse `json:"todos"`
}

// GetAdminDashboard returns dashboard statistics
// POST /api/admin/dashboard
func GetAdminDashboard(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get stats
		var stats DashboardStatsResponse
		
		// Total users
		db.Model(&model.User{}).Count(&stats.TotalUsers)
		
		// New users today
		today := time.Now().Format("2006-01-02")
		db.Model(&model.User{}).Where("DATE(created_at) = ?", today).Count(&stats.NewUsersToday)
		
		// Active users (last 7 days)
		sevenDaysAgo := time.Now().AddDate(0, 0, -7)
		db.Model(&model.User{}).Where("last_active_at > ?", sevenDaysAgo).Count(&stats.ActiveUsers)
		
		// Total posts
		db.Model(&model.Post{}).Count(&stats.TotalPosts)
		
		// Total events
		db.Model(&model.Event{}).Count(&stats.TotalEvents)
		
		// Total tasks
		db.Model(&model.Task{}).Count(&stats.TotalTasks)
		
		// Total orders
		db.Model(&model.Order{}).Count(&stats.TotalOrders)
		
		// Pending reviews
		db.Model(&model.Post{}).Where("status = ?", "pending").Count(&stats.PendingReviews)
		db.Model(&model.Event{}).Where("status = ?", "pending").Count(&stats.PendingReviews)
		
		// Get pending review items
		var todos []DashboardTodoResponse
		
		// Pending posts
		var pendingPosts []model.Post
		db.Where("status = ?", "pending").Order("created_at desc").Limit(5).Find(&pendingPosts)
		for _, p := range pendingPosts {
			todos = append(todos, DashboardTodoResponse{
				ID:        p.ID,
				Type:      "post",
				Title:     p.Title,
				CreatedAt: p.CreatedAt,
			})
		}
		
		// Pending events
		var pendingEvents []model.Event
		db.Where("status = ?", "pending").Order("created_at desc").Limit(5).Find(&pendingEvents)
		for _, e := range pendingEvents {
			todos = append(todos, DashboardTodoResponse{
				ID:        e.ID,
				Type:      "event",
				Title:     e.Title,
				CreatedAt: e.CreatedAt,
			})
		}
		
		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: DashboardResponse{
				Stats: stats,
				Todos: todos,
			},
		})
	}
}

// ================== User Management ==================

// AdminUserListRequest represents the user list request
type AdminUserListRequest struct {
	Page     int    `json:"page"`
	PageSize int    `json:"pageSize"`
	Search   string `json:"search"`
	Role     string `json:"role"`
	Status   string `json:"status"`
}

// AdminUserListItem represents a user in the list
type AdminUserListItem struct {
	ID           uint       `json:"id"`
	Username     string     `json:"username"`
	Avatar       *string    `json:"avatar"`
	Role         string     `json:"role"`
	Status       string     `json:"status"`
	VipLevel     int        `json:"vipLevel"`
	LastActiveAt *time.Time `json:"lastActiveAt"`
	CreatedAt    time.Time  `json:"createdAt"`
}

// AdminUserListResponse represents the user list response
type AdminUserListResponse struct {
	List     []AdminUserListItem `json:"list"`
	Total    int64               `json:"total"`
	Page     int                 `json:"page"`
	PageSize int                 `json:"pageSize"`
}

// AdminUserDetailResponse represents detailed user info
type AdminUserDetailResponse struct {
	ID           uint              `json:"id"`
	Username     string            `json:"username"`
	Avatar       *string           `json:"avatar"`
	Role         string            `json:"role"`
	Status       string            `json:"status"`
	VipLevel     int               `json:"vipLevel"`
	VipExpiredAt *time.Time        `json:"vipExpiredAt"`
	LastActiveAt *time.Time        `json:"lastActiveAt"`
	CreatedAt    time.Time         `json:"createdAt"`
	Assets       *model.UserAsset  `json:"assets"`
}

// GetAdminUserList returns paginated user list
// POST /api/admin/users/list
func GetAdminUserList(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req AdminUserListRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			req.Page = 1
			req.PageSize = 20
		}
		
		if req.Page < 1 {
			req.Page = 1
		}
		if req.PageSize < 1 || req.PageSize > 100 {
			req.PageSize = 20
		}
		
		query := db.Model(&model.User{})
		
		// Apply filters
		if req.Search != "" {
			query = query.Where("username LIKE ?", "%"+req.Search+"%")
		}
		if req.Role != "" {
			query = query.Where("role = ?", req.Role)
		}
		if req.Status != "" {
			query = query.Where("status = ?", req.Status)
		}
		
		// Get total
		var total int64
		query.Count(&total)
		
		// Get list
		var users []model.User
		offset := (req.Page - 1) * req.PageSize
		query.Order("created_at desc").Offset(offset).Limit(req.PageSize).Find(&users)
		
		// Convert to response
		list := make([]AdminUserListItem, len(users))
		for i, u := range users {
			list[i] = AdminUserListItem{
				ID:           u.ID,
				Username:     u.Username,
				Avatar:       u.Avatar,
				Role:         u.Role,
				Status:       u.Status,
				VipLevel:     u.VipLevel,
				LastActiveAt: u.LastActiveAt,
				CreatedAt:    u.CreatedAt,
			}
		}
		
		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: AdminUserListResponse{
				List:     list,
				Total:    total,
				Page:     req.Page,
				PageSize: req.PageSize,
			},
		})
	}
}

// GetAdminUserDetail returns user details
// POST /api/admin/users/:id/detail
func GetAdminUserDetail(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr := c.Param("id")
		userID, err := strconv.ParseUint(userIDStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid user id",
			})
			return
		}
		
		var user model.User
		if err := db.First(&user, userID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, UnifiedResponse{
					Code:    404,
					Message: "user not found",
				})
				return
			}
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "database error",
			})
			return
		}
		
		// Get user assets
		var assets model.UserAsset
		db.Where("user_id = ?", userID).First(&assets)
		
		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: AdminUserDetailResponse{
				ID:           user.ID,
				Username:     user.Username,
				Avatar:       user.Avatar,
				Role:         user.Role,
				Status:       user.Status,
				VipLevel:     user.VipLevel,
				VipExpiredAt: user.VipExpiredAt,
				LastActiveAt: user.LastActiveAt,
				CreatedAt:    user.CreatedAt,
				Assets:       &assets,
			},
		})
	}
}

// BanUserRequest represents the ban request
type BanUserRequest struct {
	Reason string `json:"reason"`
}

// BanUser bans a user
// POST /api/admin/users/:id/ban
func BanUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr := c.Param("id")
		userID, err := strconv.ParseUint(userIDStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid user id",
			})
			return
		}
		
		var req BanUserRequest
		c.ShouldBindJSON(&req)
		
		// Check if user exists
		var user model.User
		if err := db.First(&user, userID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, UnifiedResponse{
					Code:    404,
					Message: "user not found",
				})
				return
			}
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "database error",
			})
			return
		}
		
		// Update status to banned
		if err := db.Model(&user).Update("status", "banned").Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to ban user",
			})
			return
		}
		
		// Log activity
		adminID, _ := middleware.GetUserID(c)
		activityLog := model.ActivityLog{
			UserID: adminID,
			Action: "admin_ban_user",
			Details: "Banned user " + user.Username + " (ID: " + userIDStr + "). Reason: " + req.Reason,
		}
		db.Create(&activityLog)
		
		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "user banned successfully",
		})
	}
}

// UnbanUser unbans a user
// POST /api/admin/users/:id/unban
func UnbanUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr := c.Param("id")
		userID, err := strconv.ParseUint(userIDStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid user id",
			})
			return
		}
		
		var user model.User
		if err := db.First(&user, userID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, UnifiedResponse{
					Code:    404,
					Message: "user not found",
				})
				return
			}
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "database error",
			})
			return
		}
		
		// Update status to active
		if err := db.Model(&user).Update("status", "active").Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to unban user",
			})
			return
		}
		
		// Log activity
		adminID, _ := middleware.GetUserID(c)
		activityLog := model.ActivityLog{
			UserID: adminID,
			Action: "admin_unban_user",
			Details: "Unbanned user " + user.Username + " (ID: " + userIDStr + ")",
		}
		db.Create(&activityLog)
		
		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "user unbanned successfully",
		})
	}
}

// ChangeUserRoleRequest represents the role change request
type ChangeUserRoleRequest struct {
	Role string `json:"role" binding:"required"`
}

// ChangeUserRole changes a user's role
// POST /api/admin/users/:id/role
func ChangeUserRole(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr := c.Param("id")
		userID, err := strconv.ParseUint(userIDStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid user id",
			})
			return
		}
		
		var req ChangeUserRoleRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "role is required",
			})
			return
		}
		
		// Validate role
		validRoles := map[string]bool{"user": true, "admin": true, "operator": true}
		if !validRoles[req.Role] {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid role",
			})
			return
		}
		
		var user model.User
		if err := db.First(&user, userID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, UnifiedResponse{
					Code:    404,
					Message: "user not found",
				})
				return
			}
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "database error",
			})
			return
		}
		
		if err := db.Model(&user).Update("role", req.Role).Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to change role",
			})
			return
		}
		
		// Log activity
		adminID, _ := middleware.GetUserID(c)
		activityLog := model.ActivityLog{
			UserID: adminID,
			Action: "admin_change_role",
			Details: "Changed user " + user.Username + " role to " + req.Role,
		}
		db.Create(&activityLog)
		
		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "role changed successfully",
		})
	}
}

// ================== Content Review ==================

// ReviewPostListRequest represents the post review list request
type ReviewPostListRequest struct {
	Page     int    `json:"page"`
	PageSize int    `json:"pageSize"`
	Status   string `json:"status"` // pending, approved, rejected, all
}

// ReviewPostListItem represents a post pending review
type ReviewPostListItem struct {
	ID           uint      `json:"id"`
	Title        string    `json:"title"`
	Content      string    `json:"content"`
	AuthorID     uint      `json:"authorId"`
	AuthorName   string    `json:"authorName"`
	Category     string    `json:"category"`
	Status       string    `json:"status"`
	CreatedAt    time.Time `json:"createdAt"`
}

// ReviewPostListResponse represents the post review list response
type ReviewPostListResponse struct {
	List     []ReviewPostListItem `json:"list"`
	Total    int64                `json:"total"`
	Page     int                  `json:"page"`
	PageSize int                  `json:"pageSize"`
}

// GetReviewPostList returns posts pending review
// POST /api/admin/posts/review/list
func GetReviewPostList(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req ReviewPostListRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			req.Page = 1
			req.PageSize = 20
		}
		
		if req.Page < 1 {
			req.Page = 1
		}
		if req.PageSize < 1 || req.PageSize > 100 {
			req.PageSize = 20
		}
		
		// Add status column to post if not exists - we'll use a simple approach
		// For now, we'll use a "pending" status for posts that need review
		// This assumes posts table has a status column, if not we need to add it
		
		query := db.Table("posts").Select("posts.id, posts.title, posts.content, posts.user_id, posts.category, posts.created_at, users.username as author_name")
		query = query.Joins("LEFT JOIN users ON posts.user_id = users.id")
		
		if req.Status != "" && req.Status != "all" {
			query = query.Where("posts.status = ?", req.Status)
		} else {
			query = query.Where("posts.status = ?", "pending")
		}
		
		var total int64
		query.Count(&total)
		
		offset := (req.Page - 1) * req.PageSize
		var results []struct {
			ID         uint      `json:"id"`
			Title      string    `json:"title"`
			Content    string    `json:"content"`
			UserID     uint      `json:"user_id"`
			Category   string    `json:"category"`
			AuthorName string    `json:"author_name"`
			CreatedAt  time.Time `json:"created_at"`
		}
		query.Order("posts.created_at desc").Offset(offset).Limit(req.PageSize).Scan(&results)
		
		list := make([]ReviewPostListItem, len(results))
		for i, r := range results {
			list[i] = ReviewPostListItem{
				ID:         r.ID,
				Title:      r.Title,
				Content:    r.Content,
				AuthorID:   r.UserID,
				AuthorName: r.AuthorName,
				Category:   r.Category,
				Status:     "pending",
				CreatedAt:  r.CreatedAt,
			}
		}
		
		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: ReviewPostListResponse{
				List:     list,
				Total:    total,
				Page:     req.Page,
				PageSize: req.PageSize,
			},
		})
	}
}

// ReviewApproveRequest represents the approve request
type ReviewApproveRequest struct {
	ID     uint   `json:"id" binding:"required"`
	Reason string `json:"reason"`
}

// ApprovePost approves a post
// POST /api/admin/posts/review/approve
func ApprovePost(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req ReviewApproveRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "id is required",
			})
			return
		}
		
		adminID, _ := middleware.GetUserID(c)
		
		// Update post status to approved
		if err := db.Model(&model.Post{}).Where("id = ?", req.ID).Update("status", "approved").Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to approve post",
			})
			return
		}
		
		// Create review record
		review := model.ReviewRecord{
			Type:       model.ReviewTypePost,
			TargetID:   req.ID,
			ReviewerID: adminID,
			Status:     model.ReviewStatusApproved,
			Reason:     req.Reason,
		}
		db.Create(&review)
		
		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "post approved successfully",
		})
	}
}

// RejectPost rejects a post
// POST /api/admin/posts/review/reject
func RejectPost(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req ReviewApproveRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "id is required",
			})
			return
		}
		
		adminID, _ := middleware.GetUserID(c)
		
		// Update post status to rejected
		if err := db.Model(&model.Post{}).Where("id = ?", req.ID).Update("status", "rejected").Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to reject post",
			})
			return
		}
		
		// Create review record
		review := model.ReviewRecord{
			Type:       model.ReviewTypePost,
			TargetID:   req.ID,
			ReviewerID: adminID,
			Status:     model.ReviewStatusRejected,
			Reason:     req.Reason,
		}
		db.Create(&review)
		
		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "post rejected",
		})
	}
}

// ReviewEventListResponse represents the event review list response
type ReviewEventListResponse struct {
	List     []ReviewEventListItem `json:"list"`
	Total    int64                 `json:"total"`
	Page     int                   `json:"page"`
	PageSize int                   `json:"pageSize"`
}

// ReviewEventListItem represents an event pending review
type ReviewEventListItem struct {
	ID          uint      `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	AuthorID    uint      `json:"authorId"`
	AuthorName  string    `json:"authorName"`
	StartTime   time.Time `json:"startTime"`
	EndTime     time.Time `json:"endTime"`
	Location    string    `json:"location"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"createdAt"`
}

// GetReviewEventList returns events pending review
// POST /api/admin/events/review/list
func GetReviewEventList(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req ReviewPostListRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			req.Page = 1
			req.PageSize = 20
		}
		
		if req.Page < 1 {
			req.Page = 1
		}
		if req.PageSize < 1 || req.PageSize > 100 {
			req.PageSize = 20
		}
		
		query := db.Table("events").Select("events.id, events.title, events.description, events.user_id, events.start_time, events.end_time, events.location, events.created_at, users.username as author_name")
		query = query.Joins("LEFT JOIN users ON events.user_id = users.id")
		
		if req.Status != "" && req.Status != "all" {
			query = query.Where("events.status = ?", req.Status)
		} else {
			query = query.Where("events.status = ?", "pending")
		}
		
		var total int64
		query.Count(&total)
		
		offset := (req.Page - 1) * req.PageSize
		var results []struct {
			ID          uint      `json:"id"`
			Title       string    `json:"title"`
			Description string    `json:"description"`
			UserID      uint      `json:"user_id"`
			StartTime   time.Time `json:"start_time"`
			EndTime     time.Time `json:"end_time"`
			Location    string    `json:"location"`
			AuthorName  string    `json:"author_name"`
			CreatedAt   time.Time `json:"created_at"`
		}
		query.Order("events.created_at desc").Offset(offset).Limit(req.PageSize).Scan(&results)
		
		list := make([]ReviewEventListItem, len(results))
		for i, r := range results {
			list[i] = ReviewEventListItem{
				ID:          r.ID,
				Title:       r.Title,
				Description: r.Description,
				AuthorID:    r.UserID,
				AuthorName:  r.AuthorName,
				StartTime:   r.StartTime,
				EndTime:     r.EndTime,
				Location:    r.Location,
				Status:      "pending",
				CreatedAt:   r.CreatedAt,
			}
		}
		
		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: ReviewEventListResponse{
				List:     list,
				Total:    total,
				Page:     req.Page,
				PageSize: req.PageSize,
			},
		})
	}
}

// ApproveEvent approves an event
// POST /api/admin/events/review/approve
func ApproveEvent(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req ReviewApproveRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "id is required",
			})
			return
		}
		
		adminID, _ := middleware.GetUserID(c)
		
		if err := db.Model(&model.Event{}).Where("id = ?", req.ID).Update("status", "approved").Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to approve event",
			})
			return
		}
		
		review := model.ReviewRecord{
			Type:       model.ReviewTypeEvent,
			TargetID:   req.ID,
			ReviewerID: adminID,
			Status:     model.ReviewStatusApproved,
			Reason:     req.Reason,
		}
		db.Create(&review)
		
		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "event approved successfully",
		})
	}
}

// RejectEvent rejects an event
// POST /api/admin/events/review/reject
func RejectEvent(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req ReviewApproveRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "id is required",
			})
			return
		}
		
		adminID, _ := middleware.GetUserID(c)
		
		if err := db.Model(&model.Event{}).Where("id = ?", req.ID).Update("status", "rejected").Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to reject event",
			})
			return
		}
		
		review := model.ReviewRecord{
			Type:       model.ReviewTypeEvent,
			TargetID:   req.ID,
			ReviewerID: adminID,
			Status:     model.ReviewStatusRejected,
			Reason:     req.Reason,
		}
		db.Create(&review)
		
		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "event rejected",
		})
	}
}

// ================== Admin Auth Check ==================

// AdminLoginRequest represents admin login request
type AdminLoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// AdminLoginResponse represents admin login response
type AdminLoginResponse struct {
	UserID   uint   `json:"userId"`
	Username string `json:"username"`
	Role     string `json:"role"`
}

// AdminLogin handles admin login with role check
// POST /api/admin/login
func AdminLogin(db *gorm.DB, cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req AdminLoginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "username and password required",
			})
			return
		}
		
		var user model.User
		if err := db.Where("username = ?", req.Username).First(&user).Error; err != nil {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{
				Code:    401,
				Message: "invalid credentials",
			})
			return
		}
		
		if user.Role != "admin" && user.Role != "operator" {
			c.JSON(http.StatusForbidden, UnifiedResponse{
				Code:    403,
				Message: "admin access required",
			})
			return
		}
		
		// Verify password
		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{
				Code:    401,
				Message: "invalid credentials",
			})
			return
		}
		
		// Generate JWT
		token, err := jwt.GenerateToken(user.ID, user.Username, cfg.JWT.Secret, cfg.JWT.ExpireHours)
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to generate token",
			})
			return
		}
		
		// Set cookie
		setAuthCookie(c, token, cfg)
		
		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: AdminLoginResponse{
				UserID:   user.ID,
				Username: user.Username,
				Role:     user.Role,
			},
		})
	}
}

// AdminAuthMiddleware checks if user is admin
func AdminAuthMiddleware(db *gorm.DB, jwtSecret string, cookieName string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// First use the standard auth middleware
		var tokenString string
		
		tokenFromCookie, err := c.Cookie(cookieName)
		if err == nil && tokenFromCookie != "" {
			tokenString = tokenFromCookie
		}
		
		if tokenString == "" {
			authHeader := c.GetHeader("Authorization")
			if authHeader != "" {
				parts := strings.SplitN(authHeader, " ", 2)
				if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
					tokenString = parts[1]
				}
			}
		}
		
		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			c.Abort()
			return
		}
		
		claims, err := jwt.ParseToken(tokenString, jwtSecret)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			c.Abort()
			return
		}
		
		c.Set("userID", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("claims", claims)
		
		// Check if user is admin
		var user model.User
		if err := db.First(&user, claims.UserID).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
			c.Abort()
			return
		}
		
		if user.Role != "admin" && user.Role != "operator" {
			c.JSON(http.StatusForbidden, gin.H{"error": "admin access required"})
			c.Abort()
			return
		}
		
		c.Set("userRole", user.Role)
		c.Next()
	}
}

// ================== Task Management ==================

// AdminTaskListRequest represents the task list request
type AdminTaskListRequest struct {
	Page     int    `json:"page"`
	PageSize int    `json:"pageSize"`
	Status   string `json:"status"`
	Type     string `json:"type"`
	UserID   uint   `json:"userId"`
}

// AdminTaskListItem represents a task in the list
type AdminTaskListItem struct {
	ID              uint       `json:"id"`
	UserID          uint       `json:"userId"`
	UserName        string     `json:"userName"`
	Title           string     `json:"title"`
	Description     string     `json:"description"`
	Budget          float64    `json:"budget"`
	Type            string     `json:"type"`
	Level           string     `json:"level"`
	Status          string     `json:"status"`
	Urgent          bool       `json:"urgent"`
	DurationDays    int        `json:"durationDays"`
	Progress        int        `json:"progress"`
	Deadline        *time.Time `json:"deadline"`
	ApplicantsCount int        `json:"applicantsCount"`
	CreatedAt       time.Time  `json:"createdAt"`
}

// AdminTaskListResponse represents the task list response
type AdminTaskListResponse struct {
	List     []AdminTaskListItem `json:"list"`
	Total    int64               `json:"total"`
	Page     int                 `json:"page"`
	PageSize int                 `json:"pageSize"`
}

// GetAdminTaskList returns paginated task list
// POST /api/admin/tasks/list
func GetAdminTaskList(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req AdminTaskListRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			req.Page = 1
			req.PageSize = 20
		}

		if req.Page < 1 {
			req.Page = 1
		}
		if req.PageSize < 1 || req.PageSize > 100 {
			req.PageSize = 20
		}

		query := db.Model(&model.Task{})

		// Apply filters
		if req.Status != "" {
			query = query.Where("status = ?", req.Status)
		}
		if req.Type != "" {
			query = query.Where("type = ?", req.Type)
		}
		if req.UserID > 0 {
			query = query.Where("user_id = ?", req.UserID)
		}

		// Get total
		var total int64
		query.Count(&total)

		// Get list with user info
		offset := (req.Page - 1) * req.PageSize
		var tasks []model.Task
		query.Order("created_at desc").Offset(offset).Limit(req.PageSize).Find(&tasks)

		// Get user names
		userIDs := make([]uint, 0)
		for _, t := range tasks {
			userIDs = append(userIDs, t.UserID)
		}

		userNames := make(map[uint]string)
		if len(userIDs) > 0 {
			var users []model.User
			db.Select("id, username").Where("id IN ?", userIDs).Find(&users)
			for _, u := range users {
				userNames[u.ID] = u.Username
			}
		}

		list := make([]AdminTaskListItem, len(tasks))
		for i, t := range tasks {
			list[i] = AdminTaskListItem{
				ID:              t.ID,
				UserID:          t.UserID,
				UserName:        userNames[t.UserID],
				Title:           t.Title,
				Description:     t.Description,
				Budget:          t.Budget,
				Type:            t.Type,
				Level:           t.Level,
				Status:          t.Status,
				Urgent:          t.Urgent,
				DurationDays:    t.DurationDays,
				Progress:        t.Progress,
				Deadline:        t.Deadline,
				ApplicantsCount: t.ApplicantsCount,
				CreatedAt:       t.CreatedAt,
			}
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: AdminTaskListResponse{
				List:     list,
				Total:    total,
				Page:     req.Page,
				PageSize: req.PageSize,
			},
		})
	}
}

// AdminTaskDetailResponse represents task detail with applications
type AdminTaskDetailResponse struct {
	ID              uint                   `json:"id"`
	UserID          uint                   `json:"userId"`
	UserName        string                 `json:"userName"`
	Title           string                 `json:"title"`
	Description     string                 `json:"description"`
	Budget          float64                `json:"budget"`
	Type            string                 `json:"type"`
	Level           string                 `json:"level"`
	Status          string                 `json:"status"`
	Urgent          bool                   `json:"urgent"`
	DurationDays    int                    `json:"durationDays"`
	Progress        int                    `json:"progress"`
	Deadline        *time.Time             `json:"deadline"`
	ApplicantsCount int                    `json:"applicantsCount"`
	CreatedAt       time.Time              `json:"createdAt"`
	Applications    []AdminApplicationItem `json:"applications"`
}

// AdminApplicationItem represents an application
type AdminApplicationItem struct {
	ID        uint      `json:"id"`
	UserID    uint      `json:"userId"`
	UserName  string    `json:"userName"`
	Status    string    `json:"status"`
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"createdAt"`
}

// GetAdminTaskDetail returns task detail with applications
// POST /api/admin/tasks/:id
func GetAdminTaskDetail(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		taskIDStr := c.Param("id")
		taskID, err := strconv.ParseUint(taskIDStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid task id",
			})
			return
		}

		var task model.Task
		if err := db.First(&task, taskID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, UnifiedResponse{
					Code:    404,
					Message: "task not found",
				})
				return
			}
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "database error",
			})
			return
		}

		// Get user name
		var user model.User
		db.Select("username").First(&user, task.UserID)

		// Get applications
		var applications []model.Application
		db.Where("task_id = ?", taskID).Order("created_at desc").Find(&applications)

		// Get applicant user names
		applicantIDs := make([]uint, 0)
		for _, a := range applications {
			applicantIDs = append(applicantIDs, a.UserID)
		}

		applicantNames := make(map[uint]string)
		if len(applicantIDs) > 0 {
			var applicants []model.User
			db.Select("id, username").Where("id IN ?", applicantIDs).Find(&applicants)
			for _, a := range applicants {
				applicantNames[a.ID] = a.Username
			}
		}

		appList := make([]AdminApplicationItem, len(applications))
		for i, a := range applications {
			appList[i] = AdminApplicationItem{
				ID:        a.ID,
				UserID:    a.UserID,
				UserName:  applicantNames[a.UserID],
				Status:    a.Status,
				Message:   a.Message,
				CreatedAt: a.CreatedAt,
			}
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: AdminTaskDetailResponse{
				ID:              task.ID,
				UserID:          task.UserID,
				UserName:        user.Username,
				Title:           task.Title,
				Description:     task.Description,
				Budget:          task.Budget,
				Type:            task.Type,
				Level:           task.Level,
				Status:          task.Status,
				Urgent:          task.Urgent,
				DurationDays:    task.DurationDays,
				Progress:        task.Progress,
				Deadline:        task.Deadline,
				ApplicantsCount: task.ApplicantsCount,
				CreatedAt:       task.CreatedAt,
				Applications:    appList,
			},
		})
	}
}

// CloseTaskRequest represents close task request
type CloseTaskRequest struct {
	Reason string `json:"reason"`
}

// CloseAdminTask closes a task
// POST /api/admin/tasks/:id/close
func CloseAdminTask(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		taskIDStr := c.Param("id")
		taskID, err := strconv.ParseUint(taskIDStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid task id",
			})
			return
		}

		var req CloseTaskRequest
		c.ShouldBindJSON(&req)

		var task model.Task
		if err := db.First(&task, taskID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, UnifiedResponse{
					Code:    404,
					Message: "task not found",
				})
				return
			}
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "database error",
			})
			return
		}

		if task.Status == "closed" {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "task already closed",
			})
			return
		}

		// Update status to closed
		if err := db.Model(&task).Update("status", "closed").Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to close task",
			})
			return
		}

		// Log activity
		adminID, _ := middleware.GetUserID(c)
		activityLog := model.ActivityLog{
			UserID:  adminID,
			Action:  "admin_close_task",
			Details: "Closed task " + task.Title + " (ID: " + taskIDStr + "). Reason: " + req.Reason,
		}
		db.Create(&activityLog)

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "task closed successfully",
		})
	}
}

// ================== Order Management ==================

// AdminOrderListRequest represents the order list request
type AdminOrderListRequest struct {
	Page     int    `json:"page"`
	PageSize int    `json:"pageSize"`
	Status   string `json:"status"`
	UserID   uint   `json:"userId"`
}

// AdminOrderListItem represents an order in the list
type AdminOrderListItem struct {
	ID        uint      `json:"id"`
	UserID    uint      `json:"userId"`
	UserName  string    `json:"userName"`
	TaskID    uint      `json:"taskId"`
	TaskTitle string    `json:"taskTitle"`
	Amount    string    `json:"amount"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
}

// AdminOrderListResponse represents the order list response
type AdminOrderListResponse struct {
	List     []AdminOrderListItem `json:"list"`
	Total    int64                `json:"total"`
	Page     int                  `json:"page"`
	PageSize int                  `json:"pageSize"`
}

// GetAdminOrderList returns paginated order list
// POST /api/admin/orders/list
func GetAdminOrderList(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req AdminOrderListRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			req.Page = 1
			req.PageSize = 20
		}

		if req.Page < 1 {
			req.Page = 1
		}
		if req.PageSize < 1 || req.PageSize > 100 {
			req.PageSize = 20
		}

		query := db.Model(&model.Order{})

		// Apply filters
		if req.Status != "" {
			query = query.Where("status = ?", req.Status)
		}
		if req.UserID > 0 {
			query = query.Where("user_id = ?", req.UserID)
		}

		// Get total
		var total int64
		query.Count(&total)

		// Get list
		offset := (req.Page - 1) * req.PageSize
		var orders []model.Order
		query.Order("created_at desc").Offset(offset).Limit(req.PageSize).Find(&orders)

		// Get user and task info
		userIDs := make([]uint, 0)
		taskIDs := make([]uint, 0)
		for _, o := range orders {
			userIDs = append(userIDs, o.UserID)
			taskIDs = append(taskIDs, o.TaskID)
		}

		userNames := make(map[uint]string)
		if len(userIDs) > 0 {
			var users []model.User
			db.Select("id, username").Where("id IN ?", userIDs).Find(&users)
			for _, u := range users {
				userNames[u.ID] = u.Username
			}
		}

		taskTitles := make(map[uint]string)
		if len(taskIDs) > 0 {
			var tasks []model.Task
			db.Select("id, title").Where("id IN ?", taskIDs).Find(&tasks)
			for _, t := range tasks {
				taskTitles[t.ID] = t.Title
			}
		}

		list := make([]AdminOrderListItem, len(orders))
		for i, o := range orders {
			list[i] = AdminOrderListItem{
				ID:        o.ID,
				UserID:    o.UserID,
				UserName:  userNames[o.UserID],
				TaskID:    o.TaskID,
				TaskTitle: taskTitles[o.TaskID],
				Amount:    o.Amount.String(),
				Status:    string(o.Status),
				CreatedAt: o.CreatedAt,
			}
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: AdminOrderListResponse{
				List:     list,
				Total:    total,
				Page:     req.Page,
				PageSize: req.PageSize,
			},
		})
	}
}

// AdminOrderDetailResponse represents order detail
type AdminOrderDetailResponse struct {
	ID        uint                   `json:"id"`
	UserID    uint                   `json:"userId"`
	UserName  string                 `json:"userName"`
	TaskID    uint                   `json:"taskId"`
	Task      *AdminTaskListItem     `json:"task"`
	Amount    string                 `json:"amount"`
	Status    string                 `json:"status"`
	CreatedAt time.Time              `json:"createdAt"`
}

// GetAdminOrderDetail returns order detail with task and user info
// POST /api/admin/orders/:id
func GetAdminOrderDetail(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		orderIDStr := c.Param("id")
		orderID, err := strconv.ParseUint(orderIDStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid order id",
			})
			return
		}

		var order model.Order
		if err := db.First(&order, orderID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, UnifiedResponse{
					Code:    404,
					Message: "order not found",
				})
				return
			}
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "database error",
			})
			return
		}

		// Get user info
		var user model.User
		db.Select("id, username").First(&user, order.UserID)

		// Get task info
		var task model.Task
		var taskItem *AdminTaskListItem
		if err := db.First(&task, order.TaskID).Error; err == nil {
			taskItem = &AdminTaskListItem{
				ID:              task.ID,
				UserID:          task.UserID,
				UserName:         user.Username,
				Title:           task.Title,
				Description:     task.Description,
				Budget:          task.Budget,
				Type:            task.Type,
				Level:           task.Level,
				Status:          task.Status,
				Urgent:          task.Urgent,
				DurationDays:    task.DurationDays,
				Progress:        task.Progress,
				Deadline:        task.Deadline,
				ApplicantsCount: task.ApplicantsCount,
				CreatedAt:       task.CreatedAt,
			}
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: AdminOrderDetailResponse{
				ID:        order.ID,
				UserID:    order.UserID,
				UserName:  user.Username,
				TaskID:    order.TaskID,
				Task:      taskItem,
				Amount:    order.Amount.String(),
				Status:    string(order.Status),
				CreatedAt: order.CreatedAt,
			},
		})
	}
}

// RefundOrderRequest represents refund request
type RefundOrderRequest struct {
	Reason string `json:"reason"`
}

// RefundAdminOrder refunds an order
// POST /api/admin/orders/:id/refund
func RefundAdminOrder(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		orderIDStr := c.Param("id")
		orderID, err := strconv.ParseUint(orderIDStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid order id",
			})
			return
		}

		var req RefundOrderRequest
		c.ShouldBindJSON(&req)

		var order model.Order
		if err := db.First(&order, orderID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, UnifiedResponse{
					Code:    404,
					Message: "order not found",
				})
				return
			}
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "database error",
			})
			return
		}

		if order.Status == model.OrderStatusCompleted {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "cannot refund completed order",
			})
			return
		}

		// Update status to refunded (use "refunded" as status)
		if err := db.Model(&order).Update("status", "refunded").Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to refund order",
			})
			return
		}

		// Log activity
		adminID, _ := middleware.GetUserID(c)
		activityLog := model.ActivityLog{
			UserID:  adminID,
			Action:  "admin_refund_order",
			Details: "Refunded order ID: " + orderIDStr + ". Reason: " + req.Reason,
		}
		db.Create(&activityLog)

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "order refunded successfully",
		})
	}
}

// ================== Agent Config ==================

// AdminAgentConfigResponse represents agent configuration
type AdminAgentConfigResponse struct {
	ID           uint    `json:"id"`
	AgentType    string  `json:"agentType"`
	Name         string  `json:"name"`
	Description  string  `json:"description"`
	SystemPrompt string  `json:"systemPrompt"`
	Model        string  `json:"model"`
	Temperature  float64 `json:"temperature"`
	MaxTokens    int     `json:"maxTokens"`
	MCPTools     string  `json:"mcpTools"`
	DailyLimit   int     `json:"dailyLimit"`
	Enabled      bool    `json:"enabled"`
}

// AdminAgentConfigUpdateRequest represents agent config update request
type AdminAgentConfigUpdateRequest struct {
	Name         string  `json:"name"`
	Description  string  `json:"description"`
	SystemPrompt string  `json:"systemPrompt"`
	Model        string  `json:"model"`
	Temperature  float64 `json:"temperature"`
	MaxTokens    int     `json:"maxTokens"`
	MCPTools     string  `json:"mcpTools"`
	DailyLimit   int     `json:"dailyLimit"`
	Enabled      *bool   `json:"enabled"`
}

// defaultBitConfig returns default Bit agent configuration
func defaultBitConfig() model.SystemAgentConfig {
	return model.SystemAgentConfig{
		AgentType:    "bit",
		Name:         "Bit",
		Description:  "Bit is a helpful AI assistant for general tasks",
		SystemPrompt: "You are Bit, a helpful AI assistant.",
		Model:        "gpt-4",
		Temperature:  0.7,
		MaxTokens:    4096,
		MCPTools:     "[]",
		DailyLimit:   1000,
		Enabled:      true,
	}
}

// defaultLittleOConfig returns default LittleO agent configuration
func defaultLittleOConfig() model.SystemAgentConfig {
	return model.SystemAgentConfig{
		AgentType:    "little_o",
		Name:         "LittleO",
		Description:  "LittleO is an advanced AI agent for complex tasks",
		SystemPrompt: "You are LittleO, an advanced AI agent.",
		Model:        "gpt-4",
		Temperature:  0.5,
		MaxTokens:    8192,
		MCPTools:     "[]",
		DailyLimit:   500,
		Enabled:      true,
	}
}

// GetBitAgentConfig returns Bit agent configuration
// GET /api/admin/agents/bit/config
func GetBitAgentConfig(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var config model.SystemAgentConfig
		err := db.Where("agent_type = ?", "bit").First(&config).Error

		if err == gorm.ErrRecordNotFound {
			// Create default config
			config = defaultBitConfig()
			db.Create(&config)
		} else if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "database error",
			})
			return
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: AdminAgentConfigResponse{
				ID:           config.ID,
				AgentType:    config.AgentType,
				Name:         config.Name,
				Description:  config.Description,
				SystemPrompt: config.SystemPrompt,
				Model:        config.Model,
				Temperature:  config.Temperature,
				MaxTokens:    config.MaxTokens,
				MCPTools:     config.MCPTools,
				DailyLimit:   config.DailyLimit,
				Enabled:      config.Enabled,
			},
		})
	}
}

// UpdateBitAgentConfig updates Bit agent configuration
// POST /api/admin/agents/bit/config
func UpdateBitAgentConfig(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req AdminAgentConfigUpdateRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid request body",
			})
			return
		}

		var config model.SystemAgentConfig
		err := db.Where("agent_type = ?", "bit").First(&config).Error

		if err == gorm.ErrRecordNotFound {
			// Create new config with request values
			config = defaultBitConfig()
			if req.Name != "" {
				config.Name = req.Name
			}
			if req.Description != "" {
				config.Description = req.Description
			}
			if req.SystemPrompt != "" {
				config.SystemPrompt = req.SystemPrompt
			}
			if req.Model != "" {
				config.Model = req.Model
			}
			if req.Temperature > 0 {
				config.Temperature = req.Temperature
			}
			if req.MaxTokens > 0 {
				config.MaxTokens = req.MaxTokens
			}
			if req.MCPTools != "" {
				config.MCPTools = req.MCPTools
			}
			if req.DailyLimit > 0 {
				config.DailyLimit = req.DailyLimit
			}
			if req.Enabled != nil {
				config.Enabled = *req.Enabled
			}
			db.Create(&config)
		} else if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "database error",
			})
			return
		} else {
			// Update existing config
			updates := make(map[string]interface{})
			if req.Name != "" {
				updates["name"] = req.Name
			}
			if req.Description != "" {
				updates["description"] = req.Description
			}
			if req.SystemPrompt != "" {
				updates["system_prompt"] = req.SystemPrompt
			}
			if req.Model != "" {
				updates["model"] = req.Model
			}
			if req.Temperature > 0 {
				updates["temperature"] = req.Temperature
			}
			if req.MaxTokens > 0 {
				updates["max_tokens"] = req.MaxTokens
			}
			if req.MCPTools != "" {
				updates["mcp_tools"] = req.MCPTools
			}
			if req.DailyLimit > 0 {
				updates["daily_limit"] = req.DailyLimit
			}
			if req.Enabled != nil {
				updates["enabled"] = *req.Enabled
			}

			if len(updates) > 0 {
				if err := db.Model(&config).Updates(updates).Error; err != nil {
					c.JSON(http.StatusInternalServerError, UnifiedResponse{
						Code:    500,
						Message: "failed to update config",
					})
					return
				}
			}
		}

		// Log activity
		adminID, _ := middleware.GetUserID(c)
		activityLog := model.ActivityLog{
			UserID:  adminID,
			Action:  "admin_update_bit_config",
			Details: "Updated Bit agent configuration",
		}
		db.Create(&activityLog)

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "Bit agent config updated successfully",
		})
	}
}

// GetLittleOAgentConfig returns LittleO agent configuration
// GET /api/admin/agents/little-o/config
func GetLittleOAgentConfig(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var config model.SystemAgentConfig
		err := db.Where("agent_type = ?", "little_o").First(&config).Error

		if err == gorm.ErrRecordNotFound {
			// Create default config
			config = defaultLittleOConfig()
			db.Create(&config)
		} else if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "database error",
			})
			return
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: AdminAgentConfigResponse{
				ID:           config.ID,
				AgentType:    config.AgentType,
				Name:         config.Name,
				Description:  config.Description,
				SystemPrompt: config.SystemPrompt,
				Model:        config.Model,
				Temperature:  config.Temperature,
				MaxTokens:    config.MaxTokens,
				MCPTools:     config.MCPTools,
				DailyLimit:   config.DailyLimit,
				Enabled:      config.Enabled,
			},
		})
	}
}

// UpdateLittleOAgentConfig updates LittleO agent configuration
// POST /api/admin/agents/little-o/config
func UpdateLittleOAgentConfig(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req AdminAgentConfigUpdateRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid request body",
			})
			return
		}

		var config model.SystemAgentConfig
		err := db.Where("agent_type = ?", "little_o").First(&config).Error

		if err == gorm.ErrRecordNotFound {
			// Create new config with request values
			config = defaultLittleOConfig()
			if req.Name != "" {
				config.Name = req.Name
			}
			if req.Description != "" {
				config.Description = req.Description
			}
			if req.SystemPrompt != "" {
				config.SystemPrompt = req.SystemPrompt
			}
			if req.Model != "" {
				config.Model = req.Model
			}
			if req.Temperature > 0 {
				config.Temperature = req.Temperature
			}
			if req.MaxTokens > 0 {
				config.MaxTokens = req.MaxTokens
			}
			if req.MCPTools != "" {
				config.MCPTools = req.MCPTools
			}
			if req.DailyLimit > 0 {
				config.DailyLimit = req.DailyLimit
			}
			if req.Enabled != nil {
				config.Enabled = *req.Enabled
			}
			db.Create(&config)
		} else if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "database error",
			})
			return
		} else {
			// Update existing config
			updates := make(map[string]interface{})
			if req.Name != "" {
				updates["name"] = req.Name
			}
			if req.Description != "" {
				updates["description"] = req.Description
			}
			if req.SystemPrompt != "" {
				updates["system_prompt"] = req.SystemPrompt
			}
			if req.Model != "" {
				updates["model"] = req.Model
			}
			if req.Temperature > 0 {
				updates["temperature"] = req.Temperature
			}
			if req.MaxTokens > 0 {
				updates["max_tokens"] = req.MaxTokens
			}
			if req.MCPTools != "" {
				updates["mcp_tools"] = req.MCPTools
			}
			if req.DailyLimit > 0 {
				updates["daily_limit"] = req.DailyLimit
			}
			if req.Enabled != nil {
				updates["enabled"] = *req.Enabled
			}

			if len(updates) > 0 {
				if err := db.Model(&config).Updates(updates).Error; err != nil {
					c.JSON(http.StatusInternalServerError, UnifiedResponse{
						Code:    500,
						Message: "failed to update config",
					})
					return
				}
			}
		}

		// Log activity
		adminID, _ := middleware.GetUserID(c)
		activityLog := model.ActivityLog{
			UserID:  adminID,
			Action:  "admin_update_little_o_config",
			Details: "Updated LittleO agent configuration",
		}
		db.Create(&activityLog)

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "LittleO agent config updated successfully",
		})
	}
}

// ================== OPC Management ==================

// OPCListRequest represents the OPC list request
type OPCListRequest struct {
	Page     int    `json:"page"`
	PageSize int    `json:"pageSize"`
	Search   string `json:"search"`
	Status   string `json:"status"`
}

// OPCListItem represents an OPC in the list
type OPCListItem struct {
	ID           uint      `json:"id"`
	Name         string    `json:"name"`
	ContactName  string    `json:"contactName"`
	ContactEmail string    `json:"contactEmail"`
	ContactPhone string    `json:"contactPhone"`
	Status       string    `json:"status"`
	ComputeQuota int       `json:"computeQuota"`
	ComputeUsed  int       `json:"computeUsed"`
	CreatedAt    time.Time `json:"createdAt"`
}

// OPCListResponse represents the OPC list response
type OPCListResponse struct {
	List     []OPCListItem `json:"list"`
	Total    int64         `json:"total"`
	Page     int           `json:"page"`
	PageSize int           `json:"pageSize"`
}

// OPCDetailResponse represents OPC detail
type OPCDetailResponse struct {
	ID           uint      `json:"id"`
	Name         string    `json:"name"`
	ContactName  string    `json:"contactName"`
	ContactEmail string    `json:"contactEmail"`
	ContactPhone string    `json:"contactPhone"`
	Status       string    `json:"status"`
	ComputeQuota int       `json:"computeQuota"`
	ComputeUsed  int       `json:"computeUsed"`
	Description  string    `json:"description"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// OPCStatsResponse represents OPC statistics
type OPCStatsResponse struct {
	Total     int64 `json:"total"`
	Pending   int64 `json:"pending"`
	Active    int64 `json:"active"`
	Suspended int64 `json:"suspended"`
}

// OPCQuotaRequest represents quota update request
type OPCQuotaRequest struct {
	Quota int `json:"quota" binding:"required"`
}

// GetOPCList returns paginated OPC list
// POST /api/admin/opc/list
func GetOPCList(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req OPCListRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			req.Page = 1
			req.PageSize = 20
		}

		if req.Page < 1 {
			req.Page = 1
		}
		if req.PageSize < 1 || req.PageSize > 100 {
			req.PageSize = 20
		}

		query := db.Model(&model.OPC{})

		// Apply filters
		if req.Search != "" {
			query = query.Where("name LIKE ?", "%"+req.Search+"%")
		}
		if req.Status != "" {
			query = query.Where("status = ?", req.Status)
		}

		// Get total
		var total int64
		query.Count(&total)

		// Get list
		var opcs []model.OPC
		offset := (req.Page - 1) * req.PageSize
		query.Order("created_at desc").Offset(offset).Limit(req.PageSize).Find(&opcs)

		// Convert to response
		list := make([]OPCListItem, len(opcs))
		for i, o := range opcs {
			list[i] = OPCListItem{
				ID:           o.ID,
				Name:         o.Name,
				ContactName:  o.ContactName,
				ContactEmail: o.ContactEmail,
				ContactPhone: o.ContactPhone,
				Status:       o.Status,
				ComputeQuota: o.ComputeQuota,
				ComputeUsed:  o.ComputeUsed,
				CreatedAt:    o.CreatedAt,
			}
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: OPCListResponse{
				List:     list,
				Total:    total,
				Page:     req.Page,
				PageSize: req.PageSize,
			},
		})
	}
}

// GetOPCDetail returns OPC details
// POST /api/admin/opc/:id/detail
func GetOPCDetail(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		opcIDStr := c.Param("id")
		opcID, err := strconv.ParseUint(opcIDStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid opc id",
			})
			return
		}

		var opc model.OPC
		if err := db.First(&opc, opcID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, UnifiedResponse{
					Code:    404,
					Message: "opc not found",
				})
				return
			}
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "database error",
			})
			return
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: OPCDetailResponse{
				ID:           opc.ID,
				Name:         opc.Name,
				ContactName:  opc.ContactName,
				ContactEmail: opc.ContactEmail,
				ContactPhone: opc.ContactPhone,
				Status:       opc.Status,
				ComputeQuota: opc.ComputeQuota,
				ComputeUsed:  opc.ComputeUsed,
				Description:  opc.Description,
				CreatedAt:    opc.CreatedAt,
				UpdatedAt:    opc.UpdatedAt,
			},
		})
	}
}

// ApproveOPC approves an OPC application
// POST /api/admin/opc/:id/approve
func ApproveOPC(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		opcIDStr := c.Param("id")
		opcID, err := strconv.ParseUint(opcIDStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid opc id",
			})
			return
		}

		var opc model.OPC
		if err := db.First(&opc, opcID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, UnifiedResponse{
					Code:    404,
					Message: "opc not found",
				})
				return
			}
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "database error",
			})
			return
		}

		if opc.Status != "pending" {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "opc is not in pending status",
			})
			return
		}

		// Update status to active
		if err := db.Model(&opc).Update("status", "active").Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to approve opc",
			})
			return
		}

		// Log activity
		adminID, _ := middleware.GetUserID(c)
		activityLog := model.ActivityLog{
			UserID:  adminID,
			Action:  "admin_approve_opc",
			Details: "Approved OPC " + opc.Name + " (ID: " + opcIDStr + ")",
		}
		db.Create(&activityLog)

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "opc approved successfully",
		})
	}
}

// RejectOPC rejects an OPC application
// POST /api/admin/opc/:id/reject
func RejectOPC(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		opcIDStr := c.Param("id")
		opcID, err := strconv.ParseUint(opcIDStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid opc id",
			})
			return
		}

		var opc model.OPC
		if err := db.First(&opc, opcID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, UnifiedResponse{
					Code:    404,
					Message: "opc not found",
				})
				return
			}
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "database error",
			})
			return
		}

		if opc.Status != "pending" {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "opc is not in pending status",
			})
			return
		}

		// Update status to rejected (delete the record)
		if err := db.Delete(&opc).Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to reject opc",
			})
			return
		}

		// Log activity
		adminID, _ := middleware.GetUserID(c)
		activityLog := model.ActivityLog{
			UserID:  adminID,
			Action:  "admin_reject_opc",
			Details: "Rejected OPC " + opc.Name + " (ID: " + opcIDStr + ")",
		}
		db.Create(&activityLog)

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "opc rejected successfully",
		})
	}
}

// SuspendOPC suspends an OPC
// POST /api/admin/opc/:id/suspend
func SuspendOPC(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		opcIDStr := c.Param("id")
		opcID, err := strconv.ParseUint(opcIDStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid opc id",
			})
			return
		}

		var opc model.OPC
		if err := db.First(&opc, opcID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, UnifiedResponse{
					Code:    404,
					Message: "opc not found",
				})
				return
			}
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "database error",
			})
			return
		}

		if opc.Status != "active" {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "opc is not in active status",
			})
			return
		}

		// Update status to suspended
		if err := db.Model(&opc).Update("status", "suspended").Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to suspend opc",
			})
			return
		}

		// Log activity
		adminID, _ := middleware.GetUserID(c)
		activityLog := model.ActivityLog{
			UserID:  adminID,
			Action:  "admin_suspend_opc",
			Details: "Suspended OPC " + opc.Name + " (ID: " + opcIDStr + ")",
		}
		db.Create(&activityLog)

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "opc suspended successfully",
		})
	}
}

// UpdateOPCQuota updates OPC compute quota
// POST /api/admin/opc/:id/quota
func UpdateOPCQuota(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		opcIDStr := c.Param("id")
		opcID, err := strconv.ParseUint(opcIDStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid opc id",
			})
			return
		}

		var req OPCQuotaRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "quota is required",
			})
			return
		}

		var opc model.OPC
		if err := db.First(&opc, opcID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, UnifiedResponse{
					Code:    404,
					Message: "opc not found",
				})
				return
			}
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "database error",
			})
			return
		}

		// Update quota
		if err := db.Model(&opc).Update("compute_quota", req.Quota).Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to update quota",
			})
			return
		}

		// Log activity
		adminID, _ := middleware.GetUserID(c)
		activityLog := model.ActivityLog{
			UserID:  adminID,
			Action:  "admin_update_opc_quota",
			Details: "Updated OPC " + opc.Name + " quota to " + strconv.Itoa(req.Quota) + " (ID: " + opcIDStr + ")",
		}
		db.Create(&activityLog)

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "quota updated successfully",
		})
	}
}

// GetOPCStats returns OPC statistics
// POST /api/admin/opc/stats
func GetOPCStats(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var stats OPCStatsResponse

		db.Model(&model.OPC{}).Count(&stats.Total)
		db.Model(&model.OPC{}).Where("status = ?", "pending").Count(&stats.Pending)
		db.Model(&model.OPC{}).Where("status = ?", "active").Count(&stats.Active)
		db.Model(&model.OPC{}).Where("status = ?", "suspended").Count(&stats.Suspended)

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data:    stats,
		})
	}
}


// ================== API Gateway ==================

// APIStatsResponse represents API gateway statistics
// APIStatsResponse represents API gateway statistics
type APIStatsResponse struct {
	TotalAPIs    int64   `json:"totalApis"`
	TodayCalls   int64   `json:"todayCalls"`
	SuccessRate  float64 `json:"successRate"`
	AvgLatencyMs int64   `json:"avgLatencyMs"`
}

// GetAPIStats returns API gateway statistics
// POST /api/admin/api/stats
func GetAPIStats(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var totalAPIs int64
		db.Model(&model.APIEndpoint{}).Count(&totalAPIs)

		// Use placeholder/mock data for now
		stats := APIStatsResponse{
			TotalAPIs:    totalAPIs,
			TodayCalls:   125847,
			SuccessRate:  99.2,
			AvgLatencyMs: 45,
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data:    stats,
		})
	}
}

// APIListRequest represents the API list request
type APIListRequest struct {
	Page     int    `json:"page"`
	PageSize int    `json:"pageSize"`
	Status   string `json:"status"`
	Method   string `json:"method"`
	Search   string `json:"search"`
}

// APIListItem represents an API in the list
type APIListItem struct {
	ID          uint      `json:"id"`
	Name        string    `json:"name"`
	Path        string    `json:"path"`
	Method      string    `json:"method"`
	Status      string    `json:"status"`
	QPSLimit    int       `json:"qpsLimit"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"createdAt"`
}

// APIListResponse represents the API list response
type APIListResponse struct {
	List     []APIListItem `json:"list"`
	Total    int64         `json:"total"`
	Page     int           `json:"page"`
	PageSize int           `json:"pageSize"`
}

// GetAPIList returns paginated API list
// POST /api/admin/api/list
func GetAPIList(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req APIListRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			req.Page = 1
			req.PageSize = 20
		}

		if req.Page < 1 {
			req.Page = 1
		}
		if req.PageSize < 1 || req.PageSize > 100 {
			req.PageSize = 20
		}

		query := db.Model(&model.APIEndpoint{})

		// Apply filters
		if req.Status != "" {
			query = query.Where("status = ?", req.Status)
		}
		if req.Method != "" {
			query = query.Where("method = ?", req.Method)
		}
		if req.Search != "" {
			query = query.Where("name LIKE ? OR path LIKE ?", "%"+req.Search+"%", "%"+req.Search+"%")
		}

		// Get total
		var total int64
		query.Count(&total)

		// Get list
		offset := (req.Page - 1) * req.PageSize
		var endpoints []model.APIEndpoint
		query.Order("created_at desc").Offset(offset).Limit(req.PageSize).Find(&endpoints)

		list := make([]APIListItem, len(endpoints))
		for i, e := range endpoints {
			list[i] = APIListItem{
				ID:          e.ID,
				Name:        e.Name,
				Path:        e.Path,
				Method:      e.Method,
				Status:      e.Status,
				QPSLimit:    e.QPSLimit,
				Description: e.Description,
				CreatedAt:   e.CreatedAt,
			}
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: APIListResponse{
				List:     list,
				Total:    total,
				Page:     req.Page,
				PageSize: req.PageSize,
			},
		})
	}
}

// CreateAPIEndpointRequest represents the create API endpoint request
type CreateAPIEndpointRequest struct {
	Name        string `json:"name" binding:"required"`
	Path        string `json:"path" binding:"required"`
	Method      string `json:"method" binding:"required"`
	QPSLimit    int    `json:"qpsLimit"`
	Description string `json:"description"`
}

// CreateAPIEndpoint creates a new API endpoint
// POST /api/admin/api/create
func CreateAPIEndpoint(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req CreateAPIEndpointRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "name, path and method are required",
			})
			return
		}

		// Validate method
		validMethods := map[string]bool{"GET": true, "POST": true, "PUT": true, "DELETE": true, "PATCH": true}
		if !validMethods[req.Method] {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid HTTP method",
			})
			return
		}

		// Check if path+method combination already exists
		var count int64
		db.Model(&model.APIEndpoint{}).Where("path = ? AND method = ?", req.Path, req.Method).Count(&count)
		if count > 0 {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "API endpoint with this path and method already exists",
			})
			return
		}

		qpsLimit := req.QPSLimit
		if qpsLimit <= 0 {
			qpsLimit = 1000
		}

		endpoint := model.APIEndpoint{
			Name:        req.Name,
			Path:        req.Path,
			Method:      req.Method,
			Status:      "active",
			QPSLimit:    qpsLimit,
			Description: req.Description,
		}

		if err := db.Create(&endpoint).Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to create API endpoint",
			})
			return
		}

		// Log activity
		adminID, _ := middleware.GetUserID(c)
		activityLog := model.ActivityLog{
			UserID:  adminID,
			Action:  "admin_create_api_endpoint",
			Details: "Created API endpoint: " + req.Method + " " + req.Path,
		}
		db.Create(&activityLog)

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "API endpoint created successfully",
			Data:    endpoint,
		})
	}
}

// UpdateAPIEndpointRequest represents the update API endpoint request
type UpdateAPIEndpointRequest struct {
	Name        string `json:"name"`
	Method      string `json:"method"`
	Status      string `json:"status"`
	QPSLimit    int    `json:"qpsLimit"`
	Description string `json:"description"`
}

// UpdateAPIEndpoint updates an existing API endpoint
// POST /api/admin/api/:id/update
func UpdateAPIEndpoint(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		endpointIDStr := c.Param("id")
		endpointID, err := strconv.ParseUint(endpointIDStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid endpoint id",
			})
			return
		}

		var req UpdateAPIEndpointRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid request body",
			})
			return
		}

		var endpoint model.APIEndpoint
		if err := db.First(&endpoint, endpointID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, UnifiedResponse{
					Code:    404,
					Message: "API endpoint not found",
				})
				return
			}
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "database error",
			})
			return
		}

		updates := make(map[string]interface{})
		if req.Name != "" {
			updates["name"] = req.Name
		}
		if req.Method != "" {
			validMethods := map[string]bool{"GET": true, "POST": true, "PUT": true, "DELETE": true, "PATCH": true}
			if !validMethods[req.Method] {
				c.JSON(http.StatusBadRequest, UnifiedResponse{
					Code:    400,
					Message: "invalid HTTP method",
				})
				return
			}
			updates["method"] = req.Method
		}
		if req.Status != "" {
			validStatuses := map[string]bool{"active": true, "disabled": true, "deprecated": true}
			if !validStatuses[req.Status] {
				c.JSON(http.StatusBadRequest, UnifiedResponse{
					Code:    400,
					Message: "invalid status",
				})
				return
			}
			updates["status"] = req.Status
		}
		if req.QPSLimit > 0 {
			updates["qps_limit"] = req.QPSLimit
		}
		if req.Description != "" {
			updates["description"] = req.Description
		}

		if len(updates) > 0 {
			if err := db.Model(&endpoint).Updates(updates).Error; err != nil {
				c.JSON(http.StatusInternalServerError, UnifiedResponse{
					Code:    500,
					Message: "failed to update API endpoint",
				})
				return
			}
		}

		// Log activity
		adminID, _ := middleware.GetUserID(c)
		activityLog := model.ActivityLog{
			UserID:  adminID,
			Action:  "admin_update_api_endpoint",
			Details: "Updated API endpoint ID: " + endpointIDStr,
		}
		db.Create(&activityLog)

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "API endpoint updated successfully",
		})
	}
}

// DeleteAPIEndpoint deletes an API endpoint
// POST /api/admin/api/:id/delete
func DeleteAPIEndpoint(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		endpointIDStr := c.Param("id")
		endpointID, err := strconv.ParseUint(endpointIDStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid endpoint id",
			})
			return
		}

		var endpoint model.APIEndpoint
		if err := db.First(&endpoint, endpointID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, UnifiedResponse{
					Code:    404,
					Message: "API endpoint not found",
				})
				return
			}
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "database error",
			})
			return
		}

		if err := db.Delete(&endpoint).Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to delete API endpoint",
			})
			return
		}

		// Log activity
		adminID, _ := middleware.GetUserID(c)
		activityLog := model.ActivityLog{
			UserID:  adminID,
			Action:  "admin_delete_api_endpoint",
			Details: "Deleted API endpoint: " + endpoint.Method + " " + endpoint.Path,
		}
		db.Create(&activityLog)

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "API endpoint deleted successfully",
		})
	}
}

// APIKeyListRequest represents the API key list request
type APIKeyListRequest struct {
	Page     int    `json:"page"`
	PageSize int    `json:"pageSize"`
	Status   string `json:"status"`
}

// APIKeyListItem represents an API key in the list
type APIKeyListItem struct {
	ID         uint       `json:"id"`
	KeyID      string     `json:"keyId"`
	CreatorID  uint       `json:"creatorId"`
	Permission string     `json:"permission"`
	Status     string     `json:"status"`
	ExpiresAt  *time.Time `json:"expiresAt"`
	CreatedAt  time.Time  `json:"createdAt"`
}

// APIKeyListResponse represents the API key list response
type APIKeyListResponse struct {
	List     []APIKeyListItem `json:"list"`
	Total    int64            `json:"total"`
	Page     int              `json:"page"`
	PageSize int              `json:"pageSize"`
}

// GetAPIKeyList returns paginated API key list
// POST /api/admin/api/keys/list
func GetAPIKeyList(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req APIKeyListRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			req.Page = 1
			req.PageSize = 20
		}

		if req.Page < 1 {
			req.Page = 1
		}
		if req.PageSize < 1 || req.PageSize > 100 {
			req.PageSize = 20
		}

		query := db.Model(&model.APIKey{})

		// Apply filters
		if req.Status != "" {
			query = query.Where("status = ?", req.Status)
		}

		// Get total
		var total int64
		query.Count(&total)

		// Get list
		offset := (req.Page - 1) * req.PageSize
		var keys []model.APIKey
		query.Order("created_at desc").Offset(offset).Limit(req.PageSize).Find(&keys)

		list := make([]APIKeyListItem, len(keys))
		for i, k := range keys {
			list[i] = APIKeyListItem{
				ID:         k.ID,
				KeyID:      k.KeyID,
				CreatorID:  k.CreatorID,
				Permission: k.Permission,
				Status:     k.Status,
				ExpiresAt:  k.ExpiresAt,
				CreatedAt:  k.CreatedAt,
			}
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: APIKeyListResponse{
				List:     list,
				Total:    total,
				Page:     req.Page,
				PageSize: req.PageSize,
			},
		})
	}
}

// CreateAPIKeyRequest represents the create API key request
type CreateAPIKeyRequest struct {
	Permission string     `json:"permission"`
	ExpiresAt  *time.Time `json:"expiresAt"`
}

// generateKeyID generates a unique key identifier using crypto/rand
func generateKeyID() (string, error) {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	const keyLength = 32

	b := make([]byte, keyLength)
	for i := range b {
		var n byte
		_, err := rand.Read(b[i : i+1])
		if err != nil {
			return "", err
		}
		n = b[i] % byte(len(charset))
		b[i] = charset[n]
	}
	return "ak_" + string(b), nil
}

// CreateAPIKey creates a new API key
// POST /api/admin/api/keys/create
func CreateAPIKey(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req CreateAPIKeyRequest
		c.ShouldBindJSON(&req)

		// Validate permission
		permission := req.Permission
		if permission == "" {
			permission = "full"
		}
		validPermissions := map[string]bool{"full": true, "read": true, "write": true}
		if !validPermissions[permission] {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid permission",
			})
			return
		}

		// Generate unique key ID
		keyID, err := generateKeyID()
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to generate key id",
			})
			return
		}

		adminID, _ := middleware.GetUserID(c)

		apiKey := model.APIKey{
			KeyID:      keyID,
			CreatorID:  adminID,
			Permission: permission,
			Status:     "active",
			ExpiresAt:  req.ExpiresAt,
		}

		if err := db.Create(&apiKey).Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to create API key",
			})
			return
		}

		// Log activity
		activityLog := model.ActivityLog{
			UserID:  adminID,
			Action:  "admin_create_api_key",
			Details: "Created API key: " + keyID,
		}
		db.Create(&activityLog)

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "API key created successfully",
			Data:    apiKey,
		})
	}
}

// RevokeAPIKey revokes an API key
// POST /api/admin/api/keys/:id/revoke
func RevokeAPIKey(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		keyIDStr := c.Param("id")
		keyID, err := strconv.ParseUint(keyIDStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid key id",
			})
			return
		}

		var apiKey model.APIKey
		if err := db.First(&apiKey, keyID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, UnifiedResponse{
					Code:    404,
					Message: "API key not found",
				})
				return
			}
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "database error",
			})
			return
		}

		if apiKey.Status == "revoked" {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "API key already revoked",
			})
			return
		}

		if err := db.Model(&apiKey).Update("status", "revoked").Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to revoke API key",
			})
			return
		}

		// Log activity
		adminID, _ := middleware.GetUserID(c)
		activityLog := model.ActivityLog{
			UserID:  adminID,
			Action:  "admin_revoke_api_key",
			Details: "Revoked API key: " + apiKey.KeyID,
		}
		db.Create(&activityLog)

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "API key revoked successfully",
		})
	}
}

// ================== Admin Compute Usage ==================

// AdminComputeUsageListRequest represents the compute usage list request
type AdminComputeUsageListRequest struct {
	Page         int    `json:"page"`
	PageSize     int    `json:"pageSize"`
	UserID       uint   `json:"userId"`
	PackageID    uint   `json:"packageId"`
	ResourceType string `json:"resourceType"`
	StartDate    string `json:"startDate"`
	EndDate      string `json:"endDate"`
}

// AdminComputeUsageListItem represents a compute usage record in the list
type AdminComputeUsageListItem struct {
	ID           uint      `json:"id"`
	UserID       uint      `json:"userId"`
	Username     string    `json:"username"`
	PackageID    uint      `json:"packageId"`
	PackageName  string    `json:"packageName"`
	CreditsUsed  string    `json:"creditsUsed"`
	ComputeHours float64   `json:"computeHours"`
	ResourceType string    `json:"resourceType"`
	ResourceID   uint      `json:"resourceId"`
	Description  string    `json:"description"`
	CreatedAt    time.Time `json:"createdAt"`
}

// AdminComputeUsageListResponse represents the compute usage list response
type AdminComputeUsageListResponse struct {
	List     []AdminComputeUsageListItem `json:"list"`
	Total    int64                       `json:"total"`
	Page     int                         `json:"page"`
	PageSize int                         `json:"pageSize"`
}

// AdminComputeUsageSummary represents compute usage summary
type AdminComputeUsageSummary struct {
	TotalCreditsUsed  string  `json:"totalCreditsUsed"`
	TotalComputeHours float64 `json:"totalComputeHours"`
	TotalRecords      int64   `json:"totalRecords"`
}

// GetAdminComputeUsageList returns paginated compute usage list for admin
// POST /api/admin/compute/usage/list
func GetAdminComputeUsageList(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req AdminComputeUsageListRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			req.Page = 1
			req.PageSize = 20
		}

		if req.Page < 1 {
			req.Page = 1
		}
		if req.PageSize < 1 || req.PageSize > 100 {
			req.PageSize = 20
		}

		query := db.Model(&model.ComputeUsage{})

		// Apply filters
		if req.UserID > 0 {
			query = query.Where("user_id = ?", req.UserID)
		}
		if req.PackageID > 0 {
			query = query.Where("package_id = ?", req.PackageID)
		}
		if req.ResourceType != "" {
			query = query.Where("resource_type = ?", req.ResourceType)
		}
		if req.StartDate != "" {
			query = query.Where("created_at >= ?", req.StartDate)
		}
		if req.EndDate != "" {
			query = query.Where("created_at <= ?", req.EndDate+" 23:59:59")
		}

		// Get total
		var total int64
		query.Count(&total)

		// Get list with user and package info
		var usages []model.ComputeUsage
		offset := (req.Page - 1) * req.PageSize
		query.Order("created_at DESC").Offset(offset).Limit(req.PageSize).Find(&usages)

		// Get user names and package names
		userIDs := make([]uint, 0)
		packageIDs := make([]uint, 0)
		for _, u := range usages {
			userIDs = append(userIDs, u.UserID)
			packageIDs = append(packageIDs, u.PackageID)
		}

		userNames := make(map[uint]string)
		if len(userIDs) > 0 {
			var users []model.User
			db.Select("id, username").Where("id IN ?", userIDs).Find(&users)
			for _, u := range users {
				userNames[u.ID] = u.Username
			}
		}

		packageNames := make(map[uint]string)
		if len(packageIDs) > 0 {
			var packages []model.ComputePackage
			db.Select("id, name").Where("id IN ?", packageIDs).Find(&packages)
			for _, p := range packages {
				packageNames[p.ID] = p.Name
			}
		}

		list := make([]AdminComputeUsageListItem, len(usages))
		for i, u := range usages {
			list[i] = AdminComputeUsageListItem{
				ID:           u.ID,
				UserID:       u.UserID,
				Username:     userNames[u.UserID],
				PackageID:    u.PackageID,
				PackageName:  packageNames[u.PackageID],
				CreditsUsed:  u.CreditsUsed.String(),
				ComputeHours: u.ComputeHours,
				ResourceType: u.ResourceType,
				ResourceID:   u.ResourceID,
				Description:  u.Description,
				CreatedAt:    u.CreatedAt,
			}
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: AdminComputeUsageListResponse{
				List:     list,
				Total:    total,
				Page:     req.Page,
				PageSize: req.PageSize,
			},
		})
	}
}

// GetAdminComputeUsageSummary returns compute usage summary for admin
// POST /api/admin/compute/usage/summary
func GetAdminComputeUsageSummary(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			StartDate string `json:"startDate"`
			EndDate   string `json:"endDate"`
		}
		c.ShouldBindJSON(&req)

		query := db.Model(&model.ComputeUsage{})

		// Apply date filters
		if req.StartDate != "" {
			query = query.Where("created_at >= ?", req.StartDate)
		}
		if req.EndDate != "" {
			query = query.Where("created_at <= ?", req.EndDate+" 23:59:59")
		}

		var totalRecords int64
		query.Count(&totalRecords)

		// Calculate total credits used and compute hours
		type Result struct {
			TotalCredits float64
			TotalHours   float64
		}
		var result Result
		query.Select("COALESCE(SUM(credits_used), 0) as total_credits, COALESCE(SUM(compute_hours), 0) as total_hours").Scan(&result)

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: AdminComputeUsageSummary{
				TotalCreditsUsed:  strconv.FormatFloat(result.TotalCredits, 'f', 2, 64),
				TotalComputeHours: result.TotalHours,
				TotalRecords:      totalRecords,
			},
		})
	}
}
