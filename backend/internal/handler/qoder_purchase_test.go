package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/model"
	"github.com/opc-aicom/backend/pkg/config"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupQoderTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to connect to test DB: %v", err)
	}

	db.AutoMigrate(
		&model.User{},
		&model.UserAsset{},
		&model.PointsOrder{},
		&model.PointsBatch{},
	)

	return db
}

func createQoderTestUserWithPoints(db *gorm.DB, points int, t *testing.T) uint {
user := model.User{
		Username:     "qodertestuser",
		PasswordHash: "testpass",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}
	batch := &model.PointsBatch{
		UserID:    user.ID,
		Points:    points,
		Source:    model.PointsSourceAdminAllocate,
		ExpiresAt: time.Now().AddDate(1, 0, 0),
		Status:    model.PointsStatusActive,
	}
	if err := db.Create(batch).Error; err != nil {
		t.Fatalf("Failed to create points batch: %v", err)
	}

	return user.ID
}

func TestQoderPurchaseHandler_PurchaseQoder_Success(t *testing.T) {
	db := setupQoderTestDB(t)
	cfg := &config.QoderConfig{
		BaseURL:       "https://api.qoder.ai",
		APIKey:        "test-key",
		MonthlyPlanID: "monthly-plan-id",
	}
	handler := NewQoderPurchaseHandler(db, cfg)

	userID := createQoderTestUserWithPoints(db, 500, t)

	body, _ := json.Marshal(QoderPurchaseRequest{Email: "test@example.com"})
	req := httptest.NewRequest(http.MethodPost, "/api/mall/purchase-qoder", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", userID)

	handler.PurchaseQoder(c)

	if w.Code != http.StatusOK && w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 200 or 500 (external API), got %d: %s", w.Code, w.Body.String())
	}
}

func TestQoderPurchaseHandler_PurchaseQoder_InsufficientPoints(t *testing.T) {
	db := setupQoderTestDB(t)
	cfg := &config.QoderConfig{
		BaseURL:       "https://api.qoder.ai",
		APIKey:        "test-key",
		MonthlyPlanID: "monthly-plan-id",
	}
	handler := NewQoderPurchaseHandler(db, cfg)

	userID := createQoderTestUserWithPoints(db, 100, t)

	body, _ := json.Marshal(QoderPurchaseRequest{Email: "test@example.com"})
	req := httptest.NewRequest(http.MethodPost, "/api/mall/purchase-qoder", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", userID)

	handler.PurchaseQoder(c)

	if w.Code != http.StatusPaymentRequired {
		t.Errorf("Expected status 402, got %d: %s", w.Code, w.Body.String())
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	data := response["data"].(map[string]interface{})
	shortage := int(data["shortage"].(float64))
	if shortage != 200 {
		t.Errorf("Expected shortage 200, got %d", shortage)
	}
}

func TestQoderPurchaseHandler_PurchaseQoder_InvalidEmail(t *testing.T) {
	db := setupQoderTestDB(t)
	cfg := &config.QoderConfig{
		BaseURL:       "https://api.qoder.ai",
		APIKey:        "test-key",
		MonthlyPlanID: "monthly-plan-id",
	}
	handler := NewQoderPurchaseHandler(db, cfg)

	userID := createQoderTestUserWithPoints(db, 500, t)

	body, _ := json.Marshal(QoderPurchaseRequest{Email: "invalid-email"})
	req := httptest.NewRequest(http.MethodPost, "/api/mall/purchase-qoder", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", userID)

	handler.PurchaseQoder(c)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestQoderPurchaseHandler_PurchaseQoder_Unauthorized(t *testing.T) {
	db := setupQoderTestDB(t)
	cfg := &config.QoderConfig{
		BaseURL:       "https://api.qoder.ai",
		APIKey:        "test-key",
		MonthlyPlanID: "monthly-plan-id",
	}
	handler := NewQoderPurchaseHandler(db, cfg)

	body, _ := json.Marshal(QoderPurchaseRequest{Email: "test@example.com"})
	req := httptest.NewRequest(http.MethodPost, "/api/mall/purchase-qoder", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req

	handler.PurchaseQoder(c)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d: %s", w.Code, w.Body.String())
	}
}

func TestQoderPurchaseHandler_PurchaseQoder_OrderCreationAndRollback(t *testing.T) {
	db := setupQoderTestDB(t)
	cfg := &config.QoderConfig{
		BaseURL:       "https://invalid-url-that-does-not-exist.com",
		APIKey:        "test-key",
		MonthlyPlanID: "monthly-plan-id",
	}
	handler := NewQoderPurchaseHandler(db, cfg)

	userID := createQoderTestUserWithPoints(db, 500, t)

	body, _ := json.Marshal(QoderPurchaseRequest{Email: "test@example.com"})
	req := httptest.NewRequest(http.MethodPost, "/api/mall/purchase-qoder", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", userID)

	handler.PurchaseQoder(c)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 500 (external API failure), got %d: %s", w.Code, w.Body.String())
	}

	var order model.PointsOrder
	if err := db.Where("user_id = ?", userID).First(&order).Error; err != nil {
		t.Fatalf("Order should exist: %v", err)
	}

	if order.Status != "cancelled" {
		t.Errorf("Order should be cancelled, got status: %s", order.Status)
	}

	if order.CancelledAt == nil {
		t.Error("CancelledAt should be set")
	}

	var batch model.PointsBatch
	if err := db.Where("user_id = ?", userID).First(&batch).Error; err != nil {
		t.Fatalf("Points batch should exist: %v", err)
	}

	if batch.Points != 500 {
		t.Errorf("Points should not be deducted on failure, got: %d", batch.Points)
	}
}

func TestQoderPurchaseHandler_PurchaseQoder_Exactly300Points(t *testing.T) {
	db := setupQoderTestDB(t)
	cfg := &config.QoderConfig{
		BaseURL:       "https://api.qoder.ai",
		APIKey:        "test-key",
		MonthlyPlanID: "monthly-plan-id",
	}
	handler := NewQoderPurchaseHandler(db, cfg)

	userID := createQoderTestUserWithPoints(db, 300, t)

	body, _ := json.Marshal(QoderPurchaseRequest{Email: "test@example.com"})
	req := httptest.NewRequest(http.MethodPost, "/api/mall/purchase-qoder", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", userID)

	handler.PurchaseQoder(c)

	if w.Code == http.StatusPaymentRequired {
		t.Errorf("Should not return 402 when user has exactly 300 points")
	}
}

func TestQoderPurchaseHandler_PurchaseQoder_MissingRequestBody(t *testing.T) {
	db := setupQoderTestDB(t)
	cfg := &config.QoderConfig{
		BaseURL:       "https://api.qoder.ai",
		APIKey:        "test-key",
		MonthlyPlanID: "monthly-plan-id",
	}
	handler := NewQoderPurchaseHandler(db, cfg)

	userID := createQoderTestUserWithPoints(db, 500, t)

	req := httptest.NewRequest(http.MethodPost, "/api/mall/purchase-qoder", nil)
	req.Header.Set("Content-Type", "application/json")

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("userID", userID)

	handler.PurchaseQoder(c)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d: %s", w.Code, w.Body.String())
	}
}
