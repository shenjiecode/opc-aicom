package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/repository"
	"gorm.io/gorm"
)

type EventListResponse struct {
	List     interface{} `json:"list"`
	Total    int64       `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}

type ListEventRequest struct {
	Page     int    `json:"page"`
	PageSize int    `json:"pageSize"`
	Category string `json:"category"`
}

func ListEvents(db *gorm.DB) gin.HandlerFunc {
	eventRepo := repository.NewEventRepository(db)

	return func(c *gin.Context) {
		var req ListEventRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
			pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
			req.Page = page
			req.PageSize = pageSize
			req.Category = c.Query("category")
		}

		if req.Page < 1 {
			req.Page = 1
		}
		if req.PageSize < 1 {
			req.PageSize = 10
		}
		if req.PageSize > 100 {
			req.PageSize = 100
		}

		events, total, err := eventRepo.List(req.Page, req.PageSize, req.Category)
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to fetch events",
			})
			return
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: EventListResponse{
				List:     events,
				Total:    total,
				Page:     req.Page,
				PageSize: req.PageSize,
			},
		})
	}
}
