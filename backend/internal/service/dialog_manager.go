package service

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/opc-aicom/backend/internal/model"
	"github.com/opc-aicom/backend/internal/repository"
)

type DialogManager struct {
	sessionRepo *repository.AgentBabaSessionRepository
	skillRepo   *repository.SkillRepository
}

func NewDialogManager(sessionRepo *repository.AgentBabaSessionRepository, skillRepo *repository.SkillRepository) *DialogManager {
	return &DialogManager{
		sessionRepo: sessionRepo,
		skillRepo:   skillRepo,
	}
}

func (d *DialogManager) AnalyzeRequirement(ctx context.Context, sessionID uint) ([]model.ClarificationQuestion, error) {
	session, err := d.sessionRepo.GetByID(sessionID)
	if err != nil {
		return nil, err
	}

	questions := d.generateQuestions(session.Description)

	questionsJSON, _ := json.Marshal(questions)
	session.ClarificationJSON = string(questionsJSON)
	session.Status = model.SessionStatusClarifying
	session.CurrentStep = 2
	_ = d.sessionRepo.Update(session)

	return questions, nil
}

func (d *DialogManager) generateQuestions(description string) []model.ClarificationQuestion {
	questions := []model.ClarificationQuestion{
		{
			ID:       "agent_name",
			Question: "请为这个 Agent 起一个名称",
			Type:     "text",
			Required: true,
		},
		{
			ID:       "agent_type",
			Question: "这个 Agent 的主要类型是什么？",
			Type:     "select",
			Options:  []string{"对话助手", "任务执行", "数据分析", "代码生成", "信息检索"},
			Required: true,
		},
		{
			ID:       "llm_model",
			Question: "希望使用哪个 LLM 模型？",
			Type:     "select",
			Options:  []string{"GPT-4", "GPT-3.5-turbo", "Claude-3-Opus", "Claude-3-Sonnet"},
			Default:  "GPT-4",
			Required: true,
		},
		{
			ID:       "interaction_style",
			Question: "Agent 与用户的交互风格是什么？",
			Type:     "select",
			Options:  []string{"主动引导", "响应式", "混合模式"},
			Default:  "响应式",
			Required: false,
		},
		{
			ID:       "memory_enabled",
			Question: "是否需要记忆功能（记住历史对话）？",
			Type:     "select",
			Options:  []string{"是", "否"},
			Default:  "是",
			Required: false,
		},
	}

	return questions
}

func (d *DialogManager) ProcessAnswer(ctx context.Context, sessionID uint, questionID string, answer interface{}) ([]model.ClarificationQuestion, bool, error) {
	session, err := d.sessionRepo.GetByID(sessionID)
	if err != nil {
		return nil, false, err
	}

	var answers map[string]interface{}
	if session.AnswersJSON != "" {
		_ = json.Unmarshal([]byte(session.AnswersJSON), &answers)
	} else {
		answers = make(map[string]interface{})
	}
	answers[questionID] = answer

	answersJSON, _ := json.Marshal(answers)
	session.AnswersJSON = string(answersJSON)
	_ = d.sessionRepo.Update(session)

	var questions []model.ClarificationQuestion
	_ = json.Unmarshal([]byte(session.ClarificationJSON), &questions)

	answeredCount := 0
	for _, q := range questions {
		if _, ok := answers[q.ID]; ok {
			answeredCount++
		}
	}

	allAnswered := answeredCount >= len(questions)

	var nextQuestions []model.ClarificationQuestion
	if !allAnswered {
		for _, q := range questions {
			if _, ok := answers[q.ID]; !ok {
				nextQuestions = append(nextQuestions, q)
			}
		}
	}

	return nextQuestions, allAnswered, nil
}

func (d *DialogManager) GenerateSpec(ctx context.Context, sessionID uint) (*model.AgentConfig, error) {
	session, err := d.sessionRepo.GetByID(sessionID)
	if err != nil {
		return nil, err
	}

	var answers map[string]interface{}
	_ = json.Unmarshal([]byte(session.AnswersJSON), &answers)

	config := &model.AgentConfig{
		Name:        fmt.Sprintf("%v", answers["agent_name"]),
		Description: session.Description,
		Model:       d.mapModelName(fmt.Sprintf("%v", answers["llm_model"])),
		Temperature: 0.7,
		MaxTokens:   4096,
		Memory: model.MemoryConfig{
			Type:          "short_term",
			MaxMessages:   20,
			EnableSummary: true,
		},
		Planner: model.PlannerConfig{
			Type:          "react",
			MaxIterations: 10,
		},
	}

	return config, nil
}

func (d *DialogManager) mapModelName(name string) string {
	modelMap := map[string]string{
		"GPT-4":            "gpt-4-turbo",
		"GPT-3.5-turbo":    "gpt-3.5-turbo",
		"Claude-3-Opus":    "claude-3-opus",
		"Claude-3-Sonnet":  "claude-3-sonnet",
	}
	if mapped, ok := modelMap[name]; ok {
		return mapped
	}
	return "gpt-4-turbo"
}
