package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/model"
	"github.com/opc-aicom/backend/internal/repository"
	"github.com/opc-aicom/backend/internal/service"
	"gorm.io/gorm"
)

type SkillHandler struct {
	repo  *repository.SkillRepository
	reg   *service.SkillRegistry
	mcp   *service.MCPManager
}

func NewSkillHandler(db *gorm.DB) *SkillHandler {
	repo := repository.NewSkillRepository(db)
	mcpRepo := repository.NewMCPServerRepository(db)
	return &SkillHandler{
		repo: repo,
		reg:  service.NewSkillRegistry(repo),
		mcp:  service.NewMCPManager(mcpRepo),
	}
}

func (h *SkillHandler) List(c *gin.Context) {
	category := c.Query("category")
	search := c.Query("search")
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	if limit > 100 {
		limit = 100
	}

	var skills []model.Skill
	var total int64
	var err error

	if search != "" {
		matched, err := h.reg.Search(c.Request.Context(), search, limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "搜索失败"})
			return
		}
		skills = make([]model.Skill, len(matched))
		for i, m := range matched {
			skill, _ := h.repo.GetByID(m.SkillID)
			if skill != nil {
				skills[i] = *skill
			}
		}
		total = int64(len(skills))
	} else {
		skills, total, err = h.reg.List(c.Request.Context(), category, offset, limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "获取列表失败"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"skills": skills,
			"total":  total,
		},
	})
}

func (h *SkillHandler) GetDetail(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "无效的ID"})
		return
	}

	skill, err := h.repo.GetByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "Skill不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    skill,
	})
}

func (h *SkillHandler) SyncMCP(c *gin.Context) {
	skills := []model.Skill{
		{
			Name:        "browser",
			DisplayName: "Browser Automation",
			Description: "浏览器自动化操作，包括导航、点击、输入、截图等",
			Category:    model.SkillCategoryBrowser,
			Source:      "mcp_marketplace",
			SourceID:    "mcp-browser-001",
			Version:     "1.0.0",
			Status:      model.SkillStatusActive,
		},
		{
			Name:        "filesystem",
			DisplayName: "File System",
			Description: "文件系统操作，包括读写文件、目录管理等",
			Category:    model.SkillCategoryFile,
			Source:      "mcp_marketplace",
			SourceID:    "mcp-filesystem-001",
			Version:     "1.0.0",
			Status:      model.SkillStatusActive,
		},
		{
			Name:        "github",
			DisplayName: "GitHub Integration",
			Description: "GitHub集成，包括仓库操作、PR管理、Issue处理等",
			Category:    model.SkillCategoryCode,
			Source:      "mcp_marketplace",
			SourceID:    "mcp-github-001",
			Version:     "1.0.0",
			Status:      model.SkillStatusActive,
		},
	}

	added, updated, _ := h.reg.SyncFromMCPMarketplace(c.Request.Context(), skills)

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"added":   added,
			"updated": updated,
		},
	})
}
