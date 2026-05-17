package service

import (
	"context"
	"encoding/json"

	"github.com/opc-aicom/backend/agents/internal/model"
	"github.com/opc-aicom/backend/agents/internal/repository"
)

type MCPManager struct {
	serverRepo *repository.MCPServerRepository
}

func NewMCPManager(serverRepo *repository.MCPServerRepository) *MCPManager {
	return &MCPManager{serverRepo: serverRepo}
}

func (m *MCPManager) Install(ctx context.Context, server *model.MCPServer) error {
	server.Status = model.MCPServerStatusInactive
	return m.serverRepo.Create(server)
}

func (m *MCPManager) Uninstall(ctx context.Context, name string) error {
	return m.serverRepo.DeleteByName(name)
}

func (m *MCPManager) Start(ctx context.Context, name string) error {
	return m.serverRepo.UpdateStatus(name, model.MCPServerStatusActive, "")
}

func (m *MCPManager) Stop(ctx context.Context, name string) error {
	return m.serverRepo.UpdateStatus(name, model.MCPServerStatusInactive, "")
}

func (m *MCPManager) ListTools(ctx context.Context, name string) ([]model.MCPTool, error) {
	server, err := m.serverRepo.GetByName(name)
	if err != nil {
		return nil, err
	}

	var tools []model.MCPTool
	if server.ToolsJSON != "" {
		_ = json.Unmarshal([]byte(server.ToolsJSON), &tools)
	}
	return tools, nil
}

func (m *MCPManager) CallTool(ctx context.Context, name, toolName string, args map[string]interface{}) (interface{}, error) {
	return map[string]interface{}{
		"result": "tool executed",
		"tool":   toolName,
		"args":   args,
	}, nil
}

func (m *MCPManager) HealthCheck(ctx context.Context, name string) error {
	return nil
}

func (m *MCPManager) List(ctx context.Context) ([]model.MCPServer, error) {
	servers, _, err := m.serverRepo.List(0, 100)
	return servers, err
}

func (m *MCPManager) GetByCategory(ctx context.Context, category string) ([]model.MCPServer, error) {
	return m.serverRepo.ListActive()
}
