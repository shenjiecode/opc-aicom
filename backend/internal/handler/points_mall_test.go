package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/model"
	"github.com/shopspring/decimal"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// setupTestDB creates an in-memory SQLite database for testing
func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to connect to test DB: %v", err)
	}

	// Auto migrate tables
	db.AutoMigrate(
		&model.User{},
		&model.UserAsset{},
		&model.ComputePackage{},
		&model.UserPackage{},
		&model.CreditTransaction{},
	)

	return db
}

// createTestUserWithAsset creates a test user with specified points
func createTestUserWithAsset(db *gorm.DB, points int, t *testing.T) uint {
	user := model.User{
		Username:     "testuser",
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

// createTestPackage creates a test compute package
func createTestPackage(db *gorm.DB, name string, price int, credits int, durationDays int, t *testing.T) uint {
	pkg := model.ComputePackage{
		Name:          name,
		Type:          model.ComputePackageTypeGPU,
		Price:         decimal.NewFromInt(int64(price)),
		Credits:       credits,
		DurationDays:  durationDays,
		Status:        model.ComputePackageStatusActive,
		SortOrder:     0,
	}
	if err := db.Create(&pkg).Error; err != nil {
		t.Fatalf("Failed to create package: %v", err)
	}
	return pkg.ID
}

// TestPointsMallHandler_Purchase_Success tests successful purchase
func TestPointsMallHandler_Purchase_Success(t *testing.T) {
	db := setupTestDB(t)
	handler := NewPointsMallHandler(db)

	// Setup test data
	userID := createTestUserWithAsset(db, 1000, t)
	packageID := createTestPackage(db, "Test Package", 500, 10, 30, t)

	// Setup request
	body, _ := json.Marshal(PurchaseRequest{PackageID: packageID})
	req := httptest.NewRequest(http.MethodPost, "/api/mall/purchase", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	// Setup context with auth
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", userID)

	// Execute
	handler.Purchase(c)

	// Verify HTTP response
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	// Verify points deducted
	var asset model.UserAsset
	if err := db.Where("user_id = ?", userID).First(&asset).Error; err != nil {
		t.Fatalf("Failed to get user asset: %v", err)
	}
	if asset.Points != 500 {
		t.Errorf("Expected points 500, got %d", asset.Points)
	}

	// Verify credits (compute hours) added
	if asset.ComputeHours != 10 {
		t.Errorf("Expected compute hours 10, got %f", asset.ComputeHours)
	}

	// Verify transaction record exists
	var transaction model.CreditTransaction
	if err := db.Where("user_id = ? AND related_type = ?", userID, "compute_package").First(&transaction).Error; err != nil {
		t.Fatalf("Failed to find transaction: %v", err)
	}
	if transaction.Amount != -500 {
		t.Errorf("Expected transaction amount -500, got %d", transaction.Amount)
	}

	// Verify user package created
	var userPackage model.UserPackage
	if err := db.Where("user_id = ?", userID).First(&userPackage).Error; err != nil {
		t.Fatalf("Failed to find user package: %v", err)
	}
	if userPackage.Credits != 10 {
		t.Errorf("Expected user package credits 10, got %d", userPackage.Credits)
	}
	if userPackage.RemainingCredits != 10 {
		t.Errorf("Expected remaining credits 10, got %d", userPackage.RemainingCredits)
	}
}

// TestPointsMallHandler_Purchase_InsufficientPoints tests purchase with insufficient balance
func TestPointsMallHandler_Purchase_InsufficientPoints(t *testing.T) {
	db := setupTestDB(t)
	handler := NewPointsMallHandler(db)

	// Setup test data with low points
	userID := createTestUserWithAsset(db, 100, t)
	packageID := createTestPackage(db, "Expensive Package", 500, 10, 30, t)

	// Setup request
	body, _ := json.Marshal(PurchaseRequest{PackageID: packageID})
	req := httptest.NewRequest(http.MethodPost, "/api/mall/purchase", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	// Setup context with auth
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", userID)

	// Execute
	handler.Purchase(c)

	// Verify HTTP response - should return 402 Payment Required
	if w.Code != http.StatusPaymentRequired {
		t.Errorf("Expected status 402, got %d: %s", w.Code, w.Body.String())
	}

	// Verify points NOT deducted
	var asset model.UserAsset
	if err := db.Where("user_id = ?", userID).First(&asset).Error; err != nil {
		t.Fatalf("Failed to get user asset: %v", err)
	}
	if asset.Points != 100 {
		t.Errorf("Expected points unchanged at 100, got %d", asset.Points)
	}

	// Verify NO transaction created
	var count int64
	db.Model(&model.CreditTransaction{}).Where("user_id = ?", userID).Count(&count)
	if count != 0 {
		t.Errorf("Expected no transaction, found %d", count)
	}
}

// TestPointsMallHandler_Purchase_PackageNotFound tests purchase of non-existent package
func TestPointsMallHandler_Purchase_PackageNotFound(t *testing.T) {
	db := setupTestDB(t)
	handler := NewPointsMallHandler(db)

	// Setup test data
	userID := createTestUserWithAsset(db, 1000, t)

	// Setup request with non-existent package ID
	body, _ := json.Marshal(PurchaseRequest{PackageID: 99999})
	req := httptest.NewRequest(http.MethodPost, "/api/mall/purchase", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	// Setup context with auth
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", userID)

	// Execute
	handler.Purchase(c)

	// Verify HTTP response - should return 404 Not Found
	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d: %s", w.Code, w.Body.String())
	}
}

// TestPointsMallHandler_ListPackages tests listing active packages
func TestPointsMallHandler_ListPackages(t *testing.T) {
	db := setupTestDB(t)
	handler := NewPointsMallHandler(db)

	// Create test packages
	createTestPackage(db, "Package 1", 100, 2, 30, t)
	createTestPackage(db, "Package 2", 200, 5, 60, t)

	// Setup request
	req := httptest.NewRequest(http.MethodGet, "/api/mall/packages", nil)

	// Setup context
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req

	// Execute
	handler.ListPackages(c)

	// Verify HTTP response
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	// Verify response structure
	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	data := response["data"].([]interface{})
	if len(data) != 2 {
		t.Errorf("Expected 2 packages, got %d", len(data))
	}
}

// TestPointsMallHandler_GetBalance tests getting user balance
func TestPointsMallHandler_GetBalance(t *testing.T) {
	db := setupTestDB(t)
	handler := NewPointsMallHandler(db)

	// Setup test data
	userID := createTestUserWithAsset(db, 500, t)

	// Setup request
	req := httptest.NewRequest(http.MethodGet, "/api/mall/balance", nil)

	// Setup context with auth
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", userID)

	// Execute
	handler.GetBalance(c)

	// Verify HTTP response
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	// Verify response
	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	data := response["data"].(map[string]interface{})
	balance := int(data["balance"].(float64))
	if balance != 500 {
		t.Errorf("Expected balance 500, got %d", balance)
	}
}

// TestPointsMallHandler_ListMyPackages tests listing user's purchased packages
func TestPointsMallHandler_ListMyPackages(t *testing.T) {
	db := setupTestDB(t)
	handler := NewPointsMallHandler(db)

	// Setup test data
	userID := createTestUserWithAsset(db, 1000, t)

	// Create a user package manually
	pkg := model.UserPackage{
		UserID:           userID,
		PackageID:        1,
		PackageName:      "Test Package",
		PackageType:      model.ComputePackageTypeGPU,
		Credits:          10,
		RemainingCredits: 5,
		DurationDays:     30,
		Status:           model.UserPackageStatusActive,
	}
	db.Create(&pkg)

	// Setup request
	req := httptest.NewRequest(http.MethodGet, "/api/mall/my-packages", nil)

	// Setup context with auth
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", userID)

	// Execute
	handler.ListMyPackages(c)

	// Verify HTTP response
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	// Verify response
	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	data := response["data"].([]interface{})
	if len(data) != 1 {
		t.Errorf("Expected 1 user package, got %d", len(data))
	}
}

// TestPointsMallHandler_Purchase_TotalFlow tests complete purchase flow
func TestPointsMallHandler_Purchase_TotalFlow(t *testing.T) {
	db := setupTestDB(t)
	handler := NewPointsMallHandler(db)

	// Given
	userID := createTestUserWithAsset(db, 1000, t)
	packageID := createTestPackage(db, "Full Test Package", 800, 20, 30, t)

	// When
	body, _ := json.Marshal(PurchaseRequest{PackageID: packageID})
	req := httptest.NewRequest(http.MethodPost, "/api/mall/purchase", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", userID)

	handler.Purchase(c)

	// Verify response
	if w.Code != http.StatusOK {
		t.Fatalf("Purchase failed: %s", w.Body.String())
	}

	// Then: Check points remaining
	var asset model.UserAsset
	if err := db.Where("user_id = ?", userID).First(&asset).Error; err != nil {
		t.Fatalf("Failed to get user asset: %v", err)
	}

	if asset.Points != 200 {
		t.Errorf("Expected remaining points 200, got %d", asset.Points)
	}

	// Check compute hours added
	if asset.ComputeHours != 20 {
		t.Errorf("Expected compute hours 20, got %f", asset.ComputeHours)
	}

	// Verify transaction exists
	var tx model.CreditTransaction
	if err := db.Where("user_id = ? AND type = ?", userID, model.CreditTypeConsume).First(&tx).Error; err != nil {
		t.Fatalf("Transaction not found: %v", err)
	}
	if tx.BalanceAfter != 200 {
		t.Errorf("Expected balance after 200, got %d", tx.BalanceAfter)
	}

	// Verify user package created
	var up model.UserPackage
	if err := db.Where("user_id = ?", userID).First(&up).Error; err != nil {
		t.Fatalf("User package not found: %v", err)
	}

	if up.RemainingCredits != 20 {
		t.Errorf("Expected user package credits 20, got %d", up.RemainingCredits)
	}
}

// TestPointsMallHandler_Purchase_Unauthorized tests purchase without auth
func TestPointsMallHandler_Purchase_Unauthorized(t *testing.T) {
	db := setupTestDB(t)
	handler := NewPointsMallHandler(db)

	// Setup request without auth context
	body, _ := json.Marshal(PurchaseRequest{PackageID: 1})
	req := httptest.NewRequest(http.MethodPost, "/api/mall/purchase", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	// Note: NOT setting userID to simulate unauthenticated request

	// Execute
	handler.Purchase(c)

	// Verify HTTP response - should return 401 Unauthorized
	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d: %s", w.Code, w.Body.String())
	}
}

// TestPointsMallHandler_GetBalance_NewUser tests balance for new user without asset record
func TestPointsMallHandler_GetBalance_NewUser(t *testing.T) {
	db := setupTestDB(t)
	handler := NewPointsMallHandler(db)

	// Create user without asset record
	user := model.User{
		Username:     "newuser",
		PasswordHash: "pass",
	}
	db.Create(&user)

	// Setup request
	req := httptest.NewRequest(http.MethodGet, "/api/mall/balance", nil)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", user.ID)

	// Execute
	handler.GetBalance(c)

	// Verify HTTP response
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	// Verify response - should return 0 balance for new user
	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	data := response["data"].(map[string]interface{})
	balance := int(data["balance"].(float64))
	if balance != 0 {
		t.Errorf("Expected balance 0 for new user, got %d", balance)
	}
}
