package model

// AgentConfig - Agent 配置
type AgentConfig struct {
	Name         string                 `json:"name"`
	Description  string                 `json:"description"`
	Model        string                 `json:"model"` // "gpt-4", "claude-3", etc.
	SystemPrompt string                 `json:"system_prompt"`
	Temperature  float64                `json:"temperature"`
	MaxTokens    int                    `json:"max_tokens"`

	Skills     []SkillConfig     `json:"skills"`
	MCPServers []MCPServerConfig `json:"mcp_servers"`

	Memory  MemoryConfig  `json:"memory"`
	Planner PlannerConfig `json:"planner"`
}

// SkillConfig - Skill 配置
type SkillConfig struct {
	Name    string                 `json:"name"`
	Enabled bool                   `json:"enabled"`
	Config  map[string]interface{} `json:"config"`
}

// MCPServerConfig - MCP 服务器配置
type MCPServerConfig struct {
	Name          string            `json:"name"`
	TransportType string            `json:"transport_type"`
	Command       string            `json:"command,omitempty"`
	Args          []string          `json:"args,omitempty"`
	Env           map[string]string `json:"env,omitempty"`
	URL           string            `json:"url,omitempty"`
}

// MemoryConfig - 记忆配置
type MemoryConfig struct {
	Type          string `json:"type"` // "short_term", "long_term", "hybrid"
	MaxMessages   int    `json:"max_messages"`
	EnableSummary bool   `json:"enable_summary"`
}

// PlannerConfig - 规划器配置
type PlannerConfig struct {
	Type          string `json:"type"` // "react", "plan_and_execute", "hierarchical"
	MaxIterations int    `json:"max_iterations"`
}

// ClarificationQuestion - 澄清问题
type ClarificationQuestion struct {
	ID       string      `json:"id"`
	Question string      `json:"question"`
	Type     string      `json:"type"` // "text", "select", "multiselect", "number"
	Options  []string    `json:"options,omitempty"`
	Default  interface{} `json:"default,omitempty"`
	Required bool        `json:"required"`
}

// MatchedSkill - 匹配的 Skill
type MatchedSkill struct {
	SkillID        uint    `json:"skill_id"`
	SkillName      string  `json:"skill_name"`
	DisplayName    string  `json:"display_name"`
	RelevanceScore float64 `json:"relevance_score"`
	Reason         string  `json:"reason"`
}

// MCPTool - MCP 工具定义
type MCPTool struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	InputSchema map[string]interface{} `json:"input_schema"`
}

// TestCase - 测试用例
type TestCase struct {
	Name     string `json:"name"`
	Input    string `json:"input"`
	Expected string `json:"expected"`
	Timeout  int    `json:"timeout"` // 秒
}

// TestResult - 测试结果
type TestResult struct {
	Passed   int          `json:"passed"`
	Failed   int          `json:"failed"`
	Total    int          `json:"total"`
	Duration int          `json:"duration"` // 毫秒
	Details  []TestDetail `json:"details"`
}

// TestDetail - 测试详情
type TestDetail struct {
	TestCaseName string `json:"test_case_name"`
	Passed       bool   `json:"passed"`
	Actual       string `json:"actual"`
	Expected     string `json:"expected"`
	Error        string `json:"error"`
	Duration     int    `json:"duration"` // 毫秒
}
