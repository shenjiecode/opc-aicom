package repository

import (
	"gorm.io/gorm"

	"github.com/opc-aicom/backend/internal/model"
)

// TaskRepository defines the repository interface for Task
type TaskRepository struct {
	db *gorm.DB
}

// NewTaskRepository creates a new TaskRepository
func NewTaskRepository(db *gorm.DB) *TaskRepository {
	return &TaskRepository{db: db}
}

// Create creates a new task
func (r *TaskRepository) Create(task *model.Task) error {
	return r.db.Create(task).Error
}

// GetByID retrieves a task by ID
func (r *TaskRepository) GetByID(id uint) (*model.Task, error) {
	var task model.Task
	err := r.db.First(&task, id).Error
	if err != nil {
		return nil, err
	}
	return &task, nil
}

// List retrieves tasks with optional filters
func (r *TaskRepository) List(filter *model.TaskFilter, limit, offset int) ([]model.Task, error) {
	var tasks []model.Task
	query := r.db.Model(&model.Task{})

	if filter != nil {
		if filter.UserID != nil {
			query = query.Where("user_id = ?", *filter.UserID)
		}
		if filter.Type != "" {
			query = query.Where("type = ?", filter.Type)
		}
		if filter.Level != "" {
			query = query.Where("level = ?", filter.Level)
		}
		if filter.Status != "" {
			query = query.Where("status = ?", filter.Status)
		}
	}

	err := query.Limit(limit).Offset(offset).Find(&tasks).Error
	return tasks, err
}

// Update updates a task
func (r *TaskRepository) Update(task *model.Task) error {
	return r.db.Save(task).Error
}

// Delete deletes a task by ID
func (r *TaskRepository) Delete(id uint) error {
	return r.db.Delete(&model.Task{}, id).Error
}
