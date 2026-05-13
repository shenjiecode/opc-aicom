package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/repository"
	"gorm.io/gorm"
)

type ListServiceRequest struct {
	Status string `json:"status"` // "全部服务", "已上线", "内测中"
}

func ListServices(db *gorm.DB) gin.HandlerFunc {
	serviceRepo := repository.NewServiceRepository(db)

	return func(c *gin.Context) {
		var req ListServiceRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			req.Status = c.Query("status")
		}

		services, err := serviceRepo.List(req.Status)
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to fetch services",
			})
			return
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: gin.H{
				"list": services,
			},
		})
	}
}