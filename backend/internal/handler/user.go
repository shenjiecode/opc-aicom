package handler

import (


	"net/http"

	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/opc-aicom/backend/internal/middleware"

	"github.com/opc-aicom/backend/internal/model"

	"github.com/opc-aicom/backend/internal/repository"

	"github.com/opc-aicom/backend/internal/pkg/jwt"

	"github.com/opc-aicom/backend/pkg/config"

	"golang.org/x/crypto/bcrypt"

	"gorm.io/gorm"

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
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
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

// setAuthCookie sets the authentication cookie
func setAuthCookie(c *gin.Context, token string, cfg *config.Config) {
	c.SetCookie(
		cfg.JWT.Cookie.Name,
		token,
		cfg.JWT.Cookie.MaxAge,
		cfg.JWT.Cookie.Path,
		cfg.JWT.Cookie.Domain,
		cfg.JWT.Cookie.Secure,
		cfg.JWT.Cookie.HttpOnly,
	)
	// Note: Gin's SetCookie doesn't support SameSite directly, but modern browsers
	// default to SameSite=Lax, so we don't need to add it explicitly for localhost
}

// clearAuthCookie clears the authentication cookie
func clearAuthCookie(c *gin.Context, cfg *config.Config) {
	c.SetCookie(
		cfg.JWT.Cookie.Name,
		"",
		-1, // MaxAge -1 deletes the cookie
		cfg.JWT.Cookie.Path,
		cfg.JWT.Cookie.Domain,
		cfg.JWT.Cookie.Secure,
		cfg.JWT.Cookie.HttpOnly,
	)
}

// LoginRequest represents the user login request body
type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// LoginResponse represents the user login response

type LoginResponse struct {

	Token          string `json:"token"`

	UserID         uint   `json:"userId"`

	Username       string `json:"username"`

	MatrixToken    string `json:"matrixToken,omitempty"`

	MatrixUserID   string `json:"matrixUserId,omitempty"`

	MatrixUsername string `json:"matrixUsername,omitempty"`

}

// Login handles user login

// POST /api/user/login

// Also auto-login/register Matrix user and return Matrix credentials

func Login(db *gorm.DB, cfg *config.Config, matrixClient *MatrixClient) gin.HandlerFunc {

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



		// Set httpOnly cookie

		setAuthCookie(c, token, cfg)



		// Auto-login/register Matrix user
		// Use existing matrix_username from database, or generate a new one
		matrixUsername := user.MatrixUsername
		if matrixUsername == "" {
			matrixUsername = sanitizeMatrixUsername(user.Username)
		}
		matrixPassword := req.Password // Use the same password for Matrix
		matrixAccessToken := ""
		matrixUserID := ""

		if matrixClient != nil {

			// Try user's password first, then fallback to default

			accessToken, userID, err := LoginOrRegisterMatrixUser(matrixClient, matrixUsername, matrixPassword)

			if err != nil {

				// Fallback to default password

				accessToken, userID, err = LoginOrRegisterMatrixUser(matrixClient, matrixUsername, "password")

				if err == nil {

					matrixAccessToken = accessToken

					matrixUserID = userID

					if user.MatrixUsername == "" {

						db.Model(&user).Update("matrix_username", matrixUsername)

					}

				}

			} else {

				matrixAccessToken = accessToken

				matrixUserID = userID

				if user.MatrixUsername == "" {

					db.Model(&user).Update("matrix_username", matrixUsername)

				}

				setMatrixToken(user.ID, matrixAccessToken)

			}

		}



		// Return success response with user info (token in cookie only)

		c.JSON(http.StatusOK, UnifiedResponse{

			Code:    0,

			Message: "success",

			Data: LoginResponse{

				Token:          "",

				UserID:         user.ID,

				Username:       user.Username,

				MatrixToken:    matrixAccessToken,

				MatrixUserID:   matrixUserID,

				MatrixUsername: matrixUsername,

			},

		})

	}

}

// GetUserInfoResponse represents the get user info response
type GetUserInfoResponse struct {
	UserID             uint       `json:"userId"`
	Username           string     `json:"username"`
	MatrixUsername     string     `json:"matrixUsername,omitempty"`
	Role               string     `json:"role"`
	VipLevel           int        `json:"vipLevel"`
	MemberType         string     `json:"memberType"`
	VerificationStatus string     `json:"verificationStatus"`
	RealName           string     `json:"realName,omitempty"`
	EnterpriseName     string     `json:"enterpriseName,omitempty"`
	Assets             UserAssets `json:"assets"`
}

type UserAssets struct {
	Points          int     `json:"points"`
	Coupons         int     `json:"coupons"`
	CouponsExpiring int     `json:"couponsExpiring"`
	ComputeHours    float64 `json:"computeHours"`
	ComputeGPU      float64 `json:"computeGpu"`
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

		// Find user assets
		var userAsset model.UserAsset
		if err := db.Where("user_id = ?", userID).First(&userAsset).Error; err != nil {
			// Assets not found is not an error, use defaults
			userAsset = model.UserAsset{UserID: userID}
		}

		// Return user info
		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: GetUserInfoResponse{
				UserID:             user.ID,
				Username:           user.Username,
				MatrixUsername:     user.MatrixUsername,
				Role:               user.Role,
				VipLevel:           user.VipLevel,
				MemberType:         user.MemberType,
				VerificationStatus: user.VerificationStatus,
				RealName:           user.RealName,
				EnterpriseName:     user.EnterpriseName,
				Assets: UserAssets{
					Points:          userAsset.Points,
					Coupons:         userAsset.Coupons,
					CouponsExpiring: userAsset.CouponsExpiring,
					ComputeHours:    userAsset.ComputeHours,
					ComputeGPU:      userAsset.ComputeGPU,
				},
			},
		})
	}
}


// Logout handles user logout
// POST /api/user/logout
func Logout(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Clear the auth cookie
		clearAuthCookie(c, cfg)

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
		})
	}
}

// UserPostListResponse represents the user's post list response
type UserPostListResponse struct {
	List     []*repository.PostWithAuthor `json:"list"`
	Total    int64                        `json:"total"`
	Page     int                          `json:"page"`
	PageSize int                          `json:"pageSize"`
}

// GetUserPosts handles getting user's published posts
// GET /api/user/posts (requires auth)
func GetUserPosts(db *gorm.DB) gin.HandlerFunc {
	postRepo := repository.NewPostRepository(db)

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

		// Get pagination params from query
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))

		if page < 1 {
			page = 1
		}
		if pageSize < 1 {
			pageSize = 10
		}
		if pageSize > 100 {
			pageSize = 100
		}

		// Query posts by user ID
		posts, total, err := postRepo.ListByUserID(userID, page, pageSize)
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to fetch posts",
			})
			return
		}

		// Return success response
		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: UserPostListResponse{
				List:     posts,
				Total:    total,
				Page:     page,
				PageSize: pageSize,
			},
		})
	}
}

// UserEventListResponse represents the user's event list response
type UserEventListResponse struct {
	List     []*model.Event `json:"list"`
	Total    int64          `json:"total"`
	Page     int            `json:"page"`
	PageSize int            `json:"pageSize"`
}

// GetUserEvents handles getting user's registered events
// GET /api/user/events (requires auth)
func GetUserEvents(db *gorm.DB) gin.HandlerFunc {
	eventRepo := repository.NewEventRepository(db)

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

		// Get pagination params from query
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))

		if page < 1 {
			page = 1
		}
		if pageSize < 1 {
			pageSize = 10
		}
		if pageSize > 100 {
			pageSize = 100
		}

		// Query events user has registered for
		events, total, err := eventRepo.ListRegisteredByUserID(userID, page, pageSize)
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to fetch events",
			})
			return
		}

		// Return success response
		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: UserEventListResponse{
				List:     events,
				Total:    total,
				Page:     page,
				PageSize: pageSize,
			},
		})
	}
}
