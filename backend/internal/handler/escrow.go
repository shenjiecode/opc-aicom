package handler

import (
	"fmt"

	"github.com/opc-aicom/backend/internal/model"
	"gorm.io/gorm"
)

// EscrowHandler handles escrow-related operations
type EscrowHandler struct {
	db *gorm.DB
}

// NewEscrowHandler creates a new EscrowHandler
func NewEscrowHandler(db *gorm.DB) *EscrowHandler {
	return &EscrowHandler{db: db}
}

// LockPoints locks points when a task is accepted
// It deducts points from user and holds them in escrow
func (h *EscrowHandler) LockPoints(userID uint, taskID uint, amount int) error {
	if amount <= 0 {
		return fmt.Errorf("lock amount must be positive")
	}

	// Get task
	var task model.Task
	if err := h.db.First(&task, taskID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("task not found")
		}
		return fmt.Errorf("database error: %w", err)
	}

	// Verify task belongs to the user posting it (the one who will pay)
	if task.UserID != userID {
		return fmt.Errorf("task does not belong to this user")
	}

	// Get user asset
	var asset model.UserAsset
	if err := h.db.Where("user_id = ?", userID).First(&asset).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("user asset not found")
		}
		return fmt.Errorf("database error: %w", err)
	}

	// Check sufficient points
	if asset.Points < amount {
		return fmt.Errorf("insufficient points: have %d, need %d", asset.Points, amount)
	}

	// Use transaction for atomic operation
	return h.db.Transaction(func(tx *gorm.DB) error {
		// Deduct from user points
		asset.Points -= amount
		if err := tx.Save(&asset).Error; err != nil {
			return fmt.Errorf("failed to deduct points: %w", err)
		}

		// Add to task escrow
		task.EscrowPoints += amount
		if err := tx.Save(&task).Error; err != nil {
			return fmt.Errorf("failed to lock escrow points: %w", err)
		}

		// Create transaction record
		transaction := model.CreditTransaction{
			UserID:       userID,
			Type:         model.CreditTypeEscrowLock,
			Amount:       -amount,
			BalanceAfter: asset.Points,
			Description:  fmt.Sprintf("托管积分: 任务 #%d, 金额 %d", taskID, amount),
			RelatedID:    &taskID,
			RelatedType:  "task_escrow",
		}
		return tx.Create(&transaction).Error
	})
}

// ReleasePoints releases escrow points when task is completed
// It returns points back to user's balance
func (h *EscrowHandler) ReleasePoints(taskID uint) error {
	// Get task
	var task model.Task
	if err := h.db.First(&task, taskID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("task not found")
		}
		return fmt.Errorf("database error: %w", err)
	}

	// Check if there are escrow points to release
	if task.EscrowPoints <= 0 {
		return fmt.Errorf("no escrow points to release")
	}

	userID := task.UserID
	amount := task.EscrowPoints

	// Get user asset
	var asset model.UserAsset
	if err := h.db.Where("user_id = ?", userID).First(&asset).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("user asset not found")
		}
		return fmt.Errorf("database error: %w", err)
	}

	// Use transaction for atomic operation
	return h.db.Transaction(func(tx *gorm.DB) error {
		// Return points to user
		asset.Points += amount
		if err := tx.Save(&asset).Error; err != nil {
			return fmt.Errorf("failed to return points: %w", err)
		}

		// Clear task escrow
		task.EscrowPoints = 0
		if err := tx.Save(&task).Error; err != nil {
			return fmt.Errorf("failed to clear escrow points: %w", err)
		}

		// Create transaction record
		transaction := model.CreditTransaction{
			UserID:       userID,
			Type:         model.CreditTypeEscrowRelease,
			Amount:       amount,
			BalanceAfter: asset.Points,
			Description:  fmt.Sprintf("释放托管积分: 任务 #%d, 金额 %d", taskID, amount),
			RelatedID:    &taskID,
			RelatedType:  "task_escrow",
		}
		return tx.Create(&transaction).Error
	})
}

// DeductPoints permanently deducts escrow points (for early cancellation)
// This is used when the task is cancelled and points should not be returned
func (h *EscrowHandler) DeductPoints(taskID uint) error {
	// Get task
	var task model.Task
	if err := h.db.First(&task, taskID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("task not found")
		}
		return fmt.Errorf("database error: %w", err)
	}

	// Check if there are escrow points to deduct
	if task.EscrowPoints <= 0 {
		return fmt.Errorf("no escrow points to deduct")
	}

	userID := task.UserID
	amount := task.EscrowPoints

	// Get user asset
	var asset model.UserAsset
	if err := h.db.Where("user_id = ?", userID).First(&asset).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("user asset not found")
		}
		return fmt.Errorf("database error: %w", err)
	}

	// Use transaction for atomic operation
	return h.db.Transaction(func(tx *gorm.DB) error {
		// Clear task escrow (points are permanently deducted, not returned)
		task.EscrowPoints = 0
		if err := tx.Save(&task).Error; err != nil {
			return fmt.Errorf("failed to clear escrow points: %w", err)
		}

		// Create transaction record (deduction is recorded but not added back to user)
		transaction := model.CreditTransaction{
			UserID:       userID,
			Type:         model.CreditTypeEscrowDeduct,
			Amount:       -amount,
			BalanceAfter: asset.Points,
			Description:  fmt.Sprintf("扣除托管积分: 任务 #%d, 金额 %d", taskID, amount),
			RelatedID:    &taskID,
			RelatedType:  "task_escrow",
		}
		return tx.Create(&transaction).Error
	})
}

// LockPointsTx is a version of LockPoints that accepts an existing transaction
// Use this when you need to ensure atomicity with other operations
func (h *EscrowHandler) LockPointsTx(tx *gorm.DB, userID uint, taskID uint, amount int) error {
	if amount <= 0 {
		return fmt.Errorf("lock amount must be positive")
	}

	// Get task
	var task model.Task
	if err := tx.First(&task, taskID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("task not found")
		}
		return fmt.Errorf("database error: %w", err)
	}

	// Verify task belongs to the user
	if task.UserID != userID {
		return fmt.Errorf("task does not belong to this user")
	}

	// Get user asset
	var asset model.UserAsset
	if err := tx.Where("user_id = ?", userID).First(&asset).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("user asset not found")
		}
		return fmt.Errorf("database error: %w", err)
	}

	// Check sufficient points
	if asset.Points < amount {
		return fmt.Errorf("insufficient points: have %d, need %d", asset.Points, amount)
	}

	// Deduct from user points
	asset.Points -= amount
	if err := tx.Save(&asset).Error; err != nil {
		return fmt.Errorf("failed to deduct points: %w", err)
	}

	// Add to task escrow
	task.EscrowPoints += amount
	if err := tx.Save(&task).Error; err != nil {
		return fmt.Errorf("failed to lock escrow points: %w", err)
	}

	// Create transaction record
	transaction := model.CreditTransaction{
		UserID:       userID,
		Type:         model.CreditTypeEscrowLock,
		Amount:       -amount,
		BalanceAfter: asset.Points,
		Description:  fmt.Sprintf("托管积分: 任务 #%d, 金额 %d", taskID, amount),
		RelatedID:    &taskID,
		RelatedType:  "task_escrow",
	}
	return tx.Create(&transaction).Error
}

// ReleasePointsTx is a version of ReleasePoints that accepts an existing transaction
func (h *EscrowHandler) ReleasePointsTx(tx *gorm.DB, taskID uint) error {
	// Get task
	var task model.Task
	if err := tx.First(&task, taskID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("task not found")
		}
		return fmt.Errorf("database error: %w", err)
	}

	// Check if there are escrow points to release
	if task.EscrowPoints <= 0 {
		return fmt.Errorf("no escrow points to release")
	}

	userID := task.UserID
	amount := task.EscrowPoints

	// Get user asset
	var asset model.UserAsset
	if err := tx.Where("user_id = ?", userID).First(&asset).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("user asset not found")
		}
		return fmt.Errorf("database error: %w", err)
	}

	// Return points to user
	asset.Points += amount
	if err := tx.Save(&asset).Error; err != nil {
		return fmt.Errorf("failed to return points: %w", err)
	}

	// Clear task escrow
	task.EscrowPoints = 0
	if err := tx.Save(&task).Error; err != nil {
		return fmt.Errorf("failed to clear escrow points: %w", err)
	}

	// Create transaction record
	transaction := model.CreditTransaction{
		UserID:       userID,
		Type:         model.CreditTypeEscrowRelease,
		Amount:       amount,
		BalanceAfter: asset.Points,
		Description:  fmt.Sprintf("释放托管积分: 任务 #%d, 金额 %d", taskID, amount),
		RelatedID:    &taskID,
		RelatedType:  "task_escrow",
	}
	return tx.Create(&transaction).Error
}

// DeductPointsTx is a version of DeductPoints that accepts an existing transaction
func (h *EscrowHandler) DeductPointsTx(tx *gorm.DB, taskID uint) error {
	// Get task
	var task model.Task
	if err := tx.First(&task, taskID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("task not found")
		}
		return fmt.Errorf("database error: %w", err)
	}

	// Check if there are escrow points to deduct
	if task.EscrowPoints <= 0 {
		return fmt.Errorf("no escrow points to deduct")
	}

	userID := task.UserID
	amount := task.EscrowPoints

	// Get user asset
	var asset model.UserAsset
	if err := tx.Where("user_id = ?", userID).First(&asset).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("user asset not found")
		}
		return fmt.Errorf("database error: %w", err)
	}

	// Clear task escrow
	task.EscrowPoints = 0
	if err := tx.Save(&task).Error; err != nil {
		return fmt.Errorf("failed to clear escrow points: %w", err)
	}

	// Create transaction record
	transaction := model.CreditTransaction{
		UserID:       userID,
		Type:         model.CreditTypeEscrowDeduct,
		Amount:      -amount,
		BalanceAfter: asset.Points,
		Description: fmt.Sprintf("扣除托管积分: 任务 #%d, 金额 %d", taskID, amount),
		RelatedID:    &taskID,
		RelatedType:  "task_escrow",
	}
	return tx.Create(&transaction).Error
}