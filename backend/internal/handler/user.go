package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/middleware"
	"github.com/opc-aicom/backend/internal/model"
	"github.com/opc-aicom/backend/internal/pkg/jwt"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"github.com/opc-aicom/backend/pkg/config"
)

// RegisterRequest represents the user registration request body
type RegisterRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// RegisterResponse represents the user registration response
type RegisterResponse struct {
	UserID uint `json:"userId"`
}

// UnifiedResponse represents the unified API response format
type UnifiedResponse struct {
	Code    int  `json:"code"`
	Message string `json:"message"`
	Data    any  `json:"data,omitempty"`
}

// Register handles user registration
// POST /api/user/register
func Register(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req RegisterRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "Invalid request body",
			})
			return
		}

		// Validate username: 3-50 characters
		if len(req.Username) < 3 || len(req.Username) > 50 {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "Username must be between 3 and 50 characters",
			})
			return
		}

		// Validate password: 6-20 characters
		if len(req.Password) < 6 || len(req.Password) > 20 {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "Password must be between 6 and 20 characters",
			})
			return
		}

		// Check if username already exists
		var existingUser model.User
		if err := db.Where("username = ?", req.Username).First(&existingUser).Error; err == nil {
			c.JSON(http.StatusConflict, UnifiedResponse{
				Code:    409,
				Message: "Username already exists",
			})
			return
		} else if err != gorm.ErrRecordNotFound {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Database error",
			})
			return
		}

		// Hash password with bcrypt
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to hash password",
			})
			return
		}

		// Create user
		user := model.User{
			Username:     req.Username,
			PasswordHash: string(hashedPassword),
			Role:         "user",
			VipLevel:     0,
		}

		if err := db.Create(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to create user",
			})
			return
		}

		// Create user asset record with default values
		userAsset := model.UserAsset{
			UserID:       user.ID,
			Points:       0,
			Coupons:      0,
			ComputeHours: 0,
		}

		if err := db.Create(&userAsset).Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to create user asset",
			})
			return
		}

		// Return success response
		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data:    RegisterResponse{UserID: user.ID},
		})
	}
}

// LoginRequest represents the user login request body
type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// LoginResponse represents the user login response
type LoginResponse struct {
	Token    string `json:"token"`
	UserID   uint   `json:"userId"`
	Username string `json:"username"`
}

// Login handles user login
// POST /api/user/login
func Login(db *gorm.DB, cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req LoginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "Invalid request body",
			})
			return
		}

		// Find user by username
		var user model.User
		if err := db.Where("username = ?", req.Username).First(&user).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusUnauthorized, UnifiedResponse{
					Code:    401,
					Message: "Invalid username or password",
				})
				return
			}
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Database error",
			})
			return
		}

		// Verify password
		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{
				Code:    401,
				Message: "Invalid username or password",
			})
			return
		}

		// Generate JWT token
		token, err := jwt.GenerateToken(user.ID, user.Username, cfg.JWT.Secret, cfg.JWT.ExpireHours)
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to generate token",
			})
			return
		}

		// Return success response with token
		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: LoginResponse{
				Token:    token,
				UserID:   user.ID,
				Username: user.Username,
			},
		})
	}
}

// GetUserInfoResponse represents the get user info response
type GetUserInfoResponse struct {
	UserID   uint   `json:"userId"`
	Username string `json:"username"`
	Role     string `json:"role"`
	VipLevel int    `json:"vipLevel"`
}

// GetUserInfo handles getting user info
// POST /api/user/info (requires auth)
func GetUserInfo(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user ID from context (set by auth middleware)
		userID, ok := middleware.GetUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, UnifiedResponse{
				Code:    401,
				Message: "unauthorized",
			})
			return
		}

		// Find user by ID
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

		// Return user info
		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: GetUserInfoResponse{
				UserID:   user.ID,
				Username: user.Username,
				Role:     user.Role,
				VipLevel: user.VipLevel,
			},
		})
	}
}
