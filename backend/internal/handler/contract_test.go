package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/model"
	"github.com/shopspring/decimal"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// setupContractTestDB creates an in-memory SQLite database for contract tests
func setupContractTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to connect to test DB: %v", err)
	}

	db.AutoMigrate(
		&model.User{},
		&model.Task{},
		&model.Agent{},
		&model.Contract{},
		&model.ContractStage{},
	)

	return db
}

// createContractTestUser creates a test user and returns the user ID
func createContractTestUser(db *gorm.DB, username string, t *testing.T) uint {
	user := model.User{
		Username:     username,
		PasswordHash: "testpass",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}
	return user.ID
}

// createContractTestTask creates a test task and returns the task ID
func createContractTestTask(db *gorm.DB, userID uint, budget float64, t *testing.T) uint {
	task := model.Task{
		UserID:  userID,
		Title:   "Test Task",
		Budget:  budget,
		Type:    "dev",
		Level:   "medium",
		Status:  "open",
	}
	if err := db.Create(&task).Error; err != nil {
		t.Fatalf("Failed to create task: %v", err)
	}
	return task.ID
}

// createContractTestAgent creates a test agent and returns the agent ID
func createContractTestAgent(db *gorm.DB, userID uint, t *testing.T) uint {
	agent := model.Agent{
		UserID:      userID,
		Name:        "Test Agent",
		Description: "A test agent",
		Status:      "idle",
	}
	if err := db.Create(&agent).Error; err != nil {
		t.Fatalf("Failed to create agent: %v", err)
	}
	return agent.ID
}

// TestContractHandler_CreateContract_Success tests successful contract creation
func TestContractHandler_CreateContract_Success(t *testing.T) {
	db := setupContractTestDB(t)
	handler := NewContractHandler(db)

	publisherID := createContractTestUser(db, "publisher", t)
	agentUserID := createContractTestUser(db, "agentuser", t)
	taskID := createContractTestTask(db, publisherID, 1000.0, t)
	agentID := createContractTestAgent(db, agentUserID, t)

	body, _ := json.Marshal(CreateContractRequest{
		TaskID:      taskID,
		AgentID:     agentID,
		TotalAmount: 1000.0,
		EscrowAmount: 500.0,
	})

	req := httptest.NewRequest(http.MethodPost, "/api/contracts", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", publisherID)

	handler.CreateContract(c)

	if w.Code != http.StatusCreated {
		t.Fatalf("Expected status 201, got %d: %s", w.Code, w.Body.String())
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	data := response["data"].(map[string]interface{})
	contract := data["contract"].(map[string]interface{})

	if contract["status"] != "signing" {
		t.Errorf("Expected contract status 'signing', got %v", contract["status"])
	}
	if contract["task_id"] != float64(taskID) {
		t.Errorf("Expected task_id %d, got %v", taskID, contract["task_id"])
	}
	if contract["agent_id"] != float64(agentID) {
		t.Errorf("Expected agent_id %d, got %v", agentID, contract["agent_id"])
	}

	stages := data["stages"].([]interface{})
	if len(stages) != 4 {
		t.Errorf("Expected 4 stages, got %d", len(stages))
	}

	// Verify stage types
	expectedTypes := []string{"signing", "executing", "accepting", "completed"}
	for i, stage := range stages {
		s := stage.(map[string]interface{})
		if s["stage_type"] != expectedTypes[i] {
			t.Errorf("Stage %d: expected type %s, got %v", i, expectedTypes[i], s["stage_type"])
		}
		if s["status"] != "pending" {
			t.Errorf("Stage %d: expected status 'pending', got %v", i, s["status"])
		}
	}
}

// TestContractHandler_CreateContract_Duplicate tests creating duplicate contract for same task
func TestContractHandler_CreateContract_Duplicate(t *testing.T) {
	db := setupContractTestDB(t)
	handler := NewContractHandler(db)

	publisherID := createContractTestUser(db, "publisher", t)
	agentUserID := createContractTestUser(db, "agentuser", t)
	taskID := createContractTestTask(db, publisherID, 1000.0, t)
	agentID := createContractTestAgent(db, agentUserID, t)

	// Create first contract
	body, _ := json.Marshal(CreateContractRequest{
		TaskID:      taskID,
		AgentID:     agentID,
		TotalAmount: 1000.0,
	})

	req := httptest.NewRequest(http.MethodPost, "/api/contracts", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", publisherID)

	handler.CreateContract(c)

	if w.Code != http.StatusCreated {
		t.Fatalf("First contract creation failed: %s", w.Body.String())
	}

	// Try creating duplicate - need new request body
	body2, _ := json.Marshal(CreateContractRequest{
		TaskID:      taskID,
		AgentID:     agentID,
		TotalAmount: 1000.0,
	})
	req2 := httptest.NewRequest(http.MethodPost, "/api/contracts", bytes.NewReader(body2))
	req2.Header.Set("Content-Type", "application/json")

	w2 := httptest.NewRecorder()
	c2, _ := gin.CreateTestContext(w2)
	c2.Request = req2
	c2.Set("userID", publisherID)

	handler.CreateContract(c2)

	if w2.Code != http.StatusConflict {
		t.Errorf("Expected status 409 for duplicate, got %d: %s", w2.Code, w2.Body.String())
	}
}

// TestContractHandler_CreateContract_TaskNotFound tests creating contract with non-existent task
func TestContractHandler_CreateContract_TaskNotFound(t *testing.T) {
	db := setupContractTestDB(t)
	handler := NewContractHandler(db)

	publisherID := createContractTestUser(db, "publisher", t)
	agentUserID := createContractTestUser(db, "agentuser", t)
	agentID := createContractTestAgent(db, agentUserID, t)

	body, _ := json.Marshal(CreateContractRequest{
		TaskID:      99999,
		AgentID:     agentID,
		TotalAmount: 1000.0,
	})

	req := httptest.NewRequest(http.MethodPost, "/api/contracts", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", publisherID)

	handler.CreateContract(c)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d: %s", w.Code, w.Body.String())
	}
}

// TestContractHandler_CreateContract_InvalidAmount tests creating contract with invalid amount
func TestContractHandler_CreateContract_InvalidAmount(t *testing.T) {
	db := setupContractTestDB(t)
	handler := NewContractHandler(db)

	publisherID := createContractTestUser(db, "publisher", t)
	agentUserID := createContractTestUser(db, "agentuser", t)
	taskID := createContractTestTask(db, publisherID, 1000.0, t)
	agentID := createContractTestAgent(db, agentUserID, t)

	body, _ := json.Marshal(CreateContractRequest{
		TaskID:      taskID,
		AgentID:     agentID,
		TotalAmount: 0,
	})

	req := httptest.NewRequest(http.MethodPost, "/api/contracts", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", publisherID)

	handler.CreateContract(c)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d: %s", w.Code, w.Body.String())
	}
}

// TestContractHandler_GetContract_Success tests getting a contract with stages
func TestContractHandler_GetContract_Success(t *testing.T) {
	db := setupContractTestDB(t)
	handler := NewContractHandler(db)

	publisherID := createContractTestUser(db, "publisher", t)
	agentUserID := createContractTestUser(db, "agentuser", t)
	taskID := createContractTestTask(db, publisherID, 1000.0, t)
	agentID := createContractTestAgent(db, agentUserID, t)

	// Create contract directly
	contract := &model.Contract{
		TaskID:       taskID,
		PublisherID:  publisherID,
		AgentID:      agentID,
		Status:       model.ContractStatusSigning,
		TotalAmount:  decimal.NewFromFloat(1000.0),
		EscrowAmount: decimal.NewFromFloat(500.0),
	}
	db.Create(contract)

	// Create stages
	for _, stageType := range []model.StageType{model.StageTypeSigning, model.StageTypeExecuting, model.StageTypeAccepting, model.StageTypeCompleted} {
		stage := model.ContractStage{
			ContractID: contract.ID,
			StageType:  stageType,
			Status:     model.ContractStageStatusPending,
		}
		db.Create(&stage)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/contracts/"+strconvFormatUint(uint64(contract.ID)), nil)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Params = gin.Params{{Key: "id", Value: strconvFormatUint(uint64(contract.ID))}}

	handler.GetContract(c)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	data := response["data"].(map[string]interface{})
	stages := data["stages"].([]interface{})
	if len(stages) != 4 {
		t.Errorf("Expected 4 stages, got %d", len(stages))
	}
}

// TestContractHandler_GetContract_NotFound tests getting a non-existent contract
func TestContractHandler_GetContract_NotFound(t *testing.T) {
	db := setupContractTestDB(t)
	handler := NewContractHandler(db)

	req := httptest.NewRequest(http.MethodGet, "/api/contracts/99999", nil)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Params = gin.Params{{Key: "id", Value: "99999"}}

	handler.GetContract(c)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d: %s", w.Code, w.Body.String())
	}
}

// TestContractHandler_SignContract_Success tests signing a contract
func TestContractHandler_SignContract_Success(t *testing.T) {
	db := setupContractTestDB(t)
	handler := NewContractHandler(db)

	publisherID := createContractTestUser(db, "publisher", t)
	agentUserID := createContractTestUser(db, "agentuser", t)
	taskID := createContractTestTask(db, publisherID, 1000.0, t)
	agentID := createContractTestAgent(db, agentUserID, t)

	// Create contract
	contract := &model.Contract{
		TaskID:       taskID,
		PublisherID:  publisherID,
		AgentID:      agentID,
		Status:       model.ContractStatusSigning,
		TotalAmount:  decimal.NewFromFloat(1000.0),
		EscrowAmount: decimal.NewFromFloat(500.0),
	}
	db.Create(contract)

	// Create stages
	for _, stageType := range []model.StageType{model.StageTypeSigning, model.StageTypeExecuting, model.StageTypeAccepting, model.StageTypeCompleted} {
		stage := model.ContractStage{
			ContractID: contract.ID,
			StageType:  stageType,
			Status:     model.ContractStageStatusPending,
		}
		db.Create(&stage)
	}

	req := httptest.NewRequest(http.MethodPut, "/api/contracts/"+strconvFormatUint(uint64(contract.ID))+"/sign", nil)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Params = gin.Params{{Key: "id", Value: strconvFormatUint(uint64(contract.ID))}}
	c.Set("userID", publisherID)

	handler.SignContract(c)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	data := response["data"].(map[string]interface{})
	contractData := data["contract"].(map[string]interface{})

	// Contract should now be in executing status
	if contractData["status"] != "executing" {
		t.Errorf("Expected contract status 'executing', got %v", contractData["status"])
	}

	// SignedAt should be set
	if contractData["signed_at"] == nil {
		t.Error("Expected signed_at to be set")
	}

	// Verify stages
	stages := data["stages"].([]interface{})
	signingStage := stages[0].(map[string]interface{})
	if signingStage["status"] != "completed" {
		t.Errorf("Signing stage should be completed, got %v", signingStage["status"])
	}

	executingStage := stages[1].(map[string]interface{})
	if executingStage["status"] != "in_progress" {
		t.Errorf("Executing stage should be in_progress, got %v", executingStage["status"])
	}
}

// TestContractHandler_SignContract_WrongStatus tests signing a contract that is not in signing status
func TestContractHandler_SignContract_WrongStatus(t *testing.T) {
	db := setupContractTestDB(t)
	handler := NewContractHandler(db)

	publisherID := createContractTestUser(db, "publisher", t)
	agentUserID := createContractTestUser(db, "agentuser", t)
	taskID := createContractTestTask(db, publisherID, 1000.0, t)
	agentID := createContractTestAgent(db, agentUserID, t)

	// Create contract already in executing status
	contract := &model.Contract{
		TaskID:       taskID,
		PublisherID:  publisherID,
		AgentID:      agentID,
		Status:       model.ContractStatusExecuting,
		TotalAmount:  decimal.NewFromFloat(1000.0),
		EscrowAmount: decimal.NewFromFloat(500.0),
	}
	db.Create(contract)

	req := httptest.NewRequest(http.MethodPut, "/api/contracts/"+strconvFormatUint(uint64(contract.ID))+"/sign", nil)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Params = gin.Params{{Key: "id", Value: strconvFormatUint(uint64(contract.ID))}}
	c.Set("userID", publisherID)

	handler.SignContract(c)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d: %s", w.Code, w.Body.String())
	}
}

// TestContractHandler_SignContract_Unauthorized tests signing by non-participant
func TestContractHandler_SignContract_Unauthorized(t *testing.T) {
	db := setupContractTestDB(t)
	handler := NewContractHandler(db)

	publisherID := createContractTestUser(db, "publisher", t)
	agentUserID := createContractTestUser(db, "agentuser", t)
	otherUserID := createContractTestUser(db, "otheruser", t)
	taskID := createContractTestTask(db, publisherID, 1000.0, t)
	agentID := createContractTestAgent(db, agentUserID, t)

	contract := &model.Contract{
		TaskID:       taskID,
		PublisherID:  publisherID,
		AgentID:      agentID,
		Status:       model.ContractStatusSigning,
		TotalAmount:  decimal.NewFromFloat(1000.0),
		EscrowAmount: decimal.NewFromFloat(500.0),
	}
	db.Create(contract)

	req := httptest.NewRequest(http.MethodPut, "/api/contracts/"+strconvFormatUint(uint64(contract.ID))+"/sign", nil)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Params = gin.Params{{Key: "id", Value: strconvFormatUint(uint64(contract.ID))}}
	c.Set("userID", otherUserID)

	handler.SignContract(c)

	if w.Code != http.StatusForbidden {
		t.Errorf("Expected status 403, got %d: %s", w.Code, w.Body.String())
	}
}

// TestContractHandler_UpdateStage_ExecutingCompleted tests completing the executing stage
func TestContractHandler_UpdateStage_ExecutingCompleted(t *testing.T) {
	db := setupContractTestDB(t)
	handler := NewContractHandler(db)

	publisherID := createContractTestUser(db, "publisher", t)
	agentUserID := createContractTestUser(db, "agentuser", t)
	taskID := createContractTestTask(db, publisherID, 1000.0, t)
	agentID := createContractTestAgent(db, agentUserID, t)

	// Create contract in executing status
	contract := &model.Contract{
		TaskID:       taskID,
		PublisherID:  publisherID,
		AgentID:      agentID,
		Status:       model.ContractStatusExecuting,
		TotalAmount:  decimal.NewFromFloat(1000.0),
		EscrowAmount: decimal.NewFromFloat(500.0),
	}
	db.Create(contract)

	// Create stages
	var executingStageID uint
	for i, stageType := range []model.StageType{model.StageTypeSigning, model.StageTypeExecuting, model.StageTypeAccepting, model.StageTypeCompleted} {
		status := model.ContractStageStatusPending
		if stageType == model.StageTypeSigning {
			status = model.ContractStageStatusCompleted
		} else if stageType == model.StageTypeExecuting {
			status = model.ContractStageStatusInProgress
		}
		stage := model.ContractStage{
			ContractID: contract.ID,
			StageType:  stageType,
			Status:     status,
		}
		db.Create(&stage)
		if i == 1 {
			executingStageID = stage.ID
		}
	}

	body, _ := json.Marshal(UpdateStageRequest{
		Status:       "completed",
		Description:  "Work completed",
		Deliverables: `{"result": "success"}`,
	})

	req := httptest.NewRequest(http.MethodPut, "/api/contracts/"+strconvFormatUint(uint64(contract.ID))+"/stage/"+strconvFormatUint(uint64(executingStageID)), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Params = gin.Params{
		{Key: "id", Value: strconvFormatUint(uint64(contract.ID))},
		{Key: "stageId", Value: strconvFormatUint(uint64(executingStageID))},
	}
	c.Set("userID", publisherID)

	handler.UpdateStage(c)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	data := response["data"].(map[string]interface{})
	contractData := data["contract"].(map[string]interface{})

	// Contract should now be in accepting status
	if contractData["status"] != "accepting" {
		t.Errorf("Expected contract status 'accepting', got %v", contractData["status"])
	}

	// Accepting stage should be in_progress
	stages := data["stages"].([]interface{})
	acceptingStage := stages[2].(map[string]interface{})
	if acceptingStage["status"] != "in_progress" {
		t.Errorf("Accepting stage should be in_progress, got %v", acceptingStage["status"])
	}
}

// TestContractHandler_UpdateStage_AcceptingCompleted tests completing the accepting stage
func TestContractHandler_UpdateStage_AcceptingCompleted(t *testing.T) {
	db := setupContractTestDB(t)
	handler := NewContractHandler(db)

	publisherID := createContractTestUser(db, "publisher", t)
	agentUserID := createContractTestUser(db, "agentuser", t)
	taskID := createContractTestTask(db, publisherID, 1000.0, t)
	agentID := createContractTestAgent(db, agentUserID, t)

	// Create contract in accepting status
	contract := &model.Contract{
		TaskID:       taskID,
		PublisherID:  publisherID,
		AgentID:      agentID,
		Status:       model.ContractStatusAccepting,
		TotalAmount:  decimal.NewFromFloat(1000.0),
		EscrowAmount: decimal.NewFromFloat(500.0),
	}
	db.Create(contract)

	// Create stages
	var acceptingStageID uint
	for i, stageType := range []model.StageType{model.StageTypeSigning, model.StageTypeExecuting, model.StageTypeAccepting, model.StageTypeCompleted} {
		status := model.ContractStageStatusPending
		if stageType == model.StageTypeSigning || stageType == model.StageTypeExecuting {
			status = model.ContractStageStatusCompleted
		} else if stageType == model.StageTypeAccepting {
			status = model.ContractStageStatusInProgress
		}
		stage := model.ContractStage{
			ContractID: contract.ID,
			StageType:  stageType,
			Status:     status,
		}
		db.Create(&stage)
		if i == 2 {
			acceptingStageID = stage.ID
		}
	}

	body, _ := json.Marshal(UpdateStageRequest{
		Status:      "completed",
		Description: "Accepted by publisher",
	})

	req := httptest.NewRequest(http.MethodPut, "/api/contracts/"+strconvFormatUint(uint64(contract.ID))+"/stage/"+strconvFormatUint(uint64(acceptingStageID)), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Params = gin.Params{
		{Key: "id", Value: strconvFormatUint(uint64(contract.ID))},
		{Key: "stageId", Value: strconvFormatUint(uint64(acceptingStageID))},
	}
	c.Set("userID", publisherID)

	handler.UpdateStage(c)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	data := response["data"].(map[string]interface{})
	contractData := data["contract"].(map[string]interface{})

	// Contract should now be completed
	if contractData["status"] != "completed" {
		t.Errorf("Expected contract status 'completed', got %v", contractData["status"])
	}

	// CompletedAt should be set
	if contractData["completed_at"] == nil {
		t.Error("Expected completed_at to be set")
	}
}

// TestContractHandler_UpdateStage_InvalidStatus tests updating with invalid status
func TestContractHandler_UpdateStage_InvalidStatus(t *testing.T) {
	db := setupContractTestDB(t)
	handler := NewContractHandler(db)

	publisherID := createContractTestUser(db, "publisher", t)
	agentUserID := createContractTestUser(db, "agentuser", t)
	taskID := createContractTestTask(db, publisherID, 1000.0, t)
	agentID := createContractTestAgent(db, agentUserID, t)

	contract := &model.Contract{
		TaskID:       taskID,
		PublisherID:  publisherID,
		AgentID:      agentID,
		Status:       model.ContractStatusExecuting,
		TotalAmount:  decimal.NewFromFloat(1000.0),
		EscrowAmount: decimal.NewFromFloat(500.0),
	}
	db.Create(contract)

	stage := model.ContractStage{
		ContractID: contract.ID,
		StageType:  model.StageTypeExecuting,
		Status:     model.ContractStageStatusInProgress,
	}
	db.Create(&stage)

	body, _ := json.Marshal(UpdateStageRequest{
		Status: "invalid_status",
	})

	req := httptest.NewRequest(http.MethodPut, "/api/contracts/"+strconvFormatUint(uint64(contract.ID))+"/stage/"+strconvFormatUint(uint64(stage.ID)), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Params = gin.Params{
		{Key: "id", Value: strconvFormatUint(uint64(contract.ID))},
		{Key: "stageId", Value: strconvFormatUint(uint64(stage.ID))},
	}
	c.Set("userID", publisherID)

	handler.UpdateStage(c)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d: %s", w.Code, w.Body.String())
	}
}

// TestContractHandler_GetContractByTask_Success tests getting contract by task ID
func TestContractHandler_GetContractByTask_Success(t *testing.T) {
	db := setupContractTestDB(t)
	handler := NewContractHandler(db)

	publisherID := createContractTestUser(db, "publisher", t)
	agentUserID := createContractTestUser(db, "agentuser", t)
	taskID := createContractTestTask(db, publisherID, 1000.0, t)
	agentID := createContractTestAgent(db, agentUserID, t)

	contract := &model.Contract{
		TaskID:       taskID,
		PublisherID:  publisherID,
		AgentID:      agentID,
		Status:       model.ContractStatusSigning,
		TotalAmount:  decimal.NewFromFloat(1000.0),
		EscrowAmount: decimal.NewFromFloat(500.0),
	}
	db.Create(contract)

	for _, stageType := range []model.StageType{model.StageTypeSigning, model.StageTypeExecuting, model.StageTypeAccepting, model.StageTypeCompleted} {
		stage := model.ContractStage{
			ContractID: contract.ID,
			StageType:  stageType,
			Status:     model.ContractStageStatusPending,
		}
		db.Create(&stage)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/contracts/task/"+strconvFormatUint(uint64(taskID)), nil)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Params = gin.Params{{Key: "taskId", Value: strconvFormatUint(uint64(taskID))}}

	handler.GetContractByTask(c)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	data := response["data"].(map[string]interface{})
	contractData := data["contract"].(map[string]interface{})
	if contractData["task_id"] != float64(taskID) {
		t.Errorf("Expected task_id %d, got %v", taskID, contractData["task_id"])
	}
}

// TestContractHandler_GetContractByTask_NotFound tests getting contract for task without contract
func TestContractHandler_GetContractByTask_NotFound(t *testing.T) {
	db := setupContractTestDB(t)
	handler := NewContractHandler(db)

	req := httptest.NewRequest(http.MethodGet, "/api/contracts/task/99999", nil)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Params = gin.Params{{Key: "taskId", Value: "99999"}}

	handler.GetContractByTask(c)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d: %s", w.Code, w.Body.String())
	}
}

// TestContractHandler_FullLifecycle tests the complete contract lifecycle
func TestContractHandler_FullLifecycle(t *testing.T) {
	db := setupContractTestDB(t)
	handler := NewContractHandler(db)

	publisherID := createContractTestUser(db, "publisher", t)
	agentUserID := createContractTestUser(db, "agentuser", t)
	taskID := createContractTestTask(db, publisherID, 1000.0, t)
	agentID := createContractTestAgent(db, agentUserID, t)

	// Step 1: Create contract
	createBody, _ := json.Marshal(CreateContractRequest{
		TaskID:      taskID,
		AgentID:     agentID,
		TotalAmount: 1000.0,
	})

	gin.SetMode(gin.TestMode)

	createReq := httptest.NewRequest(http.MethodPost, "/api/contracts", bytes.NewReader(createBody))
	createReq.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = createReq
	c.Set("userID", publisherID)

	handler.CreateContract(c)

	if w.Code != http.StatusCreated {
		t.Fatalf("Create contract failed: %s", w.Body.String())
	}

	var createResp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &createResp)
	contractData := createResp["data"].(map[string]interface{})["contract"].(map[string]interface{})
	contractID := uint(contractData["id"].(float64))

	// Verify initial status
	if contractData["status"] != "signing" {
		t.Fatalf("Expected initial status 'signing', got %v", contractData["status"])
	}

	// Step 2: Sign contract
	signReq := httptest.NewRequest(http.MethodPut, "/api/contracts/"+strconvFormatUint(uint64(contractID))+"/sign", nil)
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	c.Request = signReq
	c.Params = gin.Params{{Key: "id", Value: strconvFormatUint(uint64(contractID))}}
	c.Set("userID", publisherID)

	handler.SignContract(c)

	if w.Code != http.StatusOK {
		t.Fatalf("Sign contract failed: %s", w.Body.String())
	}

	var signResp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &signResp)
	signedContract := signResp["data"].(map[string]interface{})["contract"].(map[string]interface{})
	if signedContract["status"] != "executing" {
		t.Fatalf("Expected status 'executing' after signing, got %v", signedContract["status"])
	}

	// Get executing stage ID
	stages := signResp["data"].(map[string]interface{})["stages"].([]interface{})
	var executingStageID uint
	for _, s := range stages {
		stage := s.(map[string]interface{})
		if stage["stage_type"] == "executing" {
			executingStageID = uint(stage["id"].(float64))
			break
		}
	}

	// Step 3: Complete executing stage
	execBody, _ := json.Marshal(UpdateStageRequest{
		Status:       "completed",
		Description:  "Development work completed",
		Deliverables: `{"code": "submitted"}`,
	})

	execReq := httptest.NewRequest(http.MethodPut, "/api/contracts/"+strconvFormatUint(uint64(contractID))+"/stage/"+strconvFormatUint(uint64(executingStageID)), bytes.NewReader(execBody))
	execReq.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	c.Request = execReq
	c.Params = gin.Params{
		{Key: "id", Value: strconvFormatUint(uint64(contractID))},
		{Key: "stageId", Value: strconvFormatUint(uint64(executingStageID))},
	}
	c.Set("userID", publisherID)

	handler.UpdateStage(c)

	if w.Code != http.StatusOK {
		t.Fatalf("Update executing stage failed: %s", w.Body.String())
	}

	var execResp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &execResp)
	execContract := execResp["data"].(map[string]interface{})["contract"].(map[string]interface{})
	if execContract["status"] != "accepting" {
		t.Fatalf("Expected status 'accepting' after executing, got %v", execContract["status"])
	}

	// Get accepting stage ID
	stages = execResp["data"].(map[string]interface{})["stages"].([]interface{})
	var acceptingStageID uint
	for _, s := range stages {
		stage := s.(map[string]interface{})
		if stage["stage_type"] == "accepting" {
			acceptingStageID = uint(stage["id"].(float64))
			break
		}
	}

	// Step 4: Complete accepting stage → contract completed
	acceptBody, _ := json.Marshal(UpdateStageRequest{
		Status:      "completed",
		Description: "Work accepted",
	})

	acceptReq := httptest.NewRequest(http.MethodPut, "/api/contracts/"+strconvFormatUint(uint64(contractID))+"/stage/"+strconvFormatUint(uint64(acceptingStageID)), bytes.NewReader(acceptBody))
	acceptReq.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	c.Request = acceptReq
	c.Params = gin.Params{
		{Key: "id", Value: strconvFormatUint(uint64(contractID))},
		{Key: "stageId", Value: strconvFormatUint(uint64(acceptingStageID))},
	}
	c.Set("userID", publisherID)

	handler.UpdateStage(c)

	if w.Code != http.StatusOK {
		t.Fatalf("Update accepting stage failed: %s", w.Body.String())
	}

	var acceptResp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &acceptResp)
	completedContract := acceptResp["data"].(map[string]interface{})["contract"].(map[string]interface{})
	if completedContract["status"] != "completed" {
		t.Fatalf("Expected status 'completed', got %v", completedContract["status"])
	}

	// Verify completed_at is set
	if completedContract["completed_at"] == nil {
		t.Error("Expected completed_at to be set")
	}
}

// TestContractHandler_CreateContract_Unauthorized tests creating contract without auth
func TestContractHandler_CreateContract_Unauthorized(t *testing.T) {
	db := setupContractTestDB(t)
	handler := NewContractHandler(db)

	body, _ := json.Marshal(CreateContractRequest{
		TaskID:      1,
		AgentID:     1,
		TotalAmount: 1000.0,
	})

	req := httptest.NewRequest(http.MethodPost, "/api/contracts", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	// Not setting userID

	handler.CreateContract(c)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d: %s", w.Code, w.Body.String())
	}
}

// TestContractHandler_UpdateStage_StageNotBelongToContract tests updating a stage that doesn't belong to the contract
func TestContractHandler_UpdateStage_StageNotBelongToContract(t *testing.T) {
	db := setupContractTestDB(t)
	handler := NewContractHandler(db)

	publisherID := createContractTestUser(db, "publisher", t)
	agentUserID := createContractTestUser(db, "agentuser", t)
	taskID := createContractTestTask(db, publisherID, 1000.0, t)
	agentID := createContractTestAgent(db, agentUserID, t)

	// Create two contracts
	contract1 := &model.Contract{
		TaskID:       taskID,
		PublisherID:  publisherID,
		AgentID:      agentID,
		Status:       model.ContractStatusExecuting,
		TotalAmount:  decimal.NewFromFloat(1000.0),
		EscrowAmount: decimal.NewFromFloat(500.0),
	}
	db.Create(contract1)

	// Create a second task and contract
	taskID2 := createContractTestTask(db, publisherID, 2000.0, t)
	contract2 := &model.Contract{
		TaskID:       taskID2,
		PublisherID:  publisherID,
		AgentID:      agentID,
		Status:       model.ContractStatusExecuting,
		TotalAmount:  decimal.NewFromFloat(2000.0),
		EscrowAmount: decimal.NewFromFloat(1000.0),
	}
	db.Create(contract2)

	// Create stage for contract2
	stage := model.ContractStage{
		ContractID: contract2.ID,
		StageType:  model.StageTypeExecuting,
		Status:     model.ContractStageStatusInProgress,
	}
	db.Create(&stage)

	// Try to update contract2's stage via contract1's endpoint
	body, _ := json.Marshal(UpdateStageRequest{
		Status: "completed",
	})

	req := httptest.NewRequest(http.MethodPut, "/api/contracts/"+strconvFormatUint(uint64(contract1.ID))+"/stage/"+strconvFormatUint(uint64(stage.ID)), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Params = gin.Params{
		{Key: "id", Value: strconvFormatUint(uint64(contract1.ID))},
		{Key: "stageId", Value: strconvFormatUint(uint64(stage.ID))},
	}
	c.Set("userID", publisherID)

	handler.UpdateStage(c)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d: %s", w.Code, w.Body.String())
	}
}


// strconvFormatUint is a helper to format uint64 as string
func strconvFormatUint(v uint64) string {
	return strconv.FormatUint(v, 10)
}
