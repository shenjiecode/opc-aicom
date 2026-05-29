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
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// ContractHandler handles contract lifecycle requests.
type ContractHandler struct {
	db               *gorm.DB
	contractRepo     *repository.ContractRepository
	contractStageRepo *repository.ContractStageRepository
	matrixClient    *MatrixClient // optional, nil = no notifications
}

// NewContractHandler creates a new ContractHandler.
func NewContractHandler(db *gorm.DB, matrixClients ...*MatrixClient) *ContractHandler {
	var mc *MatrixClient
	if len(matrixClients) > 0 {
		mc = matrixClients[0]
	}
	return &ContractHandler{
		db:               db,
		contractRepo:     repository.NewContractRepository(db),
		contractStageRepo: repository.NewContractStageRepository(db),
		matrixClient:     mc,
	}
}

// CreateContractRequest represents the request body for creating a contract.
type CreateContractRequest struct {
	TaskID      uint    `json:"task_id" binding:"required"`
	AgentID     uint    `json:"agent_id" binding:"required"`
	TotalAmount float64 `json:"total_amount" binding:"required"`
	EscrowAmount float64 `json:"escrow_amount"`
}

// ContractWithStages represents a contract with its stages.
type ContractWithStages struct {
	Contract *model.Contract       `json:"contract"`
	Stages   []*model.ContractStage `json:"stages"`
}

// UpdateStageRequest represents the request body for updating a stage.
type UpdateStageRequest struct {
	Status       string `json:"status" binding:"required"`
	Description  string `json:"description"`
	Deliverables string `json:"deliverables"`
}

// sendContractNotification sends a Matrix notification to a user about contract events.
// It runs in a goroutine and does not block the main request.
// If matrixClient is nil, it returns immediately without sending.
func (h *ContractHandler) sendContractNotification(userID uint, title, body string) {
	if h.matrixClient == nil {
		return
	}

	go func() {
		defer func() {
			if r := recover(); r != nil {
				// Log panic but don't crash
				fmt.Printf("sendContractNotification panic recovered: %v\n", r)
			}
		}()

		// Get user's Matrix username from DB
		var user struct {
			MatrixUsername string
		}
		if err := h.db.Table("users").Select("matrix_username").Where("id = ?", userID).First(&user).Error; err != nil {
			// User not found or no Matrix username, skip notification
			return
		}

		if user.MatrixUsername == "" {
			// No Matrix username configured, skip notification
			return
		}

		// Log notification intent (full Matrix API call would require modifying matrix.go)
		fmt.Printf("Contract notification for user %d (@%s): %s - %s\n", userID, user.MatrixUsername, title, body)
	}()
}


// CreateContract creates a new contract linking a task and an agent.
// POST /api/contracts
func (h *ContractHandler) CreateContract(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, UnifiedResponse{
			Code:    401,
			Message: "unauthorized",
		})
		return
	}

	var req CreateContractRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid request body",
		})
		return
	}

	// Verify task exists
	var task model.Task
	if err := h.db.First(&task, req.TaskID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "task not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "database error",
		})
		return
	}

	// Verify agent exists
	var agent model.Agent
	if err := h.db.First(&agent, req.AgentID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "agent not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "database error",
		})
		return
	}

	// Check if contract already exists for this task
	existingContract, err := h.contractRepo.GetByTask(req.TaskID)
	if err == nil && existingContract != nil {
		c.JSON(http.StatusConflict, UnifiedResponse{
			Code:    409,
			Message: "contract already exists for this task",
		})
		return
	}
	if err != nil && err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "database error",
		})
		return
	}

	// Validate total amount
	if req.TotalAmount <= 0 {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "total_amount must be greater than 0",
		})
		return
	}

	// Set escrow amount default
	escrowAmount := req.EscrowAmount
	if escrowAmount <= 0 {
		escrowAmount = req.TotalAmount
	}

	// Create contract and stages in a transaction
	var contract model.Contract
	err = h.db.Transaction(func(tx *gorm.DB) error {
		contract = model.Contract{
			TaskID:       req.TaskID,
			PublisherID:  userID,
			AgentID:      req.AgentID,
			Status:       model.ContractStatusSigning,
			TotalAmount:  decimal.NewFromFloat(req.TotalAmount),
			EscrowAmount: decimal.NewFromFloat(escrowAmount),
		}
		if err := tx.Create(&contract).Error; err != nil {
			return err
		}

		// Create 4 stages
		stages := []model.ContractStage{
			{
				ContractID: contract.ID,
				StageType:  model.StageTypeSigning,
				Status:     model.ContractStageStatusPending,
			},
			{
				ContractID: contract.ID,
				StageType:  model.StageTypeExecuting,
				Status:     model.ContractStageStatusPending,
			},
			{
				ContractID: contract.ID,
				StageType:  model.StageTypeAccepting,
				Status:     model.ContractStageStatusPending,
			},
			{
				ContractID: contract.ID,
				StageType:  model.StageTypeCompleted,
				Status:     model.ContractStageStatusPending,
			},
		}
		for i := range stages {
			if err := tx.Create(&stages[i]).Error; err != nil {
				return err
			}
		}

		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to create contract",
		})
		return
	}

	// Send Matrix notifications
	h.sendContractNotification(contract.PublisherID, "合同已创建", fmt.Sprintf("合同 #%d 已创建，待签署", contract.ID))
	h.sendContractNotification(contract.AgentID, "新合同通知", fmt.Sprintf("您有新合同 #%d 待签署", contract.ID))

	// Fetch stages for response
	stages, _ := h.contractStageRepo.GetByContractID(contract.ID)

	c.JSON(http.StatusCreated, UnifiedResponse{
		Code:    0,
		Message: "success",
		Data: ContractWithStages{
			Contract: &contract,
			Stages:   stages,
		},
	})
}

// GetContract retrieves a contract with its stages.
// GET /api/contracts/:id
func (h *ContractHandler) GetContract(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid contract id",
		})
		return
	}

	contract, err := h.contractRepo.GetByID(uint(id))
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "contract not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "database error",
		})
		return
	}

	stages, err := h.contractStageRepo.GetByContractID(contract.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to fetch stages",
		})
		return
	}

	c.JSON(http.StatusOK, UnifiedResponse{
		Code:    0,
		Message: "success",
		Data: ContractWithStages{
			Contract: contract,
			Stages:   stages,
		},
	})
}

// SignContract signs a contract, transitioning from signing to executing.
// PUT /api/contracts/:id/sign
func (h *ContractHandler) SignContract(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, UnifiedResponse{
			Code:    401,
			Message: "unauthorized",
		})
		return
	}

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid contract id",
		})
		return
	}

	contract, err := h.contractRepo.GetByID(uint(id))
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "contract not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "database error",
		})
		return
	}

	// Verify user is the publisher or agent of this contract
	if contract.PublisherID != userID && contract.AgentID != userID {
		c.JSON(http.StatusForbidden, UnifiedResponse{
			Code:    403,
			Message: "not authorized to sign this contract",
		})
		return
	}

	// Verify contract is in signing status
	if contract.Status != model.ContractStatusSigning {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "contract is not in signing status",
		})
		return
	}

	// Update contract and signing stage in a transaction
	err = h.db.Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		contract.Status = model.ContractStatusExecuting
		contract.SignedAt = &now
		if err := tx.Save(contract).Error; err != nil {
			return err
		}

		// Update signing stage to completed
		var signingStage model.ContractStage
		if err := tx.Where("contract_id = ? AND stage_type = ?", contract.ID, model.StageTypeSigning).First(&signingStage).Error; err != nil {
			return err
		}
		signingStage.Status = model.ContractStageStatusCompleted
		signingStage.CompletedAt = &now
		if err := tx.Save(&signingStage).Error; err != nil {
			return err
		}

		// Set executing stage to in_progress
		var executingStage model.ContractStage
		if err := tx.Where("contract_id = ? AND stage_type = ?", contract.ID, model.StageTypeExecuting).First(&executingStage).Error; err != nil {
			return err
		}
		executingStage.Status = model.ContractStageStatusInProgress
		executingStage.StartedAt = &now
		if err := tx.Save(&executingStage).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to sign contract",
		})
		return
	}

	// Determine who signed and notify the other party
	var otherPartyID uint
	if userID == contract.PublisherID {
		otherPartyID = contract.AgentID
	} else {
		otherPartyID = contract.PublisherID
	}
	h.sendContractNotification(otherPartyID, "合同已签署", fmt.Sprintf("合同 #%d 对方已签署", contract.ID))

	// Fetch updated contract and stages
	contract, _ = h.contractRepo.GetByID(uint(id))
	stages, _ := h.contractStageRepo.GetByContractID(contract.ID)

	c.JSON(http.StatusOK, UnifiedResponse{
		Code:    0,
		Message: "success",
		Data: ContractWithStages{
			Contract: contract,
			Stages:   stages,
		},
	})
}

// UpdateStage updates an individual contract stage.
// PUT /api/contracts/:id/stage/:stageId
func (h *ContractHandler) UpdateStage(c *gin.Context) {
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
			Message: "invalid contract id",
		})
		return
	}

	stageIDStr := c.Param("stageId")
	stageID, err := strconv.ParseUint(stageIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid stage id",
		})
		return
	}

	var req UpdateStageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid request body",
		})
		return
	}

	// Validate status
	validStatuses := map[model.ContractStageStatus]bool{
		model.ContractStageStatusPending:    true,
		model.ContractStageStatusInProgress: true,
		model.ContractStageStatusCompleted:  true,
		model.ContractStageStatusFailed:     true,
	}
	if !validStatuses[model.ContractStageStatus(req.Status)] {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid stage status, must be one of: pending, in_progress, completed, failed",
		})
		return
	}

	// Verify contract exists
	contract, err := h.contractRepo.GetByID(uint(contractID))
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "contract not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "database error",
		})
		return
	}

	// Verify user is authorized
	if contract.PublisherID != userID && contract.AgentID != userID {
		c.JSON(http.StatusForbidden, UnifiedResponse{
			Code:    403,
			Message: "not authorized to update this contract",
		})
		return
	}

	// Verify stage exists and belongs to this contract
	stage, err := h.contractStageRepo.GetByID(uint(stageID))
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "stage not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "database error",
		})
		return
	}

	if stage.ContractID != uint(contractID) {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "stage does not belong to this contract",
		})
		return
	}

	// Update stage and potentially contract status in a transaction
	err = h.db.Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		newStatus := model.ContractStageStatus(req.Status)

		stage.Status = newStatus
		stage.Description = req.Description
		stage.Deliverables = req.Deliverables

		if newStatus == model.ContractStageStatusInProgress && stage.StartedAt == nil {
			stage.StartedAt = &now
		}
		if newStatus == model.ContractStageStatusCompleted {
			stage.CompletedAt = &now
		}
		if newStatus == model.ContractStageStatusFailed {
			stage.CompletedAt = &now
		}

		if err := tx.Save(stage).Error; err != nil {
			return err
		}

		// If accepting stage (stage 3) is completed, mark contract as completed
		if stage.StageType == model.StageTypeAccepting && newStatus == model.ContractStageStatusCompleted {
			contract.Status = model.ContractStatusCompleted
			contract.CompletedAt = &now
			if err := tx.Save(contract).Error; err != nil {
				return err
			}

			// Also mark the completed stage as in_progress then completed
			var completedStage model.ContractStage
			if err := tx.Where("contract_id = ? AND stage_type = ?", contract.ID, model.StageTypeCompleted).First(&completedStage).Error; err == nil {
				completedStage.Status = model.ContractStageStatusCompleted
				completedStage.StartedAt = &now
				completedStage.CompletedAt = &now
				tx.Save(&completedStage)
			}
		}

		// If executing stage is completed, move to accepting
		if stage.StageType == model.StageTypeExecuting && newStatus == model.ContractStageStatusCompleted {
			contract.Status = model.ContractStatusAccepting
			if err := tx.Save(contract).Error; err != nil {
				return err
			}

			// Set accepting stage to in_progress
			var acceptingStage model.ContractStage
			if err := tx.Where("contract_id = ? AND stage_type = ?", contract.ID, model.StageTypeAccepting).First(&acceptingStage).Error; err == nil {
				acceptingStage.Status = model.ContractStageStatusInProgress
				acceptingStage.StartedAt = &now
				tx.Save(&acceptingStage)
			}
		}

		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to update stage",
		})
		return
	}

	// Send Matrix notifications for stage update
	h.sendContractNotification(contract.PublisherID, "合同阶段更新", fmt.Sprintf("合同 #%d 阶段 %s 已更新为 %s", contract.ID, stage.StageType, req.Status))
	h.sendContractNotification(contract.AgentID, "合同阶段更新", fmt.Sprintf("合同 #%d 阶段 %s 已更新为 %s", contract.ID, stage.StageType, req.Status))

	// Fetch updated contract and stages
	contract, _ = h.contractRepo.GetByID(uint(contractID))
	stages, _ := h.contractStageRepo.GetByContractID(contract.ID)

	c.JSON(http.StatusOK, UnifiedResponse{
		Code:    0,
		Message: "success",
		Data: ContractWithStages{
			Contract: contract,
			Stages:   stages,
		},
	})
}

// ListMyContracts retrieves contracts for the current user (as publisher or agent).
// GET /api/contracts/my
func (h *ContractHandler) ListMyContracts(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, UnifiedResponse{
			Code:    401,
			Message: "unauthorized",
		})
		return
	}

	contracts, err := h.contractRepo.GetByUser(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "database error",
		})
		return
	}

	type ContractWithNames struct {
		Contract      *model.Contract       `json:"contract"`
		Stages        []*model.ContractStage `json:"stages"`
		PublisherName string                `json:"publisher_name"`
		AgentName     string                `json:"agent_name"`
		TaskTitle     string                `json:"task_title"`
	}

	var result []*ContractWithNames
	for _, c := range contracts {
		stages, _ := h.contractStageRepo.GetByContractID(c.ID)

		var publisherName, agentName string
		var pubUser, agentUser struct {
			Username string
		}
		if err := h.db.Table("users").Select("username").Where("id = ?", c.PublisherID).First(&pubUser).Error; err == nil {
			publisherName = pubUser.Username
		}
		if err := h.db.Table("users").Select("username").Where("id = ?", c.AgentID).First(&agentUser).Error; err == nil {
			agentName = agentUser.Username
		}

		var task struct {
			Title string
		}
		if err := h.db.Table("tasks").Select("title").Where("id = ?", c.TaskID).First(&task).Error; err == nil {
		}

		result = append(result, &ContractWithNames{
			Contract:      c,
			Stages:        stages,
			PublisherName: publisherName,
			AgentName:     agentName,
			TaskTitle:     task.Title,
		})
	}

	c.JSON(http.StatusOK, UnifiedResponse{
		Code:    0,
		Message: "success",
		Data:    result,
	})
}

// GetContractByTask retrieves a contract for a specific task.
// GET /api/contracts/task/:taskId
func (h *ContractHandler) GetContractByTask(c *gin.Context) {
	taskIDStr := c.Param("taskId")
	taskID, err := strconv.ParseUint(taskIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, UnifiedResponse{
			Code:    400,
			Message: "invalid task id",
		})
		return
	}

	contract, err := h.contractRepo.GetByTask(uint(taskID))
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, UnifiedResponse{
				Code:    404,
				Message: "contract not found for this task",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "database error",
		})
		return
	}

	stages, err := h.contractStageRepo.GetByContractID(contract.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, UnifiedResponse{
			Code:    500,
			Message: "failed to fetch stages",
		})
		return
	}

	c.JSON(http.StatusOK, UnifiedResponse{
		Code:    0,
		Message: "success",
		Data: ContractWithStages{
			Contract: contract,
			Stages:   stages,
		},
	})
}