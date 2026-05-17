package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/middleware"
	"github.com/opc-aicom/backend/internal/model"
	"github.com/opc-aicom/backend/internal/repository"
	"github.com/opc-aicom/backend/internal/service"
	"gorm.io/gorm"
)

type AgentInstanceHandler struct {
	repo      *repository.AgentInstanceRepository
	dockerMgr *service.DockerManager
}

func NewAgentInstanceHandler(db *gorm.DB) *AgentInstanceHandler {
	repo := repository.NewAgentInstanceRepository(db)
	return &AgentInstanceHandler{
		repo:      repo,
		dockerMgr: service.NewDockerManager(repo),
	}
}

func (h *AgentInstanceHandler) List(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未登录"})
		return
	}
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	instances, total, err := h.repo.ListByUserID(userID, offset, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "获取列表失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"list":  instances,
			"total": total,
		},
	})
}

func (h *AgentInstanceHandler) GetDetail(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "无效的ID"})
		return
	}

	instance, err := h.repo.GetByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "实例不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    instance,
	})
}

func (h *AgentInstanceHandler) Start(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "无效的ID"})
		return
	}

	instance, err := h.repo.GetByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "实例不存在"})
		return
	}

	if err := h.dockerMgr.StartContainer(c.Request.Context(), instance.ContainerID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "启动失败"})
		return
	}

	_ = h.repo.UpdateStatus(uint(id), model.InstanceStatusRunning, model.HealthStatusUnknown)

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
	})
}

func (h *AgentInstanceHandler) Stop(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "无效的ID"})
		return
	}

	instance, err := h.repo.GetByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "实例不存在"})
		return
	}

	if err := h.dockerMgr.StopContainer(c.Request.Context(), instance.ContainerID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "停止失败"})
		return
	}

	_ = h.repo.UpdateStatus(uint(id), model.InstanceStatusStopped, "")

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
	})
}

func (h *AgentInstanceHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "无效的ID"})
		return
	}

	instance, err := h.repo.GetByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "实例不存在"})
		return
	}

	if instance.ContainerID != "" {
		_ = h.dockerMgr.RemoveContainer(c.Request.Context(), instance.ContainerID)
	}

	_ = h.repo.Delete(uint(id))

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
	})
}

type RunAgentRequest struct {
	Input string `json:"input" binding:"required"`
}

func (h *AgentInstanceHandler) Run(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "无效的ID"})
		return
	}

	var req RunAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误"})
		return
	}

	_ = h.repo.IncrementRuns(uint(id), true)

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"run_id": "run-001",
			"status": "running",
		},
	})
}

func (h *AgentInstanceHandler) GetLogs(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "无效的ID"})
		return
	}

	instance, err := h.repo.GetByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "实例不存在"})
		return
	}

	logs, _ := h.dockerMgr.GetContainerLogs(c.Request.Context(), instance.ContainerID, 100)

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"logs": logs,
		},
	})
}
