package service

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/opc-aicom/backend/internal/model"
	"github.com/opc-aicom/backend/internal/repository"
)

// setupPointsTestDB creates an in-memory SQLite database for testing
func setupPointsTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to connect to test DB: %v", err)
	}

	// Auto migrate tables
	db.AutoMigrate(&model.PointsBatch{})

	return db
}

// createTestBatch creates a test points batch
func createTestBatch(db *gorm.DB, userID uint, points int, source model.PointsSource, expiresAt time.Time, status model.PointsStatus) *model.PointsBatch {
	batch := &model.PointsBatch{
		UserID:    userID,
		Points:    points,
		Source:    source,
		ExpiresAt: expiresAt,
		Status:    status,
	}
	db.Create(batch)
	return batch
}

func TestPointsService_AllocatePoints_Success(t *testing.T) {
	db := setupPointsTestDB(t)
	batchRepo := repository.NewPointsBatchRepository(db)
	service := NewPointsService(batchRepo)

	userID := uint(1)
	points := 500
	expiresAt := time.Now().Add(24 * time.Hour)

	batch, err := service.AllocatePoints(userID, points, model.PointsSourceAdminAllocate, expiresAt)

	assert.NoError(t, err)
	assert.NotNil(t, batch)
	assert.Equal(t, userID, batch.UserID)
	assert.Equal(t, points, batch.Points)
	assert.Equal(t, model.PointsSourceAdminAllocate, batch.Source)
	assert.Equal(t, model.PointsStatusActive, batch.Status)
	assert.True(t, batch.ExpiresAt.After(time.Now()))
}

func TestPointsService_AllocatePoints_NegativePoints(t *testing.T) {
	db := setupPointsTestDB(t)
	batchRepo := repository.NewPointsBatchRepository(db)
	service := NewPointsService(batchRepo)

	userID := uint(1)
	expiresAt := time.Now().Add(24 * time.Hour)

	batch, err := service.AllocatePoints(userID, -100, model.PointsSourceAdminAllocate, expiresAt)

	assert.Error(t, err)
	assert.Equal(t, ErrNegativePoints, err)
	assert.Nil(t, batch)
}

func TestPointsService_AllocatePoints_ZeroPoints(t *testing.T) {
	db := setupPointsTestDB(t)
	batchRepo := repository.NewPointsBatchRepository(db)
	service := NewPointsService(batchRepo)

	userID := uint(1)
	expiresAt := time.Now().Add(24 * time.Hour)

	batch, err := service.AllocatePoints(userID, 0, model.PointsSourceAdminAllocate, expiresAt)

	assert.Error(t, err)
	assert.Equal(t, ErrNegativePoints, err)
	assert.Nil(t, batch)
}

func TestPointsService_DeductPoints_FIFO_Success(t *testing.T) {
	db := setupPointsTestDB(t)
	batchRepo := repository.NewPointsBatchRepository(db)
	service := NewPointsService(batchRepo)

	userID := uint(1)
	now := time.Now()

	// Create batches with different creation times (simulating FIFO order)
	batch1 := createTestBatch(db, userID, 300, model.PointsSourceAdminAllocate, now.Add(48*time.Hour), model.PointsStatusActive)
	batch1.CreatedAt = now.Add(-2 * time.Hour)
	db.Save(batch1)

	batch2 := createTestBatch(db, userID, 200, model.PointsSourceTaskReward, now.Add(72*time.Hour), model.PointsStatusActive)
	batch2.CreatedAt = now.Add(-1 * time.Hour)
	db.Save(batch2)

	// Deduct 250 points - should use batch1 (300 points) partially
	deductedIDs, err := service.DeductPoints(userID, 250)

	assert.NoError(t, err)
	assert.Len(t, deductedIDs, 1)
	assert.Equal(t, uint64(batch1.ID), deductedIDs[0])

	// Verify batch1 is partially used (50 points remaining)
	var updatedBatch1 model.PointsBatch
	db.First(&updatedBatch1, batch1.ID)
	assert.Equal(t, 50, updatedBatch1.Points)
	assert.Equal(t, model.PointsStatusActive, updatedBatch1.Status)

	// Verify batch2 is untouched
	var updatedBatch2 model.PointsBatch
	db.First(&updatedBatch2, batch2.ID)
	assert.Equal(t, 200, updatedBatch2.Points)
	assert.Equal(t, model.PointsStatusActive, updatedBatch2.Status)
}

func TestPointsService_DeductPoints_FIFO_MultipleBatches(t *testing.T) {
	db := setupPointsTestDB(t)
	batchRepo := repository.NewPointsBatchRepository(db)
	service := NewPointsService(batchRepo)

	userID := uint(1)
	now := time.Now()

	// Create batches with different creation times
	batch1 := createTestBatch(db, userID, 100, model.PointsSourceAdminAllocate, now.Add(48*time.Hour), model.PointsStatusActive)
	batch1.CreatedAt = now.Add(-3 * time.Hour)
	db.Save(batch1)

	batch2 := createTestBatch(db, userID, 150, model.PointsSourceTaskReward, now.Add(72*time.Hour), model.PointsStatusActive)
	batch2.CreatedAt = now.Add(-2 * time.Hour)
	db.Save(batch2)

	batch3 := createTestBatch(db, userID, 200, model.PointsSourceAdminAllocate, now.Add(96*time.Hour), model.PointsStatusActive)
	batch3.CreatedAt = now.Add(-1 * time.Hour)
	db.Save(batch3)

	// Deduct 350 points - should use batch1 (100) + batch2 (150) + batch3 (100)
	deductedIDs, err := service.DeductPoints(userID, 350)

	assert.NoError(t, err)
	assert.Len(t, deductedIDs, 3)

	// Verify batch1 and batch2 are fully used
	var updatedBatch1, updatedBatch2, updatedBatch3 model.PointsBatch
	db.First(&updatedBatch1, batch1.ID)
	db.First(&updatedBatch2, batch2.ID)
	db.First(&updatedBatch3, batch3.ID)

	assert.Equal(t, model.PointsStatusUsed, updatedBatch1.Status)
	assert.Equal(t, model.PointsStatusUsed, updatedBatch2.Status)
	assert.Equal(t, 100, updatedBatch3.Points) // batch3 partially used
	assert.Equal(t, model.PointsStatusActive, updatedBatch3.Status)
}

func TestPointsService_DeductPoints_InsufficientPoints(t *testing.T) {
	db := setupPointsTestDB(t)
	batchRepo := repository.NewPointsBatchRepository(db)
	service := NewPointsService(batchRepo)

	userID := uint(1)
	now := time.Now()

	// Create batch with 100 points
	createTestBatch(db, userID, 100, model.PointsSourceAdminAllocate, now.Add(48*time.Hour), model.PointsStatusActive)

	// Try to deduct 200 points
	deductedIDs, err := service.DeductPoints(userID, 200)

	assert.Error(t, err)
	assert.Equal(t, ErrInsufficientPoints, err)
	assert.Nil(t, deductedIDs)
}

func TestPointsService_DeductPoints_SkipExpiredBatches(t *testing.T) {
	db := setupPointsTestDB(t)
	batchRepo := repository.NewPointsBatchRepository(db)
	service := NewPointsService(batchRepo)

	userID := uint(1)
	now := time.Now()

	// Create expired batch
	batch1 := createTestBatch(db, userID, 100, model.PointsSourceAdminAllocate, now.Add(-1*time.Hour), model.PointsStatusActive)
	batch1.CreatedAt = now.Add(-2 * time.Hour)
	db.Save(batch1)

	// Create active batch
	batch2 := createTestBatch(db, userID, 200, model.PointsSourceTaskReward, now.Add(48*time.Hour), model.PointsStatusActive)
	batch2.CreatedAt = now.Add(-1 * time.Hour)
	db.Save(batch2)

	// Deduct 150 points - should skip expired batch1 and use batch2
	deductedIDs, err := service.DeductPoints(userID, 150)

	assert.NoError(t, err)
	assert.Len(t, deductedIDs, 1)
	assert.Equal(t, uint64(batch2.ID), deductedIDs[0])

	// Verify batch2 is partially used
	var updatedBatch2 model.PointsBatch
	db.First(&updatedBatch2, batch2.ID)
	assert.Equal(t, 50, updatedBatch2.Points)
}

func TestPointsService_DeductPoints_NegativePoints(t *testing.T) {
	db := setupPointsTestDB(t)
	batchRepo := repository.NewPointsBatchRepository(db)
	service := NewPointsService(batchRepo)

	deductedIDs, err := service.DeductPoints(1, -100)

	assert.Error(t, err)
	assert.Equal(t, ErrNegativePoints, err)
	assert.Nil(t, deductedIDs)
}

func TestPointsService_DeductPoints_ZeroPoints(t *testing.T) {
	db := setupPointsTestDB(t)
	batchRepo := repository.NewPointsBatchRepository(db)
	service := NewPointsService(batchRepo)

	deductedIDs, err := service.DeductPoints(1, 0)

	assert.Error(t, err)
	assert.Equal(t, ErrNegativePoints, err)
	assert.Nil(t, deductedIDs)
}

func TestPointsService_GetExpiringBatches_Success(t *testing.T) {
	db := setupPointsTestDB(t)
	batchRepo := repository.NewPointsBatchRepository(db)
	service := NewPointsService(batchRepo)

	userID := uint(1)
	now := time.Now()

	// Create batch expiring in 3 days
	batch1 := createTestBatch(db, userID, 100, model.PointsSourceAdminAllocate, now.Add(3*24*time.Hour), model.PointsStatusActive)

	// Create batch expiring in 10 days
	createTestBatch(db, userID, 200, model.PointsSourceTaskReward, now.Add(10*24*time.Hour), model.PointsStatusActive)

	// Get batches expiring within 5 days
	batches, err := service.GetExpiringBatches(userID, 5)

	assert.NoError(t, err)
	assert.Len(t, batches, 1)
	assert.Equal(t, batch1.ID, batches[0].ID)
}

func TestPointsService_GetExpiringBatches_NoExpiringBatches(t *testing.T) {
	db := setupPointsTestDB(t)
	batchRepo := repository.NewPointsBatchRepository(db)
	service := NewPointsService(batchRepo)

	userID := uint(1)
	now := time.Now()

	// Create batch expiring in 30 days
	createTestBatch(db, userID, 100, model.PointsSourceAdminAllocate, now.Add(30*24*time.Hour), model.PointsStatusActive)

	// Get batches expiring within 5 days
	batches, err := service.GetExpiringBatches(userID, 5)

	assert.NoError(t, err)
	assert.Len(t, batches, 0)
}

func TestPointsService_GetAvailablePoints_Success(t *testing.T) {
	db := setupPointsTestDB(t)
	batchRepo := repository.NewPointsBatchRepository(db)
	service := NewPointsService(batchRepo)

	userID := uint(1)
	now := time.Now()

	// Create active batches
	createTestBatch(db, userID, 100, model.PointsSourceAdminAllocate, now.Add(48*time.Hour), model.PointsStatusActive)
	createTestBatch(db, userID, 200, model.PointsSourceTaskReward, now.Add(72*time.Hour), model.PointsStatusActive)

	// Create expired batch (should not be counted)
	createTestBatch(db, userID, 50, model.PointsSourceAdminAllocate, now.Add(-1*time.Hour), model.PointsStatusActive)

	// Create used batch (should not be counted)
	createTestBatch(db, userID, 75, model.PointsSourceAdminAllocate, now.Add(48*time.Hour), model.PointsStatusUsed)

	total, err := service.GetAvailablePoints(userID)

	assert.NoError(t, err)
	assert.Equal(t, 300, total) // Only active, non-expired batches
}

func TestPointsService_GetAvailablePoints_NoBatches(t *testing.T) {
	db := setupPointsTestDB(t)
	batchRepo := repository.NewPointsBatchRepository(db)
	service := NewPointsService(batchRepo)

	total, err := service.GetAvailablePoints(1)

	assert.NoError(t, err)
	assert.Equal(t, 0, total)
}

func TestPointsService_DeductPoints_TransactionRollback(t *testing.T) {
	db := setupPointsTestDB(t)
	batchRepo := repository.NewPointsBatchRepository(db)
	service := NewPointsService(batchRepo)

	userID := uint(1)
	now := time.Now()

	// Create batch with 100 points
	batch := createTestBatch(db, userID, 100, model.PointsSourceAdminAllocate, now.Add(48*time.Hour), model.PointsStatusActive)

	// Try to deduct more than available
	_, err := service.DeductPoints(userID, 200)

	assert.Error(t, err)
	assert.Equal(t, ErrInsufficientPoints, err)

	// Verify batch is unchanged (transaction rolled back)
	var unchangedBatch model.PointsBatch
	db.First(&unchangedBatch, batch.ID)
	assert.Equal(t, 100, unchangedBatch.Points)
	assert.Equal(t, model.PointsStatusActive, unchangedBatch.Status)
}

func TestPointsService_FIFO_Ordering(t *testing.T) {
	db := setupPointsTestDB(t)
	batchRepo := repository.NewPointsBatchRepository(db)
	service := NewPointsService(batchRepo)

	userID := uint(1)
	now := time.Now()

	// Create batches with specific creation order
	batch1 := createTestBatch(db, userID, 100, model.PointsSourceAdminAllocate, now.Add(48*time.Hour), model.PointsStatusActive)
	batch1.CreatedAt = now.Add(-5 * time.Hour)
	db.Save(batch1)

	batch2 := createTestBatch(db, userID, 100, model.PointsSourceTaskReward, now.Add(72*time.Hour), model.PointsStatusActive)
	batch2.CreatedAt = now.Add(-3 * time.Hour)
	db.Save(batch2)

	batch3 := createTestBatch(db, userID, 100, model.PointsSourceAdminAllocate, now.Add(96*time.Hour), model.PointsStatusActive)
	batch3.CreatedAt = now.Add(-1 * time.Hour)
	db.Save(batch3)

	// Deduct 150 points - should use batch1 (100) + batch2 (50)
	deductedIDs, err := service.DeductPoints(userID, 150)

	assert.NoError(t, err)
	assert.Len(t, deductedIDs, 2)
	assert.Equal(t, uint64(batch1.ID), deductedIDs[0])
	assert.Equal(t, uint64(batch2.ID), deductedIDs[1])

	// Verify correct batches were used
	var updatedBatch1, updatedBatch2, updatedBatch3 model.PointsBatch
	db.First(&updatedBatch1, batch1.ID)
	db.First(&updatedBatch2, batch2.ID)
	db.First(&updatedBatch3, batch3.ID)

	assert.Equal(t, model.PointsStatusUsed, updatedBatch1.Status)
	assert.Equal(t, 50, updatedBatch2.Points) // partially used
	assert.Equal(t, 100, updatedBatch3.Points) // untouched
}
