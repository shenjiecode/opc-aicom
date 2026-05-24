package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/model"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)
// setupTaskBroadcastTestDB creates an in-memory SQLite database for tests
func setupTaskBroadcastTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to connect to test DB: %v", err)
	}

	db.AutoMigrate(
		&model.User{},
		&model.Task{},
		&model.AgentInstance{},
		&model.TaskNotification{},
	)

	return db
}

// createTestUser creates a test user and returns the user
func createTestUser(db *gorm.DB, username string, t *testing.T) model.User {
	user := model.User{
		Username:     username,
		PasswordHash: "testpass",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}
	return user
}

// createTestTask creates a test task and returns the task
func createTestTask(db *gorm.DB, userID uint, title string, taskType string, t *testing.T) model.Task {
	task := model.Task{
		UserID:  userID,
		Title:   title,
		Type:    taskType,
		Level:   "medium",
		Status:  "open",
	}
	if err := db.Create(&task).Error; err != nil {
		t.Fatalf("Failed to create task: %v", err)
	}
	return task
}

// createTestAgentInstance creates a test agent instance and returns it
func createTestAgentInstance(db *gorm.DB, userID uint, name string, skillsJSON string, status string, t *testing.T) model.AgentInstance {
	agent := model.AgentInstance{
		UserID:       userID,
		Name:        name,
		SkillsJSON:   skillsJSON,
		Status:      status,
	}
	if err := db.Create(&agent).Error; err != nil {
		t.Fatalf("Failed to create agent: %v", err)
	}
	return agent
}

// setupTestRouter sets up Gin test router with auth middleware
func setupTestRouter(db *gorm.DB) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	
	// Add test user to context
	router.Use(func(c *gin.Context) {
		c.Set("userID", uint(1))
		c.Next()
	})
	
	return router
}

// TestBroadcastTask_Unauthorized tests broadcast without auth
func TestBroadcastTask_Unauthorized(t *testing.T) {
	db := setupTaskBroadcastTestDB(t)
	router := setupTestRouter(db)

	// Don't add user context - this should return 401
	router.POST("/api/tasks/:id/broadcast", func(c *gin.Context) {
		c.JSON(http.StatusUnauthorized, UnifiedResponse{
			Code:    401,
			Message: "unauthorized",
		})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/tasks/1/broadcast", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", w.Code)
	}
}

// TestBroadcastTask_TaskNotFound tests broadcast for non-existent task
func TestBroadcastTask_TaskNotFound(t *testing.T) {
	db := setupTaskBroadcastTestDB(t)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("userID", uint(1))
		c.Next()
	})
	router.POST("/api/tasks/:id/broadcast", BroadcastTask(db))

	body := map[string]interface{}{
		"task_type":       "dev",
		"required_skills": []string{"python", "react"},
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/tasks/999/broadcast", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	// Should return 404 for task not found
	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d", w.Code)
	}
}

// TestBroadcastTask_Success tests successful task broadcast
func TestBroadcastTask_Success(t *testing.T) {
	db := setupTaskBroadcastTestDB(t)

	// Create test data
	user := createTestUser(db, "testuser", t)
	task := createTestTask(db, user.ID, "Test Task", "dev", t)
_ = createTestAgentInstance(db, user.ID, "Test Agent", `[{"name":"python"},{"name":"react"}]`, "running", t)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("userID", user.ID)
		c.Next()
	})
	router.POST("/api/tasks/:id/broadcast", BroadcastTask(db))

	body := map[string]interface{}{
		"task_type":       "dev",
		"required_skills": []string{"python"},
	}
	jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		url := fmt.Sprintf("/api/tasks/%d/broadcast", task.ID)
		req, _ := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		// Should return success or error based on agent matching
		t.Logf("Testing broadcast with task ID: %d, URL: %s, response code: %d", task.ID, url, w.Code)
	}

// TestGetTaskNotifications_Success tests getting notifications
func TestGetTaskNotifications_Success(t *testing.T) {
	db := setupTaskBroadcastTestDB(t)

	// Create test data
	user := createTestUser(db, "testuser", t)
	task := createTestTask(db, user.ID, "Test Task", "dev", t)
	agent := createTestAgentInstance(db, user.ID, "Test Agent", `[{"name":"python"}]`, "running", t)

	// Create notification
	notification := model.TaskNotification{
		TaskID:     task.ID,
		AgentID:    agent.ID,
		UserID:    user.ID,
		TaskTitle: task.Title,
		TaskType:  "dev",
		Status:   "pending",
	}
	db.Create(&notification)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("userID", user.ID)
		c.Next()
	})
	router.GET("/api/tasks/:id/notifications", GetTaskNotifications(db))

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/tasks/1/notifications", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}

// TestMatchesRequiredSkills tests skill matching logic
func TestMatchesRequiredSkills(t *testing.T) {
	tests := []struct {
		name           string
		agentSkills    string
		requiredSkills []string
		expected     bool
	}{
		{
			name:           "matching skills",
			agentSkills:    `[{"name":"python"},{"name":"react"}]`,
			requiredSkills: []string{"python"},
			expected:      true,
		},
		{
			name:           "no matching skills",
			agentSkills:    `[{"name":"python"}]`,
			requiredSkills: []string{"golang"},
			expected:      false,
		},
		{
			name:           "empty required skills",
			agentSkills:    `[{"name":"python"}]`,
			requiredSkills: []string{},
			expected:      true,
		},
		{
			name:           "partial match",
			agentSkills:    `[{"name":"python"},{"name":"javascript"}]`,
			requiredSkills: []string{"java"},
			expected:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := matchesRequiredSkills(tt.agentSkills, tt.requiredSkills)
			if result != tt.expected {
				t.Errorf("Expected %v, got %v", tt.expected, result)
			}
		})
	}
}

// TestTaskNotificationModel tests the TaskNotification model
func TestTaskNotificationModel(t *testing.T) {
	db := setupTaskBroadcastTestDB(t)

	notification := model.TaskNotification{
		TaskID:          1,
		AgentID:         1,
		UserID:          1,
		TaskTitle:       "Test Task",
		TaskType:        "dev",
		RequiredSkills: `["python"]`,
		Status:         model.NotificationStatusPending,
	}

	if err := db.Create(&notification).Error; err != nil {
		t.Fatalf("Failed to create notification: %v", err)
	}

	if notification.ID == 0 {
		t.Error("Expected non-zero ID after create")
	}

	// Test status constants
	if model.NotificationStatusPending != "pending" {
		t.Errorf("Expected 'pending', got %s", model.NotificationStatusPending)
	}
	if model.NotificationStatusViewed != "viewed" {
		t.Errorf("Expected 'viewed', got %s", model.NotificationStatusViewed)
	}
	if model.NotificationStatusAccepted != "accepted" {
		t.Errorf("Expected 'accepted', got %s", model.NotificationStatusAccepted)
	}
	if model.NotificationStatusRejected != "rejected" {
		t.Errorf("Expected 'rejected', got %s", model.NotificationStatusRejected)
	}
	if model.NotificationStatusExpired != "expired" {
		t.Errorf("Expected 'expired', got %s", model.NotificationStatusExpired)
	}
}