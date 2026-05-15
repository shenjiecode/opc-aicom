# MatrixNet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一个基于开源 Matrix 通信协议的分布式节点管理系统，包含可运行在 Docker 中的 Worker 节点，以及带前端聊天室和 Worker 列表展示的 Commander 节点。支持双向通过 `@XXXX` 提及来发送指令和消息。

**Architecture:**
系统整体划分为以下几个核心组件：
1. **Matrix Homeserver**: 作为底层的去中心化通信路由节点（计划采用轻量级的 Dendrite）。
2. **Worker 节点**: 使用 Go 语言和 `mautrix-go` SDK 开发的无头服务。打包在 Docker 中，启动时自动登录 Matrix 网络，加入指定的“指挥部”房间并上报状态，持续监听 `@worker_id` 的消息并做出响应。
3. **Commander 后端**: 同样基于 Go 和 `mautrix-go`，作为指挥官的 Agent 登录 Matrix 网络。它负责维护当前活跃的 Worker 列表，并将 Matrix 房间消息桥接给前端。
4. **Commander 前端**: React 编写的 Web UI，提供类似聊天室的界面和侧边栏的在线 Worker 列表。

**Tech Stack:** Go (mautrix-go), React (TypeScript, Tailwind, shadcn/ui), Docker & Docker Compose, Matrix Protocol (Dendrite).

---

## 阶段一：产品规划与数据设计 (Product & Data Design)

1. **核心概念映射**：
   - **用户/账号**：Commander 拥有一个固定的 Matrix 账号（如 `@commander:localhost`），每个 Worker 拥有独立的账号（如 `@worker-001:localhost`）。
   - **房间 (Room)**：所有的节点默认加入一个全局的 `!command_center:localhost` 房间。
   - **注册机制**：Worker 启动时，在房间内发送一条特定的状态消息（如 `{"msgtype": "m.notice", "body": "STATUS:ONLINE"}`），Commander 解析该消息并将其加入在线列表。
2. **数据流转**：
   - Commander 发送指令：在前端输入 `@worker-001 执行任务` -> Commander 后端调用 Matrix API 发送消息 -> Matrix 路由 -> Worker 收到事件 -> 解析 `@worker-001` -> 确认是发给自己的 -> 执行。

---

## 阶段二：编码实现任务分解 (Bite-Sized Tasks)

### Task 1: 搭建基础设施 (Matrix Homeserver)

**Files:**
- Create: `MatrixNet/docker-compose.yml`
- Create: `MatrixNet/config/dendrite.yaml`

- [ ] **Step 1: 创建 Matrix 目录结构**
```bash
mkdir -p MatrixNet/config MatrixNet/worker MatrixNet/commander
```

- [ ] **Step 2: 编写 docker-compose.yml 部署 Dendrite**
```yaml
# MatrixNet/docker-compose.yml
version: '3'
services:
  homeserver:
    image: matrixdotorg/dendrite-monolith:latest
    ports:
      - "8008:8008"
    volumes:
      - ./config:/etc/dendrite
    command: ["-tls-cert", "", "-tls-key", ""]
```
*(注：实际执行时需要先生成 Dendrite 的密钥和基础配置文件)*

### Task 2: 实现 Worker 核心逻辑 (Go)

**Files:**
- Create: `MatrixNet/worker/main.go`
- Create: `MatrixNet/worker/Dockerfile`
- Create: `MatrixNet/worker/go.mod`

- [ ] **Step 1: 初始化 Worker Go 模块**
```bash
cd MatrixNet/worker && go mod init matrixnet/worker && go get mautrix.io/go/mautrix
```

- [ ] **Step 2: 编写 Worker Matrix 客户端代码**
```go
// MatrixNet/worker/main.go
package main

import (
	"fmt"
	"os"
	"strings"
	"mautrix.io/go/mautrix"
	"mautrix.io/go/mautrix/event"
)

func main() {
	workerID := os.Getenv("WORKER_ID")
	client, _ := mautrix.NewClient("http://homeserver:8008", "@"+workerID+":localhost", "password")
	
	// 注册并加入指挥部房间
	// ... (登录逻辑)

	syncer := client.Syncer.(*mautrix.DefaultSyncer)
	syncer.OnEventType(event.EventMessage, func(source mautrix.EventSource, evt *event.Event) {
		if strings.Contains(evt.Content.AsMessage().Body, "@"+workerID) {
			client.SendText(evt.RoomID, "收到指令，正在执行！")
		}
	})

	client.Sync()
}
```

- [ ] **Step 3: 编写 Worker Dockerfile**
```dockerfile
# MatrixNet/worker/Dockerfile
FROM golang:1.21-alpine
WORKDIR /app
COPY . .
RUN go build -o worker .
CMD ["./worker"]
```

### Task 3: 实现 Commander 后端 (Go)

**Files:**
- Create: `MatrixNet/commander/backend/main.go`
- Create: `MatrixNet/commander/backend/go.mod`

- [ ] **Step 1: 初始化 Commander 后端模块**
```bash
cd MatrixNet/commander && mkdir backend && cd backend && go mod init matrixnet/commander-backend
```

- [ ] **Step 2: 编写 Commander Matrix 监听与 API 服务**
实现一个 Gin HTTP 服务，提供 `/api/workers` (获取在线 Worker) 和 `/api/send` (发送消息) 接口，并在后台运行 Matrix Syncer 监听 Worker 的上下线状态。

### Task 4: 实现 Commander 前端 (React)

**Files:**
- Create: `MatrixNet/commander/frontend/src/App.tsx` (基于现有项目脚手架或新建 Vite 项目)

- [ ] **Step 1: 构建聊天室 UI**
左侧/侧边栏：在线 Worker 列表 (轮询或 WebSocket 获取后端 `/api/workers`)。
右侧：聊天记录展示区与输入框。支持输入 `@` 时高亮显示。

- [ ] **Step 2: 联调与测试**
启动完整的 `docker-compose up -d`，验证 Commander 前端是否能看到自动注册的 Worker，并验证 `@` 消息的双向互通。
