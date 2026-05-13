package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/repository"
	"gorm.io/gorm"
)

func ListAgents(db *gorm.DB) gin.HandlerFunc {
	agentRepo := repository.NewAgentRepository(db)

	return func(c *gin.Context) {
		agents, err := agentRepo.List()
		if err != nil {
			c.JSON(http.StatusInternalServerError, UnifiedResponse{
				Code:    500,
				Message: "Failed to fetch agents",
			})
			return
		}

		c.JSON(http.StatusOK, UnifiedResponse{
			Code:    0,
			Message: "success",
			Data: gin.H{
				"list": agents,
			},
		})
	}
}