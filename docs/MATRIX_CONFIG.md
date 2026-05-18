# Matrix 服务器配置指南

OPC AICom 支持连接本地或外部 Matrix 服务器。本文档说明如何配置 Matrix 连接。

## 配置方式

### 方式一：本地 Matrix 服务器（开发环境）

项目包含一个预配置的 Matrix 服务器（Dendrite），位于 `MatrixNet/` 目录。

**启动本地服务器：**

```bash
cd MatrixNet
docker-compose up -d
```

服务将在 `http://localhost:8008` 启动。

**默认配置：**
- Homeserver URL: `http://localhost:8008`
- Server Name: `localhost`
- Registration Shared Secret: `mysecret`
- 已预配置 Worker: `worker-001`, `worker-002`

### 方式二：外部 Matrix 服务器（生产环境）

**生产服务器配置：**
- Homeserver URL: `http://8.217.143.228:8008`
- Server Name: `8.217.143.228`
- Registration Shared Secret: `nexus_matrix_secret_xK9mP2vL7qR4wY6j`

**快速切换到外部服务器：**

```bash
# 前端配置
echo 'VITE_MATRIX_HOMESERVER=http://8.217.143.228:8008' > frontend/.env.local

# 后端配置（修改 backend/config/config.yaml）
# matrix:
#   homeserver_url: http://8.217.143.228:8008
#   server_name: 8.217.143.228
#   shared_secret: nexus_matrix_secret_xK9mP2vL7qR4wY6j
#   admin_api_url: http://8.217.143.228:8008/_matrix/admin

# 重启前后端服务
```

### 方式二：外部 Matrix 服务器（生产环境）

连接外部 Matrix 服务器需要配置以下参数：

**前端配置（frontend/.env.local）：**

```bash
VITE_MATRIX_HOMESERVER=http://your-matrix-server:8008
```

**后端配置（环境变量或 backend/config/config.yaml）：**

```yaml
matrix:
  homeserver_url: http://your-matrix-server:8008
  server_name: your-server-name    # Matrix 服务器的 server_name
  shared_secret: your-secret       # 注册共享密钥
  admin_api_url: http://your-matrix-server:8008/_matrix/admin
  workers:
    - worker-001                   # 已注册的 Worker 用户名列表
    - worker-002
```

**或使用环境变量：**

```bash
# 后端环境变量
MATRIX_HOMESERVER_URL=http://your-matrix-server:8008
MATRIX_SERVER_NAME=your-server-name
MATRIX_SHARED_SECRET=your-secret
MATRIX_ADMIN_API_URL=http://your-matrix-server:8008/_matrix/admin
```

## 配置参数说明

| 参数 | 说明 | 示例 |
|------|------|------|
| `homeserver_url` | Matrix Homeserver 的客户端 API 地址 | `http://localhost:8008` |
| `server_name` | Matrix 服务器的域名标识 | `localhost`, `matrix.example.com` |
| `shared_secret` | 用于用户自动注册的 HMAC 密钥 | `mysecret` |
| `admin_api_url` | Matrix Admin API 地址 | `http://localhost:8008/_matrix/admin` |
| `workers` | 已注册的 AI Worker 用户名列表 | `["worker-001", "worker-002"]` |

## 外部服务器要求

连接外部 Matrix 服务器时，需确保：

1. **服务器已运行**：Matrix Homeserver（Synapse/Dendrite）可访问
2. **用户注册机制**：
   - 如果 `registration_shared_secret` 已配置，后端会自动为 OPC 用户注册 Matrix 账号
   - 如果禁用注册，需手动创建 Matrix 用户
3. **Worker 用户**：外部服务器需有对应的 Worker 用户（如 `worker-001`）
4. **CORS 配置**：Matrix 服务器需允许跨域请求（开发环境）

## 用户自动注册流程

当 OPC 用户首次连接 Matrix 时：

1. 后端调用 `/api/matrix/login` 获取 Matrix Token
2. 如果用户不存在，使用 `shared_secret` 自动注册
3. 返回 `access_token` 给前端，前端使用 Matrix JS SDK 连接

**注册 API 格式（Dendrite）：**

```
POST /_synapse/admin/v1/register
{
  "username": "user_123",
  "password": "password",
  "nonce": "...",
  "mac": "HMAC-SHA1(nonce + username + password + notadmin)"
}
```

## Worker 配置

Worker 是 Matrix 中的特殊用户，用于接收任务指令。

**本地开发：**
- MatrixNet 已预配置 `worker-001`, `worker-002`
- Worker 密码为 `password`

**外部服务器：**
- 需手动创建 Worker 用户
- 在后端配置 `matrix.workers` 列表中添加

## 常见问题

### Q: 切换外部服务器后连接失败？

检查：
1. `server_name` 是否匹配外部服务器配置
2. Matrix 服务器 CORS 是否允许前端域名
3. `shared_secret` 是否正确

### Q: Worker 状态显示离线？

Worker 需发送 `STATUS:ONLINE|worker-xxx` 消息到房间才能显示在线。本地 MatrixNet 的 Worker 容器会自动发送。

外部服务器需部署 Worker 服务。

### Q: 如何查看 Matrix 服务器用户？

**Dendrite（PostgreSQL）：**

```bash
docker exec -it dendrite-postgres psql -U dendrite -d dendrite
SELECT * FROM accounts;
```

## MatrixNet 目录说明

```
MatrixNet/
├── config/
│   └── dendrite.yaml    # Matrix 服务器配置（保留）
├── data/                # 运行时数据（不提交）
├── postgres-data/       # PostgreSQL 数据（不提交）
├── docker-compose.yml   # 服务编排
├── worker/              # Worker 服务代码
└── nginx/               # 反向代理配置
```

**运行时数据（data/, postgres-data/）不应提交到 Git。**

## 测试验证

**验证本地服务器：**

```bash
curl http://localhost:8008/_matrix/client/versions
```

**验证外部服务器：**

```bash
curl http://8.217.143.228:8008/_matrix/client/versions
```

应返回：

```json
{"versions":["v1.0","v1.1","v1.2","v1.3","v1.4","v1.5","v1.6"]}
```