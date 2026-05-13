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

// CreateTaskRequest represents the request body for creating a task
type CreateTaskRequest struct {
	Title       string  `json:"title" binding:"required"`
	Description string  `json:"description"`
	Budget      float64 `json:"budget"`
	Type        string  `json:"type"`
	Level       string  `json:"level"`
	Deadline    *string `json:"deadline"`
}

// CreateTaskResponse represents the response for creating a task
type CreateTaskResponse struct {
	TaskID uint `json:"taskId"`
}

// CreateTask handles creating a new task
// POST /api/task/create
func CreateTask(db *gorm.DB) gin.HandlerFunc {
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

		var req CreateTaskRequest
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

		// Set defaults
		taskType := req.Type
		if taskType == "" {
			taskType = "dev"
		}
		level := req.Level
		if level == "" {
			level = "medium"
		}

		// Create task
		task := &model.Task{
			UserID:      userID,
			Title:       req.Title,
			Description: req.Description,
			Budget:      req.Budget,
			Type:        taskType,
			Level:       level,
			Status:      "open",
		}

		if err := db.Create(task).Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to create task",
			})
			return
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data:    CreateTaskResponse{TaskID: task.ID},
		})
	}
}

// ApplyTaskRequest represents the request body for applying to a task
type ApplyTaskRequest struct {
	TaskID  uint   `json:"taskId" binding:"required"`
	Message string `json:"message"`
}

// ApplyTaskResponse represents the response for applying to a task
type ApplyTaskResponse struct {
	ApplicationID uint `json:"applicationId"`
}

// ApplyTask handles applying to a task
// POST /api/task/apply
func ApplyTask(db *gorm.DB) gin.HandlerFunc {
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

		var req ApplyTaskRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid request body",
			})
			return
		}

		// Check if task exists
		var task model.Task
		if err := db.First(&task, req.TaskID).Error; err != nil {
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

		// Check if user already applied (prevent duplicate applications)
		var existingApp model.Application
		result := db.Where("task_id = ? AND user_id = ?", req.TaskID, userID).First(&existingApp)
		if result.Error == nil {
			c.JSON(http.StatusConflict, UnifiedResponse{
				Code:    409,
				Message: "already applied to this task",
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

		// Create application
		application := &model.Application{
			TaskID:  req.TaskID,
			UserID:  userID,
			Status:  "pending",
			Message: req.Message,
		}

		if err := db.Create(application).Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to create application",
			})
			return
		}

		// Increment applicants count
		db.Model(&task).Update("applicants_count", gorm.Expr("applicants_count + ?", 1))

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data:    ApplyTaskResponse{ApplicationID: application.ID},
		})
	}
}

// ListTasksResponse represents the response for listing tasks
type ListTasksResponse struct {
	List  []model.Task `json:"list"`
	Total int64        `json:"total"`
}

// ListTasks handles listing tasks with filters
// POST /api/task/list
func ListTasks(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Parse pagination params
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))

		if page < 1 {
			page = 1
		}
		if pageSize < 1 {
			pageSize = 10
		}

		// Build filter from query params
		filter := &model.TaskFilter{}
		if t := c.Query("type"); t != "" {
			filter.Type = t
		}
		if l := c.Query("level"); l != "" {
			filter.Level = l
		}
		if s := c.Query("status"); s != "" {
			filter.Status = s
		}

		// Calculate offset
		offset := (page - 1) * pageSize

		// Get task repository
		taskRepo := repository.NewTaskRepository(db)

		// Get total count
		var total int64
		countQuery := db.Model(&model.Task{})
		if filter.Type != "" {
			countQuery = countQuery.Where("type = ?", filter.Type)
		}
		if filter.Level != "" {
			countQuery = countQuery.Where("level = ?", filter.Level)
		}
		if filter.Status != "" {
			countQuery = countQuery.Where("status = ?", filter.Status)
		}
		countQuery.Count(&total)

		// Get list
		tasks, err := taskRepo.List(filter, pageSize, offset)
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to fetch tasks",
			})
			return
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data:    ListTasksResponse{List: tasks, Total: total},
		})
	}
}