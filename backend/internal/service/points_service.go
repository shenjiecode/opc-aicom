package service

import (
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"

	"github.com/opc-aicom/backend/internal/model"
	"github.com/opc-aicom/backend/internal/repository"
)

var (
	// ErrInsufficientPoints indicates the user does not have enough points.
	ErrInsufficientPoints = errors.New("insufficient points")
	// ErrNegativePoints indicates points cannot be negative.
	ErrNegativePoints = errors.New("points cannot be negative")
	// ErrBatchExpired indicates the batch has expired.
	ErrBatchExpired = errors.New("batch has expired")
)

// PointsService handles points allocation and FIFO deduction logic.
type PointsService struct {
	batchRepo *repository.PointsBatchRepository
}

// NewPointsService creates a new PointsService.
func NewPointsService(batchRepo *repository.PointsBatchRepository) *PointsService {
	return &PointsService{
		batchRepo: batchRepo,
	}
}

// AllocatePoints creates a new points batch for a user.
// This represents adding points to a user's account with an expiration date.
func (s *PointsService) AllocatePoints(userID uint, points int, source model.PointsSource, expiresAt time.Time) (*model.PointsBatch, error) {
	if points <= 0 {
		return nil, ErrNegativePoints
	}

	batch := &model.PointsBatch{
		UserID:    userID,
		Points:    points,
		Source:    source,
		ExpiresAt: expiresAt,
		Status:    model.PointsStatusActive,
	}

	if err := s.batchRepo.Create(batch); err != nil {
		return nil, fmt.Errorf("failed to allocate points: %w", err)
	}

	return batch, nil
}

// DeductPoints deducts points from a user's account using FIFO algorithm.
// Returns the IDs of batches that were used for deduction.
// Uses transaction for atomic operation.
func (s *PointsService) DeductPoints(userID uint, points int) ([]uint64, error) {
	if points <= 0 {
		return nil, ErrNegativePoints
	}

	var deductedBatchIDs []uint64

	err := s.batchRepo.GetDB().Transaction(func(tx *gorm.DB) error {
		// Get all active batches for user, ordered by CreatedAt ASC (FIFO)
		batches, err := s.getActiveBatchesInTransaction(tx, userID)
		if err != nil {
			return fmt.Errorf("failed to get active batches: %w", err)
		}

		// Filter out expired batches and calculate available points
		now := time.Now()
		var availableBatches []*model.PointsBatch
		totalAvailable := 0

		for _, batch := range batches {
			if batch.ExpiresAt.After(now) {
				availableBatches = append(availableBatches, batch)
				totalAvailable += batch.Points
			}
		}

		// Check if user has enough points
		if totalAvailable < points {
			return ErrInsufficientPoints
		}

		// Deduct from oldest batches first (FIFO)
		remainingToDeduct := points
		deductedBatchIDs = make([]uint64, 0)

		for _, batch := range availableBatches {
			if remainingToDeduct <= 0 {
				break
			}

			if batch.Points <= remainingToDeduct {
				// Use entire batch
				deductedAmount := batch.Points
				batch.Status = model.PointsStatusUsed
				batch.Points = 0
				if err := tx.Save(batch).Error; err != nil {
					return fmt.Errorf("failed to update batch %d: %w", batch.ID, err)
				}
				deductedBatchIDs = append(deductedBatchIDs, uint64(batch.ID))
				remainingToDeduct -= deductedAmount
			} else {
				// Partially use batch - reduce points but keep active
				batch.Points -= remainingToDeduct
				if err := tx.Save(batch).Error; err != nil {
					return fmt.Errorf("failed to update batch %d: %w", batch.ID, err)
				}
				deductedBatchIDs = append(deductedBatchIDs, uint64(batch.ID))
				remainingToDeduct = 0
			}
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return deductedBatchIDs, nil
}

// GetExpiringBatches retrieves batches that will expire within the specified number of days.
// Used for notification purposes.
func (s *PointsService) GetExpiringBatches(userID uint, daysBeforeExpiry int) ([]*model.PointsBatch, error) {
	return s.batchRepo.GetExpiringBatches(userID, daysBeforeExpiry)
}

// GetAvailablePoints calculates the total available points for a user.
// Only counts active batches that haven't expired.
func (s *PointsService) GetAvailablePoints(userID uint) (int, error) {
	batches, err := s.batchRepo.GetActiveBatchesByUserID(userID)
	if err != nil {
		return 0, fmt.Errorf("failed to get active batches: %w", err)
	}

	now := time.Now()
	total := 0
	for _, batch := range batches {
		if batch.ExpiresAt.After(now) {
			total += batch.Points
		}
	}

	return total, nil
}

// getActiveBatchesInTransaction retrieves active batches within a transaction.
func (s *PointsService) getActiveBatchesInTransaction(tx *gorm.DB, userID uint) ([]*model.PointsBatch, error) {
	var batches []*model.PointsBatch
	err := tx.Where("user_id = ? AND status = ?", userID, model.PointsStatusActive).
		Order("created_at ASC").
		Find(&batches).Error
	if err != nil {
		return nil, err
	}
	return batches, nil
}