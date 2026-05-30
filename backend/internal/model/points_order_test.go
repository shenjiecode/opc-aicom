package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestPointsOrder_TableName(t *testing.T) {
	assert.Equal(t, "points_orders", (&PointsOrder{}).TableName())
}

func TestPointsOrder_TypeConstants(t *testing.T) {
	assert.Equal(t, "qoder_account", OrderTypeQoderAccount)
	assert.Equal(t, "compute_recharge", OrderTypeComputeRecharge)
}

func TestPointsOrder_Fields(t *testing.T) {
	now := time.Now()
	order := PointsOrder{
		ID:            1,
		OrderNo:       "ORDER123456",
		UserID:        100,
		OrderType:     OrderTypeQoderAccount,
		ProductID:     10,
		ProductName:   "Qoder Account - Pro",
		PointsAmount:  1000,
		CreditAmount:  100,
		ExchangeRate:  1.0,
		Status:        "pending",
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	assert.Equal(t, uint(1), order.ID)
	assert.Equal(t, "ORDER123456", order.OrderNo)
	assert.Equal(t, uint(100), order.UserID)
	assert.Equal(t, OrderTypeQoderAccount, order.OrderType)
	assert.Equal(t, uint(10), order.ProductID)
	assert.Equal(t, "Qoder Account - Pro", order.ProductName)
	assert.Equal(t, 1000, order.PointsAmount)
	assert.Equal(t, 100, order.CreditAmount)
	assert.Equal(t, 1.0, order.ExchangeRate)
	assert.Equal(t, "pending", order.Status)
}
