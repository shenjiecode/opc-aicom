package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/shopspring/decimal"
)

// Feature represents a project feature requirement
type Feature struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Priority    string `json:"priority"` // high, medium, low
}

// BudgetRange represents the budget range for a project
type BudgetRange struct {
	Min decimal.Decimal `json:"min"`
	Max decimal.Decimal `json:"max"`
}

// StructuredForm represents the structured requirement analysis result
type StructuredForm struct {
	ProjectName      string          `json:"project_name"`
	Description      string          `json:"description"`
	Features         []Feature       `json:"features"`
	Priority         string          `json:"priority"` // high, medium, low
	BudgetRange      BudgetRange     `json:"budget_range"`
	DurationDays     int             `json:"duration_days"`
	TechRequirements []string        `json:"tech_requirements"`
	Deliverables     []string        `json:"deliverables"`
}

// RequirementAnalyzer analyzes requirement documents using LLM
type RequirementAnalyzer struct {
	provider LLMProvider
	model    string
}

// NewRequirementAnalyzer creates a new requirement analyzer
func NewRequirementAnalyzer(provider LLMProvider, model string) *RequirementAnalyzer {
	if model == "" {
		model = "gpt-4-turbo"
	}
	return &RequirementAnalyzer{
		provider: provider,
		model:    model,
	}
}

// AnalyzeRequirement analyzes requirement from text or PDF input
// inputType: "text" or "pdf"
// inputContent: the text content (for text type)
// pdfPath: the PDF file path (for pdf type)
func (a *RequirementAnalyzer) AnalyzeRequirement(
	ctx context.Context,
	inputType string,
	inputContent string,
	pdfPath string,
) (*StructuredForm, error) {
	var content string
	var err error

	switch inputType {
	case "text":
		content = inputContent
	case "pdf":
		content, err = a.extractPDFText(pdfPath)
		if err != nil {
			return nil, fmt.Errorf("extract PDF text: %w", err)
		}
	default:
		return nil, fmt.Errorf("unsupported input type: %s", inputType)
	}

	if content == "" {
		return nil, fmt.Errorf("empty content to analyze")
	}

	return a.analyzeWithLLM(ctx, content)
}

// extractPDFText extracts text content from a PDF file
// Simple text extraction - reads raw text from PDF
func (a *RequirementAnalyzer) extractPDFText(pdfPath string) (string, error) {
	data, err := os.ReadFile(pdfPath)
	if err != nil {
		return "", fmt.Errorf("read PDF file: %w", err)
	}

	// Simple PDF text extraction
	// This is a basic implementation that extracts readable text
	// For production, consider using a proper PDF library like unidoc or pdfcpu
	text := a.extractTextFromPDFBytes(data)
	return text, nil
}

// extractTextFromPDFBytes extracts text from raw PDF bytes
// This is a simple implementation that looks for text streams in PDF
func (a *RequirementAnalyzer) extractTextFromPDFBytes(data []byte) string {
	var result strings.Builder
	inText := false
	textStart := 0

	for i := 0; i < len(data); i++ {
		// Look for BT (Begin Text) and ET (End Text) markers
		if i+1 < len(data) {
			if data[i] == 'B' && data[i+1] == 'T' {
				inText = true
				textStart = i + 2
			}
			if data[i] == 'E' && data[i+1] == 'T' {
				if inText && textStart < i {
					// Extract text between BT and ET
					text := string(data[textStart:i])
					// Clean up PDF escape sequences
					text = cleanPDFText(text)
					if text != "" {
						result.WriteString(text)
						result.WriteString(" ")
					}
				}
				inText = false
			}
		}
	}

	// Also try to extract text from Tj and TJ operators
	extracted := result.String()
	if extracted == "" {
		// Fallback: try to find readable ASCII text
		extracted = extractReadableText(data)
	}

	return strings.TrimSpace(extracted)
}

// cleanPDFText removes PDF escape sequences and formatting
func cleanPDFText(text string) string {
	// Remove common PDF escape sequences
	text = strings.ReplaceAll(text, "\\n", " ")
	text = strings.ReplaceAll(text, "\\r", " ")
	text = strings.ReplaceAll(text, "\\t", " ")
	text = strings.ReplaceAll(text, "\\(", "(")
	text = strings.ReplaceAll(text, "\\)", ")")

	// Remove PDF operator sequences like "Tj", "TJ", etc.
	operators := []string{"Tj", "TJ", "Td", "TD", "Tm", "T*", "Tw", "Tc", "TL"}
	for _, op := range operators {
		text = strings.ReplaceAll(text, op, "")
	}

	// Clean up whitespace
	text = strings.Join(strings.Fields(text), " ")

	return text
}

// extractReadableText extracts readable ASCII text from PDF bytes
func extractReadableText(data []byte) string {
	var result strings.Builder
	var current strings.Builder

	for _, b := range data {
		// Check if byte is printable ASCII
		if b >= 32 && b <= 126 {
			current.WriteByte(b)
		} else if current.Len() > 5 {
			// Only add if we have a meaningful word
			text := current.String()
			if !isPDFKeyword(text) {
				result.WriteString(text)
				result.WriteString(" ")
			}
			current.Reset()
		} else {
			current.Reset()
		}
	}

	// Don't forget the last word
	if current.Len() > 5 {
		text := current.String()
		if !isPDFKeyword(text) {
			result.WriteString(text)
		}
	}

	return strings.TrimSpace(result.String())
}

// isPDFKeyword checks if a string is a PDF keyword/operator
func isPDFKeyword(s string) bool {
	keywords := map[string]bool{
		"obj": true, "endobj": true, "stream": true, "endstream": true,
		"xref": true, "trailer": true, "startxref": true, "Root": true,
		"Size": true, "Prev": true, "Type": true, "Filter": true,
		"Length": true, "FlateDecode": true, "Subtype": true,
	}
	return keywords[s]
}

// analyzeWithLLM sends the content to LLM for analysis
func (a *RequirementAnalyzer) analyzeWithLLM(ctx context.Context, content string) (*StructuredForm, error) {
	systemPrompt := `你是一个专业的需求分析师。请分析用户提供的需求文档，提取结构化信息。

请严格按照以下JSON格式返回结果，不要添加任何其他文字：
{
  "project_name": "项目名称",
  "description": "项目描述",
  "features": [
    {
      "name": "功能名称",
      "description": "功能描述",
      "priority": "high/medium/low"
    }
  ],
  "priority": "high/medium/low",
  "budget_range": {
    "min": 0,
    "max": 0
  },
  "duration_days": 0,
  "tech_requirements": ["技术要求1", "技术要求2"],
  "deliverables": ["交付物1", "交付物2"]
}

注意：
1. priority 字段只能是 high、medium 或 low
2. budget_range 的 min 和 max 使用数字表示金额
3. duration_days 使用整数表示天数
4. 如果原文没有明确信息，请根据上下文合理推断`

	req := &ChatRequest{
		Model: a.model,
		Messages: []Message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: content},
		},
		Temperature: 0.3,
		MaxTokens:   4096,
	}

	resp, err := a.provider.Chat(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("LLM chat: %w", err)
	}

	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("no response from LLM")
	}

	// Parse the LLM response
	form, err := a.parseLLMResponse(resp.Choices[0].Message.Content)
	if err != nil {
		return nil, fmt.Errorf("parse LLM response: %w", err)
	}

	return form, nil
}

// parseLLMResponse parses the LLM response into StructuredForm
func (a *RequirementAnalyzer) parseLLMResponse(response string) (*StructuredForm, error) {
	// Extract JSON from response (handle markdown code blocks)
	jsonStr := response

	// Remove markdown code blocks if present
	if strings.Contains(jsonStr, "```json") {
		start := strings.Index(jsonStr, "```json")
		// Find closing ``` after the opening ```json
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

	var form StructuredForm
	if err := json.Unmarshal([]byte(jsonStr), &form); err != nil {
		return nil, fmt.Errorf("unmarshal JSON: %w, raw: %s", err, jsonStr)
	}

	// Validate and set defaults
	a.validateForm(&form)

	return &form, nil
}

// validateForm validates and sets defaults for the form
func (a *RequirementAnalyzer) validateForm(form *StructuredForm) {
	// Validate priority
	validPriorities := map[string]bool{"high": true, "medium": true, "low": true}
	if !validPriorities[form.Priority] {
		form.Priority = "medium"
	}

	// Validate feature priorities
	for i := range form.Features {
		if !validPriorities[form.Features[i].Priority] {
			form.Features[i].Priority = "medium"
		}
	}

	// Ensure non-negative duration
	if form.DurationDays < 0 {
		form.DurationDays = 0
	}

	// Ensure budget range is valid
	if form.BudgetRange.Min.IsNegative() {
		form.BudgetRange.Min = decimal.Zero
	}
	if form.BudgetRange.Max.IsNegative() {
		form.BudgetRange.Max = decimal.Zero
	}
	if form.BudgetRange.Max.LessThan(form.BudgetRange.Min) {
		form.BudgetRange.Max = form.BudgetRange.Min
	}
}
