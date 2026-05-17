package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/model"
	"github.com/opc-aicom/backend/internal/repository"
	"github.com/opc-aicom/backend/internal/service"
	"gorm.io/gorm"
)

type MCPHandler struct {
	repo *repository.MCPServerRepository
	mgr  *service.MCPManager
}

func NewMCPHandler(db *gorm.DB) *MCPHandler {
	repo := repository.NewMCPServerRepository(db)
	return &MCPHandler{
		repo: repo,
		mgr:  service.NewMCPManager(repo),
	}
}

func (h *MCPHandler) ListServers(c *gin.Context) {
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	servers, err := h.mgr.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "获取列表失败"})
		return
	}

	total := int64(len(servers))

	if limit > 0 {
		end := offset + limit
		if end > len(servers) {
			end = len(servers)
		}
		if offset > len(servers) {
			servers = []model.MCPServer{}
		} else {
			servers = servers[offset:end]
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"servers": servers,
			"total":  total,
		},
	})
}

type InstallMCPServerRequest struct {
	Name          string            `json:"name" binding:"required"`
	TransportType string            `json:"transport_type" binding:"required"`
	Command       string            `json:"command"`
	Args          []string          `json:"args"`
	Env           map[string]string `json:"env"`
	URL           string            `json:"url"`
}

func (h *MCPHandler) InstallServer(c *gin.Context) {
	var req InstallMCPServerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误"})
		return
	}

	argsJSON, _ := json.Marshal(req.Args)
	envJSON, _ := json.Marshal(req.Env)

	server := &model.MCPServer{
		Name:          req.Name,
		DisplayName:   req.Name,
		TransportType: req.TransportType,
		Command:       req.Command,
		Args:          string(argsJSON),
		Env:           string(envJSON),
		URL:           req.URL,
		Status:        model.MCPServerStatusInactive,
	}

	if err := h.mgr.Install(c.Request.Context(), server); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "安装失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"name":   server.Name,
			"status": server.Status,
		},
	})
}

func (h *MCPHandler) UninstallServer(c *gin.Context) {
	name := c.Param("name")

	if err := h.mgr.Uninstall(c.Request.Context(), name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "卸载失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
	})
}

func (h *MCPHandler) StartServer(c *gin.Context) {
	name := c.Param("name")

	if err := h.mgr.Start(c.Request.Context(), name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "启动失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
	})
}

func (h *MCPHandler) StopServer(c *gin.Context) {
	name := c.Param("name")

	if err := h.mgr.Stop(c.Request.Context(), name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "停止失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
	})
}

func (h *MCPHandler) ListTools(c *gin.Context) {
	name := c.Param("name")

	tools, err := h.mgr.ListTools(c.Request.Context(), name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "获取工具列表失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"tools": tools,
		},
	})
}

type CallToolRequest struct {
	Args map[string]interface{} `json:"args"`
}

func (h *MCPHandler) CallTool(c *gin.Context) {
	name := c.Param("name")
	toolName := c.Param("tool")

	var req CallToolRequest
	_ = c.ShouldBindJSON(&req)

	result, err := h.mgr.CallTool(c.Request.Context(), name, toolName, req.Args)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "调用失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"result": result,
		},
	})
}
