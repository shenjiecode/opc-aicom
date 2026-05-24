package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
)

func TestEvaluateStage_Approved(t *testing.T) {
	mockJSON := `{
  "evaluation": "经过详细评估，提交的交付物完全满足合同要求。源代码结构清晰，文档完整，测试覆盖率达到85%以上。",
  "approved": true,
  "summary": "交付物满足要求，建议通过验收"
}`

	mock := &mockLLMProvider{
		response: newMockResponse(mockJSON),
	}

	evaluator := NewContractEvaluator(mock, "gpt-4-turbo")

	evaluation, approved, err := evaluator.EvaluateStage(
		context.Background(),
		"需要交付：1. 完整源代码 2. API文档 3. 测试报告",
		[]string{"https://example.com/repo.zip", "https://example.com/docs.pdf"},
	)
	if err != nil {
		t.Fatalf("EvaluateStage failed: %v", err)
	}

	if !approved {
		t.Error("approved = false, want true")
	}
	if evaluation == "" {
		t.Error("evaluation is empty, want non-empty string")
	}
}

func TestEvaluateStage_NotApproved(t *testing.T) {
	mockJSON := `{
  "evaluation": "评估发现以下问题：1. 缺少API文档 2. 测试覆盖率仅40%，低于要求的80% 3. 部分功能未实现",
  "approved": false,
  "summary": "交付物不满足要求，需要补充完善"
}`

	mock := &mockLLMProvider{
		response: newMockResponse(mockJSON),
	}

	evaluator := NewContractEvaluator(mock, "gpt-4-turbo")

	evaluation, approved, err := evaluator.EvaluateStage(
		context.Background(),
		"需要交付：1. 完整源代码 2. API文档 3. 测试报告（覆盖率>=80%）",
		[]string{"https://example.com/repo.zip"},
	)
	if err != nil {
		t.Fatalf("EvaluateStage failed: %v", err)
	}

	if approved {
		t.Error("approved = true, want false")
	}
	if evaluation == "" {
		t.Error("evaluation is empty, want non-empty string")
	}
}

func TestEvaluateStage_MarkdownJSONResponse(t *testing.T) {
	mockJSON := "```json\n{\"evaluation\":\"测试评估\",\"approved\":true,\"summary\":\"通过\"}\n```"

	mock := &mockLLMProvider{
		response: newMockResponse(mockJSON),
	}

	evaluator := NewContractEvaluator(mock, "gpt-4-turbo")

	evaluation, approved, err := evaluator.EvaluateStage(
		context.Background(),
		"测试交付物",
		[]string{"https://example.com/artifact.zip"},
	)
	if err != nil {
		t.Fatalf("EvaluateStage failed: %v", err)
	}

	if !approved {
		t.Error("approved = false, want true")
	}
	if evaluation != "测试评估" {
		t.Errorf("evaluation = %q, want %q", evaluation, "测试评估")
	}
}

func TestEvaluateStage_EmptyDeliverables(t *testing.T) {
	mock := &mockLLMProvider{}
	evaluator := NewContractEvaluator(mock, "gpt-4-turbo")

	_, _, err := evaluator.EvaluateStage(context.Background(), "", nil)
	if err == nil {
		t.Fatal("expected error for empty deliverables, got nil")
	}
	if err.Error() != "empty deliverables description" {
		t.Errorf("error = %q, want %q", err.Error(), "empty deliverables description")
	}
}

func TestEvaluateStage_NoArtifacts(t *testing.T) {
	mockJSON := `{
  "evaluation": "未提交任何交付物，无法进行评估",
  "approved": false,
  "summary": "缺少交付物"
}`

	mock := &mockLLMProvider{
		response: newMockResponse(mockJSON),
	}

	evaluator := NewContractEvaluator(mock, "gpt-4-turbo")

	evaluation, approved, err := evaluator.EvaluateStage(
		context.Background(),
		"需要交付源代码和文档",
		nil,
	)
	if err != nil {
		t.Fatalf("EvaluateStage failed: %v", err)
	}

	if approved {
		t.Error("approved = true, want false (no artifacts)")
	}
	if evaluation == "" {
		t.Error("evaluation is empty, want non-empty string")
	}
}

func TestEvaluateStage_LLMError(t *testing.T) {
	mock := &mockLLMProvider{
		err: fmt.Errorf("LLM service unavailable"),
	}

	evaluator := NewContractEvaluator(mock, "gpt-4-turbo")

	_, _, err := evaluator.EvaluateStage(
		context.Background(),
		"测试交付物",
		[]string{"https://example.com/artifact.zip"},
	)
	if err == nil {
		t.Fatal("expected error from LLM, got nil")
	}
}

func TestEvaluateStage_NoChoices(t *testing.T) {
	mock := &mockLLMProvider{
		response: &ChatResponse{
			ID:      "test-id",
			Model:   "mock-model",
			Choices: []Choice{},
		},
	}

	evaluator := NewContractEvaluator(mock, "gpt-4-turbo")

	_, _, err := evaluator.EvaluateStage(
		context.Background(),
		"测试交付物",
		[]string{"https://example.com/artifact.zip"},
	)
	if err == nil {
		t.Fatal("expected error for no choices, got nil")
	}
	if err.Error() != "no response from LLM" {
		t.Errorf("error = %q, want %q", err.Error(), "no response from LLM")
	}
}

func TestEvaluateStage_InvalidJSON(t *testing.T) {
	mock := &mockLLMProvider{
		response: newMockResponse("this is not valid json"),
	}

	evaluator := NewContractEvaluator(mock, "gpt-4-turbo")

	_, _, err := evaluator.EvaluateStage(
		context.Background(),
		"测试交付物",
		[]string{"https://example.com/artifact.zip"},
	)
	if err == nil {
		t.Fatal("expected error for invalid JSON, got nil")
	}
}

func TestNewContractEvaluator_DefaultModel(t *testing.T) {
	mock := &mockLLMProvider{}
	evaluator := NewContractEvaluator(mock, "")
	if evaluator.model != "gpt-4-turbo" {
		t.Errorf("default model = %q, want %q", evaluator.model, "gpt-4-turbo")
	}
}

func TestNewContractEvaluator_CustomModel(t *testing.T) {
	mock := &mockLLMProvider{}
	evaluator := NewContractEvaluator(mock, "gpt-4o")
	if evaluator.model != "gpt-4o" {
		t.Errorf("model = %q, want %q", evaluator.model, "gpt-4o")
	}
}

func TestEvaluationResult_JSONRoundTrip(t *testing.T) {
	result := &EvaluationResult{
		Evaluation: "详细评估内容",
		Approved:   true,
		Summary:    "简要总结",
	}

	data, err := json.Marshal(result)
	if err != nil {
		t.Fatalf("Failed to marshal EvaluationResult: %v", err)
	}

	var decoded EvaluationResult
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal EvaluationResult: %v", err)
	}

	if decoded.Evaluation != result.Evaluation {
		t.Errorf("Evaluation mismatch: got %q, want %q", decoded.Evaluation, result.Evaluation)
	}
	if decoded.Approved != result.Approved {
		t.Errorf("Approved mismatch: got %v, want %v", decoded.Approved, result.Approved)
	}
	if decoded.Summary != result.Summary {
		t.Errorf("Summary mismatch: got %q, want %q", decoded.Summary, result.Summary)
	}
}
