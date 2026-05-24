package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/model"
	"github.com/opc-aicom/backend/internal/pkg/llm"
	"github.com/shopspring/decimal"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// mockLLMProviderForPublish is a mock LLM provider for testing
type mockLLMProviderForPublish struct {
	response *llm.ChatResponse
	err      error
}

func (m *mockLLMProviderForPublish) Chat(ctx context.Context, req *llm.ChatRequest) (*llm.ChatResponse, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.response, nil
}

func (m *mockLLMProviderForPublish) StreamChat(ctx context.Context, req *llm.ChatRequest) (<-chan llm.StreamChunk, error) {
	return nil, fmt.Errorf("not implemented in mock")
}

func (m *mockLLMProviderForPublish) GetModels() []string {
	return []string{"mock-model"}
}

// helper to create a mock response with given content
func newMockResponseForPublish(content string) *llm.ChatResponse {
	return &llm.ChatResponse{
		ID:    "test-id",
		Model: "mock-model",
		Choices: []llm.Choice{
			{
				Index: 0,
				Message: llm.Message{
					Role:    "assistant",
					Content: content,
				},
				FinishReason: "stop",
			},
		},
		Usage: llm.Usage{
			PromptTokens:     100,
			CompletionTokens: 200,
			TotalTokens:      300,
		},
	}
}

// setupTestDBForPublish creates an in-memory SQLite database for testing
func setupTestDBForPublish(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to connect to test DB: %v", err)
	}

	// Auto migrate tables
	db.AutoMigrate(
		&model.User{},
		&model.RequirementSession{},
		&model.Task{},
	)

	return db
}

// createTestUserForPublish creates a test user with unique username
func createTestUserForPublish(db *gorm.DB, t *testing.T) uint {
	username := fmt.Sprintf("testuser_%d", time.Now().UnixNano())
	user := model.User{
		Username:     username,
		PasswordHash: "testpass",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}
	return user.ID
}

// TestAnalyzeRequirement_Success tests successful requirement analysis
func TestAnalyzeRequirement_Success(t *testing.T) {
	db := setupTestDBForPublish(t)
	userID := createTestUserForPublish(db, t)

	// Create mock registry
	mockJSON := `{
		"project_name": "智能客服系统",
		"description": "基于AI的智能客服系统",
		"features": [{"name": "多轮对话", "description": "支持上下文理解", "priority": "high"}],
		"priority": "high",
		"budget_range": {"min": 50000, "max": 100000},
		"duration_days": 30,
		"tech_requirements": ["Python", "FastAPI"],
		"deliverables": ["源码", "文档"]
	}`

	mock := &mockLLMProviderForPublish{
		response: newMockResponseForPublish(mockJSON),
	}

	registry := llm.NewProviderRegistry()
	registry.Register("mock", mock)
	registry.SetDefault("analysis", "mock")

	handler := NewEnterprisePublishHandler(db, registry)

	// Setup request
	body, _ := json.Marshal(AnalyzeRequirementRequest{
		InputType:    "text",
		InputContent: "我需要一个智能客服系统",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/publish/analyze", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	// Setup context with auth
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", userID)

	// Execute
	handler.AnalyzeRequirement(c)

	// Verify HTTP response
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	// Verify response structure
	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	data := response["data"].(map[string]interface{})
	sessionID := uint(data["session_id"].(float64))
	if sessionID == 0 {
		t.Error("Expected non-zero session_id")
	}

	analyzedResult := data["analyzed_result"].(map[string]interface{})
	if analyzedResult["project_name"] != "智能客服系统" {
		t.Errorf("Expected project_name '智能客服系统', got %v", analyzedResult["project_name"])
	}

	// Verify session was created in DB
	var session model.RequirementSession
	if err := db.First(&session, sessionID).Error; err != nil {
		t.Fatalf("Session not found in DB: %v", err)
	}
	if session.UserID != userID {
		t.Errorf("Session user_id mismatch: got %d, want %d", session.UserID, userID)
	}
	if session.Status != model.RequirementSessionStatusDraft {
		t.Errorf("Session status mismatch: got %s, want %s", session.Status, model.RequirementSessionStatusDraft)
	}
}

// TestAnalyzeRequirement_Unauthorized tests analysis without auth
func TestAnalyzeRequirement_Unauthorized(t *testing.T) {
	db := setupTestDBForPublish(t)

	registry := llm.NewProviderRegistry()
	handler := NewEnterprisePublishHandler(db, registry)

	// Setup request without auth context
	body, _ := json.Marshal(AnalyzeRequirementRequest{
		InputType:    "text",
		InputContent: "test",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/publish/analyze", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	// Note: NOT setting userID to simulate unauthenticated request

	// Execute
	handler.AnalyzeRequirement(c)

	// Verify HTTP response - should return 401 Unauthorized
	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d: %s", w.Code, w.Body.String())
	}
}

// TestAnalyzeRequirement_InvalidInputType tests analysis with invalid input type
func TestAnalyzeRequirement_InvalidInputType(t *testing.T) {
	db := setupTestDBForPublish(t)
	userID := createTestUserForPublish(db, t)

	registry := llm.NewProviderRegistry()
	handler := NewEnterprisePublishHandler(db, registry)

	// Setup request with invalid input type
	body, _ := json.Marshal(AnalyzeRequirementRequest{
		InputType:    "image",
		InputContent: "test",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/publish/analyze", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", userID)

	// Execute
	handler.AnalyzeRequirement(c)

	// Verify HTTP response - should return 400 Bad Request
	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d: %s", w.Code, w.Body.String())
	}
}

// TestAnalyzeRequirement_MissingContent tests analysis with missing content
func TestAnalyzeRequirement_MissingContent(t *testing.T) {
	db := setupTestDBForPublish(t)
	userID := createTestUserForPublish(db, t)

	registry := llm.NewProviderRegistry()
	handler := NewEnterprisePublishHandler(db, registry)

	// Setup request with missing content
	body, _ := json.Marshal(AnalyzeRequirementRequest{
		InputType: "text",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/publish/analyze", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", userID)

	// Execute
	handler.AnalyzeRequirement(c)

	// Verify HTTP response - should return 400 Bad Request
	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d: %s", w.Code, w.Body.String())
	}
}

// TestConfirmRequirement_Success tests successful requirement confirmation
func TestConfirmRequirement_Success(t *testing.T) {
	db := setupTestDBForPublish(t)
	userID := createTestUserForPublish(db, t)

	// Create a session with analyzed result
	formJSON := `{
		"project_name": "测试项目",
		"description": "测试描述",
		"features": [],
		"priority": "medium",
		"budget_range": {"min": 10000, "max": 50000},
		"duration_days": 15,
		"tech_requirements": ["Go"],
		"deliverables": ["源码"]
	}`
	session := &model.RequirementSession{
		UserID:         userID,
		InputType:      "text",
		InputContent:   "测试需求",
		StructuredForm: formJSON,
		AnalyzedResult: formJSON,
		Status:         model.RequirementSessionStatusDraft,
	}
	if err := db.Create(session).Error; err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	registry := llm.NewProviderRegistry()
	handler := NewEnterprisePublishHandler(db, registry)

	// Setup request
	body, _ := json.Marshal(ConfirmRequirementRequest{
		SessionID: session.ID,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/publish/confirm", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", userID)

	// Execute
	handler.ConfirmRequirement(c)

	// Verify HTTP response
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	// Verify response structure
	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	data := response["data"].(map[string]interface{})
	taskID := uint(data["task_id"].(float64))
	if taskID == 0 {
		t.Error("Expected non-zero task_id")
	}

	// Verify task was created
	var task model.Task
	if err := db.First(&task, taskID).Error; err != nil {
		t.Fatalf("Task not found in DB: %v", err)
	}
	if task.UserID != userID {
		t.Errorf("Task user_id mismatch: got %d, want %d", task.UserID, userID)
	}
	if task.Title != "测试项目" {
		t.Errorf("Task title mismatch: got %s, want %s", task.Title, "测试项目")
	}
	if task.Type != "enterprise" {
		t.Errorf("Task type mismatch: got %s, want %s", task.Type, "enterprise")
	}

	// Verify session was updated
	var updatedSession model.RequirementSession
	if err := db.First(&updatedSession, session.ID).Error; err != nil {
		t.Fatalf("Session not found: %v", err)
	}
	if updatedSession.Status != model.RequirementSessionStatusPublished {
		t.Errorf("Session status mismatch: got %s, want %s", updatedSession.Status, model.RequirementSessionStatusPublished)
	}
	if *updatedSession.TaskID != taskID {
		t.Errorf("Session task_id mismatch: got %d, want %d", *updatedSession.TaskID, taskID)
	}
}

// TestConfirmRequirement_SessionNotFound tests confirmation with non-existent session
func TestConfirmRequirement_SessionNotFound(t *testing.T) {
	db := setupTestDBForPublish(t)
	userID := createTestUserForPublish(db, t)

	registry := llm.NewProviderRegistry()
	handler := NewEnterprisePublishHandler(db, registry)

	// Setup request with non-existent session ID
	body, _ := json.Marshal(ConfirmRequirementRequest{
		SessionID: 99999,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/publish/confirm", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", userID)

	// Execute
	handler.ConfirmRequirement(c)

	// Verify HTTP response - should return 404 Not Found
	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d: %s", w.Code, w.Body.String())
	}
}

// TestConfirmRequirement_WrongUser tests confirmation with wrong user
func TestConfirmRequirement_WrongUser(t *testing.T) {
	db := setupTestDBForPublish(t)
	userID := createTestUserForPublish(db, t)
	otherUserID := createTestUserForPublish(db, t)

	// Create a session for user1
	session := &model.RequirementSession{
		UserID:         userID,
		InputType:      "text",
		InputContent:   "测试需求",
		StructuredForm: `{"project_name": "test"}`,
		Status:         model.RequirementSessionStatusDraft,
	}
	if err := db.Create(session).Error; err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	registry := llm.NewProviderRegistry()
	handler := NewEnterprisePublishHandler(db, registry)

	// Setup request with other user
	body, _ := json.Marshal(ConfirmRequirementRequest{
		SessionID: session.ID,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/publish/confirm", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", otherUserID)

	// Execute
	handler.ConfirmRequirement(c)

	// Verify HTTP response - should return 403 Forbidden
	if w.Code != http.StatusForbidden {
		t.Errorf("Expected status 403, got %d: %s", w.Code, w.Body.String())
	}
}

// TestConfirmRequirement_AlreadyPublished tests confirmation of already published session
func TestConfirmRequirement_AlreadyPublished(t *testing.T) {
	db := setupTestDBForPublish(t)
	userID := createTestUserForPublish(db, t)

	// Create an already published session
	session := &model.RequirementSession{
		UserID:         userID,
		InputType:      "text",
		InputContent:   "测试需求",
		StructuredForm: `{"project_name": "test"}`,
		Status:         model.RequirementSessionStatusPublished,
	}
	if err := db.Create(session).Error; err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	registry := llm.NewProviderRegistry()
	handler := NewEnterprisePublishHandler(db, registry)

	// Setup request
	body, _ := json.Marshal(ConfirmRequirementRequest{
		SessionID: session.ID,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/publish/confirm", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", userID)

	// Execute
	handler.ConfirmRequirement(c)

	// Verify HTTP response - should return 400 Bad Request
	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d: %s", w.Code, w.Body.String())
	}
}

// TestGetSession_Success tests successful session retrieval
func TestGetSession_Success(t *testing.T) {
	db := setupTestDBForPublish(t)
	userID := createTestUserForPublish(db, t)

	// Create a session
	formJSON := `{
		"project_name": "测试项目",
		"description": "测试描述",
		"features": [],
		"priority": "medium",
		"budget_range": {"min": 10000, "max": 50000},
		"duration_days": 15,
		"tech_requirements": [],
		"deliverables": []
	}`
	session := &model.RequirementSession{
		UserID:         userID,
		InputType:      "text",
		InputContent:   "测试需求",
		StructuredForm: formJSON,
		AnalyzedResult: formJSON,
		Status:         model.RequirementSessionStatusDraft,
	}
	if err := db.Create(session).Error; err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	registry := llm.NewProviderRegistry()
	handler := NewEnterprisePublishHandler(db, registry)

	// Setup request
	req := httptest.NewRequest(http.MethodGet, "/api/publish/session/"+fmt.Sprintf("%d", session.ID), nil)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Params = gin.Params{{Key: "id", Value: fmt.Sprintf("%d", session.ID)}}
	c.Set("userID", userID)

	// Execute
	handler.GetSession(c)

	// Verify HTTP response
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	// Verify response structure
	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	data := response["data"].(map[string]interface{})
	if data["id"].(float64) != float64(session.ID) {
		t.Errorf("Session id mismatch: got %v, want %d", data["id"], session.ID)
	}
	if data["status"] != string(model.RequirementSessionStatusDraft) {
		t.Errorf("Session status mismatch: got %v, want %s", data["status"], model.RequirementSessionStatusDraft)
	}

	// Verify analyzed_result is present
	analyzedResult := data["analyzed_result"].(map[string]interface{})
	if analyzedResult["project_name"] != "测试项目" {
		t.Errorf("Analyzed result project_name mismatch: got %v", analyzedResult["project_name"])
	}
}

// TestGetSession_NotFound tests session retrieval with non-existent session
func TestGetSession_NotFound(t *testing.T) {
	db := setupTestDBForPublish(t)
	userID := createTestUserForPublish(db, t)

	registry := llm.NewProviderRegistry()
	handler := NewEnterprisePublishHandler(db, registry)

	// Setup request with non-existent session ID
	req := httptest.NewRequest(http.MethodGet, "/api/publish/session/99999", nil)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Params = gin.Params{{Key: "id", Value: "99999"}}
	c.Set("userID", userID)

	// Execute
	handler.GetSession(c)

	// Verify HTTP response - should return 404 Not Found
	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d: %s", w.Code, w.Body.String())
	}
}

// TestGetSession_WrongUser tests session retrieval with wrong user
func TestGetSession_WrongUser(t *testing.T) {
	db := setupTestDBForPublish(t)
	userID := createTestUserForPublish(db, t)
	otherUserID := createTestUserForPublish(db, t)

	// Create a session for user1
	session := &model.RequirementSession{
		UserID:       userID,
		InputType:    "text",
		InputContent: "测试需求",
		Status:       model.RequirementSessionStatusDraft,
	}
	if err := db.Create(session).Error; err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	registry := llm.NewProviderRegistry()
	handler := NewEnterprisePublishHandler(db, registry)

	// Setup request with other user
	req := httptest.NewRequest(http.MethodGet, "/api/publish/session/"+fmt.Sprintf("%d", session.ID), nil)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Params = gin.Params{{Key: "id", Value: fmt.Sprintf("%d", session.ID)}}
	c.Set("userID", otherUserID)

	// Execute
	handler.GetSession(c)

	// Verify HTTP response - should return 403 Forbidden
	if w.Code != http.StatusForbidden {
		t.Errorf("Expected status 403, got %d: %s", w.Code, w.Body.String())
	}
}

// TestConfirmRequirement_CreatesTaskWithCorrectFields tests that task is created with correct fields from structured form
func TestConfirmRequirement_CreatesTaskWithCorrectFields(t *testing.T) {
	db := setupTestDBForPublish(t)
	userID := createTestUserForPublish(db, t)

	// Create a session with full structured form
	formJSON := `{
		"project_name": "电商平台开发",
		"description": "开发一个完整的电商平台，包含商品管理、订单系统、支付集成",
		"features": [
			{"name": "商品管理", "description": "商品CRUD", "priority": "high"},
			{"name": "订单系统", "description": "订单流程", "priority": "high"}
		],
		"priority": "high",
		"budget_range": {"min": 80000, "max": 150000},
		"duration_days": 60,
		"tech_requirements": ["Go", "React", "PostgreSQL"],
		"deliverables": ["源码", "部署文档", "API文档"]
	}`
	session := &model.RequirementSession{
		UserID:         userID,
		InputType:      "text",
		InputContent:   "电商平台需求",
		StructuredForm: formJSON,
		AnalyzedResult: formJSON,
		Status:         model.RequirementSessionStatusDraft,
	}
	if err := db.Create(session).Error; err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	registry := llm.NewProviderRegistry()
	handler := NewEnterprisePublishHandler(db, registry)

	// Setup request
	body, _ := json.Marshal(ConfirmRequirementRequest{
		SessionID: session.ID,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/publish/confirm", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", userID)

	// Execute
	handler.ConfirmRequirement(c)

	// Verify HTTP response
	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	// Get the created task
	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)
	data := response["data"].(map[string]interface{})
	taskID := uint(data["task_id"].(float64))

	var task model.Task
	if err := db.First(&task, taskID).Error; err != nil {
		t.Fatalf("Task not found: %v", err)
	}

	// Verify all fields
	if task.Title != "电商平台开发" {
		t.Errorf("Task title: got %s, want %s", task.Title, "电商平台开发")
	}
	if task.Description != "开发一个完整的电商平台，包含商品管理、订单系统、支付集成" {
		t.Errorf("Task description: got %s", task.Description)
	}
	if task.Type != "enterprise" {
		t.Errorf("Task type: got %s, want enterprise", task.Type)
	}
	if task.Priority != "high" {
		t.Errorf("Task priority: got %s, want high", task.Priority)
	}
	if task.EstimatedDays != 60 {
		t.Errorf("Task estimated_days: got %d, want 60", task.EstimatedDays)
	}

	expectedMin := decimal.NewFromInt(80000)
	expectedMax := decimal.NewFromInt(150000)
	if !task.BudgetMin.Equal(expectedMin) {
		t.Errorf("Task budget_min: got %s, want %s", task.BudgetMin.String(), expectedMin.String())
	}
	if !task.BudgetMax.Equal(expectedMax) {
		t.Errorf("Task budget_max: got %s, want %s", task.BudgetMax.String(), expectedMax.String())
	}
}
