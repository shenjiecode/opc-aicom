package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	"github.com/docker/go-connections/nat"
	"github.com/opc-aicom/backend/internal/model"
	"github.com/opc-aicom/backend/internal/repository"
	"github.com/opc-aicom/backend/pkg/config"
)

type DockerManager struct {
	client       *client.Client
	instanceRepo *repository.AgentInstanceRepository
	llmConfig    *config.LLMConfig
}

func NewDockerManager(instanceRepo *repository.AgentInstanceRepository, llmConfig *config.LLMConfig) (*DockerManager, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, fmt.Errorf("failed to create docker client: %w", err)
	}
	if llmConfig == nil {
		llmConfig = &config.LLMConfig{}
	}
	return &DockerManager{
		client:       cli,
		instanceRepo: instanceRepo,
		llmConfig:    llmConfig,
	}, nil
}

type ContainerConfig struct {
	Name        string
	Image       string
	Env         map[string]string
	Ports       map[int]int
	CPULimit    float64
	MemoryLimit int
}

func (d *DockerManager) PullImage(ctx context.Context, imageName string) error {
	reader, err := d.client.ImagePull(ctx, imageName, types.ImagePullOptions{})
	if err != nil {
		return fmt.Errorf("failed to pull image %s: %w", imageName, err)
	}
	defer reader.Close()
	_, err = io.Copy(io.Discard, reader)
	return err
}

func (d *DockerManager) CreateContainer(ctx context.Context, cfg *ContainerConfig) (string, error) {
	env := make([]string, 0, len(cfg.Env))
	for k, v := range cfg.Env {
		env = append(env, fmt.Sprintf("%s=%s", k, v))
	}

	portBindings := make(nat.PortMap)
	exposedPorts := make(nat.PortSet)
	for containerPort, hostPort := range cfg.Ports {
		port := nat.Port(fmt.Sprintf("%d/tcp", containerPort))
		portBindings[port] = []nat.PortBinding{
			{HostIP: "0.0.0.0", HostPort: fmt.Sprintf("%d", hostPort)},
		}
		exposedPorts[port] = struct{}{}
	}

	resp, err := d.client.ContainerCreate(ctx,
		&container.Config{
			Image:        cfg.Image,
			Env:          env,
			ExposedPorts: exposedPorts,
		},
		&container.HostConfig{
			PortBindings: portBindings,
			Resources: container.Resources{
				Memory: int64(cfg.MemoryLimit) * 1024 * 1024,
			},
		},
		nil, nil, cfg.Name,
	)
	if err != nil {
		return "", fmt.Errorf("failed to create container: %w", err)
	}

	return resp.ID, nil
}

func (d *DockerManager) StartContainer(ctx context.Context, containerID string) error {
	if err := d.client.ContainerStart(ctx, containerID, types.ContainerStartOptions{}); err != nil {
		return fmt.Errorf("failed to start container %s: %w", containerID, err)
	}
	return nil
}

func (d *DockerManager) StopContainer(ctx context.Context, containerID string) error {
	timeout := 10
	if err := d.client.ContainerStop(ctx, containerID, container.StopOptions{Timeout: &timeout}); err != nil {
		return fmt.Errorf("failed to stop container %s: %w", containerID, err)
	}
	return nil
}

func (d *DockerManager) RemoveContainer(ctx context.Context, containerID string) error {
	if err := d.client.ContainerRemove(ctx, containerID, types.ContainerRemoveOptions{Force: true}); err != nil {
		return fmt.Errorf("failed to remove container %s: %w", containerID, err)
	}
	return nil
}

func (d *DockerManager) GetContainerStatus(ctx context.Context, containerID string) (string, error) {
	inspect, err := d.client.ContainerInspect(ctx, containerID)
	if err != nil {
		return "unknown", fmt.Errorf("failed to inspect container %s: %w", containerID, err)
	}

	switch inspect.State.Status {
	case "running":
		return model.InstanceStatusRunning, nil
	case "created", "paused":
		return model.InstanceStatusCreating, nil
	case "exited", "dead":
		return model.InstanceStatusStopped, nil
	default:
		return "unknown", nil
	}
}

func (d *DockerManager) GetContainerLogs(ctx context.Context, containerID string, tail int) (string, error) {
	reader, err := d.client.ContainerLogs(ctx, containerID, types.ContainerLogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Tail:       fmt.Sprintf("%d", tail),
	})
	if err != nil {
		return "", fmt.Errorf("failed to get logs: %w", err)
	}
	defer reader.Close()

	logs, err := io.ReadAll(reader)
	if err != nil {
		return "", fmt.Errorf("failed to read logs: %w", err)
	}
	return string(logs), nil
}

func (d *DockerManager) CreateAgentInstance(ctx context.Context, sessionID uint, userID uint, config *model.AgentConfig, skills []model.SkillConfig, mcpServers []model.MCPServerConfig) (*model.AgentInstance, error) {
	configJSON, _ := json.Marshal(config)
	skillsJSON, _ := json.Marshal(skills)
	mcpJSON, _ := json.Marshal(mcpServers)

	containerName := fmt.Sprintf("agent-%d-%d", sessionID, time.Now().Unix())

	envVars := map[string]string{
		"AGENT_NAME":        config.Name,
		"AGENT_DESCRIPTION": config.Description,
		"AGENT_MODEL":       config.Model,
		"AGENT_TEMPERATURE": fmt.Sprintf("%.2f", config.Temperature),
		"AGENT_MAX_TOKENS":  fmt.Sprintf("%d", config.MaxTokens),
		"AGENT_CONFIG":      string(configJSON),
	}

	if config.SystemPrompt != "" {
		envVars["AGENT_SYSTEM_PROMPT"] = config.SystemPrompt
	}

	// Pass LLM API key to container based on provider
	if d.llmConfig != nil {
		switch d.llmConfig.DefaultProvider {
		case "anthropic":
			if d.llmConfig.Anthropic.APIKey != "" {
				envVars["OPENAI_API_KEY"] = d.llmConfig.Anthropic.APIKey
				envVars["ANTHROPIC_API_KEY"] = d.llmConfig.Anthropic.APIKey
			}
			if d.llmConfig.Anthropic.BaseURL != "" {
				envVars["OPENAI_BASE_URL"] = d.llmConfig.Anthropic.BaseURL
			}
		default: // openai
			if d.llmConfig.OpenAI.APIKey != "" {
				envVars["OPENAI_API_KEY"] = d.llmConfig.OpenAI.APIKey
			}
			if d.llmConfig.OpenAI.BaseURL != "" {
				envVars["OPENAI_BASE_URL"] = d.llmConfig.OpenAI.BaseURL
			}
		}
	}

	instance := &model.AgentInstance{
		SessionID:      sessionID,
		UserID:         userID,
		Name:           config.Name,
		Description:    config.Description,
		ConfigJSON:     string(configJSON),
		SkillsJSON:     string(skillsJSON),
		MCPServersJSON: string(mcpJSON),
		ContainerName:  containerName,
		ImageName:      "agent-runtime:latest",
		Status:         model.InstanceStatusCreating,
		HealthStatus:   model.HealthStatusUnknown,
		CPULimit:       1.0,
		MemoryLimit:    512,
	}

	if err := d.instanceRepo.Create(instance); err != nil {
		return nil, fmt.Errorf("failed to create instance in DB: %w", err)
	}

	imageName := "agent-runtime:latest"
	_ = d.PullImage(ctx, imageName)

	containerCfg := &ContainerConfig{
		Name:        containerName,
		Image:       imageName,
		Env:         envVars,
		CPULimit:    1.0,
		MemoryLimit: 512,
	}

	containerID, err := d.CreateContainer(ctx, containerCfg)
	if err != nil {
		instance.Status = model.InstanceStatusError
		instance.ErrorMessage = fmt.Sprintf("Failed to create container: %v", err)
		_ = d.instanceRepo.Update(instance)
		return instance, nil
	}

	instance.ContainerID = containerID

	if err := d.StartContainer(ctx, containerID); err != nil {
		instance.Status = model.InstanceStatusError
		instance.ErrorMessage = fmt.Sprintf("Failed to start container: %v", err)
		_ = d.instanceRepo.Update(instance)
		return instance, nil
	}

	instance.Status = model.InstanceStatusRunning
	instance.HealthStatus = model.HealthStatusHealthy

	if err := d.instanceRepo.Update(instance); err != nil {
		return nil, fmt.Errorf("failed to update instance status: %w", err)
	}

	return instance, nil
}

func (d *DockerManager) ListContainers(ctx context.Context) ([]map[string]interface{}, error) {
	instances, _, err := d.instanceRepo.ListByUserID(0, 0, 100)
	if err != nil {
		return nil, err
	}

	containers := make([]map[string]interface{}, 0, len(instances))
	for _, inst := range instances {
		containers = append(containers, map[string]interface{}{
			"id":          inst.ID,
			"name":        inst.ContainerName,
			"status":      inst.Status,
			"containerId": inst.ContainerID,
		})
	}
	return containers, nil
}

func (d *DockerManager) StartAgent(ctx context.Context, instanceID uint) error {
	instance, err := d.instanceRepo.GetByID(instanceID)
	if err != nil {
		return err
	}

	if instance.ContainerID == "" {
		return fmt.Errorf("no container associated with this instance")
	}

	if err := d.StartContainer(ctx, instance.ContainerID); err != nil {
		instance.Status = model.InstanceStatusError
		instance.ErrorMessage = err.Error()
		_ = d.instanceRepo.Update(instance)
		return err
	}

	instance.Status = model.InstanceStatusRunning
	instance.HealthStatus = model.HealthStatusHealthy
	return d.instanceRepo.Update(instance)
}

func (d *DockerManager) StopAgent(ctx context.Context, instanceID uint) error {
	instance, err := d.instanceRepo.GetByID(instanceID)
	if err != nil {
		return err
	}

	if instance.ContainerID == "" {
		return fmt.Errorf("no container associated with this instance")
	}

	if err := d.StopContainer(ctx, instance.ContainerID); err != nil {
		return err
	}

	instance.Status = model.InstanceStatusStopped
	return d.instanceRepo.Update(instance)
}