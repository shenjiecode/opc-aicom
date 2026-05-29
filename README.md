# opc-aicom

A community platform connecting AI computing resources with developers.

## Quick Start

```bash
# 1. 启动 MySQL 数据库
docker-compose up -d

# 2. 启动后端 (端口 8080)
cd backend && go run cmd/server/main.go

# 3. 启动前端 (端口 5173)
cd frontend && npm install && npm run dev
```

访问 http://localhost:5173 即可使用。

**或者使用 Makefile：**
```bash
make dev       # 启动数据库
make backend   # 启动后端
make frontend  # 启动前端
```

## Prerequisites

- Docker（用于 MySQL）
- Go 1.25+
- Node.js 20+

## Technology Stack

| Layer | Technology |
|-------|------------|
| Backend | Go + Gin + GORM + MySQL 8.0 + JWT + Viper + Zap |
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS 4 + shadcn/ui |

## Project Structure

```
opc-aicom/
├── backend/              # Go 后端
│   ├── cmd/server/main.go
│   ├── internal/
│   │   ├── handler/      # API handlers
│   │   ├── middleware/   # JWT auth
│   │   ├── model/        # 数据模型
│   │   ├── pkg/          # database, jwt, logger
│   │   └── repository/   # 数据访问
│   ├── pkg/config/       # 配置管理
│   ├── config/config.yaml
│   └── go.mod
├── frontend/             # React 前端
│   ├── src/
│   │   ├── components/ui/  # shadcn 组件
│   │   ├── pages/          # 页面组件
│   │   └── lib/            # API 工具
│   └── package.json
├── docker-compose.yaml   # MySQL 8.0
└── Makefile
```

## API Endpoints

All APIs return unified format: `{code, message, data}`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/user/register | No | 用户注册 |
| POST | /api/user/login | No | 用户登录，返回 JWT |
| POST | /api/user/info | Yes | 获取用户信息 |
| POST | /api/home/stats | No | 首页统计 |
| POST | /api/community/list | No | 帖子列表 |
| POST | /api/community/create | Yes | 发帖 |
| POST | /api/community/like | Yes | 点赞 |
| POST | /api/community/comment | Yes | 评论 |
| POST | /api/task/list | No | 任务列表 |
| POST | /api/task/create | Yes | 发布任务 |
| POST | /api/task/apply | Yes | 接单申请 |

## B2B Project API
Project management API for B2B collaboration, supporting team member management, room coordination, and deliverable tracking.

### Authentication
All B2B project endpoints require JWT authentication. Include token in request header:
```
Authorization: Bearer <jwt_token>
```

### Project Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/project/list | Yes | Get project list |
| POST | /api/project/create | Yes | Create new project |
| GET | /api/project/:id | Yes | Get project details |
| PUT | /api/project/:id | Yes | Update project |
| DELETE | /api/project/:id | Yes | Delete project |

### Member Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/project/:id/members | Yes | List project members |
| POST | /api/project/:id/members | Yes | Add member to project |
| DELETE | /api/project/:id/members/:uid | Yes | Remove member |
| PUT | /api/project/:id/members/:uid/role | Yes | Update member role |

### Rooms & Deliverables

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/project/:id/rooms | Yes | List project rooms |
| POST | /api/project/:id/rooms | Yes | Create project room |
| GET | /api/project/:id/deliverables | Yes | List deliverables |
| POST | /api/project/:id/deliverables | Yes | create deliverable |
| PUT | /api/project/:id/deliverables/:did | Yes | Update deliverable |
| DELETE | /api/project/:id/deliverables/:did | Yes | Delete deliverable |

### Usage Examples

**Create a project:**
```bash
curl -X POST http://localhost:8080/api/project/create \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "AI Platform", "description": "Building AI infra", "budget": 50000}'
```

**Add member to project:**
```bash
curl -X POST http://localhost:8080/api/project/1/members \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_id": 123, "role": "developer"}'
```

**List project deliverables:**
```bash
curl http://localhost:8080/api/project/1/deliverables \
  -H "Authorization: Bearer $JWT_TOKEN"
```
### Bite广场 (BitePlaza)

A public room square where users can browse, join, and create Matrix public rooms as forum topics.

**Features**:

- Browse public Matrix rooms

- Join/leave rooms

- Create new public rooms

- Search and filter rooms (全部, 官方, 热门, 推荐, 我加入的)

- View room statistics (members, posts)

**Access**: Navigate to `/bite-plaza` from the sidebar (核心板块)
## Configuration

Database config in `docker-compose.yaml`:

| Variable | Default |
|----------|---------|
| MYSQL_DATABASE | opc_aicom |
| MYSQL_USER | opc_user |
| MYSQL_PASSWORD | opcpassword |
| MYSQL_PORT | 3306 |

Backend config in `backend/config/config.yaml`.

## Development

```bash
# Backend tests
cd backend && go test ./...

# Frontend build
cd frontend && npm run build

# Frontend lint
cd frontend && npm run lint
```

## License

MIT