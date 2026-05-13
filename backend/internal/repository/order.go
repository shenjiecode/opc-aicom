package repository

import (
	"github.com/opc-aicom/backend/internal/model"

	"gorm.io/gorm"
)

// OrderRepository handles order database operations.
type OrderRepository struct {
	db *gorm.DB
}

// NewOrderRepository creates a new OrderRepository.
func NewOrderRepository(db *gorm.DB) *OrderRepository {
	return &OrderRepository{db: db}
}

// Create creates a new order.
func (r *OrderRepository) Create(order *model.Order) error {
	return r.db.Create(order).Error
}

// GetByID retrieves an order by ID.
func (r *OrderRepository) GetByID(id uint) (*model.Order, error) {
	var order model.Order
	err := r.db.First(&order, id).Error
	if err != nil {
		return nil, err
	}
	return &order, nil
}

// GetByUser retrieves orders by user ID.
func (r *OrderRepository) GetByUser(userID uint) ([]*model.Order, error) {
	var orders []*model.Order
	err := r.db.Where("user_id = ?", userID).Find(&orders).Error
	return orders, err
}

// GetByTask retrieves orders by task ID.
func (r *OrderRepository) GetByTask(taskID uint) ([]*model.Order, error) {
	var orders []*model.Order
	err := r.db.Where("task_id = ?", taskID).Find(&orders).Error
	return orders, err
}

// Update updates an order.
func (r *OrderRepository) Update(order *model.Order) error {
	return r.db.Save(order).Error
}