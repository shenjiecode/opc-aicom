package handler

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/middleware"
	"github.com/opc-aicom/backend/internal/model"
	"github.com/opc-aicom/backend/internal/repository"
	"gorm.io/gorm"
)

// ProjectHandler handles project-related API endpoints
type ProjectHandler struct {
	db          *gorm.DB
	projectRepo *repository.ProjectRepository
	memberRepo  *repository.ProjectMemberRepository
	roomRepo    *repository.ProjectRoomRepository
	stageRepo   *repository.ContractStageRepository
}

// NewProjectHandler creates a new project handler
func NewProjectHandler(db *gorm.DB) *ProjectHandler {
	return &ProjectHandler{
		db:          db,
		projectRepo: repository.NewProjectRepository(db),
		memberRepo:  repository.NewProjectMemberRepository(db),
		roomRepo:    repository.NewProjectRoomRepository(db),
		stageRepo:   repository.NewContractStageRepository(db),
	}
}

// CreateProjectRequest represents the request body for creating a project
type CreateProjectRequest struct {
	Name        string `json:"name" binding:"required"`
	Slug        string `json:"slug"`
	Description string `json:"description"`
	Category    string `json:"category"`
	ClientID    uint   `json:"client_id" binding:"required"`
	ProviderID  uint   `json:"provider_id" binding:"required"`
	Visibility  string `json:"visibility"`
}

// UpdateProjectRequest represents the request body for updating a project
type UpdateProjectRequest struct {
	Name            string `json:"name"`
	Description     string `json:"description"`
	Category        string `json:"category"`
	Status          string `json:"status"`
	LifecycleStage  string `json:"lifecycle_stage"`
}

// ProjectDetailResponse represents a project with detailed info
type ProjectDetailResponse struct {
	Project           *model.Project         `json:"project"`
	Members           []*model.ProjectMember `json:"members"`
	MembersCount      int                    `json:"members_count"`
	DeliverablesCount int                    `json:"deliverables_count"`
}

// CreateProject handles POST /api/projects
// Creates a new project with the current user as owner
func (h *ProjectHandler) CreateProject(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, UnifiedResponse{
			Code:    401,
			Message: "unauthorized",
		})
		return
	}

	var req CreateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid request body: " + err.Error(),
		})
		return
	}

	// Validate required fields
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "name is required",
		})
		return
	}

	// Generate slug if not provided
	slug := req.Slug
	if slug == "" {
		slug = fmt.Sprintf("project-%d", time.Now().Unix())
	}

	// Check slug uniqueness
	existingProject, _ := h.projectRepo.GetBySlug(slug)
	if existingProject != nil {
		c.JSON(http.StatusConflict, UnifiedResponse{
			Code:    409,
			Message: "project with this slug already exists",
		})
		return
	}

	// Set default visibility
	visibility := req.Visibility
	if visibility == "" {
		visibility = "private"
	}

	// Create project in a transaction
	var project model.Project
	err := h.db.Transaction(func(tx *gorm.DB) error {
		// Create project
		project = model.Project{
			Name:         req.Name,
			Slug:         slug,
			Description:  req.Description,
			Category:     req.Category,
			ClientID:     req.ClientID,
			ProviderID:   req.ProviderID,
			Status:       "draft",
			Visibility:   visibility,
			MembersCount: 1,
		}
		if err := tx.Create(&project).Error; err != nil {
			return err
		}

		// Add creator as owner member
		now := time.Now()
		member := model.ProjectMember{
			ProjectID: project.ID,
			UserID:    userID,
			Role:      "owner",
			Status:    "active",
			JoinedAt:  &now,
		}
		if err := tx.Create(&member).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to create project: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, UnifiedResponse{
		Code:    0,
		Message: "success",
		Data:    project,
	})
}

// ListProjects handles GET /api/projects and GET /api/projects/list
// Returns projects for the current user (as client, provider, or member)
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

	// Get projects where user is client, provider, or member
	var projects []*model.Project
	var total int64

	// Query projects as client or provider
	h.db.Model(&model.Project{}).
		Where("client_id = ? OR provider_id = ?", userID, userID).
		Count(&total)

	offset := (page - 1) * pageSize
	h.db.Where("client_id = ? OR provider_id = ?", userID, userID).
		Offset(offset).Limit(pageSize).
		Order("updated_at DESC").
		Find(&projects)

	// Get project IDs where user is a member
	members, err := h.memberRepo.GetByUser(userID)
	if err == nil {
		projectIDs := make([]uint, 0)
		for _, m := range members {
			// Avoid duplicates
			found := false
			for _, p := range projects {
				if p.ID == m.ProjectID {
					found = true
					break
				}
			}
			if !found {
				projectIDs = append(projectIDs, m.ProjectID)
			}
		}

		if len(projectIDs) > 0 {
			var memberProjects []*model.Project
			h.db.Where("id IN ?", projectIDs).
				Order("updated_at DESC").
				Find(&memberProjects)
			projects = append(projects, memberProjects...)
		}
	}

	c.JSON(http.StatusOK, UnifiedResponse{
		Code:    0,
		Message: "success",
		Data: model.ProjectListResponse{
			Projects: convertToProjectViews(projects),
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

	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseUint(projectIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid project id",
		})
		return
	}

	// Get project
	project, err := h.projectRepo.GetByID(uint(projectID))
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "project not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "database error",
		})
		return
	}

	// Check access: user must be client, provider, or member
	hasAccess := project.ClientID == userID || project.ProviderID == userID
	if !hasAccess {
		// Check if user is a member
		hasAccess = h.memberRepo.IsMember(project.ID, userID)
	}

	if !hasAccess {
		c.JSON(http.StatusForbidden, UnifiedResponse{
			Code:    403,
			Message: "access denied",
		})
		return
	}

	// Get members
	members, _ := h.memberRepo.GetMembers(project.ID)

	// Get deliverables count
	var deliverablesCount int64
	h.db.Model(&model.ProjectDeliverable{}).
		Where("project_id = ?", project.ID).
		Count(&deliverablesCount)

	c.JSON(http.StatusOK, UnifiedResponse{
		Code:    0,
		Message: "success",
		Data: ProjectDetailResponse{
			Project:           project,
			Members:          members,
			MembersCount:     project.MembersCount,
			DeliverablesCount: int(deliverablesCount),
		},
	})
}

// UpdateProject handles PUT /api/projects/:id
// Updates project details (only owner or admin can update)
func (h *ProjectHandler) UpdateProject(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, UnifiedResponse{
			Code:    401,
			Message: "unauthorized",
		})
		return
	}

	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseUint(projectIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid project id",
		})
		return
	}

	var req UpdateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid request body: " + err.Error(),
		})
		return
	}

	// Get project
	project, err := h.projectRepo.GetByID(uint(projectID))
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "project not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "database error",
		})
		return
	}

	// Check authorization: only owner or admin can update
	member, err := h.memberRepo.GetMember(project.ID, userID)
	isOwner := err == nil && member.Role == "owner"
	isAdmin := err == nil && member.Role == "admin"

	if !isOwner && !isAdmin {
		c.JSON(http.StatusForbidden, UnifiedResponse{
			Code:    403,
			Message: "only owner or admin can update this project",
		})
		return
	}

	// Validate status transitions
	if req.Status != "" {
		validStatuses := map[string]bool{
			"draft":     true,
			"active":    true,
			"paused":    true,
			"completed": true,
			"cancelled": true,
		}
		if !validStatuses[req.Status] {
			c.JSON(http.StatusBadRequest, UnifiedResponse{
				Code:    400,
				Message: "invalid status, must be one of: draft, active, paused, completed, cancelled",
			})
			return
		}
	}

	// Update fields
	if req.Name != "" {
		project.Name = req.Name
	}
	if req.Description != "" {
		project.Description = req.Description
	}
	if req.Category != "" {
		project.Category = req.Category
	}
	if req.Status != "" {
		project.Status = req.Status
	}
	if req.LifecycleStage != "" {
		project.LifecycleStage = req.LifecycleStage
	}

	if err := h.projectRepo.Update(project); err != nil {
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to update project: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, UnifiedResponse{
		Code:    0,
		Message: "success",
		Data:    project,
	})
}

// DeleteProject handles DELETE /api/projects/:id
// Soft deletes a project (only owner can delete)
func (h *ProjectHandler) DeleteProject(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, UnifiedResponse{
			Code:    401,
			Message: "unauthorized",
		})
		return
	}

	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseUint(projectIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid project id",
		})
		return
	}

	// Get project
	project, err := h.projectRepo.GetByID(uint(projectID))
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "project not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "database error",
		})
		return
	}

	// Check authorization: only owner can delete
	member, err := h.memberRepo.GetMember(project.ID, userID)
	if err != nil || member.Role != "owner" {
		c.JSON(http.StatusForbidden, UnifiedResponse{
			Code:    403,
			Message: "only owner can delete this project",
		})
		return
	}

	// Soft delete
	if err := h.projectRepo.Delete(project.ID); err != nil {
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to delete project: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, UnifiedResponse{
		Code:    0,
		Message: "success",
	})
}

// ==================== Member Management Handlers ====================

// AddMemberRequest represents the request body for adding a member
type AddMemberRequest struct {
	UserID uint   `json:"user_id" binding:"required"`
	Role   string `json:"role" binding:"required"`
}

// AddMember handles POST /api/projects/:id/members
// Adds a member to the project
func (h *ProjectHandler) AddMember(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, UnifiedResponse{
			Code:    401,
			Message: "unauthorized",
		})
		return
	}

	projectID := c.Param("id")
	projectIDUint, err := strconv.ParseUint(projectID, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid project id",
		})
		return
	}

	var req AddMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid request body: " + err.Error(),
		})
		return
	}

	// Validate role
	validRoles := map[string]bool{
		"owner":    true,
		"client":   true,
		"provider": true,
		"member":   true,
		"follower": true,
	}
	if !validRoles[req.Role] {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid role, must be one of: owner, client, provider, member, follower",
		})
		return
	}

	// Get project
	project, err := h.projectRepo.GetByID(uint(projectIDUint))
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "project not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "database error",
		})
		return
	}

	// Check authorization: only owner or admin can add members
	member, err := h.memberRepo.GetMember(project.ID, userID)
	isOwner := err == nil && member.Role == "owner"
	isAdmin := err == nil && member.Role == "admin"

	if !isOwner && !isAdmin {
		c.JSON(http.StatusForbidden, UnifiedResponse{
			Code:    403,
			Message: "only owner or admin can add members",
		})
		return
	}

	// Check if user already exists
	existingMember, err := h.memberRepo.GetMember(project.ID, req.UserID)
	if err == nil && existingMember != nil {
		c.JSON(http.StatusConflict, UnifiedResponse{
			Code:    409,
			Message: "user is already a member of this project",
		})
		return
	}

	// Validate user exists (check in users table)
	var userCount int64
	h.db.Model(&model.User{}).Where("id = ?", req.UserID).Count(&userCount)
	if userCount == 0 {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "user does not exist",
		})
		return
	}

	// Add member
	now := time.Now()
	newMember := &model.ProjectMember{
		ProjectID: project.ID,
		UserID:    req.UserID,
		Role:      req.Role,
		Status:    "active",
		JoinedAt:  &now,
	}

	if err := h.memberRepo.AddMember(newMember); err != nil {
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to add member: " + err.Error(),
		})
		return
	}

	// Update members count
	project.MembersCount++
	h.projectRepo.Update(project)

	c.JSON(http.StatusCreated, UnifiedResponse{
		Code:    0,
		Message: "success",
		Data:    newMember,
	})
}

// RemoveMember handles DELETE /api/projects/:id/members/:uid
// Removes a member from the project
func (h *ProjectHandler) RemoveMember(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, UnifiedResponse{
			Code:    401,
			Message: "unauthorized",
		})
		return
	}

	projectID := c.Param("id")
	projectIDUint, err := strconv.ParseUint(projectID, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid project id",
		})
		return
	}

	memberIDStr := c.Param("uid")
	memberIDUint, err := strconv.ParseUint(memberIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid user id",
		})
		return
	}

	// Get project
	project, err := h.projectRepo.GetByID(uint(projectIDUint))
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "project not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "database error",
		})
		return
	}

	// Check authorization: only owner can remove members, or user can remove themselves
	currentMember, err := h.memberRepo.GetMember(project.ID, userID)
	isOwner := err == nil && currentMember.Role == "owner"
	isSelfRemoving := userID == uint(memberIDUint)

	if !isOwner && !isSelfRemoving {
		c.JSON(http.StatusForbidden, UnifiedResponse{
			Code:    403,
			Message: "only owner can remove other members, or you can remove yourself",
		})
		return
	}

	// Check if member exists
	existingMember, err := h.memberRepo.GetMember(project.ID, uint(memberIDUint))
	if err != nil {
		c.JSON(http.StatusNotFound, UnifiedResponse{
			Code:    404,
			Message: "member not found",
		})
		return
	}

	// Cannot remove owner
	if existingMember.Role == "owner" {
		c.JSON(http.StatusForbidden, UnifiedResponse{
			Code:    403,
			Message: "cannot remove project owner",
		})
		return
	}

	// Remove member
	if err := h.memberRepo.RemoveMember(project.ID, uint(memberIDUint)); err != nil {
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to remove member: " + err.Error(),
		})
		return
	}

	// Update members count
	if project.MembersCount > 0 {
		project.MembersCount--
		h.projectRepo.Update(project)
	}

	c.JSON(http.StatusOK, UnifiedResponse{
		Code:    0,
		Message: "success",
	})
}

// ListMembers handles GET /api/projects/:id/members
// Returns all members of the project
func (h *ProjectHandler) ListMembers(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, UnifiedResponse{
			Code:    401,
			Message: "unauthorized",
		})
		return
	}

	projectID := c.Param("id")
	projectIDUint, err := strconv.ParseUint(projectID, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid project id",
		})
		return
	}

	// Get project
	project, err := h.projectRepo.GetByID(uint(projectIDUint))
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "project not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "database error",
		})
		return
	}

	// Check access: user must be client, provider, or member
	hasAccess := project.ClientID == userID || project.ProviderID == userID
	if !hasAccess {
		hasAccess = h.memberRepo.IsMember(project.ID, userID)
	}

	if !hasAccess {
		c.JSON(http.StatusForbidden, UnifiedResponse{
			Code:    403,
			Message: "access denied",
		})
		return
	}

	// Get members
	members, err := h.memberRepo.GetMembers(project.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to get members: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, UnifiedResponse{
		Code:    0,
		Message: "success",
		Data:    members,
	})
}

// FollowProject handles POST /api/projects/:id/follow
// Adds the current user as a follower of the project
func (h *ProjectHandler) FollowProject(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, UnifiedResponse{
			Code:    401,
			Message: "unauthorized",
		})
		return
	}

	projectID := c.Param("id")
	projectIDUint, err := strconv.ParseUint(projectID, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid project id",
		})
		return
	}

	// Get project
	project, err := h.projectRepo.GetByID(uint(projectIDUint))
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "project not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "database error",
		})
		return
	}

	// Check if already a follower
	existingMember, err := h.memberRepo.GetMember(project.ID, userID)
	if err == nil && existingMember != nil {
		if existingMember.Role == "follower" {
			c.JSON(http.StatusConflict, UnifiedResponse{
				Code:    409,
				Message: "already following this project",
			})
			return
		}
		// Update existing member to follower
		if err := h.memberRepo.UpdateRole(project.ID, userID, "follower"); err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to update role: " + err.Error(),
			})
			return
		}
	} else {
		// Add as new follower
		now := time.Now()
		follower := &model.ProjectMember{
			ProjectID: project.ID,
			UserID:    userID,
			Role:      "follower",
			Status:    "active",
			JoinedAt:  &now,
		}
		if err := h.memberRepo.AddMember(follower); err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "failed to follow project: " + err.Error(),
			})
			return
		}
		project.FollowersCount++
		h.projectRepo.Update(project)
	}

	c.JSON(http.StatusOK, UnifiedResponse{
		Code:    0,
		Message: "success",
	})
}

// UnfollowProject handles DELETE /api/projects/:id/follow
// Removes the current user from followers of the project
func (h *ProjectHandler) UnfollowProject(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, UnifiedResponse{
			Code:    401,
			Message: "unauthorized",
		})
		return
	}

	projectID := c.Param("id")
	projectIDUint, err := strconv.ParseUint(projectID, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid project id",
		})
		return
	}

	// Get project
	project, err := h.projectRepo.GetByID(uint(projectIDUint))
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "project not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "database error",
		})
		return
	}

	// Check if user is a follower
	existingMember, err := h.memberRepo.GetMember(project.ID, userID)
	if err != nil || existingMember.Role != "follower" {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "not following this project",
		})
		return
	}

	// Remove follower
	if err := h.memberRepo.RemoveMember(project.ID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to unfollow project: " + err.Error(),
		})
		return
	}

	// Update followers count
	if project.FollowersCount > 0 {
		project.FollowersCount--
		h.projectRepo.Update(project)
	}

	c.JSON(http.StatusOK, UnifiedResponse{
		Code:    0,
		Message: "success",
	})
}

// ==================== Room Management Handlers ====================

// CreateProjectRoomRequest represents the request body for creating a project room
type CreateProjectRoomRequest struct {
	Name      string `json:"name" binding:"required"`
	RoomType string `json:"room_type" binding:"required"`
	Topic    string `json:"topic"`
	Milestone *uint `json:"milestone_id"`
}

// CreateRoom handles POST /api/projects/:id/rooms
// Creates a new room for the project
func (h *ProjectHandler) CreateRoom(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, UnifiedResponse{
			Code:    401,
			Message: "unauthorized",
		})
		return
	}

	projectID := c.Param("id")
	projectIDUint, err := strconv.ParseUint(projectID, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid project id",
		})
		return
	}

	var req CreateProjectRoomRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid request body: " + err.Error(),
		})
		return
	}

	// Validate room type
	validRoomTypes := map[string]bool{
		"main_group":  true,
		"milestone":  true,
		"direct":     true,
		"discussion": true,
	}
	if !validRoomTypes[req.RoomType] {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid room_type, must be one of: main_group, milestone, direct, discussion",
		})
		return
	}

	// Get project
	project, err := h.projectRepo.GetByID(uint(projectIDUint))
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "project not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "database error",
		})
		return
	}

	// Check authorization: only owner, admin, or member can create rooms
	member, err := h.memberRepo.GetMember(project.ID, userID)
	isMember := err == nil && member != nil

	if !isMember && project.ClientID != userID && project.ProviderID != userID {
		c.JSON(http.StatusForbidden, UnifiedResponse{
			Code:    403,
			Message: "only project members can create rooms",
		})
		return
	}

	// Create room
	room := &model.ProjectRoom{
		ProjectID:  project.ID,
		Name:       req.Name,
		RoomType:   req.RoomType,
		Topic:      req.Topic,
		MilestoneID: req.Milestone,
	}

	if err := h.roomRepo.CreateRoom(room); err != nil {
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to create room: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, UnifiedResponse{
		Code:    0,
		Message: "success",
		Data:    room,
	})
}

// ListRooms handles GET /api/projects/:id/rooms
// Returns all rooms of the project
func (h *ProjectHandler) ListRooms(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, UnifiedResponse{
			Code:    401,
			Message: "unauthorized",
		})
		return
	}

	projectID := c.Param("id")
	projectIDUint, err := strconv.ParseUint(projectID, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid project id",
		})
		return
	}

	// Get project
	project, err := h.projectRepo.GetByID(uint(projectIDUint))
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "project not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "database error",
		})
		return
	}

	// Check access: user must be client, provider, or member
	hasAccess := project.ClientID == userID || project.ProviderID == userID
	if !hasAccess {
		hasAccess = h.memberRepo.IsMember(project.ID, userID)
	}

	if !hasAccess {
		c.JSON(http.StatusForbidden, UnifiedResponse{
			Code:    403,
			Message: "access denied",
		})
		return
	}

	// Get rooms
	rooms, err := h.roomRepo.GetByProject(project.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to get rooms: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, UnifiedResponse{
		Code:    0,
		Message: "success",
		Data:    rooms,
	})
}

// ==================== Deliverable Management Handlers ====================

// CreateDeliverableRequest represents the request body for creating a deliverable
type CreateDeliverableRequest struct {
	Name            string `json:"name" binding:"required"`
	Description    string `json:"description"`
	DeliverableType string `json:"deliverable_type"`
	MilestoneID    *uint  `json:"milestone_id"`
}

// CreateDeliverable handles POST /api/projects/:id/deliverables
// Creates a new deliverable for the project
func (h *ProjectHandler) CreateDeliverable(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, UnifiedResponse{
			Code:    401,
			Message: "unauthorized",
		})
		return
	}

	projectID := c.Param("id")
	projectIDUint, err := strconv.ParseUint(projectID, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid project id",
		})
		return
	}

	var req CreateDeliverableRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid request body: " + err.Error(),
		})
		return
	}

	// Get project
	project, err := h.projectRepo.GetByID(uint(projectIDUint))
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "project not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "database error",
		})
		return
	}

	// Check authorization: only owner, admin, or member can create deliverables
	member, err := h.memberRepo.GetMember(project.ID, userID)
	isMember := err == nil && member != nil

	if !isMember && project.ClientID != userID && project.ProviderID != userID {
		c.JSON(http.StatusForbidden, UnifiedResponse{
			Code:    403,
			Message: "only project members can create deliverables",
		})
		return
	}

	// Create deliverable
	deliverable := &model.ProjectDeliverable{
		ProjectID:       project.ID,
		Name:            req.Name,
		Description:    req.Description,
		DeliverableType: req.DeliverableType,
		MilestoneID:     req.MilestoneID,
		Status:          "draft",
	}

	if err := h.db.Create(deliverable).Error; err != nil {
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to create deliverable: " + err.Error(),
		})
		return
	}

	// Update deliverables count
	project.DeliverablesCount++
	h.projectRepo.Update(project)

	c.JSON(http.StatusCreated, UnifiedResponse{
		Code:    0,
		Message: "success",
		Data:    deliverable,
	})
}

// ListDeliverables handles GET /api/projects/:id/deliverables
// Returns all deliverables of the project
func (h *ProjectHandler) ListDeliverables(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, UnifiedResponse{
			Code:    401,
			Message: "unauthorized",
		})
		return
	}

	projectID := c.Param("id")
	projectIDUint, err := strconv.ParseUint(projectID, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid project id",
		})
		return
	}

	// Get project
	project, err := h.projectRepo.GetByID(uint(projectIDUint))
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "project not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "database error",
		})
		return
	}

	// Check access: user must be client, provider, or member
	hasAccess := project.ClientID == userID || project.ProviderID == userID
	if !hasAccess {
		hasAccess = h.memberRepo.IsMember(project.ID, userID)
	}

	if !hasAccess {
		c.JSON(http.StatusForbidden, UnifiedResponse{
			Code:    403,
			Message: "access denied",
		})
		return
	}

	// Get deliverables
	var deliverables []*model.ProjectDeliverable
	h.db.Where("project_id = ?", project.ID).Find(&deliverables)

	c.JSON(http.StatusOK, UnifiedResponse{
		Code:    0,
		Message: "success",
		Data:    deliverables,
	})
}

// SubmitDeliverable handles POST /api/projects/:id/deliverables/:did/submit
// Submits a deliverable for review
func (h *ProjectHandler) SubmitDeliverable(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, UnifiedResponse{
			Code:    401,
			Message: "unauthorized",
		})
		return
	}

	projectID := c.Param("id")
	projectIDUint, err := strconv.ParseUint(projectID, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid project id",
		})
		return
	}

	deliverableIDStr := c.Param("did")
	deliverableIDUint, err := strconv.ParseUint(deliverableIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid deliverable id",
		})
		return
	}

	// Get deliverable
	var deliverable model.ProjectDeliverable
	if err := h.db.First(&deliverable, uint(deliverableIDUint)).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "deliverable not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "database error",
		})
		return
	}

	// Verify project ownership
	if deliverable.ProjectID != uint(projectIDUint) {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "deliverable does not belong to this project",
		})
		return
	}

	// Check authorization: must be a member
	member, err := h.memberRepo.GetMember(uint(projectIDUint), userID)
	isMember := err == nil && member != nil

	project, _ := h.projectRepo.GetByID(uint(projectIDUint))
	if !isMember && project.ClientID != userID && project.ProviderID != userID {
		c.JSON(http.StatusForbidden, UnifiedResponse{
			Code:    403,
			Message: "only project members can submit deliverables",
		})
		return
	}

	// Can only submit draft deliverables
	if deliverable.Status != "draft" {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "only draft deliverables can be submitted",
		})
		return
	}

	// Submit deliverable
	now := time.Now()
	deliverable.Status = "submitted"
	deliverable.SubmittedAt = &now

	if err := h.db.Save(&deliverable).Error; err != nil {
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to submit deliverable: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, UnifiedResponse{
		Code:    0,
		Message: "success",
		Data:    deliverable,
	})
}

// ApproveDeliverable handles POST /api/projects/:id/deliverables/:did/approve
// Approves a deliverable
func (h *ProjectHandler) ApproveDeliverable(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, UnifiedResponse{
			Code:    401,
			Message: "unauthorized",
		})
		return
	}

	projectID := c.Param("id")
	projectIDUint, err := strconv.ParseUint(projectID, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid project id",
		})
		return
	}

	deliverableIDStr := c.Param("did")
	deliverableIDUint, err := strconv.ParseUint(deliverableIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid deliverable id",
		})
		return
	}

	// Get deliverable
	var deliverable model.ProjectDeliverable
	if err := h.db.First(&deliverable, uint(deliverableIDUint)).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "deliverable not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "database error",
		})
		return
	}

	// Verify project ownership
	if deliverable.ProjectID != uint(projectIDUint) {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "deliverable does not belong to this project",
		})
		return
	}

	// Check authorization: only owner or admin can approve
	member, err := h.memberRepo.GetMember(uint(projectIDUint), userID)
	isOwner := err == nil && member.Role == "owner"
	isAdmin := err == nil && member.Role == "admin"

	project, _ := h.projectRepo.GetByID(uint(projectIDUint))
	if !isOwner && !isAdmin && project.ClientID != userID && project.ProviderID != userID {
		c.JSON(http.StatusForbidden, UnifiedResponse{
			Code:    403,
			Message: "only owner or admin can approve deliverables",
		})
		return
	}

	// Can only approve submitted deliverables
	if deliverable.Status != "submitted" {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "only submitted deliverables can be approved",
		})
		return
	}

	// Approve deliverable
	now := time.Now()
	deliverable.Status = "approved"
	deliverable.ReviewedAt = &now
	deliverable.ReviewedBy = &userID
	deliverable.AcceptedAt = &now
	deliverable.AcceptedBy = &userID

	if err := h.db.Save(&deliverable).Error; err != nil {
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to approve deliverable: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, UnifiedResponse{
		Code:    0,
		Message: "success",
		Data:    deliverable,
	})
}

// RejectDeliverableRequest represents the request body for rejecting a deliverable
type RejectDeliverableRequest struct {
	ReviewComment string `json:"review_comment" binding:"required"`
}

// RejectDeliverable handles POST /api/projects/:id/deliverables/:did/reject
// Rejects a deliverable
func (h *ProjectHandler) RejectDeliverable(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, UnifiedResponse{
			Code:    401,
			Message: "unauthorized",
		})
		return
	}

	projectID := c.Param("id")
	projectIDUint, err := strconv.ParseUint(projectID, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid project id",
		})
		return
	}

	deliverableIDStr := c.Param("did")
	deliverableIDUint, err := strconv.ParseUint(deliverableIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid deliverable id",
		})
		return
	}

	var req RejectDeliverableRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid request body: " + err.Error(),
		})
		return
	}

	// Get deliverable
	var deliverable model.ProjectDeliverable
	if err := h.db.First(&deliverable, uint(deliverableIDUint)).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "deliverable not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "database error",
		})
		return
	}

	// Verify project ownership
	if deliverable.ProjectID != uint(projectIDUint) {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "deliverable does not belong to this project",
		})
		return
	}

	// Check authorization: only owner or admin can reject
	member, err := h.memberRepo.GetMember(uint(projectIDUint), userID)
	isOwner := err == nil && member.Role == "owner"
	isAdmin := err == nil && member.Role == "admin"

	project, _ := h.projectRepo.GetByID(uint(projectIDUint))
	if !isOwner && !isAdmin && project.ClientID != userID && project.ProviderID != userID {
		c.JSON(http.StatusForbidden, UnifiedResponse{
			Code:    403,
			Message: "only owner or admin can reject deliverables",
		})
		return
	}

	// Can only reject submitted deliverables
	if deliverable.Status != "submitted" {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "only submitted deliverables can be rejected",
		})
		return
	}

	// Reject deliverable
	now := time.Now()
	deliverable.Status = "rejected"
	deliverable.ReviewedAt = &now
	deliverable.ReviewedBy = &userID
	deliverable.ReviewComment = req.ReviewComment

	if err := h.db.Save(&deliverable).Error; err != nil {
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to reject deliverable: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, UnifiedResponse{
		Code:    0,
		Message: "success",
		Data:    deliverable,
	})
}

// convertToProjectViews converts Project slice to ProjectView slice
func convertToProjectViews(projects []*model.Project) []model.ProjectView {
	views := make([]model.ProjectView, 0, len(projects))
	for _, p := range projects {
		views = append(views, model.ProjectView{
			ID:          p.ID,
			Title:       p.Name,
			Description: p.Description,
			Status:      p.Status,
			OwnerID:     p.ClientID,
			CreatedAt:   p.CreatedAt,
			UpdatedAt:   p.UpdatedAt,
		})
	}
	return views
}

// ==================== Milestone/Stage Handlers ====================

// ListMilestones handles GET /api/projects/:id/milestones
// Returns contract stages (milestones) associated with the project via contract
func (h *ProjectHandler) ListMilestones(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, UnifiedResponse{
			Code:    401,
			Message: "unauthorized",
		})
		return
	}

	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseUint(projectIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid project id",
		})
		return
	}

	// Get project
	project, err := h.projectRepo.GetByID(uint(projectID))
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "project not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "database error",
		})
		return
	}

	// Check access: user must be client, provider, or member
	hasAccess := project.ClientID == userID || project.ProviderID == userID
	if !hasAccess {
		hasAccess = h.memberRepo.IsMember(project.ID, userID)
	}

	if !hasAccess {
		c.JSON(http.StatusForbidden, UnifiedResponse{
			Code:    403,
			Message: "access denied",
		})
		return
	}

	// Get contract ID from task via project view
	// Query contract by task_id and agent_id/provider_id relationship
	var contract model.Contract
	err = h.db.Where("agent_id = ?", project.ProviderID).First(&contract).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusOK, UnifiedResponse{
				Code:    0,
				Message: "success",
				Data:    []interface{}{},
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to get contract",
		})
		return
	}

	// Get stages by contract ID
	stages, err := h.stageRepo.GetByContractID(contract.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to get milestones",
		})
		return
	}

	c.JSON(http.StatusOK, UnifiedResponse{
	Code:    0,
	Message: "success",
	Data:    stages,
})
}

// ==================== Workspace Handlers ====================

// WorkspaceResponse represents workspace info with computed fields
type WorkspaceResponse struct {
	*model.ProjectWorkspace
	Quota    int64  `json:"quota"`
	Used    int64  `json:"used"`
	GitEnabled bool  `json:"git_enabled"`
}

// GetWorkspace handles GET /api/projects/:id/workspace
// Returns the workspace associated with the project
func (h *ProjectHandler) GetWorkspace(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, UnifiedResponse{
			Code:    401,
			Message: "unauthorized",
		})
		return
	}

	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseUint(projectIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid project id",
		})
		return
	}

	// Get project
	project, err := h.projectRepo.GetByID(uint(projectID))
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "project not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "database error",
		})
		return
	}

	// Check access: user must be client, provider, or member
	hasAccess := project.ClientID == userID || project.ProviderID == userID
	if !hasAccess {
		hasAccess = h.memberRepo.IsMember(project.ID, userID)
	}

	if !hasAccess {
		c.JSON(http.StatusForbidden, UnifiedResponse{
			Code:    403,
			Message: "access denied",
		})
		return
	}

	// Get workspace
	var workspace model.ProjectWorkspace
	err = h.db.Where("project_id = ?", project.ID).First(&workspace).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			// Return empty workspace with project storage info
			c.JSON(http.StatusOK, UnifiedResponse{
				Code:    0,
				Message: "success",
				Data: WorkspaceResponse{
					ProjectWorkspace: &model.ProjectWorkspace{
						ProjectID: project.ID,
						QuotaBytes:  project.StorageQuota,
						UsedBytes:  project.StorageUsed,
					},
					Quota:     project.StorageQuota,
					Used:     project.StorageUsed,
					GitEnabled: false,
				},
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to get workspace",
		})
		return
	}

	response := WorkspaceResponse{
		ProjectWorkspace: &workspace,
		Quota:      workspace.QuotaBytes,
		Used:      workspace.UsedBytes,
		GitEnabled: workspace.GitEnabled,
	}

	c.JSON(http.StatusOK, UnifiedResponse{
	Code:    0,
	Message: "success",
	Data:    response,
})
}

// ListFiles handles GET /api/projects/:id/workspace/files
// Returns files in the project workspace
func (h *ProjectHandler) ListFiles(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, UnifiedResponse{
			Code:    401,
			Message: "unauthorized",
		})
		return
	}

	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseUint(projectIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid project id",
		})
		return
	}

	// Get project
	project, err := h.projectRepo.GetByID(uint(projectID))
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "project not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "database error",
		})
		return
	}

	// Check access: user must be client, provider, or member
	hasAccess := project.ClientID == userID || project.ProviderID == userID
	if !hasAccess {
		hasAccess = h.memberRepo.IsMember(project.ID, userID)
	}

	if !hasAccess {
		c.JSON(http.StatusForbidden, UnifiedResponse{
			Code:    403,
			Message: "access denied",
		})
		return
	}

	// Get workspace
	var workspace model.ProjectWorkspace
	err = h.db.Where("project_id = ?", project.ID).First(&workspace).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusOK, UnifiedResponse{
				Code:    0,
				Message: "success",
				Data:    []interface{}{},
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to get workspace",
		})
		return
	}

	// Get workspace files
	var files []*model.ProjectWorkspaceFile
	h.db.Where("workspace_id = ? AND is_deleted = ?", workspace.ID, false).Find(&files)

	c.JSON(http.StatusOK, UnifiedResponse{
	Code:    0,
	Message: "success",
	Data:    files,
})
}

// ==================== Payment Handlers ====================

// ListPayments handles GET /api/projects/:id/payments
// Returns payments associated with the project
func (h *ProjectHandler) ListPayments(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, UnifiedResponse{
			Code:    401,
			Message: "unauthorized",
		})
		return
	}

	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseUint(projectIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid project id",
		})
		return
	}

	// Get project
	project, err := h.projectRepo.GetByID(uint(projectID))
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "project not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "database error",
		})
		return
	}

	// Check access: user must be client, provider, or member
	hasAccess := project.ClientID == userID || project.ProviderID == userID
	if !hasAccess {
		hasAccess = h.memberRepo.IsMember(project.ID, userID)
	}

	if !hasAccess {
		c.JSON(http.StatusForbidden, UnifiedResponse{
			Code:    403,
			Message: "access denied",
		})
		return
	}

	// Get payments
	var payments []*model.ProjectPayment
	h.db.Where("project_id = ?", project.ID).Order("created_at DESC").Find(&payments)

	c.JSON(http.StatusOK, UnifiedResponse{
	Code:    0,
	Message: "success",
	Data:    payments,
})
}

// ==================== Activity Handlers ====================

// ActivityWithActor represents activity with actor info
type ActivityWithActor struct {
	*model.ProjectActivity
	ActorName  string `json:"actor_name"`
	ActorAvatar string `json:"actor_avatar"`
}

// ListActivities handles GET /api/projects/:id/activities
// Returns activities associated with the project
func (h *ProjectHandler) ListActivities(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, UnifiedResponse{
			Code:    401,
			Message: "unauthorized",
		})
		return
	}

	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseUint(projectIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid project id",
		})
		return
	}

	// Get project
	project, err := h.projectRepo.GetByID(uint(projectID))
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "project not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "database error",
		})
		return
	}

	// Check access: user must be client, provider, or member
	hasAccess := project.ClientID == userID || project.ProviderID == userID
	if !hasAccess {
		hasAccess = h.memberRepo.IsMember(project.ID, userID)
	}

	if !hasAccess {
		c.JSON(http.StatusForbidden, UnifiedResponse{
			Code:    403,
			Message: "access denied",
		})
		return
	}

	// Get pagination params
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	// Get activities
	var activities []*model.ProjectActivity
	offset := (page - 1) * pageSize
	h.db.Where("project_id = ?", project.ID).
		Offset(offset).Limit(pageSize).
		Order("created_at DESC").
		Find(&activities)

	// If actor_id is present, fetch actor info
	results := make([]ActivityWithActor, 0, len(activities))
	for _, a := range activities {
		item := ActivityWithActor{
			ProjectActivity: a,
		}
		if a.ActorID != nil {
			var user model.User
			if err := h.db.First(&user, *a.ActorID).Error; err == nil {
				item.ActorName = user.Username
				if user.Avatar != nil {
					item.ActorAvatar = *user.Avatar
				}
			}
		}
		results = append(results, item)
	}

	c.JSON(http.StatusOK, UnifiedResponse{
	Code:    0,
	Message: "success",
	Data:    results,
})
}
