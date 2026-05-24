package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

// StageEvaluation represents the input for evaluating a contract stage
type StageEvaluation struct {
	Deliverables string   `json:"deliverables"` // Description of what should be delivered
	Artifacts    []string `json:"artifacts"`    // URLs or paths to actual deliverable artifacts
}

// EvaluationResult represents the LLM's evaluation of a stage
type EvaluationResult struct {
	Evaluation string `json:"evaluation"` // Detailed evaluation text
	Approved   bool   `json:"approved"`   // Whether the stage passes evaluation
	Summary    string `json:"summary"`    // Brief summary of the evaluation
}

// ContractEvaluator evaluates contract stage deliverables using LLM
type ContractEvaluator struct {
	provider LLMProvider
	model    string
}

// NewContractEvaluator creates a new contract evaluator
func NewContractEvaluator(provider LLMProvider, model string) *ContractEvaluator {
	if model == "" {
		model = "gpt-4-turbo"
	}
	return &ContractEvaluator{
		provider: provider,
		model:    model,
	}
}

// EvaluateStage evaluates whether stage deliverables meet requirements
// Returns evaluation text, approved status, and error
func (e *ContractEvaluator) EvaluateStage(
	ctx context.Context,
	deliverables string,
	artifacts []string,
) (string, bool, error) {
	if deliverables == "" {
		return "", false, fmt.Errorf("empty deliverables description")
	}

	return e.evaluateWithLLM(ctx, deliverables, artifacts)
}

// evaluateWithLLM sends the evaluation request to LLM
func (e *ContractEvaluator) evaluateWithLLM(
	ctx context.Context,
	deliverables string,
	artifacts []string,
) (string, bool, error) {
	systemPrompt := `你是一个专业的项目交付验收评估师。请评估提交的交付物是否满足合同要求。

请严格按照以下JSON格式返回结果，不要添加任何其他文字：
{
  "evaluation": "详细的评估分析，包括对每个交付物的检查结果",
  "approved": true或false,
  "summary": "简要总结评估结果"
}

注意：
1. approved 字段只能是 true 或 false（布尔值，不是字符串）
2. evaluation 应包含详细的评估过程和发现
3. summary 应简洁明了地总结结果
4. 如果交付物明显不满足要求，approved 应为 false
5. 如果交付物基本满足要求，approved 应为 true
6. 请客观公正地评估，不要过于严格或过于宽松`

	// Build user message with deliverables and artifacts
	userMessage := fmt.Sprintf("合同要求的交付物：\n%s\n\n", deliverables)
	if len(artifacts) > 0 {
		userMessage += "实际提交的交付物链接：\n"
		for i, artifact := range artifacts {
			userMessage += fmt.Sprintf("%d. %s\n", i+1, artifact)
		}
	} else {
		userMessage += "实际提交的交付物链接：无\n"
	}
	userMessage += "\n请评估这些交付物是否满足合同要求。"

	req := &ChatRequest{
		Model: e.model,
		Messages: []Message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userMessage},
		},
		Temperature: 0.3,
		MaxTokens:   4096,
	}

	resp, err := e.provider.Chat(ctx, req)
	if err != nil {
		return "", false, fmt.Errorf("LLM chat: %w", err)
	}

	if len(resp.Choices) == 0 {
		return "", false, fmt.Errorf("no response from LLM")
	}

	// Parse the LLM response
	result, err := e.parseLLMResponse(resp.Choices[0].Message.Content)
	if err != nil {
		return "", false, fmt.Errorf("parse LLM response: %w", err)
	}

	return result.Evaluation, result.Approved, nil
}

// parseLLMResponse parses the LLM response into EvaluationResult
func (e *ContractEvaluator) parseLLMResponse(response string) (*EvaluationResult, error) {
	// Extract JSON from response (handle markdown code blocks)
	jsonStr := response

	// Remove markdown code blocks if present
	if strings.Contains(jsonStr, "```json") {
		start := strings.Index(jsonStr, "```json")
		end := strings.Index(jsonStr[start+7:], "```")
		if start != -1 && end != -1 {
			jsonStr = jsonStr[start+7 : start+7+end]
		}
	} else if strings.Contains(jsonStr, "```") {
		start := strings.Index(jsonStr, "```")
		end := strings.LastIndex(jsonStr, "```")
		if start != -1 && end > start {
			jsonStr = jsonStr[start+3 : end]
		}
	}

	jsonStr = strings.TrimSpace(jsonStr)

	var result EvaluationResult
	if err := json.Unmarshal([]byte(jsonStr), &result); err != nil {
		return nil, fmt.Errorf("unmarshal JSON: %w, raw: %s", err, jsonStr)
	}

	return &result, nil
}
