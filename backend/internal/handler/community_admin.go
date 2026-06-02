package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/middleware"
	"github.com/opc-aicom/backend/internal/model"
	"gorm.io/gorm"
)

// ================== Community Users List ==================

// CommunityUserListRequest represents the community user list request
type CommunityUserListRequest struct {
	Page     int    `json:"page"`
	PageSize int    `json:"pageSize"`
	Search   string `json:"search"`
	Status   string `json:"status"`
}

// CommunityUserListItem represents a user in the community list
type CommunityUserListItem struct {
	ID               uint       `json:"id"`
	Username         string     `json:"username"`
	Avatar           *string    `json:"avatar"`
	Role             string     `json:"role"`
	Status           string     `json:"status"`
	MemberType       string     `json:"memberType"`
	VerificationStatus string   `json:"verificationStatus"`
	EnterpriseName   string     `json:"enterpriseName"`
	VipLevel         int        `json:"vipLevel"`
	LastActiveAt     *time.Time `json:"lastActiveAt"`
	CreatedAt        time.Time  `json:"createdAt"`
}

// CommunityUserListResponse represents the community user list response
type CommunityUserListResponse struct {
	List     []CommunityUserListItem `json:"list"`
	Total    int64                   `json:"total"`
	Page     int                     `json:"page"`
	PageSize int                     `json:"pageSize"`
}

// GetCommunityUsersList returns paginated list of all non-admin users
// POST /api/community-admin/users/list
func GetCommunityUsersList(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req CommunityUserListRequest
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

		// Exclude admin users (only show regular users and community_admin)
		query = query.Where("role IN ?", []string{"user", "community_admin"})

		// Apply filters
		if req.Search != "" {
			query = query.Where("username LIKE ?", "%"+req.Search+"%")
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
		list := make([]CommunityUserListItem, len(users))
		for i, u := range users {
			list[i] = CommunityUserListItem{
				ID:               u.ID,
				Username:         u.Username,
				Avatar:           u.Avatar,
				Role:             u.Role,
				Status:           u.Status,
				MemberType:       u.MemberType,
				VerificationStatus: u.VerificationStatus,
				EnterpriseName:   u.EnterpriseName,
				VipLevel:         u.VipLevel,
				LastActiveAt:     u.LastActiveAt,
				CreatedAt:        u.CreatedAt,
			}
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: CommunityUserListResponse{
				List:     list,
				Total:    total,
				Page:     req.Page,
				PageSize: req.PageSize,
			},
		})
	}
}

// ================== OPC Enterprises List ==================

// OPCEnterpriseListRequest represents the OPC enterprise list request
type OPCEnterpriseListRequest struct {
	Page              int    `json:"page"`
	PageSize          int    `json:"pageSize"`
	VerificationStatus string `json:"verificationStatus"` // none, pending, verified, rejected
	Search            string `json:"search"`
}

// OPCEnterpriseListItem represents an enterprise user in the list
type OPCEnterpriseListItem struct {
	ID               uint       `json:"id"`
	Username         string     `json:"username"`
	Avatar           *string    `json:"avatar"`
	EnterpriseName   string     `json:"enterpriseName"`
	VerificationStatus string   `json:"verificationStatus"`
	RealName         string     `json:"realName"`
	MemberType       string     `json:"memberType"`
	Status           string     `json:"status"`
	CreatedAt        time.Time  `json:"createdAt"`
	UpdatedAt        time.Time  `json:"updatedAt"`
}

// OPCEnterpriseListResponse represents the OPC enterprise list response
type OPCEnterpriseListResponse struct {
	List     []OPCEnterpriseListItem `json:"list"`
	Total    int64                   `json:"total"`
	Page     int                     `json:"page"`
	PageSize int                     `json:"pageSize"`
}

// GetOPCEnterprisesList returns paginated list of enterprise users
// POST /api/community-admin/enterprises/list
func GetOPCEnterprisesList(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req OPCEnterpriseListRequest
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

		// Filter for enterprise member type
		query = query.Where("member_type = ?", "enterprise")

		// Apply filters
		if req.VerificationStatus != "" {
			query = query.Where("verification_status = ?", req.VerificationStatus)
		}
		if req.Search != "" {
			query = query.Where("username LIKE ? OR enterprise_name LIKE ?", 
				"%"+req.Search+"%", "%"+req.Search+"%")
		}

		// Get total
		var total int64
		query.Count(&total)

		// Get list
		var users []model.User
		offset := (req.Page - 1) * req.PageSize
		query.Order("created_at desc").Offset(offset).Limit(req.PageSize).Find(&users)

		// Convert to response
		list := make([]OPCEnterpriseListItem, len(users))
		for i, u := range users {
			list[i] = OPCEnterpriseListItem{
				ID:               u.ID,
				Username:         u.Username,
				Avatar:           u.Avatar,
				EnterpriseName:   u.EnterpriseName,
				VerificationStatus: u.VerificationStatus,
				RealName:         u.RealName,
				MemberType:       u.MemberType,
				Status:           u.Status,
				CreatedAt:        u.CreatedAt,
				UpdatedAt:        u.UpdatedAt,
			}
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: OPCEnterpriseListResponse{
				List:     list,
				Total:    total,
				Page:     req.Page,
				PageSize: req.PageSize,
			},
		})
	}
}

// ================== Enterprise Verification ==================

// EnterpriseApprovalRequest represents the approval request
type EnterpriseApprovalRequest struct {
	UserID uint   `json:"userId" binding:"required"`
	Reason string `json:"reason"`
}

// ApproveEnterpriseVerification approves an enterprise verification
// POST /api/community-admin/enterprises/approve
func ApproveEnterpriseVerification(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req EnterpriseApprovalRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "userId is required",
			})
			return
		}

		var user model.User
		if err := db.First(&user, req.UserID).Error; err != nil {
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

		// Check if user is enterprise type
		if user.MemberType != "enterprise" {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "user is not enterprise member type",
			})
			return
		}

		// Update verification status to verified
		if err := db.Model(&user).Update("verification_status", "verified").Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to approve verification",
			})
			return
		}

		// Log activity
		adminID, _ := middleware.GetUserID(c)
		activityLog := model.ActivityLog{
			UserID:  adminID,
			Action:  "community_admin_approve_enterprise",
			Details: "Approved enterprise verification for user " + user.Username + " (ID: " + string(req.UserID) + "). Enterprise: " + user.EnterpriseName + ". Reason: " + req.Reason,
		}
		db.Create(&activityLog)

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "enterprise verification approved successfully",
		})
	}
}

// RejectEnterpriseVerification rejects an enterprise verification
// POST /api/community-admin/enterprises/reject
func RejectEnterpriseVerification(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req EnterpriseApprovalRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "userId is required",
			})
			return
		}

		var user model.User
		if err := db.First(&user, req.UserID).Error; err != nil {
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

		// Check if user is enterprise type
		if user.MemberType != "enterprise" {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "user is not enterprise member type",
			})
			return
		}

		// Update verification status to rejected
		if err := db.Model(&user).Update("verification_status", "rejected").Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to reject verification",
			})
			return
		}

		// Log activity
		adminID, _ := middleware.GetUserID(c)
		activityLog := model.ActivityLog{
			UserID:  adminID,
			Action:  "community_admin_reject_enterprise",
			Details: "Rejected enterprise verification for user " + user.Username + " (ID: " + string(req.UserID) + "). Enterprise: " + user.EnterpriseName + ". Reason: " + req.Reason,
		}
		db.Create(&activityLog)

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "enterprise verification rejected",
		})
	}
}