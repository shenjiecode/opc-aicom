package llm

import (
	"context"
	"encoding/json"

	"github.com/opc-aicom/backend/agents/internal/model"
)

type AgentExecutor struct {
	registry *ProviderRegistry
}

func NewAgentExecutor(registry *ProviderRegistry) *AgentExecutor {
	return &AgentExecutor{registry: registry}
}

func (e *AgentExecutor) Execute(
	ctx context.Context,
	config *model.AgentConfig,
	input string,
	mcpTools []model.MCPTool,
) (string, error) {
	provider, err := e.registry.GetDefault("chat")
	if err != nil {
		return "", err
	}

	messages := []Message{
		{Role: "system", Content: config.SystemPrompt},
		{Role: "user", Content: input},
	}

	tools := []Tool{}
	for _, mcpTool := range mcpTools {
		tools = append(tools, Tool{
			Type: "function",
			Function: FunctionDef{
				Name:        mcpTool.Name,
				Description: mcpTool.Description,
				Parameters:  mcpTool.InputSchema,
			},
		})
	}

	req := &ChatRequest{
		Model:       config.Model,
		Messages:    messages,
		Temperature: config.Temperature,
		MaxTokens:   config.MaxTokens,
		Tools:       tools,
	}

	resp, err := provider.Chat(ctx, req)
	if err != nil {
		return "", err
	}

	if len(resp.Choices) == 0 {
		return "", nil
	}

	return resp.Choices[0].Message.Content, nil
}

func (e *AgentExecutor) ExecuteWithMemory(
	ctx context.Context,
	config *model.AgentConfig,
	input string,
	history []Message,
	mcpTools []model.MCPTool,
) (string, []Message, error) {
	provider, err := e.registry.GetDefault("chat")
	if err != nil {
		return "", history, err
	}

	messages := []Message{}
	if config.SystemPrompt != "" {
		messages = append(messages, Message{
			Role:    "system",
			Content: config.SystemPrompt,
		})
	}

	messages = append(messages, history...)
	messages = append(messages, Message{
		Role:    "user",
		Content: input,
	})

	if len(messages) > config.Memory.MaxMessages {
		start := len(messages) - config.Memory.MaxMessages
		if messages[0].Role == "system" {
			messages = append([]Message{messages[0]}, messages[start:]...)
		} else {
			messages = messages[start:]
		}
	}

	tools := []Tool{}
	for _, mcpTool := range mcpTools {
		tools = append(tools, Tool{
			Type: "function",
			Function: FunctionDef{
				Name:        mcpTool.Name,
				Description: mcpTool.Description,
				Parameters:  mcpTool.InputSchema,
			},
		})
	}

	req := &ChatRequest{
		Model:       config.Model,
		Messages:    messages,
		Temperature: config.Temperature,
		MaxTokens:   config.MaxTokens,
		Tools:       tools,
	}

	resp, err := provider.Chat(ctx, req)
	if err != nil {
		return "", history, err
	}

	if len(resp.Choices) == 0 {
		return "", messages, nil
	}

	assistantMsg := resp.Choices[0].Message
	messages = append(messages, assistantMsg)

	return assistantMsg.Content, messages, nil
}

func (e *AgentExecutor) ExecuteToolCall(
	ctx context.Context,
	config *model.AgentConfig,
	toolName string,
	toolArgs map[string]interface{},
) (interface{}, error) {
	return map[string]interface{}{
		"tool":   toolName,
		"args":   toolArgs,
		"result": "tool executed",
	}, nil
}

func (e *AgentExecutor) GetAvailableModels() map[string][]string {
	return e.registry.ListModels()
}

func ParseHistoryFromJSON(jsonStr string) []Message {
	if jsonStr == "" {
		return nil
	}

	var messages []Message
	_ = json.Unmarshal([]byte(jsonStr), &messages)
	return messages
}

func SerializeHistoryToJSON(messages []Message) string {
	if messages == nil {
		return ""
	}
	data, _ := json.Marshal(messages)
	return string(data)
}