# AgentBaba 系统架构设计

> 基于 Hermes 架构思想用 Go 原生实现的 Agent 创建系统

## 1. 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │需求输入  │  │对话澄清  │  │进度展示  │  │Agent管理 │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
                              │ REST API
┌─────────────────────────────────────────────────────────────────┐
│                     Backend (Go + Gin)                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Handler Layer                          │   │
│  │  AgentBabaHandler / SkillHandler / MCPHandler            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Service Layer                          │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │   │
│  │  │DialogMgr   │  │SkillRegistry│  │MCPManager   │       │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │   │
│  │  │AgentRuntime │  │DockerMgr   │  │TestRunner   │       │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Repository Layer                       │   │
│  │  AgentBabaRepo / SkillRepo / MCPRepo / AgentInstanceRepo│   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                        Data Layer                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  MySQL   │  │ Local FS │  │MCP Market│  │ Docker   │       │
│  │(Metadata)│  │(Skills)  │  │  (API)   │  │ Engine   │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    Agent Container Pool                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │ Agent-1  │  │ Agent-2  │  │ Agent-N  │  (Docker Containers) │
│  │(Runtime) │  │(Runtime) │  │(Runtime) │                      │
│  └──────────┘  └──────────┘  └──────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

## 2. 核心功能流程

```
用户需求 → 对话澄清 → Skill匹配 → 配置生成 → Docker构建 → 测试验证 → Agent运行
    │          │           │           │            │           │
    ▼          ▼           ▼           ▼            ▼           ▼
 创建会话   提问回答   搜索推荐   预览确认   容器启动   运行测试
```

## 3. 数据模型

### 3.1 AgentBabaSession - Agent 创建会话

```go
type AgentBabaSession struct {
    ID            uint           `gorm:"primaryKey" json:"id"`
    UserID        uint           `gorm:"index;not null" json:"user_id"`
    Title         string         `gorm:"size:255" json:"title"`
    Description   string         `gorm:"type:text" json:"description"`
    Status        string         `gorm:"size:50;index" json:"status"` // draft, clarifying, configuring, building, testing, completed, failed
    CurrentStep   int            `gorm:"default:1" json:"current_step"`
    
    ClarificationJSON string    `gorm:"type:text" json:"clarification_json"`
    AnswersJSON       string    `gorm:"type:text" json:"answers_json"`
    MatchedSkillsJSON string    `gorm:"type:text" json:"matched_skills_json"`
    AgentConfigJSON   string    `gorm:"type:text" json:"agent_config_json"`
    AgentInstanceID   sql.NullInt64 `gorm:"index" json:"agent_instance_id"`
    
    CreatedAt     time.Time      `json:"created_at"`
    UpdatedAt     time.Time      `json:"updated_at"`
    DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}
```

### 3.2 Skill - Skill 库

```go
type Skill struct {
    ID              uint           `gorm:"primaryKey" json:"id"`
    Name            string         `gorm:"size:100;uniqueIndex;not null" json:"name"`
    DisplayName     string         `gorm:"size:255" json:"display_name"`
    Description     string         `gorm:"type:text" json:"description"`
    Category        string         `gorm:"size:100;index" json:"category"`
    Tags            string         `gorm:"type:text" json:"tags"`
    
    Source          string         `gorm:"size:50;index" json:"source"` // local, mcp_marketplace
    SourceID        string         `gorm:"size:255" json:"source_id"`
    
    ConfigSchemaJSON string       `gorm:"type:text" json:"config_schema_json"`
    DefaultConfigJSON string      `gorm:"type:text" json:"default_config_json"`
    
    MCPName         string         `gorm:"size:100" json:"mcp_name"`
    MCPTools        string         `gorm:"type:text" json:"mcp_tools"`
    
    Version         string         `gorm:"size:50" json:"version"`
    Author          string         `gorm:"size:255" json:"author"`
    Rating          float64        `gorm:"type:decimal(3,2)" json:"rating"`
    InstallCount    int            `gorm:"default:0" json:"install_count"`
    Status          string         `gorm:"size:50;index" json:"status"`
    
    CreatedAt       time.Time      `json:"created_at"`
    UpdatedAt       time.Time      `json:"updated_at"`
    DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
}
```

### 3.3 MCPServer - MCP 服务器配置

```go
type MCPServer struct {
    ID              uint           `gorm:"primaryKey" json:"id"`
    Name            string         `gorm:"size:100;uniqueIndex;not null" json:"name"`
    DisplayName     string         `gorm:"size:255" json:"display_name"`
    Description     string         `gorm:"type:text" json:"description"`
    
    TransportType   string         `gorm:"size:50" json:"transport_type"` // stdio, http, websocket
    Command         string         `gorm:"size:255" json:"command"`
    Args            string         `gorm:"type:text" json:"args"`
    Env             string         `gorm:"type:text" json:"env"`
    URL             string         `gorm:"size:255" json:"url"`
    
    ToolsJSON       string         `gorm:"type:text" json:"tools_json"`
    Status          string         `gorm:"size:50;index" json:"status"`
    LastHealthCheck time.Time      `json:"last_health_check"`
    
    CreatedAt       time.Time      `json:"created_at"`
    UpdatedAt       time.Time      `json:"updated_at"`
    DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
}
```

### 3.4 AgentInstance - 运行中的 Agent 实例

```go
type AgentInstance struct {
    ID              uint           `gorm:"primaryKey" json:"id"`
    SessionID       uint           `gorm:"index;not null" json:"session_id"`
    UserID          uint           `gorm:"index;not null" json:"user_id"`
    
    Name            string         `gorm:"size:255;not null" json:"name"`
    Description     string         `gorm:"type:text" json:"description"`
    
    ConfigJSON      string         `gorm:"type:text" json:"config_json"`
    SkillsJSON      string         `gorm:"type:text" json:"skills_json"`
    MCPServersJSON  string         `gorm:"type:text" json:"mcp_servers_json"`
    
    ContainerID     string         `gorm:"size:255;index" json:"container_id"`
    ContainerName   string         `gorm:"size:255;uniqueIndex" json:"container_name"`
    ImageName       string         `gorm:"size:255" json:"image_name"`
    PortMapping     string         `gorm:"type:text" json:"port_mapping"`
    
    Status          string         `gorm:"size:50;index" json:"status"` // creating, running, stopped, error
    HealthStatus    string         `gorm:"size:50" json:"health_status"`
    
    CPULimit        float64        `gorm:"type:decimal(10,2)" json:"cpu_limit"`
    MemoryLimit     int            `json:"memory_limit"`
    
    TotalRuns       int            `gorm:"default:0" json:"total_runs"`
    SuccessRuns     int            `gorm:"default:0" json:"success_runs"`
    FailedRuns      int            `gorm:"default:0" json:"failed_runs"`
    
    CreatedAt       time.Time      `json:"created_at"`
    UpdatedAt       time.Time      `json:"updated_at"`
    DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
}
```

## 4. API 端点设计

### 4.1 AgentBaba 会话管理

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/agentbaba/session/create | 创建新会话 |
| GET | /api/agentbaba/session/:id | 获取会话详情 |
| POST | /api/agentbaba/session/:id/answer | 回答澄清问题 |
| POST | /api/agentbaba/session/:id/match-skills | 匹配 Skill |
| POST | /api/agentbaba/session/:id/select-skills | 选择 Skill |
| POST | /api/agentbaba/session/:id/generate-config | 生成配置 |
| POST | /api/agentbaba/session/:id/build | 构建 Agent |
| POST | /api/agentbaba/session/:id/test | 测试 Agent |
| POST | /api/agentbaba/session/:id/deploy | 部署 Agent |

### 4.2 Skill 管理

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/skills | 列出 Skill |
| GET | /api/skills/:id | 获取 Skill 详情 |
| POST | /api/skills/sync | 同步 MCP Marketplace |

### 4.3 MCP 管理

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/mcp/servers | 列出 MCP 服务器 |
| POST | /api/mcp/servers | 安装 MCP 服务器 |
| DELETE | /api/mcp/servers/:name | 卸载 MCP 服务器 |
| POST | /api/mcp/servers/:name/start | 启动 MCP 服务器 |
| POST | /api/mcp/servers/:name/stop | 停止 MCP 服务器 |
| GET | /api/mcp/servers/:name/tools | 列出工具 |
| POST | /api/mcp/servers/:name/tools/:tool/call | 调用工具 |

### 4.4 Agent 实例管理

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/agent-instances | 列出实例 |
| GET | /api/agent-instances/:id | 获取实例详情 |
| POST | /api/agent-instances/:id/start | 启动实例 |
| POST | /api/agent-instances/:id/stop | 停止实例 |
| DELETE | /api/agent-instances/:id | 删除实例 |
| POST | /api/agent-instances/:id/run | 运行任务 |
| GET | /api/agent-instances/:id/logs | 获取日志 |

## 5. 目录结构

```
backend/
├── cmd/
│   ├── server/main.go              # 主应用入口
│   └── agent-runtime/main.go       # Agent Runtime 入口
│
├── internal/
│   ├── handler/
│   │   ├── agentbaba.go            # AgentBaba 会话管理
│   │   ├── skill.go                # Skill 管理
│   │   ├── mcp.go                  # MCP 管理
│   │   └── agent_instance.go       # Agent 实例管理
│   │
│   ├── service/
│   │   ├── agentbaba/
│   │   │   ├── dialog_manager.go   # 对话澄清管理
│   │   │   ├── spec_generator.go   # Agent 规格生成
│   │   │   └── orchestrator.go     # 流程编排
│   │   │
│   │   ├── skill/
│   │   │   ├── registry.go         # Skill 注册表
│   │   │   ├── matcher.go          # Skill 匹配器
│   │   │   └── syncer.go           # MCP Marketplace 同步
│   │   │
│   │   ├── mcp/
│   │   │   ├── manager.go          # MCP 管理器
│   │   │   ├── client.go           # MCP 客户端
│   │   │   ├── stdio.go            # stdio 传输
│   │   │   └── http.go             # http 传输
│   │   │
│   │   ├── runtime/
│   │   │   ├── agent_runtime.go    # Agent Runtime
│   │   │   ├── planner.go          # 规划器
│   │   │   ├── memory.go           # 记忆系统
│   │   │   └── executor.go         # 执行器
│   │   │
│   │   └── docker/
│   │       ├── manager.go          # Docker 管理器
│   │       └── monitor.go          # 容器监控
│   │
│   ├── repository/
│   │   ├── agentbaba_session.go
│   │   ├── skill.go
│   │   ├── mcp_server.go
│   │   └── agent_instance.go
│   │
│   └── model/
│       ├── agentbaba_session.go
│       ├── skill.go
│       ├── mcp_server.go
│       └── agent_instance.go
│
├── docker/
│   └── agent/
│       ├── Dockerfile
│       └── docker-compose.agent.yml
│
└── config/
    └── agentbaba.yaml

frontend/
├── src/
│   ├── pages/
│   │   └── agentbaba/
│   │       ├── CreateSession.tsx
│   │       ├── Clarification.tsx
│   │       ├── SkillMatch.tsx
│   │       ├── ConfigPreview.tsx
│   │       ├── BuildProgress.tsx
│   │       └── TestAgent.tsx
│   │
│   ├── components/
│   │   └── agentbaba/
│   │       ├── QuestionCard.tsx
│   │       ├── SkillCard.tsx
│   │       └── ProgressSteps.tsx
│   │
│   └── lib/
│       └── api/
│           └── agentbaba.ts
```

## 6. 实施优先级

| Phase | 内容 | 预计时间 |
|-------|------|----------|
| Phase 1 | 核心框架：数据模型、Skill Registry、MCP Manager、Docker Manager | 2-3 周 |
| Phase 2 | Agent Runtime：核心逻辑、Planner、Memory、LLM 客户端 | 2-3 周 |
| Phase 3 | Dialog Manager：需求分析、澄清问题生成、规格生成 | 1-2 周 |
| Phase 4 | 前端界面：会话创建、Skill 匹配、配置预览、测试 | 2-3 周 |
| Phase 5 | 测试和优化：端到端测试、性能优化 | 1-2 周 |

**总计：8-12 周**
