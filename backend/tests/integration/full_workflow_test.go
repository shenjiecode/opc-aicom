package integration

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/handler"
	"github.com/opc-aicom/backend/internal/model"
	"github.com/shopspring/decimal"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)
// setupIntegrationTestDB creates an in-memory SQLite database for integration tests
func setupIntegrationTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to connect to test DB: %v", err)
	}

	db.AutoMigrate(
		&model.User{},
		&model.UserAsset{},
		&model.Task{},
		&model.Agent{},
		&model.Contract{},
		&model.ContractStage{},
		&model.ComputePackage{},
		&model.ComputeUsage{},
		&model.CreditTransaction{},
		&model.UserPackage{},
	)

	return db
}

// createTestUserWithAsset creates a test user with specified points
func createTestUserWithAsset(db *gorm.DB, username string, points int, t *testing.T) uint {
	user := model.User{
		Username:     username,
		PasswordHash: "testpass",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	asset := model.UserAsset{
		UserID: user.ID,
		Points: points,
	}
	if err := db.Create(&asset).Error; err != nil {
		t.Fatalf("Failed to create asset: %v", err)
	}

	return user.ID
}

// createEnterpriseUser creates an enterprise user with 10000 points
func createEnterpriseUser(db *gorm.DB, username string, t *testing.T) uint {
	userID := createTestUserWithAsset(db, username, 10000, t)

	// Update user to enterprise status
	db.Model(&model.User{}).Where("id = ?", userID).Updates(map[string]interface{}{
		"member_type":         "enterprise",
		"verification_status": "verified",
	})

	return userID
}

// createTestAgent creates a test agent and returns the agent ID
func createTestAgent(db *gorm.DB, userID uint, t *testing.T) uint {
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

// createComputePackages creates test compute packages
func createComputePackages(db *gorm.DB, t *testing.T) []uint {
	packages := []model.ComputePackage{
		{
			Name:         "GPU Basic",
			Description:  "Basic GPU package",
			Type:         model.ComputePackageTypeGPU,
			Price:        decimal.NewFromInt(100),
			Credits:      100,
			DurationDays: 30,
			Status:       model.ComputePackageStatusActive,
			SortOrder:    1,
		},
		{
			Name:         "GPU Pro",
			Description:  "Pro GPU package",
			Type:         model.ComputePackageTypeGPU,
			Price:        decimal.NewFromInt(500),
			Credits:      500,
			DurationDays: 30,
			Status:       model.ComputePackageStatusActive,
			SortOrder:    2,
		},
	}

	var ids []uint
	for _, pkg := range packages {
		if err := db.Create(&pkg).Error; err != nil {
			t.Fatalf("Failed to create package: %v", err)
		}
		ids = append(ids, pkg.ID)
	}

	return ids
}

// setupRouter creates a gin engine with authenticated context
func setupRouter(db *gorm.DB, userID uint) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	// Add auth middleware simulation
	router.Use(func(c *gin.Context) {
		c.Set("userID", userID)
		c.Next()
	})

	return router
}

// TestFullWorkflow_EnterpriseVerificationToPointsToContract tests the full enterprise workflow
func TestFullWorkflow_EnterpriseVerificationToPointsToContract(t *testing.T) {
	db := setupIntegrationTestDB(t)

	// Step 1: Create enterprise user with 10000 points
	enterpriseUserID := createEnterpriseUser(db, "enterprise_user", t)

	// Verify enterprise status
	var user model.User
	if err := db.First(&user, enterpriseUserID).Error; err != nil {
		t.Fatalf("Failed to find user: %v", err)
	}
	if user.MemberType != "enterprise" {
		t.Errorf("Expected member_type 'enterprise', got %s", user.MemberType)
	}
	if user.VerificationStatus != "verified" {
		t.Errorf("Expected verification_status 'verified', got %s", user.VerificationStatus)
	}

	// Step 2: Purchase GPU package
	packageIDs := createComputePackages(db, t)
	basicPackageID := packageIDs[0]

	pointsMallHandler := handler.NewPointsMallHandler(db)
	router := setupRouter(db, enterpriseUserID)
	router.POST("/api/mall/purchase", pointsMallHandler.Purchase)

	purchaseBody, _ := json.Marshal(handler.PurchaseRequest{
		PackageID: basicPackageID,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/mall/purchase", bytes.NewReader(purchaseBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Purchase failed: %s", w.Body.String())
	}

	// Verify points deducted
	var asset model.UserAsset
	db.Where("user_id = ?", enterpriseUserID).First(&asset)
	if asset.Points != 9900 { // 10000 - 100
		t.Errorf("Expected points 9900, got %d", asset.Points)
	}

	// Step 3: Create task
	task := model.Task{
		UserID:      enterpriseUserID,
		Title:       "Enterprise Task",
		Description: "A task for enterprise user",
		Budget:      1000,
		Type:        "dev",
		Level:       "high",
		Status:      "open",
	}
	if err := db.Create(&task).Error; err != nil {
		t.Fatalf("Failed to create task: %v", err)
	}

	// Step 4: Create agent for another user
	agentUserID := createTestUserWithAsset(db, "agent_user", 0, t)
	agentID := createTestAgent(db, agentUserID, t)

	// Step 5: Create contract
	contractHandler := handler.NewContractHandler(db)
	router2 := setupRouter(db, enterpriseUserID)
	router2.POST("/api/contracts", contractHandler.CreateContract)

	contractBody, _ := json.Marshal(handler.CreateContractRequest{
		TaskID:       task.ID,
		AgentID:      agentID,
		TotalAmount:  500.0,
		EscrowAmount: 250.0,
	})
	req2 := httptest.NewRequest(http.MethodPost, "/api/contracts", bytes.NewReader(contractBody))
	req2.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()
	router2.ServeHTTP(w2, req2)

	if w2.Code != http.StatusCreated {
		t.Fatalf("Contract creation failed: %s", w2.Body.String())
	}

	var contractResp map[string]interface{}
	json.Unmarshal(w2.Body.Bytes(), &contractResp)
	data := contractResp["data"].(map[string]interface{})
	contractData := data["contract"].(map[string]interface{})
	contractID := uint(contractData["id"].(float64))

	// Step 6: Sign contract
	router3 := setupRouter(db, enterpriseUserID)
	router3.PUT("/api/contracts/:id/sign", contractHandler.SignContract)

	req3 := httptest.NewRequest(http.MethodPut, "/api/contracts/"+strconv.FormatUint(uint64(contractID), 10)+"/sign", nil)
	w3 := httptest.NewRecorder()
	router3.ServeHTTP(w3, req3)

	if w3.Code != http.StatusOK {
		t.Fatalf("Contract signing failed: %s", w3.Body.String())
	}

	// Step 7: Advance stages - complete executing stage
	var stages []*model.ContractStage
	db.Where("contract_id = ?", contractID).Order("id ASC").Find(&stages)

	executingStageID := stages[1].ID // Index 1 is executing stage

	router4 := setupRouter(db, enterpriseUserID)
	router4.PUT("/api/contracts/:id/stage/:stageId", contractHandler.UpdateStage)

	stageBody, _ := json.Marshal(handler.UpdateStageRequest{
		Status:       "completed",
		Description:  "Work completed",
		Deliverables: `{"result": "success"}`,
	})
	req4 := httptest.NewRequest(http.MethodPut, "/api/contracts/"+strconv.FormatUint(uint64(contractID), 10)+"/stage/"+strconv.FormatUint(uint64(executingStageID), 10), bytes.NewReader(stageBody))
	req4.Header.Set("Content-Type", "application/json")
	w4 := httptest.NewRecorder()
	router4.ServeHTTP(w4, req4)

	if w4.Code != http.StatusOK {
		t.Fatalf("Stage update failed: %s", w4.Body.String())
	}

	// Step 8: Complete accepting stage
	var updatedStages []*model.ContractStage
	db.Where("contract_id = ?", contractID).Order("id ASC").Find(&updatedStages)
	acceptingStageID := updatedStages[2].ID

	acceptBody, _ := json.Marshal(handler.UpdateStageRequest{
		Status:      "completed",
		Description: "Accepted",
	})
	req5 := httptest.NewRequest(http.MethodPut, "/api/contracts/"+strconv.FormatUint(uint64(contractID), 10)+"/stage/"+strconv.FormatUint(uint64(acceptingStageID), 10), bytes.NewReader(acceptBody))
	req5.Header.Set("Content-Type", "application/json")
	w5 := httptest.NewRecorder()
	router4.ServeHTTP(w5, req5)

	if w5.Code != http.StatusOK {
		t.Fatalf("Accepting stage failed: %s", w5.Body.String())
	}

	// Verify contract is completed
	var finalContract model.Contract
	db.First(&finalContract, contractID)
	if finalContract.Status != model.ContractStatusCompleted {
		t.Errorf("Expected contract status 'completed', got %s", finalContract.Status)
	}

	// Step 9: Record compute usage
	computeUsageHandler := handler.NewComputeUsageHandler(db)
	router5 := setupRouter(db, enterpriseUserID)
	router5.POST("/api/compute/usage", computeUsageHandler.CreateComputeUsage)

	usageBody, _ := json.Marshal(handler.CreateComputeUsageRequest{
		PackageID:    basicPackageID,
		CreditsUsed:  "50",
		ComputeHours: 2.0,
		ResourceType: "task",
		ResourceID:   task.ID,
		Description:  "Compute usage for task",
	})
	req6 := httptest.NewRequest(http.MethodPost, "/api/compute/usage", bytes.NewReader(usageBody))
	req6.Header.Set("Content-Type", "application/json")
	w6 := httptest.NewRecorder()
	router5.ServeHTTP(w6, req6)

	if w6.Code != http.StatusOK {
		t.Fatalf("Compute usage creation failed: %s", w6.Body.String())
	}

	// Verify compute usage was recorded
	var usageCount int64
	db.Model(&model.ComputeUsage{}).Where("user_id = ?", enterpriseUserID).Count(&usageCount)
	if usageCount != 1 {
		t.Errorf("Expected 1 compute usage record, got %d", usageCount)
	}
}

// TestWorkflow_PointsEscrowAndRelease tests points escrow lock and release
func TestWorkflow_PointsEscrowAndRelease(t *testing.T) {
	db := setupIntegrationTestDB(t)

	userID := createTestUserWithAsset(db, "test_user", 1000, t)

	// Create task
	task := model.Task{
		UserID:      userID,
		Title:       "Test Task",
		Description: "Test task for escrow",
		Budget:      500,
		Type:        "dev",
		Level:       "medium",
		Status:      "open",
	}
	if err := db.Create(&task).Error; err != nil {
		t.Fatalf("Failed to create task: %v", err)
	}

	// Lock points using EscrowHandler
	escrowHandler := handler.NewEscrowHandler(db)
	err := escrowHandler.LockPoints(userID, task.ID, 200)
	if err != nil {
		t.Fatalf("LockPoints failed: %v", err)
	}

	// Verify points locked
	var asset model.UserAsset
	db.Where("user_id = ?", userID).First(&asset)
	if asset.Points != 800 { // 1000 - 200
		t.Errorf("Expected points 800 after lock, got %d", asset.Points)
	}

	var updatedTask model.Task
	db.First(&updatedTask, task.ID)
	if updatedTask.EscrowPoints != 200 {
		t.Errorf("Expected escrow_points 200, got %d", updatedTask.EscrowPoints)
	}

	// Verify credit transaction created
	var txCount int64
	db.Model(&model.CreditTransaction{}).Where("user_id = ? AND type = ?", userID, model.CreditTypeEscrowLock).Count(&txCount)
	if txCount != 1 {
		t.Errorf("Expected 1 escrow_lock transaction, got %d", txCount)
	}

	// Release points
	err = escrowHandler.ReleasePoints(task.ID)
	if err != nil {
		t.Fatalf("ReleasePoints failed: %v", err)
	}

	// Verify points restored
	db.Where("user_id = ?", userID).First(&asset)
	if asset.Points != 1000 { // 800 + 200
		t.Errorf("Expected points 1000 after release, got %d", asset.Points)
	}

	db.First(&updatedTask, task.ID)
	if updatedTask.EscrowPoints != 0 {
		t.Errorf("Expected escrow_points 0 after release, got %d", updatedTask.EscrowPoints)
	}

	// Verify release transaction created
	db.Model(&model.CreditTransaction{}).Where("user_id = ? AND type = ?", userID, model.CreditTypeEscrowRelease).Count(&txCount)
	if txCount != 1 {
		t.Errorf("Expected 1 escrow_release transaction, got %d", txCount)
	}
}

// TestWorkflow_PointsMallPurchaseAndComputeUsage tests purchase and compute usage
func TestWorkflow_PointsMallPurchaseAndComputeUsage(t *testing.T) {
	db := setupIntegrationTestDB(t)

	userID := createTestUserWithAsset(db, "buyer", 500, t)
	packageIDs := createComputePackages(db, t)
	basicPackageID := packageIDs[0]

	// Purchase package
	pointsMallHandler := handler.NewPointsMallHandler(db)
	router := setupRouter(db, userID)
	router.POST("/api/mall/purchase", pointsMallHandler.Purchase)

	purchaseBody, _ := json.Marshal(handler.PurchaseRequest{
		PackageID: basicPackageID,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/mall/purchase", bytes.NewReader(purchaseBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Purchase failed: %s", w.Body.String())
	}

	// Verify purchase
	var asset model.UserAsset
	db.Where("user_id = ?", userID).First(&asset)
	if asset.Points != 400 { // 500 - 100
		t.Errorf("Expected points 400 after purchase, got %d", asset.Points)
	}

	// Record compute usage
	computeUsageHandler := handler.NewComputeUsageHandler(db)
	router2 := setupRouter(db, userID)
	router2.POST("/api/compute/usage", computeUsageHandler.CreateComputeUsage)

	usageBody, _ := json.Marshal(handler.CreateComputeUsageRequest{
		PackageID:    basicPackageID,
		CreditsUsed:  "50",
		ComputeHours: 1.5,
		ResourceType: "gpu",
		Description:  "GPU compute usage",
	})
	req2 := httptest.NewRequest(http.MethodPost, "/api/compute/usage", bytes.NewReader(usageBody))
	req2.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()
	router2.ServeHTTP(w2, req2)

	if w2.Code != http.StatusOK {
		t.Fatalf("Compute usage failed: %s", w2.Body.String())
	}

	// Verify deductions
	db.Where("user_id = ?", userID).First(&asset)
	if asset.Points != 350 { // 400 - 50
		t.Errorf("Expected points 350 after usage, got %d", asset.Points)
	}

	// Verify credit transactions
	var consumeTxCount int64
	db.Model(&model.CreditTransaction{}).Where("user_id = ? AND type = ?", userID, model.CreditTypeConsume).Count(&consumeTxCount)
	if consumeTxCount != 2 { // purchase + usage
		t.Errorf("Expected 2 consume transactions, got %d", consumeTxCount)
	}
}

// TestWorkflow_InsufficientPointsPurchase tests purchase with insufficient points
func TestWorkflow_InsufficientPointsPurchase(t *testing.T) {
	db := setupIntegrationTestDB(t)

	userID := createTestUserWithAsset(db, "poor_user", 0, t)
	packageIDs := createComputePackages(db, t)
	proPackageID := packageIDs[1] // 500 credits

	// Try to purchase expensive package
	pointsMallHandler := handler.NewPointsMallHandler(db)
	router := setupRouter(db, userID)
	router.POST("/api/mall/purchase", pointsMallHandler.Purchase)

	purchaseBody, _ := json.Marshal(handler.PurchaseRequest{
		PackageID: proPackageID,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/mall/purchase", bytes.NewReader(purchaseBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusPaymentRequired {
		t.Errorf("Expected status 402 for insufficient points, got %d", w.Code)
	}

	// Verify no purchase happened
	var userPackages []model.UserPackage
	db.Where("user_id = ?", userID).Find(&userPackages)
	if len(userPackages) != 0 {
		t.Errorf("Expected no user packages, got %d", len(userPackages))
	}
}

// TestWorkflow_ContractStageAdvancement tests contract stage progression
func TestWorkflow_ContractStageAdvancement(t *testing.T) {
	db := setupIntegrationTestDB(t)

	publisherID := createTestUserWithAsset(db, "publisher", 1000, t)
	agentUserID := createTestUserWithAsset(db, "agent_user", 0, t)
	agentID := createTestAgent(db, agentUserID, t)

	// Create task
	task := model.Task{
		UserID:      publisherID,
		Title:       "Stage Test Task",
		Description: "Task for stage testing",
		Budget:      1000,
		Type:        "dev",
		Level:       "medium",
		Status:      "open",
	}
	if err := db.Create(&task).Error; err != nil {
		t.Fatalf("Failed to create task: %v", err)
	}

	// Create contract
	contractHandler := handler.NewContractHandler(db)
	router := setupRouter(db, publisherID)
	router.POST("/api/contracts", contractHandler.CreateContract)

	contractBody, _ := json.Marshal(handler.CreateContractRequest{
		TaskID:      task.ID,
		AgentID:     agentID,
		TotalAmount: 1000.0,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/contracts", bytes.NewReader(contractBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("Contract creation failed: %s", w.Body.String())
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	data := resp["data"].(map[string]interface{})
	contractData := data["contract"].(map[string]interface{})
	contractID := uint(contractData["id"].(float64))

	// Verify 4 stages created
	stagesData := data["stages"].([]interface{})
	if len(stagesData) != 4 {
		t.Fatalf("Expected 4 stages, got %d", len(stagesData))
	}

	// Sign contract
	router2 := setupRouter(db, publisherID)
	router2.PUT("/api/contracts/:id/sign", contractHandler.SignContract)

	req2 := httptest.NewRequest(http.MethodPut, "/api/contracts/"+strconv.FormatUint(uint64(contractID), 10)+"/sign", nil)
	w2 := httptest.NewRecorder()
	router2.ServeHTTP(w2, req2)

	if w2.Code != http.StatusOK {
		t.Fatalf("Signing failed: %s", w2.Body.String())
	}

	// Verify contract in executing status
	var contract model.Contract
	db.First(&contract, contractID)
	if contract.Status != model.ContractStatusExecuting {
		t.Errorf("Expected status 'executing', got %s", contract.Status)
	}

	// Advance each stage
	router3 := setupRouter(db, publisherID)
	router3.PUT("/api/contracts/:id/stage/:stageId", contractHandler.UpdateStage)

	// Get stages
	var stages []model.ContractStage
	db.Where("contract_id = ?", contractID).Order("id ASC").Find(&stages)

	// Complete executing stage
	execStageBody, _ := json.Marshal(handler.UpdateStageRequest{
		Status:      "completed",
		Description: "Execution done",
	})
	req3 := httptest.NewRequest(http.MethodPut, "/api/contracts/"+strconv.FormatUint(uint64(contractID), 10)+"/stage/"+strconv.FormatUint(uint64(stages[1].ID), 10), bytes.NewReader(execStageBody))
	req3.Header.Set("Content-Type", "application/json")
	w3 := httptest.NewRecorder()
	router3.ServeHTTP(w3, req3)

	if w3.Code != http.StatusOK {
		t.Fatalf("Executing stage failed: %s", w3.Body.String())
	}

	// Verify contract in accepting status
	db.First(&contract, contractID)
	if contract.Status != model.ContractStatusAccepting {
		t.Errorf("Expected status 'accepting', got %s", contract.Status)
	}

	// Complete accepting stage
	acceptStageBody, _ := json.Marshal(handler.UpdateStageRequest{
		Status:      "completed",
		Description: "Accepted",
	})
	req4 := httptest.NewRequest(http.MethodPut, "/api/contracts/"+strconv.FormatUint(uint64(contractID), 10)+"/stage/"+strconv.FormatUint(uint64(stages[2].ID), 10), bytes.NewReader(acceptStageBody))
	req4.Header.Set("Content-Type", "application/json")
	w4 := httptest.NewRecorder()
	router3.ServeHTTP(w4, req4)

	if w4.Code != http.StatusOK {
		t.Fatalf("Accepting stage failed: %s", w4.Body.String())
	}

	// Verify contract completed
	db.First(&contract, contractID)
	if contract.Status != model.ContractStatusCompleted {
		t.Errorf("Expected status 'completed', got %s", contract.Status)
	}

	// Verify completed_at is set
	if contract.CompletedAt == nil {
		t.Error("Expected completed_at to be set")
	}

	// Verify all stages have correct status
	db.Where("contract_id = ?", contractID).Order("id ASC").Find(&stages)
	if stages[0].Status != model.ContractStageStatusCompleted {
		t.Errorf("Signing stage should be completed")
	}
	if stages[1].Status != model.ContractStageStatusCompleted {
		t.Errorf("Executing stage should be completed")
	}
	if stages[2].Status != model.ContractStageStatusCompleted {
		t.Errorf("Accepting stage should be completed")
	}
	if stages[3].Status != model.ContractStageStatusCompleted {
		t.Errorf("Completed stage should be completed")
	}
}