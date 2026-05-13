package repository

import (
	"github.com/opc-aicom/backend/internal/model"
	"gorm.io/gorm"
)

type TaskRepository struct {
	db *gorm.DB
}

func NewTaskRepository(db *gorm.DB) *TaskRepository {
	return &TaskRepository{db: db}
}

func (r *TaskRepository) List(page, pageSize int, taskType string, level string) ([]*model.Task, int64, error) {
	var tasks []*model.Task
	var total int64

	offset := (page - 1) * pageSize

	query := r.db.Model(&model.Task{})
	if taskType != "" && taskType != "全部" {
		query = query.Where("type = ?", taskType)
	}
	if level != "" && level != "全部" {
		query = query.Where("level = ?", level)
	}

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&tasks).Error
	if err != nil {
		return nil, 0, err
	}

	return tasks, total, nil
}
