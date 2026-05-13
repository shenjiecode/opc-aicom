package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/middleware"
	"github.com/opc-aicom/backend/internal/model"
	"github.com/opc-aicom/backend/internal/repository"
	"gorm.io/gorm"
)

// PostListResponse represents the post list response
type PostListResponse struct {
	List     interface{} `json:"list"`
	Total    int64       `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}

// ListPostRequest represents the request body for getting post list
type ListPostRequest struct {
	Page     int    `json:"page"`
	PageSize int    `json:"pageSize"`
	Category string `json:"category"`
}

// ListPosts handles getting post list with pagination
// POST /api/community/list
func ListPosts(db *gorm.DB) gin.HandlerFunc {
	postRepo := repository.NewPostRepository(db)

	return func(c *gin.Context) {
		var req ListPostRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			// Fallback to query params if JSON binding fails (for compatibility)
			page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
			pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
			req.Page = page
			req.PageSize = pageSize
			req.Category = c.Query("category")
		}

		if req.Page < 1 {
			req.Page = 1
		}
		if req.PageSize < 1 {
			req.PageSize = 10
		}
		if req.PageSize > 100 {
			req.PageSize = 100
		}

		// Query posts from repository
		posts, total, err := postRepo.List(req.Page, req.PageSize, req.Category)
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to fetch posts",
			})
			return
		}

		// Return success response
		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: PostListResponse{
				List:     posts,
				Total:    total,
				Page:     req.Page,
				PageSize: req.PageSize,
			},
		})
	}
}

// LikeRequest represents the like request body
type LikeRequest struct {
	PostID uint `json:"postId" binding:"required"`
}

// CommentRequest represents the comment request body
type CommentRequest struct {
	PostID  uint   `json:"postId" binding:"required"`
	Content string `json:"content" binding:"required"`
}

// LikePost handles toggling like on a post
// POST /api/community/like
func LikePost(db *gorm.DB) gin.HandlerFunc {
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

		var req LikeRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid request body",
			})
			return
		}

		// Check if post exists
		var post model.Post
		if err := db.First(&post, req.PostID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, UnifiedResponse{
					Code:    404,
					Message: "post not found",
				})
				return
			}
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "database error",
			})
			return
		}

		// Check if user already liked the post
		var existingLike model.Like
		result := db.Where("post_id = ? AND user_id = ?", req.PostID, userID).First(&existingLike)

		if result.Error == nil {
			// User already liked - unlike (delete)
			if err := db.Delete(&existingLike).Error; err != nil {
				c.JSON(http.StatusInternalServerError, UnifiedResponse{
					Code:    500,
					Message: "failed to unlike post",
				})
				return
			}
			// Decrement likes count
			db.Model(&post).Update("likes_count", gorm.Expr("likes_count - ?", 1))

			c.JSON(http.StatusOK, UnifiedResponse{
				Code:    0,
				Message: "unliked",
				Data:    false, // isLiked: false
			})
			return
		}

		if result.Error != gorm.ErrRecordNotFound {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "database error",
			})
			return
		}

		// Create new like
		like := model.Like{
			PostID: req.PostID,
			UserID: userID,
		}

		if err := db.Create(&like).Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to like post",
			})
			return
		}

		// Increment likes count
		db.Model(&post).Update("likes_count", gorm.Expr("likes_count + ?", 1))

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data:    true, // isLiked: true
		})
	}
}

// CommentPost handles adding a comment to a post
// POST /api/community/comment
func CommentPost(db *gorm.DB) gin.HandlerFunc {
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

		var req CommentRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid request body",
			})
			return
		}

		// Validate content length
		if len(req.Content) == 0 || len(req.Content) > 1000 {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "content must be between 1 and 1000 characters",
			})
			return
		}

		// Check if post exists
		var post model.Post
		if err := db.First(&post, req.PostID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, UnifiedResponse{
					Code:    404,
					Message: "post not found",
				})
				return
			}
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "database error",
			})
			return
		}

		// Create comment
		comment := model.Comment{
			PostID:  req.PostID,
			UserID:  userID,
			Content: req.Content,
		}

		if err := db.Create(&comment).Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to create comment",
			})
			return
		}

		// Increment comments count
		db.Model(&post).Update("comments_count", gorm.Expr("comments_count + ?", 1))

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data:    comment,
		})
	}
}

// CreatePostRequest represents the request body for creating a post
type CreatePostRequest struct {
	Title   string `json:"title" binding:"required"`
	Content string `json:"content" binding:"required"`
}

// CreatePostResponse represents the response for creating a post
type CreatePostResponse struct {
	PostID uint `json:"postId"`
}

// CreatePost handles creating a new community post
// POST /api/community/create
func CreatePost(db *gorm.DB) gin.HandlerFunc {
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

		var req CreatePostRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid request body",
			})
			return
		}

		// Validate title: 1-200 characters
		if len(req.Title) < 1 || len(req.Title) > 200 {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "title must be between 1 and 200 characters",
			})
			return
		}

		// Validate content: required
		if len(req.Content) < 1 {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "content is required",
			})
			return
		}

		// Create post
		post := &model.Post{
			UserID:  userID,
			Title:   req.Title,
			Content: req.Content,
		}

		createdPost, err := postRepo.Create(post)
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to create post",
			})
			return
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data:    CreatePostResponse{PostID: createdPost.ID},
		})
	}
}
