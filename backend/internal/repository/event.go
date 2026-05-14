package repository

import (
	"crypto/rand"
	"encoding/hex"
	"time"

	"github.com/opc-aicom/backend/internal/model"
	"gorm.io/gorm"
)

type EventRepository struct {
	db *gorm.DB
}

func NewEventRepository(db *gorm.DB) *EventRepository {
	return &EventRepository{db: db}
}

// generateShareCode 生成随机分享码
func generateShareCode() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
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

// Create 创建新活动
func (r *EventRepository) Create(event *model.Event) error {
	event.ShareCode = generateShareCode()
	event.CreatedAt = time.Now()
	event.UpdatedAt = time.Now()
	return r.db.Create(event).Error
}

// GetByID 根据ID获取活动
func (r *EventRepository) GetByID(id uint) (*model.Event, error) {
	var event model.Event
	err := r.db.First(&event, id).Error
	if err != nil {
		return nil, err
	}
	return &event, nil
}

// GetByShareCode 根据分享码获取活动
func (r *EventRepository) GetByShareCode(shareCode string) (*model.Event, error) {
	var event model.Event
	err := r.db.Where("share_code = ?", shareCode).First(&event).Error
	if err != nil {
		return nil, err
	}
	return &event, nil
}

// Register 用户报名活动
func (r *EventRepository) Register(eventID, userID uint) error {
	// 检查是否已报名
	var existing model.EventRegistration
	err := r.db.Where("event_id = ? AND user_id = ?", eventID, userID).First(&existing).Error
	if err == nil {
		return gorm.ErrDuplicatedKey
	}

	// 创建报名记录
	registration := &model.EventRegistration{
		EventID:   eventID,
		UserID:    userID,
		Status:    "registered",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// 使用事务
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(registration).Error; err != nil {
			return err
		}
		// 更新报名人数
		return tx.Model(&model.Event{}).Where("id = ?", eventID).
			UpdateColumn("joined_count", gorm.Expr("joined_count + 1")).Error
	})
}

// GetRegistration 获取用户报名状态
func (r *EventRepository) GetRegistration(eventID, userID uint) (*model.EventRegistration, error) {
	var registration model.EventRegistration
	err := r.db.Where("event_id = ? AND user_id = ?", eventID, userID).First(&registration).Error
	if err != nil {
		return nil, err
	}
	return &registration, nil
}

// GetRegistrationsByEvent 获取活动的所有报名记录
func (r *EventRepository) GetRegistrationsByEvent(eventID uint) ([]*model.EventRegistration, error) {
	var registrations []*model.EventRegistration
	err := r.db.Where("event_id = ?", eventID).Order("created_at DESC").Find(&registrations).Error
	return registrations, err
}

