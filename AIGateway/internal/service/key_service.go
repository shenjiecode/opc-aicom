package service

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"time"

	"github.com/opc-aicom/aigateway/internal/config"
	"github.com/opc-aicom/aigateway/internal/model"
	"gorm.io/gorm"
)

var (
	ErrKeyNotFound = errors.New("virtual key not found")
	ErrKeyRevoked  = errors.New("virtual key is revoked")
	ErrKeyExpired  = errors.New("virtual key has expired")
	ErrQuotaExceeded = errors.New("virtual key quota exceeded")
)

// KeyService manages virtual API keys.
type KeyService struct {
	db     *gorm.DB
	config *config.GatewayConfig
}

// NewKeyService creates a new KeyService.
func NewKeyService(db *gorm.DB, cfg *config.GatewayConfig) *KeyService {
	return &KeyService{db: db, config: cfg}
}

// GenerateVirtualKey creates a new virtual API key for a user.
func (s *KeyService) GenerateVirtualKey(userID uint, name string) (*model.AIVirtualKey, error) {
	keyStr, err := generateKeyString()
	if err != nil {
		return nil, err
	}

	vk := &model.AIVirtualKey{
		Key:       keyStr,
		UserID:    userID,
		Name:      name,
		Quota:     s.config.DefaultQuota,
		UsedQuota: 0,
		RateLimit: s.config.DefaultRPM,
		Status:    model.VirtualKeyStatusActive,
	}

	if err := s.db.Create(vk).Error; err != nil {
		return nil, err
	}

	return vk, nil
}

// ValidateKey checks if a key string is valid and returns the virtual key.
func (s *KeyService) ValidateKey(keyString string) (*model.AIVirtualKey, error) {
	var vk model.AIVirtualKey
	if err := s.db.Where("key = ? AND status = ?", keyString, model.VirtualKeyStatusActive).First(&vk).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrKeyNotFound
		}
		return nil, err
	}

	if vk.Status == model.VirtualKeyStatusRevoked {
		return nil, ErrKeyRevoked
	}

	if vk.ExpiresAt != nil && vk.ExpiresAt.Before(time.Now()) {
		return nil, ErrKeyExpired
	}

	if vk.Quota > 0 && vk.UsedQuota >= vk.Quota {
		return nil, ErrQuotaExceeded
	}

	return &vk, nil
}

// RevokeKey revokes a virtual key by ID.
func (s *KeyService) RevokeKey(keyID uint) error {
	result := s.db.Model(&model.AIVirtualKey{}).Where("id = ? AND status = ?", keyID, model.VirtualKeyStatusActive).
		Update("status", model.VirtualKeyStatusRevoked)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrKeyNotFound
	}
	return nil
}

// GetUserKeys returns all virtual keys for a user.
func (s *KeyService) GetUserKeys(userID uint) ([]model.AIVirtualKey, error) {
	var keys []model.AIVirtualKey
	if err := s.db.Where("user_id = ?", userID).Find(&keys).Error; err != nil {
		return nil, err
	}
	return keys, nil
}

// generateKeyString creates a random key in the format "sk-opc-" + 32 hex chars.
func generateKeyString() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return "sk-opc-" + hex.EncodeToString(bytes), nil
}
