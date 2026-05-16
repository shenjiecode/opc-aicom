# Matrix Integration Guide

## 概述

OPC AICom 已集成 Matrix 协议，实现多房间群聊功能。

## 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    OPC AICom 主站                               │
│  ┌──────────────┐     ┌──────────────┐                         │
│  │  React 前端   │────▶│  Go 后端      │                         │
│  │ (OPCWorkbench)│     │ (Matrix API) │                         │
│  └──────┬───────┘     └──────┬───────┘                         │
│         │                    │                                  │
│         │ matrix-js-sdk      │ HTTP Proxy                       │
│         │                    │                                  │
└─────────┼────────────────────┼──────────────────────────────────┘
          │                    │
          ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MatrixNet (独立部署)                          │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     │
│  │ Nginx Proxy  │────▶│  Dendrite    │────▶│  PostgreSQL  │     │
│  │ (CORS:8888)  │     │ (Matrix HS)  │     │              │     │
│  └──────────────┘     └──────────────┘     └──────────────┘     │
│                              │                                  │
│         ┌────────────────────┼────────────────────┐            │
│         ▼                    ▼                    ▼            │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     │
│  │ Worker-001   │     │ Worker-002   │     │ Light-Agent  │     │
│  │ (AI Agent)   │     │ (AI Agent)   │     │ (LLM Bridge) │     │
│  └──────────────┘     └──────────────┘     └──────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

## 快速启动

### 1. 启动 MatrixNet

```bash
cd MatrixNet
docker-compose up -d
```

服务启动后：
- Matrix Homeserver: `http://localhost:8008`
- CORS Proxy: `http://localhost:8888`
- Commander Backend: `http://localhost:8081`
- Light-Agent: `http://localhost:3000`

### 2. 创建测试用户

使用 Dendrite Admin API 创建用户：

```bash
# 创建用户
curl -X PUT "http://localhost:8008/_synapse/admin/v2/users/@test:localhost" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mysecret" \
  -d '{"password": "password", "admin": false}'
```

或使用 shared secret registration:

```bash
# 登录获取 token
curl -X POST "http://localhost:8008/_matrix/client/v3/login" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "m.login.password",
    "identifier": {"type": "m.id.user", "user": "test"},
    "password": "password"
  }'
```

### 3. 启动 OPC AICom 后端

```bash
cd backend
go run cmd/server/main.go
```

后端运行在 `http://localhost:8080`

### 4. 启动 OPC AICom 前端

```bash
cd frontend
npm install
npm run dev
```

前端运行在 `http://localhost:5173`

### 5. 访问 OPC 工作台

访问 `http://localhost:5173/opc-workbench`

## 用户映射

OPC 用户自动映射到 Matrix 用户：
- OPC 用户名: `alice`
- Matrix 用户: `@alice:localhost`
- 默认密码: 使用后端配置的共享密钥

## API 端点

### Matrix 代理 API (OPC 后端)

| Method | Endpoint | 描述 |
|--------|----------|------|
| POST | `/api/matrix/register` | 注册 Matrix 用户 |
| POST | `/api/matrix/login` | 获取 Matrix access_token |
| POST | `/api/matrix/rooms` | 创建房间 |
| GET | `/api/matrix/rooms` | 列出已加入房间 |
| POST | `/api/matrix/rooms/:room_id/join` | 加入房间 |
| POST | `/api/matrix/rooms/:room_id/leave` | 离开房间 |
| POST | `/api/matrix/rooms/:room_id/invite` | 邀请用户 |

### 直接访问 Matrix API (通过 CORS Proxy)

| Method | Endpoint | 描述 |
|--------|----------|------|
| POST | `http://localhost:8888/_matrix/client/v3/login` | 登录 |
| POST | `http://localhost:8888/_matrix/client/v3/createRoom` | 创建房间 |
| GET | `http://localhost:8888/_matrix/client/v3/joined_rooms` | 已加入房间 |
| GET | `http://localhost:8888/_matrix/client/v3/sync` | 同步状态 |

## 配置

### 后端配置 (backend/config/config.yaml)

```yaml
matrix:
  homeserver_url: http://localhost:8008
  server_name: localhost
  shared_secret: mysecret  # Dendrite registration_shared_secret
  admin_api_url: http://localhost:8008/_matrix/admin
```

### 前端配置 (frontend/.env.local)

```env
VITE_MATRIX_HOMESERVER=http://localhost:8888
```

## 故障排除

### CORS 错误

确保使用 `http://localhost:8888` (nginx proxy) 而不是 `http://localhost:8008` (直接 Dendrite)。

### 登录失败

检查 Matrix 用户是否已创建。OPC 后端会在用户首次访问 OPCWorkbench 时自动尝试登录。

### 查看日志

```bash
# MatrixNet 日志
cd MatrixNet
docker-compose logs -f dendrite

# OPC 后端日志
cd backend
go run cmd/server/main.go

# OPC 前端日志
cd frontend
npm run dev
```

## 生产环境部署

1. 更新 `MatrixNet/config/dendrite.yaml`:
   - 修改 `server_name` 为你的域名
   - 启用 HTTPS
   
2. 更新 `MatrixNet/nginx/nginx.conf`:
   - 修改 CORS 策略，限制允许的域名
   
3. 更新后端配置:
   - 修改 `matrix.homeserver_url`
   - 修改 `matrix.server_name`
   
4. 更新前端环境变量:
   - 设置 `VITE_MATRIX_HOMESERVER` 为生产 URL
