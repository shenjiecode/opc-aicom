package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/opc-aicom/backend/agents/internal/model"
	"github.com/opc-aicom/backend/agents/internal/repository"
)

type DockerManager struct {
	instanceRepo *repository.AgentInstanceRepository
}

func NewDockerManager(instanceRepo *repository.AgentInstanceRepository) *DockerManager {
	return &DockerManager{instanceRepo: instanceRepo}
}

type ContainerConfig struct {
	Name        string
	Image       string
	Env         map[string]string
	Ports       map[int]int
	CPULimit    float64
	MemoryLimit int
}

func (d *DockerManager) CreateContainer(ctx context.Context, config *ContainerConfig) (string, error) {
	containerName := fmt.Sprintf("agent-%s-%d", config.Name, time.Now().Unix())
	
	return containerName, nil
}

func (d *DockerManager) StartContainer(ctx context.Context, containerID string) error {
	return nil
}

func (d *DockerManager) StopContainer(ctx context.Context, containerID string) error {
	return nil
}

func (d *DockerManager) RemoveContainer(ctx context.Context, containerID string) error {
	return nil
}

func (d *DockerManager) GetContainerStatus(ctx context.Context, containerID string) (string, error) {
	return model.InstanceStatusRunning, nil
}

func (d *DockerManager) GetContainerLogs(ctx context.Context, containerID string, tail int) (string, error) {
	return "", nil
}

func (d *DockerManager) CreateAgentInstance(ctx context.Context, sessionID uint, userID uint, config *model.AgentConfig, skills []model.SkillConfig, mcpServers []model.MCPServerConfig) (*model.AgentInstance, error) {
	configJSON, _ := json.Marshal(config)
	skillsJSON, _ := json.Marshal(skills)
	mcpJSON, _ := json.Marshal(mcpServers)

	containerName := fmt.Sprintf("agent-%d-%d", sessionID, time.Now().Unix())

	instance := &model.AgentInstance{
		SessionID:       sessionID,
		UserID:          userID,
		Name:            config.Name,
		Description:     config.Description,
		ConfigJSON:      string(configJSON),
		SkillsJSON:      string(skillsJSON),
		MCPServersJSON:  string(mcpJSON),
		ContainerName:   containerName,
		ImageName:       "agent-runtime:latest",
		Status:          model.InstanceStatusCreating,
		HealthStatus:    model.HealthStatusUnknown,
		CPULimit:        1.0,
		MemoryLimit:     512,
	}

	if err := d.instanceRepo.Create(instance); err != nil {
		return nil, err
	}

	return instance, nil
}

func (d *DockerManager) ListContainers(ctx context.Context) ([]map[string]interface{}, error) {
	instances, _, err := d.instanceRepo.ListByUserID(0, 0, 100)
	if err != nil {
		return nil, err
	}

	var containers []map[string]interface{}
	for _, inst := range instances {
		containers = append(containers, map[string]interface{}{
			"id":     inst.ID,
			"name":   inst.ContainerName,
			"status": inst.Status,
		})
	}
	return containers, nil
}
