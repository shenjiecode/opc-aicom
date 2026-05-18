package admin

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/aigateway/internal/model"
	"github.com/opc-aicom/aigateway/internal/pkg/response"
)

// ChannelService defines the interface for channel operations
type ChannelService interface {
	CreateChannel(channel *model.AIChannel) error
	GetChannelByID(id uint) (*model.AIChannel, error)
	GetAllChannels() ([]*model.AIChannel, error)
	UpdateChannel(channel *model.AIChannel) error
	DeleteChannel(id uint) error
	UpdateChannelStatus(id uint, status model.ChannelStatus) error
}

// ChannelCreateRequest represents the request body for creating a channel
type ChannelCreateRequest struct {
	Name      string `json:"name" binding:"required"`
	Provider  string `json:"provider" binding:"required"`
	BaseURL   string `json:"base_url" binding:"required"`
	APIKey    string `json:"api_key" binding:"required"`
	Models    string `json:"models"`
	Weight    int    `json:"weight"`
	Priority  int    `json:"priority"`
	MaxRetries int   `json:"max_retries"`
}

// ChannelUpdateRequest represents the request body for updating a channel
type ChannelUpdateRequest struct {
	Name       string `json:"name"`
	Provider   string `json:"provider"`
	BaseURL    string `json:"base_url"`
	APIKey     string `json:"api_key"`
	Models     string `json:"models"`
	Weight     int    `json:"weight"`
	Priority   int    `json:"priority"`
	MaxRetries int    `json:"max_retries"`
	Status     string `json:"status"`
}

// ListChannelsHandler handles GET /admin/channels
func ListChannelsHandler(channelService ChannelService) gin.HandlerFunc {
	return func(c *gin.Context) {
		channels, err := channelService.GetAllChannels()
		if err != nil {
			response.InternalError(c, "failed to get channels: "+err.Error())
			return
		}

		response.Success(c, channels)
	}
}

// GetChannelHandler handles GET /admin/channels/:id
func GetChannelHandler(channelService ChannelService) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.ParseUint(idStr, 10, 64)
		if err != nil {
			response.BadRequest(c, "invalid channel id")
			return
		}

		channel, err := channelService.GetChannelByID(uint(id))
		if err != nil {
			response.NotFound(c, "channel not found")
			return
		}

		response.Success(c, channel)
	}
}

// CreateChannelHandler handles POST /admin/channels
func CreateChannelHandler(channelService ChannelService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req ChannelCreateRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.BadRequest(c, "invalid request body: "+err.Error())
			return
		}

		channel := &model.AIChannel{
			Name:      req.Name,
			Provider:  req.Provider,
			BaseURL:   req.BaseURL,
			APIKey:    req.APIKey,
			Models:    req.Models,
			Weight:    req.Weight,
			Priority:  req.Priority,
			MaxRetries: req.MaxRetries,
			Status:    model.ChannelStatusActive,
		}

		if channel.Weight <= 0 {
			channel.Weight = 1
		}
		if channel.MaxRetries <= 0 {
			channel.MaxRetries = 3
		}

		if err := channelService.CreateChannel(channel); err != nil {
			response.InternalError(c, "failed to create channel: "+err.Error())
			return
		}

		response.SuccessWithStatus(c, http.StatusCreated, channel)
	}
}

// UpdateChannelHandler handles PUT /admin/channels/:id
func UpdateChannelHandler(channelService ChannelService) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.ParseUint(idStr, 10, 64)
		if err != nil {
			response.BadRequest(c, "invalid channel id")
			return
		}

		existing, err := channelService.GetChannelByID(uint(id))
		if err != nil {
			response.NotFound(c, "channel not found")
			return
		}

		var req ChannelUpdateRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.BadRequest(c, "invalid request body: "+err.Error())
			return
		}

		if req.Name != "" {
			existing.Name = req.Name
		}
		if req.Provider != "" {
			existing.Provider = req.Provider
		}
		if req.BaseURL != "" {
			existing.BaseURL = req.BaseURL
		}
		if req.APIKey != "" {
			existing.APIKey = req.APIKey
		}
		if req.Models != "" {
			existing.Models = req.Models
		}
		if req.Weight > 0 {
			existing.Weight = req.Weight
		}
		if req.Priority != 0 {
			existing.Priority = req.Priority
		}
		if req.MaxRetries > 0 {
			existing.MaxRetries = req.MaxRetries
		}
		if req.Status != "" {
			existing.Status = model.ChannelStatus(req.Status)
		}

		if err := channelService.UpdateChannel(existing); err != nil {
			response.InternalError(c, "failed to update channel: "+err.Error())
			return
		}

		response.Success(c, existing)
	}
}

// DeleteChannelHandler handles DELETE /admin/channels/:id
func DeleteChannelHandler(channelService ChannelService) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.ParseUint(idStr, 10, 64)
		if err != nil {
			response.BadRequest(c, "invalid channel id")
			return
		}

		if err := channelService.DeleteChannel(uint(id)); err != nil {
			response.InternalError(c, "failed to delete channel: "+err.Error())
			return
		}

		response.Success(c, gin.H{"id": id})
	}
}

// UpdateChannelStatusHandler handles PUT /admin/channels/:id/status
func UpdateChannelStatusHandler(channelService ChannelService) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.ParseUint(idStr, 10, 64)
		if err != nil {
			response.BadRequest(c, "invalid channel id")
			return
		}

		var req struct {
			Status string `json:"status" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			response.BadRequest(c, "invalid request body: "+err.Error())
			return
		}

		status := model.ChannelStatus(req.Status)
		if status != model.ChannelStatusActive && status != model.ChannelStatusDisabled {
			response.BadRequest(c, "invalid status, must be 'active' or 'disabled'")
			return
		}

		if err := channelService.UpdateChannelStatus(uint(id), status); err != nil {
			response.InternalError(c, "failed to update channel status: "+err.Error())
			return
		}

		response.Success(c, gin.H{"id": id, "status": req.Status})
	}
}
