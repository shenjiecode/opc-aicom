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