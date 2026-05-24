package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/middleware"
	"github.com/opc-aicom/backend/internal/model"
	"github.com/opc-aicom/backend/internal/pkg/llm"
	"github.com/opc-aicom/backend/internal/repository"
	"gorm.io/gorm"
)

// EnterprisePublishHandler handles enterprise publish API endpoints
type EnterprisePublishHandler struct {
	db              *gorm.DB
	sessionRepo     *repository.RequirementSessionRepository
	taskRepo        *repository.TaskRepository
	registry        *llm.ProviderRegistry
	analysisTimeout time.Duration
}

// NewEnterprisePublishHandler creates a new enterprise publish handler
func NewEnterprisePublishHandler(db *gorm.DB, registry *llm.ProviderRegistry) *EnterprisePublishHandler {
	return &EnterprisePublishHandler{
		db:              db,
		sessionRepo:     repository.NewRequirementSessionRepository(db),
		taskRepo:        repository.NewTaskRepository(db),
		registry:        registry,
		analysisTimeout: 60 * time.Second,
	}
}

// WithAnalysisTimeout sets the analysis timeout
func (h *EnterprisePublishHandler) WithAnalysisTimeout(timeout time.Duration) *EnterprisePublishHandler {
	h.analysisTimeout = timeout
	return h
}

// AnalyzeRequirementRequest represents the request body for analyzing a requirement
type AnalyzeRequirementRequest struct {
	InputType    string `json:"input_type" binding:"required"` // "text" or "pdf"
	InputContent string `json:"input_content"`                 // for text type
	PDFPath      string `json:"pdf_path"`                      // for pdf type
}

// AnalyzeRequirementResponse represents the response for analyzing a requirement
type AnalyzeRequirementResponse struct {
	SessionID      uint             `json:"session_id"`
	AnalyzedResult *llm.StructuredForm `json:"analyzed_result"`
}

// AnalyzeRequirement handles POST /api/publish/analyze
// Analyzes a requirement (text or PDF) and returns a structured form
func (h *EnterprisePublishHandler) AnalyzeRequirement(c *gin.Context) {
	// Get user ID from context (set by auth middleware)
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, UnifiedResponse{
			Code:    401,
			Message: "unauthorized",
		})
		return
	}

	var req AnalyzeRequirementRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid request body: " + err.Error(),
		})
		return
	}

	// Validate input type
	if req.InputType != "text" && req.InputType != "pdf" {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "input_type must be 'text' or 'pdf'",
		})
		return
	}

	// Validate input content based on type
	if req.InputType == "text" && req.InputContent == "" {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "input_content is required for text type",
		})
		return
	}

	if req.InputType == "pdf" && req.PDFPath == "" {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "pdf_path is required for pdf type",
		})
		return
	}

	// Create session record first
	session := &model.RequirementSession{
		UserID:       userID,
		InputType:    req.InputType,
		InputContent: req.InputContent,
		PDFPath:      req.PDFPath,
		Status:       model.RequirementSessionStatusAnalyzing,
	}

	if err := h.sessionRepo.Create(session); err != nil {
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to create session",
		})
		return
	}

	// Analyze requirement with LLM
	ctx, cancel := context.WithTimeout(c.Request.Context(), h.analysisTimeout)
	defer cancel()

	// Get provider from registry
	provider, err := h.registry.GetDefault("analysis")
	if err != nil {
		// Update session status to draft on error
		session.Status = model.RequirementSessionStatusDraft
		h.sessionRepo.Update(session)

		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to get LLM provider: " + err.Error(),
		})
		return
	}

	analyzer := llm.NewRequirementAnalyzer(provider, "")
	form, err := analyzer.AnalyzeRequirement(ctx, req.InputType, req.InputContent, req.PDFPath)
	if err != nil {
		// Update session status to draft on error
		session.Status = model.RequirementSessionStatusDraft
		h.sessionRepo.Update(session)

		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to analyze requirement: " + err.Error(),
		})
		return
	}

	// Store analyzed result
	formJSON, err := json.Marshal(form)
	if err != nil {
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to serialize result",
		})
		return
	}

	session.AnalyzedResult = string(formJSON)
	session.StructuredForm = string(formJSON)
	session.Status = model.RequirementSessionStatusDraft

	if err := h.sessionRepo.Update(session); err != nil {
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to update session",
		})
		return
	}

	c.JSON(http.StatusOK, UnifiedResponse{
		Code:    0,
		Message: "success",
		Data: AnalyzeRequirementResponse{
			SessionID:      session.ID,
			AnalyzedResult: form,
		},
	})
}

// ConfirmRequirementRequest represents the request body for confirming a requirement
type ConfirmRequirementRequest struct {
	SessionID uint `json:"session_id" binding:"required"`
}

// ConfirmRequirementResponse represents the response for confirming a requirement
type ConfirmRequirementResponse struct {
	TaskID uint `json:"task_id"`
}

// ConfirmRequirement handles POST /api/publish/confirm
// User confirms the structured form and creates a Task
func (h *EnterprisePublishHandler) ConfirmRequirement(c *gin.Context) {
	// Get user ID from context (set by auth middleware)
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, UnifiedResponse{
			Code:    401,
			Message: "unauthorized",
		})
		return
	}

	var req ConfirmRequirementRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid request body: " + err.Error(),
		})
		return
	}

	// Get session
	session, err := h.sessionRepo.GetByID(req.SessionID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "session not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to get session",
		})
		return
	}

	// Verify session belongs to user
	if session.UserID != userID {
		c.JSON(http.StatusForbidden, UnifiedResponse{
			Code:    403,
			Message: "session does not belong to user",
		})
		return
	}

	// Check session status - must have analyzed result
	if session.Status == model.RequirementSessionStatusAnalyzing {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "session is still analyzing",
		})
		return
	}

	if session.Status == model.RequirementSessionStatusPublished {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "session already published",
		})
		return
	}

	// Parse structured form
	var form llm.StructuredForm
	if session.StructuredForm != "" {
		if err := json.Unmarshal([]byte(session.StructuredForm), &form); err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to parse structured form",
			})
			return
		}
	}

	// Create task from structured form
	task := &model.Task{
		UserID:          userID,
		Title:           form.ProjectName,
		Description:     form.Description,
		Type:           "enterprise",
		Level:          form.Priority,
		Status:         "open",
		Priority:       form.Priority,
		BudgetMin:      form.BudgetRange.Min,
		BudgetMax:      form.BudgetRange.Max,
		EstimatedDays:  form.DurationDays,
		RequiredSkills: stringOrNil(form.TechRequirements),
	}

	// Start transaction
	tx := h.db.Begin()
	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to start transaction",
		})
		return
	}

	// Create task
	if err := tx.Create(task).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to create task",
		})
		return
	}

	// Update session
	session.Status = model.RequirementSessionStatusPublished
	session.TaskID = &task.ID
	if err := tx.Save(session).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to update session",
		})
		return
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to commit transaction",
		})
		return
	}

	c.JSON(http.StatusOK, UnifiedResponse{
		Code:    0,
		Message: "success",
		Data: ConfirmRequirementResponse{
			TaskID: task.ID,
		},
	})
}

// GetSessionResponse represents the response for getting a session
type GetSessionResponse struct {
	ID             uint                        `json:"id"`
	UserID         uint                        `json:"user_id"`
	InputType      string                      `json:"input_type"`
	InputContent   string                      `json:"input_content,omitempty"`
	PDFPath        string                      `json:"pdf_path,omitempty"`
	AnalyzedResult *llm.StructuredForm         `json:"analyzed_result,omitempty"`
	Status         model.RequirementSessionStatus `json:"status"`
	TaskID         *uint                       `json:"task_id,omitempty"`
	CreatedAt      time.Time                   `json:"created_at"`
	UpdatedAt      time.Time                   `json:"updated_at"`
}

// GetSession handles GET /api/publish/session/:id
// Returns session with status
func (h *EnterprisePublishHandler) GetSession(c *gin.Context) {
	// Get user ID from context (set by auth middleware)
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, UnifiedResponse{
			Code:    401,
			Message: "unauthorized",
		})
		return
	}

	sessionID := c.Param("id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "session id is required",
		})
		return
	}

	// Parse session ID
	var id uint
	if _, err := json.Number(sessionID).Int64(); err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid session id",
		})
		return
	}
	id = uint(func() int64 {
		n, _ := json.Number(sessionID).Int64()
		return n
	}())

	// Get session
	session, err := h.sessionRepo.GetByID(id)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "session not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to get session",
		})
		return
	}

	// Verify session belongs to user
	if session.UserID != userID {
		c.JSON(http.StatusForbidden, UnifiedResponse{
			Code:    403,
			Message: "session does not belong to user",
		})
		return
	}

	// Parse analyzed result
	var analyzedResult *llm.StructuredForm
	if session.AnalyzedResult != "" {
		var form llm.StructuredForm
		if err := json.Unmarshal([]byte(session.AnalyzedResult), &form); err == nil {
			analyzedResult = &form
		}
	}

	c.JSON(http.StatusOK, UnifiedResponse{
		Code:    0,
		Message: "success",
		Data: GetSessionResponse{
			ID:             session.ID,
			UserID:         session.UserID,
			InputType:      session.InputType,
			InputContent:   session.InputContent,
			PDFPath:        session.PDFPath,
			AnalyzedResult: analyzedResult,
			Status:         session.Status,
			TaskID:         session.TaskID,
			CreatedAt:      session.CreatedAt,
			UpdatedAt:      session.UpdatedAt,
		},
	})
}

// stringOrNil converts a string slice to a JSON string or empty string
func stringOrNil(s []string) string {
	if len(s) == 0 {
		return ""
	}
	b, _ := json.Marshal(s)
	return string(b)
}
