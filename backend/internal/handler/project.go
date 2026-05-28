package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/middleware"
	"github.com/opc-aicom/backend/internal/model"
	"gorm.io/gorm"
)

// ProjectHandler handles project-related API endpoints
type ProjectHandler struct {
	db *gorm.DB
}

// NewProjectHandler creates a new project handler
func NewProjectHandler(db *gorm.DB) *ProjectHandler {
	return &ProjectHandler{db: db}
}

// ListProjects handles GET /api/projects/list
// Returns projects for the current user (as owner or agent)
func (h *ProjectHandler) ListProjects(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, UnifiedResponse{
			Code:    401,
			Message: "unauthorized",
		})
		return
	}

	// Get page and pageSize from query
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 10
	}

	var projects []model.Project

	// Query contracts where user is publisher or agent
	// Simplified query to avoid missing tables
	query := h.db.Table("contracts c").
		Select(`
			c.id as contract_id,
			c.task_id,
			c.status,
			c.total_amount as budget,
			c.publisher_id as owner_id,
			c.agent_id,
			c.created_at,
			c.updated_at,
			t.title,
			t.description,
			t.progress,
			pu.username as owner_name,
			au.username as agent_name
		`).
		Joins("LEFT JOIN tasks t ON t.id = c.task_id").
		Joins("LEFT JOIN users pu ON pu.id = c.publisher_id").
		Joins("LEFT JOIN users au ON au.id = c.agent_id").
		Where("c.publisher_id = ? OR c.agent_id = ?", userID, userID).
		Where("c.deleted_at IS NULL").
		Order("c.updated_at DESC")

	// Get total count
	var total int64
	query.Count(&total)

	// Get paginated results
	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Find(&projects).Error; err != nil {
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to query projects: " + err.Error(),
		})
		return
	}

	// Get PRD documents for each project
	for i := range projects {
		// Look for PRD file in workspace
		var prdFile string
		h.db.Table("workspace_files").
			Select("path").
			Where("task_id = ? AND name LIKE '%PRD%' OR name LIKE '%prd%'", projects[i].TaskID).
			First(&prdFile)
		projects[i].PRDDocument = prdFile
	}

	c.JSON(http.StatusOK, UnifiedResponse{
		Code:    0,
		Message: "success",
		Data: model.ProjectListResponse{
			Projects: projects,
			Total:    int(total),
		},
	})
}

// GetProject handles GET /api/projects/:id
// Returns a single project with detailed info
func (h *ProjectHandler) GetProject(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, UnifiedResponse{
			Code:    401,
			Message: "unauthorized",
		})
		return
	}

	contractIDStr := c.Param("id")
	contractID, err := strconv.ParseUint(contractIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid project id",
		})
		return
	}

	var project model.Project

	// Query single project
	query := h.db.Table("contracts c").
		Select(`
			c.id as contract_id,
			c.task_id,
			c.status,
			c.total_amount as budget,
			c.publisher_id as owner_id,
			c.agent_id,
			c.created_at,
			c.updated_at,
			t.title,
			t.description,
			t.progress,
			pu.username as owner_name,
			au.username as agent_name
		`).
		Joins("LEFT JOIN tasks t ON t.id = c.task_id").
		Joins("LEFT JOIN users pu ON pu.id = c.publisher_id").
		Joins("LEFT JOIN users au ON au.id = c.agent_id").
		Where("c.id = ?", contractID).
		Where("c.publisher_id = ? OR c.agent_id = ?", userID, userID).
		Where("c.deleted_at IS NULL")

	if err := query.First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "project not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to query project: " + err.Error(),
		})
		return
	}

	// PRD document - placeholder for now (workspace table doesn't exist)
	project.PRDDocument = ""

	c.JSON(http.StatusOK, UnifiedResponse{
		Code:    0,
		Message: "success",
		Data:    project,
	})
}