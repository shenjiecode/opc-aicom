package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/repository"
	"gorm.io/gorm"
)

type ResourceListResponse struct {
	List     interface{} `json:"list"`
	Total    int64       `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}

type ListResourceRequest struct {
	Page     int    `json:"page"`
	PageSize int    `json:"pageSize"`
	Type     string `json:"type"` // "ip" or "expert"
}

func ListResources(db *gorm.DB) gin.HandlerFunc {
	resourceRepo := repository.NewResourceRepository(db)

	return func(c *gin.Context) {
		var req ListResourceRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
			pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
			req.Page = page
			req.PageSize = pageSize
			req.Type = c.Query("type")
		}

		if req.Page < 1 {
			req.Page = 1
		}
		if req.PageSize < 1 {
			req.PageSize = 20
		}
		if req.PageSize > 100 {
			req.PageSize = 100
		}

		if req.Type == "" {
			req.Type = "ip"
		}

		resources, total, err := resourceRepo.List(req.Page, req.PageSize, req.Type)
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to fetch resources",
			})
			return
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: ResourceListResponse{
				List:     resources,
				Total:    total,
				Page:     req.Page,
				PageSize: req.PageSize,
			},
		})
	}
}