package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/model"
	"github.com/opc-aicom/backend/internal/pkg/llm"
	"github.com/opc-aicom/backend/internal/repository"
	"gorm.io/gorm"
)

type AgentChatHandler struct {
	instanceRepo *repository.AgentInstanceRepository
	registry     *llm.ProviderRegistry
}

func NewAgentChatHandler(db *gorm.DB) *AgentChatHandler {
	return &AgentChatHandler{
		instanceRepo: repository.NewAgentInstanceRepository(db),
		registry:     llm.InitDefaultRegistry(),
	}
}

type ChatRequest struct {
	Message string `json:"message" binding:"required"`
}

type ChatResponse struct {
	Response string `json:"response"`
	Model    string `json:"model"`
	Duration int64  `json:"duration_ms"`
}

func (h *AgentChatHandler) Chat(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "无效的ID"})
		return
	}

	var req ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误"})
		return
	}

	instance, err := h.instanceRepo.GetByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "实例不存在"})
		return
	}

	var config model.AgentConfig
	if instance.ConfigJSON != "" {
		_ = json.Unmarshal([]byte(instance.ConfigJSON), &config)
	}

	if config.Model == "" {
		config.Model = "gpt-4-turbo"
	}
	if config.Temperature == 0 {
		config.Temperature = 0.7
	}
	if config.MaxTokens == 0 {
		config.MaxTokens = 4096
	}

	executor := llm.NewAgentExecutor(h.registry)

	ctx, cancel := context.WithTimeout(c.Request.Context(), 60*time.Second)
	defer cancel()

	start := time.Now()
	response, err := executor.Execute(ctx, &config, req.Message, nil)
	duration := time.Since(start).Milliseconds()

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "LLM调用失败: " + err.Error(),
		})
		return
	}

	_ = h.instanceRepo.IncrementRuns(uint(id), true)

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": ChatResponse{
			Response: response,
			Model:    config.Model,
			Duration: duration,
		},
	})
}

func (h *AgentChatHandler) GetConfig(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "无效的ID"})
		return
	}

	instance, err := h.instanceRepo.GetByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "实例不存在"})
		return
	}

	var config model.AgentConfig
	if instance.ConfigJSON != "" {
		_ = json.Unmarshal([]byte(instance.ConfigJSON), &config)
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"instance": instance,
			"config":   config,
		},
	})
}

type UpdateConfigRequest struct {
	Model       string  `json:"model"`
	ApiKey      string  `json:"api_key"`
	ApiUrl      string  `json:"api_url"`
	Temperature float64 `json:"temperature"`
	MaxTokens   int     `json:"max_tokens"`
}

func (h *AgentChatHandler) UpdateConfig(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "无效的ID"})
		return
	}

	var req UpdateConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误"})
		return
	}

	instance, err := h.instanceRepo.GetByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "实例不存在"})
		return
	}

	var config model.AgentConfig
	if instance.ConfigJSON != "" {
		_ = json.Unmarshal([]byte(instance.ConfigJSON), &config)
	}

	if req.Model != "" {
		config.Model = req.Model
	}
	if req.Temperature > 0 {
		config.Temperature = req.Temperature
	}
	if req.MaxTokens > 0 {
		config.MaxTokens = req.MaxTokens
	}
	if req.ApiKey != "" {
		config.APIKey = req.ApiKey
	}
	if req.ApiUrl != "" {
		config.BaseURL = req.ApiUrl
	}
	configJSON, _ := json.Marshal(config)
	instance.ConfigJSON = string(configJSON)
	_ = h.instanceRepo.Update(instance)

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    config,
	})
}