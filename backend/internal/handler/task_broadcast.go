package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/middleware"
	"github.com/opc-aicom/backend/internal/model"
	"gorm.io/gorm"
)

// BroadcastTaskRequest represents the request body for broadcasting a task
type BroadcastTaskRequest struct {
	TaskType      string   `json:"task_type" binding:"required"` // e.g., "dev", "design"
	RequiredSkills []string `json:"required_skills"`             // List of required skills
}

// BroadcastTaskResponse represents the response for broadcasting a task
type BroadcastTaskResponse struct {
	NotifiedCount int      `json:"notified_count"`
	AgentIDs      []uint   `json:"agent_ids"`
}

// GetNotificationsResponse represents the response for getting notifications
type GetNotificationsResponse struct {
	Notifications []NotificationInfo `json:"notifications"`
	Total        int                `json:"total"`
}

// NotificationInfo represents notification details
type NotificationInfo struct {
	ID             uint       `json:"id"`
	AgentID        uint       `json:"agent_id"`
	AgentName      string     `json:"agent_name"`
	UserID         uint       `json:"user_id"`
	TaskTitle      string     `json:"task_title"`
	Status         string     `json:"status"`
	NotifiedAt     time.Time  `json:"notified_at"`
	ViewedAt       *time.Time `json:"viewed_at"`
	AcceptedAt     *time.Time `json:"accepted_at"`
	RejectedAt     *time.Time `json:"rejected_at"`
}

// BroadcastTask broadcasts a task to matching agents
// POST /api/tasks/:id/broadcast
func BroadcastTask(db *gorm.DB) gin.HandlerFunc {
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

		// Get task ID from path
		taskIDStr := c.Param("id")
		if taskIDStr == "" {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "task ID is required",
			})
			return
		}

		var taskID uint
		if _, err := fmt.Sscanf(taskIDStr, "%d", &taskID); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid task ID",
			})
			return
		}

		// Check if task exists and belongs to user
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

		// Verify ownership
		if task.UserID != userID {
			c.JSON(http.StatusForbidden, UnifiedResponse{
				Code:    403,
				Message: "not authorized to broadcast this task",
			})
			return
		}

		// Parse request
		var req BroadcastTaskRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid request body",
			})
			return
		}

		// Validate task type
		if req.TaskType == "" {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "task_type is required",
			})
			return
		}

		// Find matching agents
		var agents []model.AgentInstance
		if err := db.Where("status = ?", model.InstanceStatusRunning).Find(&agents).Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to find agents",
			})
			return
		}

		// Filter agents by matching skills
		var matchedAgents []model.AgentInstance
		for _, agent := range agents {
			if matchesRequiredSkills(agent.SkillsJSON, req.RequiredSkills) {
				matchedAgents = append(matchedAgents, agent)
			}
		}

		// Create notification records
		var notifiedCount int
		var notifiedAgentIDs []uint
		now := time.Now()

		for _, agent := range matchedAgents {
			// Check if notification already exists
			var existing model.TaskNotification
			result := db.Where("task_id = ? AND agent_id = ?", taskID, agent.ID).First(&existing)
			if result.Error == nil {
				// Already notified, skip
				continue
			}

			// Parse required skills to JSON string
			skillsJSON, _ := json.Marshal(req.RequiredSkills)

			notification := &model.TaskNotification{
				TaskID:          taskID,
				AgentID:         agent.ID,
				UserID:          agent.UserID,
				TaskTitle:       task.Title,
				TaskType:        req.TaskType,
				RequiredSkills:  string(skillsJSON),
				Status:          model.NotificationStatusPending,
				NotifiedAt:      now,
			}

			if err := db.Create(notification).Error; err != nil {
				continue
			}

			notifiedCount++
			notifiedAgentIDs = append(notifiedAgentIDs, agent.ID)
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: BroadcastTaskResponse{
				NotifiedCount: notifiedCount,
				AgentIDs:      notifiedAgentIDs,
			},
		})
	}
}

// matchesRequiredSkills checks if agent's skills match required skills
func matchesRequiredSkills(agentSkillsJSON string, requiredSkills []string) bool {
	if agentSkillsJSON == "" {
		return false
	}

	var agentSkills []map[string]interface{}
	if err := json.Unmarshal([]byte(agentSkillsJSON), &agentSkills); err != nil {
		return false
	}

	// Extract agent skill names
	var agentSkillNames []string
	for _, skill := range agentSkills {
		if name, ok := skill["name"].(string); ok {
			agentSkillNames = append(agentSkillNames, strings.ToLower(name))
		}
	}

// Check if any required skill matches
	for _, required := range requiredSkills {
		requiredLower := strings.ToLower(required)
		for _, agentSkill := range agentSkillNames {
			// Exact match only - "java" should not match "javascript"
			if agentSkill == requiredLower {
				return true
			}
		}
	}

	// If no required skills specified, match all agents
	return len(requiredSkills) == 0
}

// GetTaskNotifications gets all notifications for a task
// GET /api/tasks/:id/notifications
func GetTaskNotifications(db *gorm.DB) gin.HandlerFunc {
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

		// Get task ID from path
		taskIDStr := c.Param("id")
		if taskIDStr == "" {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "task ID is required",
			})
			return
		}

		var taskID uint
		if _, err := fmt.Sscanf(taskIDStr, "%d", &taskID); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid task ID",
			})
			return
		}

		// Check if task exists
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

		// Verify ownership
		if task.UserID != userID {
			c.JSON(http.StatusForbidden, UnifiedResponse{
				Code:    403,
				Message: "not authorized to view notifications for this task",
			})
			return
		}

		// Get notifications with agent info
		type NotificationWithAgent struct {
			model.TaskNotification
			AgentName string `json:"agent_name"`
		}

		var notifications []NotificationWithAgent
		if err := db.Table("task_notifications").
			Select("task_notifications.*, agent_instances.name as agent_name").
			Joins("LEFT JOIN agent_instances ON task_notifications.agent_id = agent_instances.id").
			Where("task_notifications.task_id = ?", taskID).
			Order("task_notifications.created_at DESC").
			Find(&notifications).Error; err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to fetch notifications",
			})
			return
		}

		// Build response
		var notificationInfos []NotificationInfo
		for _, n := range notifications {
			notificationInfos = append(notificationInfos, NotificationInfo{
				ID:         n.ID,
				AgentID:    n.AgentID,
				AgentName:  n.AgentName,
				UserID:     n.UserID,
				TaskTitle:  n.TaskTitle,
				Status:     n.Status,
				NotifiedAt: n.NotifiedAt,
				ViewedAt:   n.ViewedAt,
				AcceptedAt: n.AcceptedAt,
				RejectedAt: n.RejectedAt,
			})
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: GetNotificationsResponse{
				Notifications: notificationInfos,
				Total:          len(notificationInfos),
			},
		})
	}
}

// AcceptTaskRequest represents the request body for accepting a task
type AcceptTaskRequest struct {
	Message string `json:"message"`
}

// AcceptTaskResponse represents the response for accepting a task
type AcceptTaskResponse struct {
	ContractID uint `json:"contract_id"`
}

// AcceptTask handles accepting a task by an agent
// POST /api/task/:id/accept
func AcceptTask(db *gorm.DB) gin.HandlerFunc {
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

		// Get task ID from path
		taskIDStr := c.Param("id")
		if taskIDStr == "" {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "task ID is required",
			})
			return
		}

		var taskID uint
		if _, err := fmt.Sscanf(taskIDStr, "%d", &taskID); err != nil {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid task ID",
			})
			return
		}

		// Check if task exists
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

		// Check if task is still open
		if task.Status != "open" {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "task is no longer available",
			})
			return
		}

		// Check if user already applied
		var existingApp model.Application
		result := db.Where("task_id = ? AND user_id = ?", taskID, userID).First(&existingApp)
		if result.Error == nil {
			c.JSON(http.StatusConflict, UnifiedResponse{
				Code:    409,
				Message: "already applied to this task",
			})
			return
		}

		// Parse request
		var req AcceptTaskRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			req.Message = "" // Optional field
		}

		// Create application
		application := &model.Application{
			TaskID:  taskID,
			UserID:  userID,
			Status:  "accepted",
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

		// Create contract record if needed
		contractID := uint(0)
		if task.ContractID != nil {
			contractID = *task.ContractID
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: AcceptTaskResponse{
				ContractID: contractID,
			},
		})
	}
}
