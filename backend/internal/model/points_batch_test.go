package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestPointsBatch_TableName(t *testing.T) {
	assert.Equal(t, "points_batches", (&PointsBatch{}).TableName())
}

func TestPointsBatch_SourceConstants(t *testing.T) {
	assert.Equal(t, PointsSource("admin_allocate"), PointsSourceAdminAllocate)
	assert.Equal(t, PointsSource("task_reward"), PointsSourceTaskReward)
}

func TestPointsBatch_StatusConstants(t *testing.T) {
	assert.Equal(t, PointsStatus("active"), PointsStatusActive)
	assert.Equal(t, PointsStatus("expired"), PointsStatusExpired)
	assert.Equal(t, PointsStatus("used"), PointsStatusUsed)
}

func TestPointsBatch_Fields(t *testing.T) {
	expiresAt := time.Now().Add(24 * time.Hour)
	batch := PointsBatch{
		ID:        1,
		UserID:    100,
		Points:    500,
		Source:    PointsSourceAdminAllocate,
		ExpiresAt: expiresAt,
		Status:    PointsStatusActive,
	}

	assert.Equal(t, uint(1), batch.ID)
	assert.Equal(t, uint(100), batch.UserID)
	assert.Equal(t, 500, batch.Points)
	assert.Equal(t, PointsSourceAdminAllocate, batch.Source)
	assert.Equal(t, expiresAt, batch.ExpiresAt)
	assert.Equal(t, PointsStatusActive, batch.Status)
}

func TestPointsBatch_TaskRewardSource(t *testing.T) {
	batch := PointsBatch{
		ID:     2,
		UserID: 200,
		Points: 1000,
		Source: PointsSourceTaskReward,
		Status: PointsStatusActive,
	}

	assert.Equal(t, PointsSourceTaskReward, batch.Source)
}

func TestPointsBatch_StatusTransitions(t *testing.T) {
	// Active -> Expired
	batch := PointsBatch{Status: PointsStatusActive}
	assert.Equal(t, PointsStatusActive, batch.Status)

	batch.Status = PointsStatusExpired
	assert.Equal(t, PointsStatusExpired, batch.Status)

	batch.Status = PointsStatusUsed
	assert.Equal(t, PointsStatusUsed, batch.Status)
}
