package repository

import (
	"github.com/opc-aicom/backend/internal/model"
	"gorm.io/gorm"
)

// RequirementSessionRepository handles requirement_session database operations.
type RequirementSessionRepository struct {
	db *gorm.DB
}

// NewRequirementSessionRepository creates a new RequirementSessionRepository.
func NewRequirementSessionRepository(db *gorm.DB) *RequirementSessionRepository {
	return &RequirementSessionRepository{db: db}
}

// Create creates a new requirement session.
func (r *RequirementSessionRepository) Create(session *model.RequirementSession) error {
	return r.db.Create(session).Error
}

// GetByID retrieves a requirement session by ID.
func (r *RequirementSessionRepository) GetByID(id uint) (*model.RequirementSession, error) {
	var session model.RequirementSession
	err := r.db.First(&session, id).Error
	if err != nil {
		return nil, err
	}
	return &session, nil
}

// GetByUser retrieves requirement sessions by user ID.
func (r *RequirementSessionRepository) GetByUser(userID uint) ([]*model.RequirementSession, error) {
	var sessions []*model.RequirementSession
	err := r.db.Where("user_id = ?", userID).Order("created_at DESC").Find(&sessions).Error
	return sessions, err
}

// GetByTask retrieves requirement sessions by task ID.
func (r *RequirementSessionRepository) GetByTask(taskID uint) ([]*model.RequirementSession, error) {
	var sessions []*model.RequirementSession
	err := r.db.Where("task_id = ?", taskID).Find(&sessions).Error
	return sessions, err
}

// GetAll retrieves all requirement sessions.
func (r *RequirementSessionRepository) GetAll() ([]*model.RequirementSession, error) {
	var sessions []*model.RequirementSession
	err := r.db.Find(&sessions).Error
	return sessions, err
}

// Update updates a requirement session.
func (r *RequirementSessionRepository) Update(session *model.RequirementSession) error {
	return r.db.Save(session).Error
}

// Delete soft deletes a requirement session.
func (r *RequirementSessionRepository) Delete(id uint) error {
	return r.db.Delete(&model.RequirementSession{}, id).Error
}