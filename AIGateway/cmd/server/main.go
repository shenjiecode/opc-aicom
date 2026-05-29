package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/aigateway/internal/config"
	"github.com/opc-aicom/aigateway/internal/middleware"
	"github.com/opc-aicom/aigateway/internal/model"
	"github.com/opc-aicom/aigateway/internal/provider"
	"github.com/opc-aicom/aigateway/internal/service"
	"github.com/shopspring/decimal"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		cfg.Database.User, cfg.Database.Password,
		cfg.Database.Host, cfg.Database.Port, cfg.Database.DBName)

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	if err := db.AutoMigrate(
		&model.AIChannel{},
		&model.AIModel{},
		&model.AIVirtualKey{},
		&model.AITokenLog{},
		&model.AIModelPrice{},
	); err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	keyService := service.NewKeyService(db, &cfg.Gateway)
	channelService := service.NewChannelService(db)
	modelService := service.NewModelService(db)
	usageService := service.NewUsageService(db)

	gin.SetMode(cfg.Server.Mode)
	engine := gin.Default()

	engine.Use(func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin == "" {
			origin = "*"
		}
		c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// === OpenAI-compatible endpoints ===
	v1 := engine.Group("/v1")
	v1.Use(middleware.AuthMiddleware(keyService))
	v1.Use(middleware.RateLimitMiddleware())
	v1.Use(middleware.QuotaMiddleware())
	{
		// POST /v1/chat/completions
		v1.POST("/chat/completions", chatCompletionHandler(channelService, usageService))

		// GET /v1/models
		v1.GET("/models", listModelsHandler(channelService))

		// GET /v1/models/:id
		v1.GET("/models/:id", getModelHandler(channelService))
	}

	// === Admin endpoints ===
	adminGroup := engine.Group("/admin")
	{
		// Channel CRUD
		adminGroup.GET("/channels", listChannelsHandler(channelService))
		adminGroup.GET("/channels/:id", getChannelHandler(channelService))
		adminGroup.POST("/channels", createChannelHandler(channelService))
		adminGroup.PUT("/channels/:id", updateChannelHandler(channelService))
		adminGroup.DELETE("/channels/:id", deleteChannelHandler(channelService))
		adminGroup.POST("/channels/:id/test", testChannelHandler())

		// Model CRUD
		adminGroup.GET("/models", listModelsAdminHandler(modelService))
		adminGroup.POST("/models", createModelAdminHandler(modelService))
		adminGroup.PUT("/models/:id", updateModelAdminHandler(modelService))
		adminGroup.DELETE("/models/:id", deleteModelAdminHandler(modelService))
		adminGroup.POST("/models/sync-bailian", syncBailianModelsHandler(channelService, modelService))

		// Virtual Key CRUD
		adminGroup.GET("/keys", listKeysAdminHandler(keyService))
		adminGroup.POST("/keys", createKeyHandler(keyService))
		adminGroup.DELETE("/keys/:id", revokeKeyHandler(keyService))

		// Usage
		adminGroup.GET("/usage", usageHandler(usageService))
		adminGroup.GET("/usage/user/:user_id", userUsageHandler(usageService))
		adminGroup.GET("/usage/key/:key_id", keyUsageHandler(usageService))

		// Bailian models
		adminGroup.GET("/bailian/models", bailianModelsHandler(channelService))
	}

	engine.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "aigateway"})
	})

	addr := fmt.Sprintf(":%d", cfg.Server.Port)
	log.Printf("AIGateway server starting on %s", addr)
	if err := engine.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// === OpenAI-compatible handlers ===

func chatCompletionHandler(cs *service.ChannelService, us *service.UsageService) gin.HandlerFunc {
	return func(c *gin.Context) {
		startTime := time.Now()
		virtualKey := middleware.GetVirtualKey(c)
		if virtualKey == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": gin.H{"message": "no virtual key found"}})
			return
		}

		var req provider.ChatRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid request: " + err.Error()}})
			return
		}

		// Find channel for model
		ch, err := cs.SelectChannelForModel(req.Model)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "model not found or no available channels: " + err.Error()}})
			return
		}

		// Create provider
		var p provider.Provider
		switch ch.Provider {
		case "openai":
			p = provider.NewOpenAIProvider(provider.ProviderConfig{APIKey: ch.APIKey, BaseURL: ch.BaseURL})
		case "deepseek":
			p = provider.NewDeepSeekProvider(provider.ProviderConfig{APIKey: ch.APIKey, BaseURL: ch.BaseURL})
		case "anthropic":
			p = provider.NewAnthropicProvider(provider.ProviderConfig{APIKey: ch.APIKey, BaseURL: ch.BaseURL})
		case "alibaba":
			p = provider.NewBailianProvider(provider.ProviderConfig{APIKey: ch.APIKey, BaseURL: ch.BaseURL})
		default:
			p = provider.NewOpenAIProvider(provider.ProviderConfig{APIKey: ch.APIKey, BaseURL: ch.BaseURL})
		}

		// Handle streaming
		if req.Stream {
			handleStream(c, p, &req, us, virtualKey.ID, ch.ID, startTime)
			return
		}

		// Non-streaming
		resp, err := p.ChatCompletion(c.Request.Context(), &req)
		if err != nil {
			latencyMs := int(time.Since(startTime).Milliseconds())
			_ = us.RecordFailedUsage(virtualKey.ID, ch.ID, req.Model, err.Error())
			_ = latencyMs
			c.JSON(http.StatusBadGateway, gin.H{"error": gin.H{"message": err.Error()}})
			return
		}

		// Record usage
		latencyMs := int(time.Since(startTime).Milliseconds())
		cost := calculateCost(resp.Usage.PromptTokens, resp.Usage.CompletionTokens, req.Model)
		_ = us.RecordUsage(virtualKey.ID, ch.ID, req.Model, resp.Usage.PromptTokens, resp.Usage.CompletionTokens, cost)
		_ = latencyMs // latency tracked but not used in record for now
		c.JSON(http.StatusOK, resp)
	}
}

func handleStream(c *gin.Context, p provider.Provider, req *provider.ChatRequest, us *service.UsageService, keyID, channelID uint, startTime time.Time) {
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")

	ch, err := p.StreamChatCompletion(c.Request.Context(), req)
	if err != nil {
		_ = us.RecordFailedUsage(keyID, channelID, req.Model, err.Error())
		fmt.Fprintf(c.Writer, "data: {\"error\": \"%s\"}\n\n", err.Error())
		c.Writer.Flush()
		return
	}

	var totalContent string
	for event := range ch {
		switch event.Event {
		case "message":
			fmt.Fprintf(c.Writer, "data: %s\n\n", event.Data)
			c.Writer.Flush()
			// Try to extract content for token estimation
			var chunk map[string]interface{}
			if jsonErr := json.Unmarshal([]byte(event.Data), &chunk); jsonErr == nil {
				if choices, ok := chunk["choices"].([]interface{}); ok && len(choices) > 0 {
					if choice, ok := choices[0].(map[string]interface{}); ok {
						if delta, ok := choice["delta"].(map[string]interface{}); ok {
							if content, ok := delta["content"].(string); ok {
								totalContent += content
							}
						}
					}
				}
			}
		case "done":
			fmt.Fprintf(c.Writer, "data: [DONE]\n\n")
			c.Writer.Flush()
		case "error":
			fmt.Fprintf(c.Writer, "data: {\"error\": \"%s\"}\n\n", event.Data)
			c.Writer.Flush()
		}
	}

	// Estimate tokens from content (rough: 4 chars = 1 token)
	estimatedTokens := len(totalContent) / 4
	if estimatedTokens < 1 {
		estimatedTokens = 1
	}
	cost := calculateCost(0, estimatedTokens, req.Model)
	_ = us.RecordUsage(keyID, channelID, req.Model, 0, estimatedTokens, cost)
}

func listModelsHandler(cs *service.ChannelService) gin.HandlerFunc {
	return func(c *gin.Context) {
		channels, err := cs.ListChannels()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
			return
		}

		modelMap := map[string]bool{}
		data := []gin.H{}
		for _, ch := range channels {
			if ch.Status != model.ChannelStatusActive {
				continue
			}
			// Parse models from channel
			var models []string
			if ch.Models != "" {
				if jsonErr := json.Unmarshal([]byte(ch.Models), &models); jsonErr != nil {
					models = []string{ch.Models}
				}
			}
			for _, m := range models {
				if !modelMap[m] {
					modelMap[m] = true
					data = append(data, gin.H{
						"id":       m,
						"object":   "model",
						"created":  time.Now().Unix(),
						"owned_by": ch.Provider,
					})
				}
			}
		}

		c.JSON(http.StatusOK, gin.H{"object": "list", "data": data})
	}
}

func getModelHandler(cs *service.ChannelService) gin.HandlerFunc {
	return func(c *gin.Context) {
		modelID := c.Param("id")
		c.JSON(http.StatusOK, gin.H{
			"id":      modelID,
			"object":  "model",
			"created": time.Now().Unix(),
		})
	}
}

// === Admin handlers ===

func listChannelsHandler(cs *service.ChannelService) gin.HandlerFunc {
	return func(c *gin.Context) {
		channels, err := cs.ListChannels()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"code": 0, "message": "ok", "data": channels})
	}
}

func getChannelHandler(cs *service.ChannelService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
		ch, err := cs.GetChannel(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"code": 1, "message": "channel not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"code": 0, "message": "ok", "data": ch})
	}
}

func createChannelHandler(cs *service.ChannelService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Name     string `json:"name" binding:"required"`
			Provider string `json:"provider" binding:"required"`
			BaseURL  string `json:"base_url" binding:"required"`
			APIKey   string `json:"api_key" binding:"required"`
			Models   string `json:"models"`
			Weight   int    `json:"weight"`
			Priority int    `json:"priority"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": err.Error()})
			return
		}
		ch, err := cs.CreateChannel(req.Provider, req.Name, req.BaseURL, req.APIKey, req.Models)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
			return
		}
		if req.Weight > 0 {
			cs.UpdateChannel(ch.ID, map[string]interface{}{"weight": req.Weight})
		}
		if req.Priority > 0 {
			cs.UpdateChannel(ch.ID, map[string]interface{}{"priority": req.Priority})
		}
		c.JSON(http.StatusOK, gin.H{"code": 0, "message": "ok", "data": ch})
	}
}

func updateChannelHandler(cs *service.ChannelService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
		var updates map[string]interface{}
		if err := c.ShouldBindJSON(&updates); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": err.Error()})
			return
		}
		if err := cs.UpdateChannel(uint(id), updates); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"code": 0, "message": "ok"})
	}
}

func deleteChannelHandler(cs *service.ChannelService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
		if err := cs.DeleteChannel(uint(id)); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"code": 0, "message": "ok"})
	}
}

func testChannelHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"code": 0, "message": "channel test not implemented yet"})
	}
}

func listModelsAdminHandler(ms *service.ModelService) gin.HandlerFunc {
	return func(c *gin.Context) {
		models, err := ms.ListModels()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"code": 0, "message": "ok", "data": models})
	}
}

func createModelAdminHandler(ms *service.ModelService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Name        string `json:"name" binding:"required"`
			Provider    string `json:"provider" binding:"required"`
			ChannelID   uint   `json:"channel_id" binding:"required"`
			InputPrice  string `json:"input_price"`
			OutputPrice string `json:"output_price"`
			MaxTokens   int    `json:"max_tokens" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": err.Error()})
			return
		}

		inputPrice, _ := decimal.NewFromString(req.InputPrice)
		if inputPrice.IsZero() {
			inputPrice = decimal.NewFromFloat(0.002)
		}
		outputPrice, _ := decimal.NewFromString(req.OutputPrice)
		if outputPrice.IsZero() {
			outputPrice = decimal.NewFromFloat(0.006)
		}

		m, err := ms.CreateModel(req.Name, req.Provider, req.ChannelID, inputPrice, outputPrice, req.MaxTokens)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"code": 0, "message": "ok", "data": m})
	}
}

func updateModelAdminHandler(ms *service.ModelService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
		var updates map[string]interface{}
		if err := c.ShouldBindJSON(&updates); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": err.Error()})
			return
		}
		if err := ms.UpdateModel(uint(id), updates); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"code": 0, "message": "ok"})
	}
}

func deleteModelAdminHandler(ms *service.ModelService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
		if err := ms.DeleteModel(uint(id)); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"code": 0, "message": "ok"})
	}
}

func syncBailianModelsHandler(cs *service.ChannelService, ms *service.ModelService) gin.HandlerFunc {
	return func(c *gin.Context) {
		channels, err := cs.GetChannelsByProvider("alibaba")
		if err != nil || len(channels) == 0 {
			c.JSON(http.StatusNotFound, gin.H{"code": 1, "message": "no alibaba channel configured"})
			return
		}

		ch := channels[0]
		p := provider.NewBailianProvider(provider.ProviderConfig{APIKey: ch.APIKey, BaseURL: ch.BaseURL})
		bailianModels, err := p.ListModels(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": "failed to fetch bailian models: " + err.Error()})
			return
		}

		synced, err := ms.SyncBailianModels(ch.ID, bailianModels)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": "failed to sync models: " + err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"code": 0, "message": "ok", "data": gin.H{"synced": synced, "total": len(bailianModels)}})
	}
}

func listKeysAdminHandler(ks *service.KeyService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var keys []model.AIVirtualKey
		if err := ks.DB().Find(&keys).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"code": 0, "message": "ok", "data": keys})
	}
}

func createKeyHandler(ks *service.KeyService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			UserID uint   `json:"user_id" binding:"required"`
			Name   string `json:"name"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": err.Error()})
			return
		}
		name := req.Name
		if name == "" {
			name = "Default Key"
		}
		vk, err := ks.GenerateVirtualKey(req.UserID, name)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"code": 0, "message": "ok", "data": vk})
	}
}

func revokeKeyHandler(ks *service.KeyService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
		if err := ks.RevokeKey(uint(id)); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"code": 0, "message": "ok"})
	}
}

func usageHandler(us *service.UsageService) gin.HandlerFunc {
	return func(c *gin.Context) {
		now := time.Now()
		start := now.AddDate(0, -1, 0)
		summary, err := us.GetUserUsage(0, start, now)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"code": 0, "message": "ok", "data": summary})
	}
}

func userUsageHandler(us *service.UsageService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := strconv.ParseUint(c.Param("user_id"), 10, 64)
		now := time.Now()
		start := now.AddDate(0, -1, 0)
		summary, err := us.GetUserUsage(uint(userID), start, now)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"code": 0, "message": "ok", "data": summary})
	}
}

func keyUsageHandler(us *service.UsageService) gin.HandlerFunc {
	return func(c *gin.Context) {
		keyID, _ := strconv.ParseUint(c.Param("key_id"), 10, 64)
		now := time.Now()
		start := now.AddDate(0, -1, 0)
		summary, err := us.GetKeyUsage(uint(keyID), start, now)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"code": 0, "message": "ok", "data": summary})
	}
}

func calculateCost(promptTokens, completionTokens int, modelName string) decimal.Decimal {
	return decimal.NewFromInt(int64(promptTokens + completionTokens)).Mul(decimal.NewFromFloat(0.001))
}

func bailianModelsHandler(cs *service.ChannelService) gin.HandlerFunc {
	return func(c *gin.Context) {
		channels, err := cs.GetChannelsByProvider("alibaba")
		if err != nil || len(channels) == 0 {
			c.JSON(http.StatusNotFound, gin.H{"code": 1, "message": "no alibaba channel configured"})
			return
		}

		ch := channels[0]
		p := provider.NewBailianProvider(provider.ProviderConfig{APIKey: ch.APIKey, BaseURL: ch.BaseURL})
		models, err := p.ListModels(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": "failed to fetch bailian models: " + err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"code": 0, "message": "ok", "data": models})
	}
}
