package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/model"
	"github.com/opc-aicom/backend/internal/service"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// setupComputeRechargeTestDB creates an in-memory SQLite database for testing
func setupComputeRechargeTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to connect to test DB: %v", err)
	}

	// Auto migrate tables
	db.AutoMigrate(
		&model.User{},
		&model.UserAsset{},
		&model.PointsOrder{},
		&model.CreditTransaction{},
	)

	return db
}

// createTestUserWithPoints creates a test user with specified points
func createTestUserWithPoints(db *gorm.DB, points int, t *testing.T) uint {
	user := model.User{
		Username:     "testuser",
		PasswordHash: "testpass",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	asset := model.UserAsset{
		UserID:        user.ID,
		Points:        points,
		AlibabaCredit: 0,
		ComputeHours:  0,
	}
	if err := db.Create(&asset).Error; err != nil {
		t.Fatalf("Failed to create asset: %v", err)
	}

	return user.ID
}

// mockAlibabaService creates a mock AlibabaCloudService for testing
func mockAlibabaService(db *gorm.DB) *service.AlibabaCloudService {
	// Create a service with empty config (will use local DB operations)
	return service.NewAlibabaCloudService(nil, db)
}

// TestComputeRechargeHandler_Success tests successful recharge
func TestComputeRechargeHandler_Success(t *testing.T) {
	db := setupComputeRechargeTestDB(t)
	alibabaService := mockAlibabaService(db)
	handler := NewComputeRechargeHandler(db, alibabaService)

	// Setup test data
	userID := createTestUserWithPoints(db, 1000, t)

	// Setup request
	body, _ := json.Marshal(ComputeRechargeRequest{PointsAmount: 100})
	req := httptest.NewRequest(http.MethodPost, "/api/mall/recharge-compute", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	// Setup context with auth
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", userID)

	// Execute
	handler.RechargeCompute(c)

	// Verify HTTP response
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	// Verify response structure
	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response["code"].(float64) != 0 {
		t.Errorf("Expected code 0, got %v", response["code"])
	}

	data := response["data"].(map[string]interface{})
	pointsDeducted := int(data["points_deducted"].(float64))
	if pointsDeducted != 100 {
		t.Errorf("Expected points deducted 100, got %d", pointsDeducted)
	}

	creditsAdded := int(data["credits_added"].(float64))
	if creditsAdded != 100 {
		t.Errorf("Expected credits added 100, got %d", creditsAdded)
	}

	// Verify points deducted
	var asset model.UserAsset
	if err := db.Where("user_id = ?", userID).First(&asset).Error; err != nil {
		t.Fatalf("Failed to get user asset: %v", err)
	}
	if asset.Points != 900 {
		t.Errorf("Expected points 900, got %d", asset.Points)
	}

	// Verify credits added (1:1 mapping)
	if asset.AlibabaCredit != 100 {
		t.Errorf("Expected AlibabaCredit 100, got %d", asset.AlibabaCredit)
	}
	if asset.ComputeHours != 100 {
		t.Errorf("Expected ComputeHours 100, got %f", asset.ComputeHours)
	}

	// Verify order created
	var order model.PointsOrder
	if err := db.Where("user_id = ? AND order_type = ?", userID, model.OrderTypeComputeRecharge).First(&order).Error; err != nil {
		t.Fatalf("Failed to find order: %v", err)
	}
	if order.Status != "completed" {
		t.Errorf("Expected order status completed, got %s", order.Status)
	}
	if order.PointsAmount != 100 {
		t.Errorf("Expected order points amount 100, got %d", order.PointsAmount)
	}
	if order.CreditAmount != 100 {
		t.Errorf("Expected order credit amount 100, got %d", order.CreditAmount)
	}

	// Verify transaction record exists
	var transaction model.CreditTransaction
	if err := db.Where("user_id = ? AND related_type = ?", userID, "compute_recharge").First(&transaction).Error; err != nil {
		t.Fatalf("Failed to find transaction: %v", err)
	}
	if transaction.Amount != -100 {
		t.Errorf("Expected transaction amount -100, got %d", transaction.Amount)
	}
}

// TestComputeRechargeHandler_InsufficientPoints tests recharge with insufficient balance
func TestComputeRechargeHandler_InsufficientPoints(t *testing.T) {
	db := setupComputeRechargeTestDB(t)
	alibabaService := mockAlibabaService(db)
	handler := NewComputeRechargeHandler(db, alibabaService)

	// Setup test data with low points
	userID := createTestUserWithPoints(db, 50, t)

	// Setup request
	body, _ := json.Marshal(ComputeRechargeRequest{PointsAmount: 100})
	req := httptest.NewRequest(http.MethodPost, "/api/mall/recharge-compute", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	// Setup context with auth
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", userID)

	// Execute
	handler.RechargeCompute(c)

	// Verify HTTP response - should return 402 Payment Required
	if w.Code != http.StatusPaymentRequired {
		t.Errorf("Expected status 402, got %d: %s", w.Code, w.Body.String())
	}

	// Verify points NOT deducted
	var asset model.UserAsset
	if err := db.Where("user_id = ?", userID).First(&asset).Error; err != nil {
		t.Fatalf("Failed to get user asset: %v", err)
	}
	if asset.Points != 50 {
		t.Errorf("Expected points unchanged at 50, got %d", asset.Points)
	}

	// Verify NO order created
	var count int64
	db.Model(&model.PointsOrder{}).Where("user_id = ?", userID).Count(&count)
	if count != 0 {
		t.Errorf("Expected no order, found %d", count)
	}
}

// TestComputeRechargeHandler_InvalidAmount tests recharge with invalid amount
func TestComputeRechargeHandler_InvalidAmount(t *testing.T) {
	db := setupComputeRechargeTestDB(t)
	alibabaService := mockAlibabaService(db)
	handler := NewComputeRechargeHandler(db, alibabaService)

	// Setup test data
	userID := createTestUserWithPoints(db, 1000, t)

	// Setup request with invalid amount (0)
	body, _ := json.Marshal(ComputeRechargeRequest{PointsAmount: 0})
	req := httptest.NewRequest(http.MethodPost, "/api/mall/recharge-compute", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	// Setup context with auth
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", userID)

	// Execute
	handler.RechargeCompute(c)

	// Verify HTTP response - should return 400 Bad Request
	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d: %s", w.Code, w.Body.String())
	}
}

// TestComputeRechargeHandler_Unauthorized tests recharge without auth
func TestComputeRechargeHandler_Unauthorized(t *testing.T) {
	db := setupComputeRechargeTestDB(t)
	alibabaService := mockAlibabaService(db)
	handler := NewComputeRechargeHandler(db, alibabaService)

	// Setup request without auth context
	body, _ := json.Marshal(ComputeRechargeRequest{PointsAmount: 100})
	req := httptest.NewRequest(http.MethodPost, "/api/mall/recharge-compute", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	// Setup context without userID
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	// Note: NOT setting userID to simulate unauthenticated request

	// Execute
	handler.RechargeCompute(c)

	// Verify HTTP response - should return 401 Unauthorized
	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d: %s", w.Code, w.Body.String())
	}
}

// TestComputeRechargeHandler_NoAsset tests recharge for user without asset record
func TestComputeRechargeHandler_NoAsset(t *testing.T) {
	db := setupComputeRechargeTestDB(t)
	alibabaService := mockAlibabaService(db)
	handler := NewComputeRechargeHandler(db, alibabaService)

	// Create user without asset record
	user := model.User{
		Username:     "newuser",
		PasswordHash: "pass",
	}
	db.Create(&user)

	// Setup request
	body, _ := json.Marshal(ComputeRechargeRequest{PointsAmount: 100})
	req := httptest.NewRequest(http.MethodPost, "/api/mall/recharge-compute", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	// Setup context with auth
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", user.ID)

	// Execute
	handler.RechargeCompute(c)

	// Verify HTTP response - should return 402 Payment Required
	if w.Code != http.StatusPaymentRequired {
		t.Errorf("Expected status 402, got %d: %s", w.Code, w.Body.String())
	}
}

// TestComputeRechargeHandler_MultipleRecharges tests multiple consecutive recharges
func TestComputeRechargeHandler_MultipleRecharges(t *testing.T) {
	db := setupComputeRechargeTestDB(t)
	alibabaService := mockAlibabaService(db)
	handler := NewComputeRechargeHandler(db, alibabaService)

	// Setup test data
	userID := createTestUserWithPoints(db, 500, t)

	// First recharge
	body1, _ := json.Marshal(ComputeRechargeRequest{PointsAmount: 100})
	req1 := httptest.NewRequest(http.MethodPost, "/api/mall/recharge-compute", bytes.NewReader(body1))
	req1.Header.Set("Content-Type", "application/json")

	gin.SetMode(gin.TestMode)
	w1 := httptest.NewRecorder()
	c1, _ := gin.CreateTestContext(w1)
	c1.Request = req1
	c1.Set("userID", userID)

	handler.RechargeCompute(c1)

	if w1.Code != http.StatusOK {
		t.Fatalf("First recharge failed: %s", w1.Body.String())
	}

	// Second recharge
	body2, _ := json.Marshal(ComputeRechargeRequest{PointsAmount: 200})
	req2 := httptest.NewRequest(http.MethodPost, "/api/mall/recharge-compute", bytes.NewReader(body2))
	req2.Header.Set("Content-Type", "application/json")

	w2 := httptest.NewRecorder()
	c2, _ := gin.CreateTestContext(w2)
	c2.Request = req2
	c2.Set("userID", userID)

	handler.RechargeCompute(c2)

	if w2.Code != http.StatusOK {
		t.Fatalf("Second recharge failed: %s", w2.Body.String())
	}

	// Verify final state
	var asset model.UserAsset
	if err := db.Where("user_id = ?", userID).First(&asset).Error; err != nil {
		t.Fatalf("Failed to get user asset: %v", err)
	}

	// Points: 500 - 100 - 200 = 200
	if asset.Points != 200 {
		t.Errorf("Expected points 200, got %d", asset.Points)
	}

	// Credits: 100 + 200 = 300
	if asset.AlibabaCredit != 300 {
		t.Errorf("Expected AlibabaCredit 300, got %d", asset.AlibabaCredit)
	}
	if asset.ComputeHours != 300 {
		t.Errorf("Expected ComputeHours 300, got %f", asset.ComputeHours)
	}

	// Verify two orders created
	var count int64
	db.Model(&model.PointsOrder{}).Where("user_id = ? AND order_type = ?", userID, model.OrderTypeComputeRecharge).Count(&count)
	if count != 2 {
		t.Errorf("Expected 2 orders, found %d", count)
	}
}

// TestComputeRechargeHandler_1to1Mapping tests the 1:1 exchange rate
func TestComputeRechargeHandler_1to1Mapping(t *testing.T) {
	db := setupComputeRechargeTestDB(t)
	alibabaService := mockAlibabaService(db)
	handler := NewComputeRechargeHandler(db, alibabaService)

	// Setup test data
	userID := createTestUserWithPoints(db, 10000, t)

	// Test various amounts to verify 1:1 mapping
	testAmounts := []int{1, 10, 100, 500, 1000}

	for _, amount := range testAmounts {
		// Reset asset
		var asset model.UserAsset
		db.Where("user_id = ?", userID).First(&asset)
		asset.Points = 10000
		asset.AlibabaCredit = 0
		asset.ComputeHours = 0
		db.Save(&asset)

		// Clear orders
		db.Where("user_id = ?", userID).Delete(&model.PointsOrder{})

		// Recharge
		body, _ := json.Marshal(ComputeRechargeRequest{PointsAmount: amount})
		req := httptest.NewRequest(http.MethodPost, "/api/mall/recharge-compute", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")

		gin.SetMode(gin.TestMode)
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = req
		c.Set("userID", userID)

		handler.RechargeCompute(c)

		if w.Code != http.StatusOK {
			t.Errorf("Recharge %d failed: %s", amount, w.Body.String())
			continue
		}

		// Verify 1:1 mapping
		db.Where("user_id = ?", userID).First(&asset)
		if asset.AlibabaCredit != amount {
			t.Errorf("Amount %d: Expected AlibabaCredit %d, got %d", amount, amount, asset.AlibabaCredit)
		}
		if asset.ComputeHours != float64(amount) {
			t.Errorf("Amount %d: Expected ComputeHours %d, got %f", amount, amount, asset.ComputeHours)
		}
	}
}
