package repository

import (
	"github.com/opc-aicom/backend/internal/model"
	"gorm.io/gorm"
)

type EventRepository struct {
	db *gorm.DB
}

func NewEventRepository(db *gorm.DB) *EventRepository {
	return &EventRepository{db: db}
}

func (r *EventRepository) List(page, pageSize int, category string) ([]*model.Event, int64, error) {
	var events []*model.Event
	var total int64

	offset := (page - 1) * pageSize

	query := r.db.Model(&model.Event{})
	if category != "" && category != "全部活动" {
		query = query.Where("category = ?", category)
	}

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = query.Offset(offset).Limit(pageSize).Order("start_time DESC").Find(&events).Error
	if err != nil {
		return nil, 0, err
	}

	return events, total, nil
}
