package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/shopspring/decimal"
)

// mockLLMProvider is a mock LLM provider for testing
type mockLLMProvider struct {
	response *ChatResponse
	err      error
}

func (m *mockLLMProvider) Chat(ctx context.Context, req *ChatRequest) (*ChatResponse, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.response, nil
}

func (m *mockLLMProvider) StreamChat(ctx context.Context, req *ChatRequest) (<-chan StreamChunk, error) {
	return nil, fmt.Errorf("not implemented in mock")
}

func (m *mockLLMProvider) GetModels() []string {
	return []string{"mock-model"}
}

// helper to create a mock response with given content
func newMockResponse(content string) *ChatResponse {
	return &ChatResponse{
		ID:    "test-id",
		Model: "mock-model",
		Choices: []Choice{
			{
				Index: 0,
				Message: Message{
					Role:    "assistant",
					Content: content,
				},
				FinishReason: "stop",
			},
		},
		Usage: Usage{
			PromptTokens:     100,
			CompletionTokens: 200,
			TotalTokens:      300,
		},
	}
}

func TestAnalyzeRequirement_TextInput(t *testing.T) {
	mockJSON := `{
  "project_name": "智能客服系统",
  "description": "基于AI的智能客服系统，支持多轮对话和知识库检索",
  "features": [
    {
      "name": "多轮对话",
      "description": "支持上下文理解的多轮对话功能",
      "priority": "high"
    },
    {
      "name": "知识库检索",
      "description": "基于向量数据库的知识库检索",
      "priority": "high"
    },
    {
      "name": "工单系统",
      "description": "自动创建和跟踪工单",
      "priority": "medium"
    }
  ],
  "priority": "high",
  "budget_range": {
    "min": 50000,
    "max": 100000
  },
  "duration_days": 30,
  "tech_requirements": ["Python", "FastAPI", "向量数据库", "React"],
  "deliverables": ["系统源码", "部署文档", "API文档", "测试报告"]
}`

	mock := &mockLLMProvider{
		response: newMockResponse(mockJSON),
	}

	analyzer := NewRequirementAnalyzer(mock, "gpt-4-turbo")

	form, err := analyzer.AnalyzeRequirement(context.Background(), "text", "我需要一个智能客服系统", "")
	if err != nil {
		t.Fatalf("AnalyzeRequirement failed: %v", err)
	}

	// Verify basic fields
	if form.ProjectName != "智能客服系统" {
		t.Errorf("ProjectName = %q, want %q", form.ProjectName, "智能客服系统")
	}
	if form.Description != "基于AI的智能客服系统，支持多轮对话和知识库检索" {
		t.Errorf("Description = %q, want %q", form.Description, "基于AI的智能客服系统，支持多轮对话和知识库检索")
	}
	if form.Priority != "high" {
		t.Errorf("Priority = %q, want %q", form.Priority, "high")
	}
	if form.DurationDays != 30 {
		t.Errorf("DurationDays = %d, want %d", form.DurationDays, 30)
	}

	// Verify features
	if len(form.Features) != 3 {
		t.Fatalf("Features count = %d, want 3", len(form.Features))
	}
	if form.Features[0].Name != "多轮对话" {
		t.Errorf("Feature[0].Name = %q, want %q", form.Features[0].Name, "多轮对话")
	}
	if form.Features[0].Priority != "high" {
		t.Errorf("Feature[0].Priority = %q, want %q", form.Features[0].Priority, "high")
	}

	// Verify budget range
	expectedMin := decimal.NewFromInt(50000)
	expectedMax := decimal.NewFromInt(100000)
	if !form.BudgetRange.Min.Equal(expectedMin) {
		t.Errorf("BudgetRange.Min = %s, want %s", form.BudgetRange.Min.String(), expectedMin.String())
	}
	if !form.BudgetRange.Max.Equal(expectedMax) {
		t.Errorf("BudgetRange.Max = %s, want %s", form.BudgetRange.Max.String(), expectedMax.String())
	}

	// Verify tech requirements
	if len(form.TechRequirements) != 4 {
		t.Errorf("TechRequirements count = %d, want 4", len(form.TechRequirements))
	}

	// Verify deliverables
	if len(form.Deliverables) != 4 {
		t.Errorf("Deliverables count = %d, want 4", len(form.Deliverables))
	}
}

func TestAnalyzeRequirement_MarkdownJSONResponse(t *testing.T) {
	mockJSON := "```json\n{\"project_name\":\"测试项目\",\"description\":\"测试描述\",\"features\":[{\"name\":\"功能1\",\"description\":\"描述1\",\"priority\":\"high\"}],\"priority\":\"medium\",\"budget_range\":{\"min\":10000,\"max\":50000},\"duration_days\":15,\"tech_requirements\":[\"Go\"],\"deliverables\":[\"源码\"]}\n```"

	mock := &mockLLMProvider{
		response: newMockResponse(mockJSON),
	}

	analyzer := NewRequirementAnalyzer(mock, "gpt-4-turbo")

	form, err := analyzer.AnalyzeRequirement(context.Background(), "text", "测试需求", "")
	if err != nil {
		t.Fatalf("AnalyzeRequirement failed: %v", err)
	}

	if form.ProjectName != "测试项目" {
		t.Errorf("ProjectName = %q, want %q", form.ProjectName, "测试项目")
	}
}

func TestAnalyzeRequirement_UnsupportedInputType(t *testing.T) {
	mock := &mockLLMProvider{}
	analyzer := NewRequirementAnalyzer(mock, "gpt-4-turbo")

	_, err := analyzer.AnalyzeRequirement(context.Background(), "image", "some content", "")
	if err == nil {
		t.Fatal("expected error for unsupported input type, got nil")
	}
	if err.Error() != "unsupported input type: image" {
		t.Errorf("error = %q, want %q", err.Error(), "unsupported input type: image")
	}
}

func TestAnalyzeRequirement_EmptyContent(t *testing.T) {
	mock := &mockLLMProvider{}
	analyzer := NewRequirementAnalyzer(mock, "gpt-4-turbo")

	_, err := analyzer.AnalyzeRequirement(context.Background(), "text", "", "")
	if err == nil {
		t.Fatal("expected error for empty content, got nil")
	}
	if err.Error() != "empty content to analyze" {
		t.Errorf("error = %q, want %q", err.Error(), "empty content to analyze")
	}
}

func TestAnalyzeRequirement_LLMError(t *testing.T) {
	mock := &mockLLMProvider{
		err: fmt.Errorf("LLM service unavailable"),
	}

	analyzer := NewRequirementAnalyzer(mock, "gpt-4-turbo")

	_, err := analyzer.AnalyzeRequirement(context.Background(), "text", "some content", "")
	if err == nil {
		t.Fatal("expected error from LLM, got nil")
	}
}

func TestAnalyzeRequirement_NoChoices(t *testing.T) {
	mock := &mockLLMProvider{
		response: &ChatResponse{
			ID:      "test-id",
			Model:   "mock-model",
			Choices: []Choice{},
		},
	}

	analyzer := NewRequirementAnalyzer(mock, "gpt-4-turbo")

	_, err := analyzer.AnalyzeRequirement(context.Background(), "text", "some content", "")
	if err == nil {
		t.Fatal("expected error for no choices, got nil")
	}
	if err.Error() != "no response from LLM" {
		t.Errorf("error = %q, want %q", err.Error(), "no response from LLM")
	}
}

func TestAnalyzeRequirement_InvalidJSON(t *testing.T) {
	mock := &mockLLMProvider{
		response: newMockResponse("this is not valid json"),
	}

	analyzer := NewRequirementAnalyzer(mock, "gpt-4-turbo")

	_, err := analyzer.AnalyzeRequirement(context.Background(), "text", "some content", "")
	if err == nil {
		t.Fatal("expected error for invalid JSON, got nil")
	}
}

func TestAnalyzeRequirement_PDFInput(t *testing.T) {
	mockJSON := `{
  "project_name": "PDF项目",
  "description": "从PDF提取的需求",
  "features": [],
  "priority": "low",
  "budget_range": {"min": 0, "max": 0},
  "duration_days": 0,
  "tech_requirements": [],
  "deliverables": []
}`

	mock := &mockLLMProvider{
		response: newMockResponse(mockJSON),
	}

	analyzer := NewRequirementAnalyzer(mock, "gpt-4-turbo")

	// Create a temporary PDF-like file
	tmpDir := t.TempDir()
	pdfPath := filepath.Join(tmpDir, "test.pdf")
	// Write some content that our simple extractor can read
	content := "This is a test requirement document for a PDF project"
	if err := os.WriteFile(pdfPath, []byte(content), 0644); err != nil {
		t.Fatalf("Failed to create test PDF: %v", err)
	}

	form, err := analyzer.AnalyzeRequirement(context.Background(), "pdf", "", pdfPath)
	if err != nil {
		t.Fatalf("AnalyzeRequirement with PDF failed: %v", err)
	}

	if form.ProjectName != "PDF项目" {
		t.Errorf("ProjectName = %q, want %q", form.ProjectName, "PDF项目")
	}
}

func TestAnalyzeRequirement_PDFNotFound(t *testing.T) {
	mock := &mockLLMProvider{}
	analyzer := NewRequirementAnalyzer(mock, "gpt-4-turbo")

	_, err := analyzer.AnalyzeRequirement(context.Background(), "pdf", "", "/nonexistent/path.pdf")
	if err == nil {
		t.Fatal("expected error for missing PDF, got nil")
	}
}

func TestValidateForm_DefaultPriority(t *testing.T) {
	mockJSON := `{
  "project_name": "测试",
  "description": "测试",
  "features": [{"name": "f1", "description": "d1", "priority": "invalid"}],
  "priority": "invalid",
  "budget_range": {"min": -100, "max": -50},
  "duration_days": -10,
  "tech_requirements": [],
  "deliverables": []
}`

	mock := &mockLLMProvider{
		response: newMockResponse(mockJSON),
	}

	analyzer := NewRequirementAnalyzer(mock, "gpt-4-turbo")

	form, err := analyzer.AnalyzeRequirement(context.Background(), "text", "test", "")
	if err != nil {
		t.Fatalf("AnalyzeRequirement failed: %v", err)
	}

	// Invalid priority should default to "medium"
	if form.Priority != "medium" {
		t.Errorf("Priority = %q, want %q (default)", form.Priority, "medium")
	}
	if form.Features[0].Priority != "medium" {
		t.Errorf("Feature priority = %q, want %q (default)", form.Features[0].Priority, "medium")
	}
	// Negative duration should be 0
	if form.DurationDays != 0 {
		t.Errorf("DurationDays = %d, want 0", form.DurationDays)
	}
	// Negative budget should be 0
	if !form.BudgetRange.Min.IsZero() {
		t.Errorf("BudgetRange.Min = %s, want 0", form.BudgetRange.Min.String())
	}
	if !form.BudgetRange.Max.IsZero() {
		t.Errorf("BudgetRange.Max = %s, want 0", form.BudgetRange.Max.String())
	}
}

func TestValidateForm_MaxLessThanMin(t *testing.T) {
	mockJSON := `{
  "project_name": "测试",
  "description": "测试",
  "features": [],
  "priority": "medium",
  "budget_range": {"min": 100, "max": 50},
  "duration_days": 10,
  "tech_requirements": [],
  "deliverables": []
}`

	mock := &mockLLMProvider{
		response: newMockResponse(mockJSON),
	}

	analyzer := NewRequirementAnalyzer(mock, "gpt-4-turbo")

	form, err := analyzer.AnalyzeRequirement(context.Background(), "text", "test", "")
	if err != nil {
		t.Fatalf("AnalyzeRequirement failed: %v", err)
	}

	// Max < Min should set Max = Min
	expectedMin := decimal.NewFromInt(100)
	if !form.BudgetRange.Min.Equal(expectedMin) {
		t.Errorf("BudgetRange.Min = %s, want %s", form.BudgetRange.Min.String(), expectedMin.String())
	}
	if !form.BudgetRange.Max.Equal(form.BudgetRange.Min) {
		t.Errorf("BudgetRange.Max = %s, want %s (equal to Min)", form.BudgetRange.Max.String(), form.BudgetRange.Min.String())
	}
}

func TestNewRequirementAnalyzer_DefaultModel(t *testing.T) {
	mock := &mockLLMProvider{}
	analyzer := NewRequirementAnalyzer(mock, "")
	if analyzer.model != "gpt-4-turbo" {
		t.Errorf("default model = %q, want %q", analyzer.model, "gpt-4-turbo")
	}
}

func TestNewRequirementAnalyzer_CustomModel(t *testing.T) {
	mock := &mockLLMProvider{}
	analyzer := NewRequirementAnalyzer(mock, "gpt-4o")
	if analyzer.model != "gpt-4o" {
		t.Errorf("model = %q, want %q", analyzer.model, "gpt-4o")
	}
}

func TestStructuredForm_JSONRoundTrip(t *testing.T) {
	form := &StructuredForm{
		ProjectName:  "测试项目",
		Description:  "项目描述",
		Features:     []Feature{{Name: "功能1", Description: "描述1", Priority: "high"}},
		Priority:     "medium",
		BudgetRange:  BudgetRange{Min: decimal.NewFromInt(1000), Max: decimal.NewFromInt(5000)},
		DurationDays: 30,
		TechRequirements: []string{"Go", "React"},
		Deliverables:     []string{"源码", "文档"},
	}

	data, err := json.Marshal(form)
	if err != nil {
		t.Fatalf("Failed to marshal StructuredForm: %v", err)
	}

	var decoded StructuredForm
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal StructuredForm: %v", err)
	}

	if decoded.ProjectName != form.ProjectName {
		t.Errorf("ProjectName mismatch: got %q, want %q", decoded.ProjectName, form.ProjectName)
	}
	if decoded.DurationDays != form.DurationDays {
		t.Errorf("DurationDays mismatch: got %d, want %d", decoded.DurationDays, form.DurationDays)
	}
	if !decoded.BudgetRange.Min.Equal(form.BudgetRange.Min) {
		t.Errorf("BudgetRange.Min mismatch: got %s, want %s", decoded.BudgetRange.Min.String(), form.BudgetRange.Min.String())
	}
	if len(decoded.Features) != len(form.Features) {
		t.Errorf("Features count mismatch: got %d, want %d", len(decoded.Features), len(form.Features))
	}
}

func TestCleanPDFText(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{"escape sequences", "hello\\nworld\\t!", "hello world !"},
		{"parentheses", "text\\(1\\)", "text(1)"},
		{"PDF operators", "hello Tj world TJ", "hello world"},
		{"whitespace", "  hello   world  ", "hello world"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := cleanPDFText(tt.input)
			if got != tt.want {
				t.Errorf("cleanPDFText(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestIsPDFKeyword(t *testing.T) {
	tests := []struct {
		input string
		want  bool
	}{
		{"obj", true},
		{"endobj", true},
		{"stream", true},
		{"hello", false},
		{"world", false},
		{"Length", true},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got := isPDFKeyword(tt.input)
			if got != tt.want {
				t.Errorf("isPDFKeyword(%q) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}
