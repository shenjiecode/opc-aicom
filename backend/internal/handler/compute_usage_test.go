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
func setupComputeUsageTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to connect to test DB: %v", err)
	}

	// Auto migrate tables
	db.AutoMigrate(
		&model.User{},
		&model.UserAsset{},
		&model.ComputePackage{},
		&model.ComputeUsage{},
	)

	return db
}

// createTestUserWithAsset creates a test user with specified points
func createComputeUsageTestUser(db *gorm.DB, points int, t *testing.T) uint {
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
func createComputeUsageTestPackage(db *gorm.DB, name string, price int, credits int, durationDays int, t *testing.T) uint {
	pkg := model.ComputePackage{
		Name:         name,
		Type:         model.ComputePackageTypeGPU,
		Price:       decimal.NewFromInt(int64(price)),
		Credits:     credits,
		DurationDays: durationDays,
		Status:     model.ComputePackageStatusActive,
		SortOrder:   0,
	}
	if err := db.Create(&pkg).Error; err != nil {
		t.Fatalf("Failed to create package: %v", err)
	}
	return pkg.ID
}

// setupRouter creates a gin engine with authenticated context
func setupComputeUsageRouter(db *gorm.DB, userID uint) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	// Add auth middleware simulation
	router.Use(func(c *gin.Context) {
	c.Set("userID", userID)
		c.Next()
	})

	return router
}

// TestCreateComputeUsage_Success tests successful compute usage creation
func TestCreateComputeUsage_Success(t *testing.T) {
	db := setupComputeUsageTestDB(t)
	handler := NewComputeUsageHandler(db)

	// Setup test data
	userID := createComputeUsageTestUser(db, 1000, t)
	packageID := createComputeUsageTestPackage(db, "GPU Pack", 100, 100, 30, t)

	router := setupComputeUsageRouter(db, userID)
	router.POST("/api/compute/usage", handler.CreateComputeUsage)

	// Create request
	reqBody := map[string]interface{}{
		"package_id":     packageID,
		"credits_used":   "50",
		"compute_hours": 2.5,
		"resource_type":  "gpu",
		"resource_id":   123,
		"description":  "Test compute usage",
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/api/compute/usage", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)

	if resp["code"].(float64) != 0 {
		t.Fatalf("Expected code 0, got %v", resp["code"])
	}
}

// TestCreateComputeUsage_InsufficientCredits tests failed due to insufficient credits
func TestCreateComputeUsage_InsufficientCredits(t *testing.T) {
	db := setupComputeUsageTestDB(t)
	handler := NewComputeUsageHandler(db)

	// Setup test data with low points
	userID := createComputeUsageTestUser(db, 10, t)
	packageID := createComputeUsageTestPackage(db, "GPU Pack", 100, 100, 30, t)

	router := setupComputeUsageRouter(db, userID)
	router.POST("/api/compute/usage", handler.CreateComputeUsage)

	// Try to use more credits than available
	reqBody := map[string]interface{}{
		"package_id":   packageID,
		"credits_used": "100", // More than user's 10 points
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/api/compute/usage", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("Expected status 400, got %d", w.Code)
	}
}

// TestGetComputeUsageList_Success tests listing compute usage
func TestGetComputeUsageList_Success(t *testing.T) {
	db := setupComputeUsageTestDB(t)
	handler := NewComputeUsageHandler(db)

	// Setup test data
	userID := createComputeUsageTestUser(db, 1000, t)
	packageID := createComputeUsageTestPackage(db, "GPU Pack", 100, 100, 30, t)

	// Create a usage record
	usage := model.ComputeUsage{
		UserID:        userID,
		PackageID:     packageID,
		CreditsUsed:   decimal.NewFromInt(50),
		ComputeHours:  2.5,
		ResourceType: "gpu",
	}
	db.Create(&usage)

	router := setupComputeUsageRouter(db, userID)
	router.GET("/api/compute/usage", handler.GetComputeUsageList)

	req := httptest.NewRequest(http.MethodGet, "/api/compute/usage", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)

	if resp["code"].(float64) != 0 {
		t.Fatalf("Expected code 0, got %v", resp["code"])
	}
}

// TestGetComputeUsageDetail_Success tests getting compute usage detail
func TestGetComputeUsageDetail_Success(t *testing.T) {
	db := setupComputeUsageTestDB(t)
	handler := NewComputeUsageHandler(db)

	// Setup test data
	userID := createComputeUsageTestUser(db, 1000, t)
	packageID := createComputeUsageTestPackage(db, "GPU Pack", 100, 100, 30, t)

	// Create a usage record
	usage := model.ComputeUsage{
		UserID:        userID,
		PackageID:     packageID,
		CreditsUsed:   decimal.NewFromInt(50),
		ComputeHours:  2.5,
		ResourceType: "gpu",
	}
	db.Create(&usage)

	router := setupComputeUsageRouter(db, userID)
	router.GET("/api/compute/usage/:id", handler.GetComputeUsageDetail)

	req := httptest.NewRequest(http.MethodGet, "/api/compute/usage/1", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)

	if resp["code"].(float64) != 0 {
		t.Fatalf("Expected code 0, got %v", resp["code"])
	}
}