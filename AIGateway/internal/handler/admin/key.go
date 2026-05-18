package admin

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/aigateway/internal/model"
	"github.com/opc-aicom/aigateway/internal/pkg/response"
)

// KeyService defines the interface for virtual key operations
type KeyService interface {
	CreateKey(key *model.AIVirtualKey) error
	GetKeyByID(id uint) (*model.AIVirtualKey, error)
	GetKeyByKey(key string) (*model.AIVirtualKey, error)
	GetKeysByUserID(userID uint) ([]*model.AIVirtualKey, error)
	GetAllKeys() ([]*model.AIVirtualKey, error)
	UpdateKey(key *model.AIVirtualKey) error
	DeleteKey(id uint) error
	ValidateKey(key string) (*model.AIVirtualKey, error)
	RevokeKey(id uint) error
}

// KeyCreateRequest represents the request body for creating a virtual key
type KeyCreateRequest struct {
	UserID    uint   `json:"user_id" binding:"required"`
	Name      string `json:"name" binding:"required"`
	Quota     int64  `json:"quota"`
	RateLimit int    `json:"rate_limit"`
	ExpiresAt string `json:"expires_at"`
}

// KeyUpdateRequest represents the request body for updating a virtual key
type KeyUpdateRequest struct {
	Name      string `json:"name"`
	Quota     int64  `json:"quota"`
	RateLimit int    `json:"rate_limit"`
	Status    string `json:"status"`
	ExpiresAt string `json:"expires_at"`
}

// KeyResponse represents the response for a virtual key (without sensitive data)
type KeyResponse struct {
	ID        uint    `json:"id"`
	Key       string  `json:"key"`
	UserID    uint    `json:"user_id"`
	Name      string  `json:"name"`
	Quota     int64   `json:"quota"`
	UsedQuota int64   `json:"used_quota"`
	RateLimit int     `json:"rate_limit"`
	Status    string  `json:"status"`
	ExpiresAt *string `json:"expires_at,omitempty"`
	CreatedAt string  `json:"created_at"`
	UpdatedAt string  `json:"updated_at"`
}

// generateKey generates a random API key
func generateKey() string {
	bytes := make([]byte, 24)
	rand.Read(bytes)
	return "sk-" + hex.EncodeToString(bytes)
}

// toKeyResponse converts AIVirtualKey to KeyResponse
func toKeyResponse(key *model.AIVirtualKey) KeyResponse {
	resp := KeyResponse{
		ID:        key.ID,
		Key:       key.Key,
		UserID:    key.UserID,
		Name:      key.Name,
		Quota:     key.Quota,
		UsedQuota: key.UsedQuota,
		RateLimit: key.RateLimit,
		Status:    string(key.Status),
		CreatedAt: key.CreatedAt.Format(time.RFC3339),
		UpdatedAt: key.UpdatedAt.Format(time.RFC3339),
	}
	if key.ExpiresAt != nil {
		expires := key.ExpiresAt.Format(time.RFC3339)
		resp.ExpiresAt = &expires
	}
	return resp
}

// ListKeysHandler handles GET /admin/keys
func ListKeysHandler(keyService KeyService) gin.HandlerFunc {
	return func(c *gin.Context) {
		keys, err := keyService.GetAllKeys()
		if err != nil {
			response.InternalError(c, "failed to get keys: "+err.Error())
			return
		}

		data := make([]KeyResponse, 0, len(keys))
		for _, k := range keys {
			data = append(data, toKeyResponse(k))
		}

		response.Success(c, data)
	}
}

// GetKeyHandler handles GET /admin/keys/:id
func GetKeyHandler(keyService KeyService) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.ParseUint(idStr, 10, 64)
		if err != nil {
			response.BadRequest(c, "invalid key id")
			return
		}

		key, err := keyService.GetKeyByID(uint(id))
		if err != nil {
			response.NotFound(c, "key not found")
			return
		}

		response.Success(c, toKeyResponse(key))
	}
}

// CreateKeyHandler handles POST /admin/keys
func CreateKeyHandler(keyService KeyService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req KeyCreateRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.BadRequest(c, "invalid request body: "+err.Error())
			return
		}

		key := &model.AIVirtualKey{
			Key:       generateKey(),
			UserID:    req.UserID,
			Name:      req.Name,
			Quota:     req.Quota,
			RateLimit: req.RateLimit,
			Status:    model.VirtualKeyStatusActive,
		}

		if key.RateLimit <= 0 {
			key.RateLimit = 60
		}

		if req.ExpiresAt != "" {
			expiresAt, err := time.Parse(time.RFC3339, req.ExpiresAt)
			if err != nil {
				response.BadRequest(c, "invalid expires_at format, use RFC3339")
				return
			}
			key.ExpiresAt = &expiresAt
		}

		if err := keyService.CreateKey(key); err != nil {
			response.InternalError(c, "failed to create key: "+err.Error())
			return
		}

		response.SuccessWithStatus(c, http.StatusCreated, toKeyResponse(key))
	}
}

// UpdateKeyHandler handles PUT /admin/keys/:id
func UpdateKeyHandler(keyService KeyService) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.ParseUint(idStr, 10, 64)
		if err != nil {
			response.BadRequest(c, "invalid key id")
			return
		}

		existing, err := keyService.GetKeyByID(uint(id))
		if err != nil {
			response.NotFound(c, "key not found")
			return
		}

		var req KeyUpdateRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.BadRequest(c, "invalid request body: "+err.Error())
			return
		}

		if req.Name != "" {
			existing.Name = req.Name
		}
		if req.Quota != 0 {
			existing.Quota = req.Quota
		}
		if req.RateLimit > 0 {
			existing.RateLimit = req.RateLimit
		}
		if req.Status != "" {
			existing.Status = model.VirtualKeyStatus(req.Status)
		}
		if req.ExpiresAt != "" {
			expiresAt, err := time.Parse(time.RFC3339, req.ExpiresAt)
			if err != nil {
				response.BadRequest(c, "invalid expires_at format, use RFC3339")
				return
			}
			existing.ExpiresAt = &expiresAt
		}

		if err := keyService.UpdateKey(existing); err != nil {
			response.InternalError(c, "failed to update key: "+err.Error())
			return
		}

		response.Success(c, toKeyResponse(existing))
	}
}

// DeleteKeyHandler handles DELETE /admin/keys/:id
func DeleteKeyHandler(keyService KeyService) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.ParseUint(idStr, 10, 64)
		if err != nil {
			response.BadRequest(c, "invalid key id")
			return
		}

		if err := keyService.DeleteKey(uint(id)); err != nil {
			response.InternalError(c, "failed to delete key: "+err.Error())
			return
		}

		response.Success(c, gin.H{"id": id})
	}
}

// RevokeKeyHandler handles POST /admin/keys/:id/revoke
func RevokeKeyHandler(keyService KeyService) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.ParseUint(idStr, 10, 64)
		if err != nil {
			response.BadRequest(c, "invalid key id")
			return
		}

		if err := keyService.RevokeKey(uint(id)); err != nil {
			response.InternalError(c, "failed to revoke key: "+err.Error())
			return
		}

		response.Success(c, gin.H{"id": id, "status": "revoked"})
	}
}

// ListKeysByUserHandler handles GET /admin/users/:user_id/keys
func ListKeysByUserHandler(keyService KeyService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr := c.Param("user_id")
		userID, err := strconv.ParseUint(userIDStr, 10, 64)
		if err != nil {
			response.BadRequest(c, "invalid user id")
			return
		}

		keys, err := keyService.GetKeysByUserID(uint(userID))
		if err != nil {
			response.InternalError(c, "failed to get keys: "+err.Error())
			return
		}

		data := make([]KeyResponse, 0, len(keys))
		for _, k := range keys {
			data = append(data, toKeyResponse(k))
		}

		response.Success(c, data)
	}
}
