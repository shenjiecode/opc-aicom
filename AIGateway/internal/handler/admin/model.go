package admin

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/aigateway/internal/model"
	"github.com/opc-aicom/aigateway/internal/pkg/response"
	"github.com/shopspring/decimal"
)

// ModelService defines the interface for model operations
type ModelService interface {
	CreateModel(m *model.AIModel) error
	GetModelByID(id uint) (*model.AIModel, error)
	GetModelByName(name string) (*model.AIModel, error)
	GetAllModels() ([]*model.AIModel, error)
	GetActiveModels() ([]*model.AIModel, error)
	UpdateModel(m *model.AIModel) error
	DeleteModel(id uint) error
	GetModelsByChannelID(channelID uint) ([]*model.AIModel, error)
}

// ModelCreateRequest represents the request body for creating a model
type ModelCreateRequest struct {
	Name        string `json:"name" binding:"required"`
	Provider    string `json:"provider" binding:"required"`
	ChannelID   uint   `json:"channel_id" binding:"required"`
	InputPrice  string `json:"input_price"`
	OutputPrice string `json:"output_price"`
	MaxTokens   int    `json:"max_tokens" binding:"required"`
}

// ModelUpdateRequest represents the request body for updating a model
type ModelUpdateRequest struct {
	Name        string `json:"name"`
	Provider    string `json:"provider"`
	ChannelID   uint   `json:"channel_id"`
	InputPrice  string `json:"input_price"`
	OutputPrice string `json:"output_price"`
	MaxTokens   int    `json:"max_tokens"`
	Status      string `json:"status"`
}

// ListModelsHandler handles GET /admin/models
func ListModelsHandler(modelService ModelService) gin.HandlerFunc {
	return func(c *gin.Context) {
		models, err := modelService.GetAllModels()
		if err != nil {
			response.InternalError(c, "failed to get models: "+err.Error())
			return
		}

		response.Success(c, models)
	}
}

// GetModelHandler handles GET /admin/models/:id
func GetModelHandler(modelService ModelService) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.ParseUint(idStr, 10, 64)
		if err != nil {
			response.BadRequest(c, "invalid model id")
			return
		}

		m, err := modelService.GetModelByID(uint(id))
		if err != nil {
			response.NotFound(c, "model not found")
			return
		}

		response.Success(c, m)
	}
}

// CreateModelHandler handles POST /admin/models
func CreateModelHandler(modelService ModelService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req ModelCreateRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.BadRequest(c, "invalid request body: "+err.Error())
			return
		}

		inputPrice, _ := decimal.NewFromString(req.InputPrice)
		if inputPrice.IsZero() {
			inputPrice = decimal.NewFromFloat(0.001)
		}

		outputPrice, _ := decimal.NewFromString(req.OutputPrice)
		if outputPrice.IsZero() {
			outputPrice = decimal.NewFromFloat(0.002)
		}

		m := &model.AIModel{
			Name:        req.Name,
			Provider:    req.Provider,
			ChannelID:   req.ChannelID,
			InputPrice:  inputPrice,
			OutputPrice: outputPrice,
			MaxTokens:   req.MaxTokens,
			Status:      model.ModelStatusActive,
		}

		if err := modelService.CreateModel(m); err != nil {
			response.InternalError(c, "failed to create model: "+err.Error())
			return
		}

		response.SuccessWithStatus(c, http.StatusCreated, m)
	}
}

// UpdateModelHandler handles PUT /admin/models/:id
func UpdateModelHandler(modelService ModelService) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.ParseUint(idStr, 10, 64)
		if err != nil {
			response.BadRequest(c, "invalid model id")
			return
		}

		existing, err := modelService.GetModelByID(uint(id))
		if err != nil {
			response.NotFound(c, "model not found")
			return
		}

		var req ModelUpdateRequest
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
		if req.ChannelID != 0 {
			existing.ChannelID = req.ChannelID
		}
		if req.InputPrice != "" {
			if price, err := decimal.NewFromString(req.InputPrice); err == nil {
				existing.InputPrice = price
			}
		}
		if req.OutputPrice != "" {
			if price, err := decimal.NewFromString(req.OutputPrice); err == nil {
				existing.OutputPrice = price
			}
		}
		if req.MaxTokens > 0 {
			existing.MaxTokens = req.MaxTokens
		}
		if req.Status != "" {
			existing.Status = model.ModelStatus(req.Status)
		}

		if err := modelService.UpdateModel(existing); err != nil {
			response.InternalError(c, "failed to update model: "+err.Error())
			return
		}

		response.Success(c, existing)
	}
}

// DeleteModelHandler handles DELETE /admin/models/:id
func DeleteModelHandler(modelService ModelService) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.ParseUint(idStr, 10, 64)
		if err != nil {
			response.BadRequest(c, "invalid model id")
			return
		}

		if err := modelService.DeleteModel(uint(id)); err != nil {
			response.InternalError(c, "failed to delete model: "+err.Error())
			return
		}

		response.Success(c, gin.H{"id": id})
	}
}

// ListModelsByChannelHandler handles GET /admin/channels/:channel_id/models
func ListModelsByChannelHandler(modelService ModelService) gin.HandlerFunc {
	return func(c *gin.Context) {
		channelIDStr := c.Param("channel_id")
		channelID, err := strconv.ParseUint(channelIDStr, 10, 64)
		if err != nil {
			response.BadRequest(c, "invalid channel id")
			return
		}

		models, err := modelService.GetModelsByChannelID(uint(channelID))
		if err != nil {
			response.InternalError(c, "failed to get models: "+err.Error())
			return
		}

		response.Success(c, models)
	}
}
