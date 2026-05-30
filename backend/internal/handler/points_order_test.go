package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/opc-aicom/backend/internal/model"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// setupPointsOrderTestDB creates an in-memory SQLite database for testing
func setupPointsOrderTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to connect to test DB: %v", err)
	}

	// Auto migrate tables
	db.AutoMigrate(&model.PointsOrder{})

	return db
}

// createTestPointsOrder creates a test points order
func createTestPointsOrder(db *gorm.DB, userID uint, orderType string, status string, t *testing.T) *model.PointsOrder {
	order := model.PointsOrder{
		UserID:        userID,
		OrderNo:      fmt.Sprintf("ORD-%d-%d", userID, time.Now().UnixNano()),
		OrderType:    orderType,
		ProductID:   1,
		ProductName: "Test Product",
		PointsAmount: 100,
		CreditAmount: 100,
		Status:       status,
	}
	if err := db.Create(&order).Error; err != nil {
		t.Fatalf("Failed to create order: %v", err)
	}
	return &order
}

// TestGetPointsOrders_Success tests listing user's points orders
func TestGetPointsOrders_Success(t *testing.T) {
	db := setupPointsOrderTestDB(t)

	// Create test user
	user := model.User{Username: "testuser", PasswordHash: "hash"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}
	// Create test orders
	for i := 0; i < 3; i++ {
		createTestPointsOrder(db, user.ID, model.OrderTypeQoderAccount, "pending", t)
	}

	// Setup request
	req := httptest.NewRequest(http.MethodGet, "/api/orders?page=1&pageSize=10", nil)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", user.ID)

	// Execute
	GetPointsOrders(db)(c)

	// Verify response
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	code := response["code"].(float64)
	if code != 0 {
		t.Errorf("Expected code 0, got %f", code)
	}

	data := response["data"].(map[string]interface{})
	list := data["list"].([]interface{})
	if len(list) != 3 {
		t.Errorf("Expected 3 orders, got %d", len(list))
	}

	total := int64(data["total"].(float64))
	if total != 3 {
		t.Errorf("Expected total 3, got %d", total)
	}
}

// TestGetPointsOrdersPagination tests pagination
func TestGetPointsOrdersPagination(t *testing.T) {
	db := setupPointsOrderTestDB(t)

	// Create test user
	user := model.User{Username: "testuser", PasswordHash: "hash"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	// Create 5 test orders
	for i := 0; i < 5; i++ {
		createTestPointsOrder(db, user.ID, model.OrderTypeQoderAccount, "pending", t)
	}

	// Setup request - get page 1 with pageSize 2
	req := httptest.NewRequest(http.MethodGet, "/api/orders?page=1&pageSize=2", nil)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", user.ID)

	// Execute
	GetPointsOrders(db)(c)

	// Verify response
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)

	data := response["data"].(map[string]interface{})
	list := data["list"].([]interface{})
	if len(list) != 2 {
		t.Errorf("Expected 2 orders on page, got %d", len(list))
	}

	total := int64(data["total"].(float64))
	if total != 5 {
		t.Errorf("Expected total 5, got %d", total)
	}

	page := int(data["page"].(float64))
	if page != 1 {
		t.Errorf("Expected page 1, got %d", page)
	}
}

// TestGetPointsOrders_Unauthorized tests unauthorized access
func TestGetPointsOrders_Unauthorized(t *testing.T) {
	db := setupPointsOrderTestDB(t)

	// Setup request without auth
	req := httptest.NewRequest(http.MethodGet, "/api/orders", nil)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	// Note: NOT setting userID

	// Execute
	GetPointsOrders(db)(c)

	// Verify 401 response
	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", w.Code)
	}
}

// TestGetPointsOrders_EmptyList tests empty order list
func TestGetPointsOrders_EmptyList(t *testing.T) {
	db := setupPointsOrderTestDB(t)

	// Create test user with no orders
	user := model.User{Username: "testuser", PasswordHash: "hash"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	// Setup request
	req := httptest.NewRequest(http.MethodGet, "/api/orders", nil)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", user.ID)

	// Execute
	GetPointsOrders(db)(c)

	// Verify response
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)

	data := response["data"].(map[string]interface{})
	list := data["list"].([]interface{})
	if len(list) != 0 {
		t.Errorf("Expected empty list, got %d", len(list))
	}
}

// TestGetPointsOrderDetail_Success tests getting order detail
func TestGetPointsOrderDetail_Success(t *testing.T) {
	db := setupPointsOrderTestDB(t)

	// Create test user and order
	user := model.User{Username: "testuser", PasswordHash: "hash"}
	db.Create(&user)

	order := createTestPointsOrder(db, user.ID, model.OrderTypeQoderAccount, "pending", t)

	// Setup request
	req := httptest.NewRequest(http.MethodGet, "/api/orders/"+formatUint(order.ID), nil)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Params = gin.Params{{Key: "id", Value: formatUint(order.ID)}}
	c.Set("userID", user.ID)

	// Execute
	GetPointsOrderDetail(db)(c)

	// Verify response
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)

	code := response["code"].(float64)
	if code != 0 {
		t.Errorf("Expected code 0, got %f", code)
	}
}

// TestGetPointsOrderDetail_NotFound tests order not found
func TestGetPointsOrderDetail_NotFound(t *testing.T) {
	db := setupPointsOrderTestDB(t)

	// Create test user
	user := model.User{Username: "testuser", PasswordHash: "hash"}
	db.Create(&user)

	// Setup request with non-existent order ID
	req := httptest.NewRequest(http.MethodGet, "/api/orders/99999", nil)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Params = gin.Params{{Key: "id", Value: "99999"}}
	c.Set("userID", user.ID)

	// Execute
	GetPointsOrderDetail(db)(c)

	// Verify 404 response
	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d", w.Code)
	}
}

// TestGetPointsOrderDetail_WrongUser tests accessing another user's order
func TestGetPointsOrderDetail_WrongUser(t *testing.T) {
	db := setupPointsOrderTestDB(t)

	// Create two users
	user1 := model.User{Username: "user1", PasswordHash: "hash"}
	db.Create(&user1)

	user2 := model.User{Username: "user2", PasswordHash: "hash"}
	db.Create(&user2)

	// Create order for user1
	order := createTestPointsOrder(db, user1.ID, model.OrderTypeQoderAccount, "pending", t)

	// Setup request - user2 trying to access user1's order
	req := httptest.NewRequest(http.MethodGet, "/api/orders/"+formatUint(order.ID), nil)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Params = gin.Params{{Key: "id", Value: formatUint(order.ID)}}
	c.Set("userID", user2.ID)

	// Execute
	GetPointsOrderDetail(db)(c)

	// Verify 404 response (should not exist for user2)
	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d", w.Code)
	}
}

// TestGetPointsOrderDetail_Unauthorized tests unauthorized access to detail
func TestGetPointsOrderDetail_Unauthorized(t *testing.T) {
	db := setupPointsOrderTestDB(t)

	// Setup request without auth
	req := httptest.NewRequest(http.MethodGet, "/api/orders/1", nil)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Params = gin.Params{{Key: "id", Value: "1"}}

	// Execute
	GetPointsOrderDetail(db)(c)

	// Verify 401 response
	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", w.Code)
	}
}

// TestGetPointsOrderDetail_InvalidID tests invalid order ID
func TestGetPointsOrderDetail_InvalidID(t *testing.T) {
	db := setupPointsOrderTestDB(t)

	// Create test user
	user := model.User{Username: "testuser", PasswordHash: "hash"}
	db.Create(&user)

	// Setup request with invalid order ID
	req := httptest.NewRequest(http.MethodGet, "/api/orders/invalid", nil)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Params = gin.Params{{Key: "id", Value: "invalid"}}
	c.Set("userID", user.ID)

	// Execute
	GetPointsOrderDetail(db)(c)

	// Verify 400 response
	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

// Helper function to format uint as string
func formatUint(n uint) string {
	if n == 0 {
		return "0"
	}
	var result string
	for n > 0 {
		result = string(rune('0'+n%10)) + result
		n /= 10
	}
	return result
}