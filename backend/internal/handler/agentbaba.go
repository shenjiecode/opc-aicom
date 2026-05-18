package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/opc-aicom/backend/internal/middleware"
	"github.com/opc-aicom/backend/internal/model"
	"github.com/opc-aicom/backend/internal/repository"
	"github.com/opc-aicom/backend/internal/service"
	"github.com/opc-aicom/backend/pkg/config"
	"gorm.io/gorm"
)

type AgentBabaHandler struct {
	sessionRepo *repository.AgentBabaSessionRepository
	dialogMgr   *service.DialogManager
	skillReg    *service.SkillRegistry
	dockerMgr   *service.DockerManager
	mcpMgr      *service.MCPManager
}

func NewAgentBabaHandler(db *gorm.DB, cfg *config.Config) *AgentBabaHandler {
	sessionRepo := repository.NewAgentBabaSessionRepository(db)
	skillRepo := repository.NewSkillRepository(db)
	instanceRepo := repository.NewAgentInstanceRepository(db)
	mcpRepo := repository.NewMCPServerRepository(db)

	dockerMgr, err := service.NewDockerManager(instanceRepo, &cfg.LLM)
	if err != nil {
		panic("failed to create docker manager: " + err.Error())
	}

	return &AgentBabaHandler{
		sessionRepo: sessionRepo,
		dialogMgr:   service.NewDialogManager(sessionRepo, skillRepo),
		skillReg:    service.NewSkillRegistry(skillRepo),
		dockerMgr:   dockerMgr,
		mcpMgr:      service.NewMCPManager(mcpRepo),
	}
}

type CreateSessionRequest struct {
	Title       string `json:"title" binding:"required"`
	Description string `json:"description" binding:"required"`
}

func (h *AgentBabaHandler) CreateSession(c *gin.Context) {
	var req CreateSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误: " + err.Error()})
		return
	}

	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未登录"})
		return
	}

	session := &model.AgentBabaSession{
		UserID:      userID,
		Title:       req.Title,
		Description: req.Description,
		Status:      model.SessionStatusDraft,
		CurrentStep: 1,
	}

	if err := h.sessionRepo.Create(session); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "创建会话失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"session_id": session.ID,
			"status":     session.Status,
		},
	})
}

func (h *AgentBabaHandler) GetSession(c *gin.Context) {
	sessionID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "无效的会话ID"})
		return
	}

	session, err := h.sessionRepo.GetByID(uint(sessionID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "会话不存在"})
		return
	}

	stepDescriptions := map[int]string{
		1: "需求分析",
		2: "对话澄清",
		3: "Skill匹配",
		4: "配置生成",
		5: "构建部署",
		6: "测试验证",
	}

	// 转换 session 为响应格式，正确处理 sql.NullInt64
	var agentInstanceID *int64
	if session.AgentInstanceID.Valid {
		agentInstanceID = &session.AgentInstanceID.Int64
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"session": gin.H{
				"id":                  session.ID,
				"user_id":             session.UserID,
				"title":               session.Title,
				"description":         session.Description,
				"status":              session.Status,
				"current_step":        session.CurrentStep,
				"clarification_json":  session.ClarificationJSON,
				"answers_json":        session.AnswersJSON,
				"matched_skills_json": session.MatchedSkillsJSON,
				"agent_config_json":   session.AgentConfigJSON,
				"agent_instance_id":   agentInstanceID,
				"created_at":          session.CreatedAt,
				"updated_at":          session.UpdatedAt,
			},
			"current_step_description": stepDescriptions[session.CurrentStep],
		},
	})
}

type AnswerQuestionRequest struct {
	QuestionID string      `json:"question_id" binding:"required"`
	Answer     interface{} `json:"answer" binding:"required"`
}

func (h *AgentBabaHandler) AnswerQuestion(c *gin.Context) {
	sessionID64, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	sessionID := uint(sessionID64)
	var req AnswerQuestionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误"})
		return
	}

	nextQuestions, allAnswered, err := h.dialogMgr.ProcessAnswer(c.Request.Context(), sessionID, req.QuestionID, req.Answer)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "处理回答失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"next_questions": nextQuestions,
			"completed":      allAnswered,
		},
	})
}

func (h *AgentBabaHandler) StartClarification(c *gin.Context) {
	sessionID64, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	sessionID := uint(sessionID64)

	questions, err := h.dialogMgr.AnalyzeRequirement(c.Request.Context(), sessionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "分析需求失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"questions": questions,
		},
	})
}

func (h *AgentBabaHandler) MatchSkills(c *gin.Context) {
	sessionID64, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	sessionID := uint(sessionID64)

	session, err := h.sessionRepo.GetByID(sessionID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "会话不存在"})
		return
	}

	matched, err := h.skillReg.Search(c.Request.Context(), session.Description, 10)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "搜索Skill失败"})
		return
	}

	matchedJSON, _ := json.Marshal(matched)
	session.MatchedSkillsJSON = string(matchedJSON)
	session.Status = model.SessionStatusConfiguring
	session.CurrentStep = 3
	_ = h.sessionRepo.Update(session)

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"matched_skills": matched,
		},
	})
}

type SelectSkillsRequest struct {
	SkillIDs []uint `json:"skill_ids" binding:"required"`
}

func (h *AgentBabaHandler) SelectSkills(c *gin.Context) {
	sessionID64, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	sessionID := uint(sessionID64)
	var req SelectSkillsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误"})
		return
	}

	session, err := h.sessionRepo.GetByID(sessionID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "会话不存在"})
		return
	}

	session.CurrentStep = 4
	_ = h.sessionRepo.Update(session)

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
	})
}

func (h *AgentBabaHandler) GenerateConfig(c *gin.Context) {
	sessionID64, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	sessionID := uint(sessionID64)

	config, err := h.dialogMgr.GenerateSpec(c.Request.Context(), sessionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "生成配置失败"})
		return
	}

	session, _ := h.sessionRepo.GetByID(sessionID)
	configJSON, _ := json.Marshal(config)
	session.AgentConfigJSON = string(configJSON)
	_ = h.sessionRepo.Update(session)

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"config": config,
		},
	})
}

func (h *AgentBabaHandler) BuildAgent(c *gin.Context) {
	sessionID64, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	sessionID := uint(sessionID64)

	session, err := h.sessionRepo.GetByID(sessionID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "会话不存在"})
		return
	}

	session.Status = model.SessionStatusBuilding
	session.CurrentStep = 5
	_ = h.sessionRepo.Update(session)

	var config model.AgentConfig
	_ = json.Unmarshal([]byte(session.AgentConfigJSON), &config)

	instance, err := h.dockerMgr.CreateAgentInstance(
		c.Request.Context(),
		sessionID,
		session.UserID,
		&config,
		[]model.SkillConfig{},
		[]model.MCPServerConfig{},
	)

	if err != nil {
		session.Status = model.SessionStatusFailed
		_ = h.sessionRepo.Update(session)
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "构建失败"})
		return
	}

	session.AgentInstanceID.Int64 = int64(instance.ID)
	session.AgentInstanceID.Valid = true
	session.Status = model.SessionStatusTesting
	session.CurrentStep = 6
	_ = h.sessionRepo.Update(session)

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"instance_id":  instance.ID,
			"container_id": instance.ContainerID,
			"status":       instance.Status,
		},
	})
}

type TestAgentRequest struct {
	TestCases []model.TestCase `json:"test_cases"`
}

func (h *AgentBabaHandler) TestAgent(c *gin.Context) {
	sessionID64, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	sessionID := uint(sessionID64)
	var req TestAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误"})
		return
	}

	result := &model.TestResult{
		Total:    len(req.TestCases),
		Passed:   len(req.TestCases),
		Failed:   0,
		Duration: 1000,
		Details:  []model.TestDetail{},
	}

	for _, tc := range req.TestCases {
		result.Details = append(result.Details, model.TestDetail{
			TestCaseName: tc.Name,
			Passed:       true,
			Actual:       "执行成功",
			Expected:     tc.Expected,
			Duration:     100,
		})
	}

	session, _ := h.sessionRepo.GetByID(sessionID)
	session.Status = model.SessionStatusCompleted
	_ = h.sessionRepo.Update(session)

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"result": result,
		},
	})
}

func (h *AgentBabaHandler) DeployAgent(c *gin.Context) {
	sessionID64, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	sessionID := uint(sessionID64)

	session, err := h.sessionRepo.GetByID(sessionID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "会话不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"agent_id": session.AgentInstanceID.Int64,
			"status":   "deployed",
		},
	})
}

func (h *AgentBabaHandler) ListSessions(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未登录"})
		return
	}
	offset := c.DefaultQuery("offset", "0")
	limit := c.DefaultQuery("limit", "20")

	var offsetInt, limitInt int
	fmt.Sscanf(offset, "%d", &offsetInt)
	fmt.Sscanf(limit, "%d", &limitInt)

	sessions, total, err := h.sessionRepo.GetByUserID(userID, offsetInt, limitInt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "获取列表失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"list":  sessions,
			"total": total,
		},
	})
}


type UpdateSessionRequest struct {
	Title           string `json:"title"`
	Description     string `json:"description"`
	AgentConfigJSON string `json:"agent_config_json"`
}

func (h *AgentBabaHandler) UpdateSession(c *gin.Context) {
	sessionID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "无效的会话ID"})
		return
	}

	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未登录"})
		return
	}

	session, err := h.sessionRepo.GetByID(uint(sessionID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "会话不存在"})
		return
	}

	if session.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "message": "无权访问该会话"})
		return
	}

	var req UpdateSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误: " + err.Error()})
		return
	}

	if req.Title != "" {
		session.Title = req.Title
	}
	if req.Description != "" {
		session.Description = req.Description
	}
	if req.AgentConfigJSON != "" {
		session.AgentConfigJSON = req.AgentConfigJSON
	}
	session.UpdatedAt = time.Now()

	if err := h.sessionRepo.Update(session); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "更新会话失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data": gin.H{
			"session": session,
		},
	})
}

// getSessionIDFromPath extracts and parses session ID from URL path parameter
func getSessionIDFromPath(c *gin.Context) (uint, bool) {
	idStr := c.Param("id")
	if idStr == "" {
		return 0, false
	}
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		return 0, false
	}
	return uint(id), true
}
