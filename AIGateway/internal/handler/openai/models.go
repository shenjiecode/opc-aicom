package openai

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/aigateway/internal/model"
	"github.com/opc-aicom/aigateway/internal/pkg/response"
)

// ModelService defines the interface for model operations
type ModelService interface {
	GetAllModels() ([]*model.AIModel, error)
	GetModelByName(name string) (*model.AIModel, error)
	GetActiveModels() ([]*model.AIModel, error)
}

// ModelResponse represents the OpenAI-compatible model response
type ModelResponse struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	OwnedBy string `json:"owned_by"`
}

// ModelListResponse represents the OpenAI-compatible model list response
type ModelListResponse struct {
	Object string          `json:"object"`
	Data   []ModelResponse `json:"data"`
}

// ModelsHandler handles GET /v1/models - list available models
func ModelsHandler(modelService ModelService) gin.HandlerFunc {
	return func(c *gin.Context) {
		models, err := modelService.GetActiveModels()
		if err != nil {
			response.InternalError(c, "failed to get models: "+err.Error())
			return
		}

		data := make([]ModelResponse, 0, len(models))
		for _, m := range models {
			data = append(data, ModelResponse{
				ID:      m.Name,
				Object:  "model",
				Created: m.CreatedAt.Unix(),
				OwnedBy: m.Provider,
			})
		}

		c.JSON(http.StatusOK, ModelListResponse{
			Object: "list",
			Data:   data,
		})
	}
}

// GetModelHandler handles GET /v1/models/:id - get model info
func GetModelHandler(modelService ModelService) gin.HandlerFunc {
	return func(c *gin.Context) {
		modelID := c.Param("id")
		if modelID == "" {
			response.BadRequest(c, "model id is required")
			return
		}

		m, err := modelService.GetModelByName(modelID)
		if err != nil {
			response.NotFound(c, "model not found: "+modelID)
			return
		}

		c.JSON(http.StatusOK, ModelResponse{
			ID:      m.Name,
			Object:  "model",
			Created: m.CreatedAt.Unix(),
			OwnedBy: m.Provider,
		})
	}
}

// ModelDetailResponse represents detailed model information
type ModelDetailResponse struct {
	ID           string    `json:"id"`
	Object       string    `json:"object"`
	Created      int64     `json:"created"`
	OwnedBy      string    `json:"owned_by"`
	Provider     string    `json:"provider"`
	MaxTokens    int       `json:"max_tokens"`
	InputPrice   string    `json:"input_price"`
	OutputPrice  string    `json:"output_price"`
	Status       string    `json:"status"`
	ChannelID    uint      `json:"channel_id"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// GetModelDetailHandler handles GET /v1/models/:id/detail - get detailed model info
func GetModelDetailHandler(modelService ModelService) gin.HandlerFunc {
	return func(c *gin.Context) {
		modelID := c.Param("id")
		if modelID == "" {
			response.BadRequest(c, "model id is required")
			return
		}

		m, err := modelService.GetModelByName(modelID)
		if err != nil {
			response.NotFound(c, "model not found: "+modelID)
			return
		}

		c.JSON(http.StatusOK, ModelDetailResponse{
			ID:          m.Name,
			Object:      "model",
			Created:     m.CreatedAt.Unix(),
			OwnedBy:     m.Provider,
			Provider:    m.Provider,
			MaxTokens:   m.MaxTokens,
			InputPrice:  m.InputPrice.String(),
			OutputPrice: m.OutputPrice.String(),
			Status:      string(m.Status),
			ChannelID:   m.ChannelID,
			CreatedAt:   m.CreatedAt,
			UpdatedAt:   m.UpdatedAt,
		})
	}
}
