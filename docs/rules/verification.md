# 验证流程

代码写完后必须验证，不能只靠 LSP。

---

## 代码编辑后必做

1. LSP 诊断确保无错误
2. 重新读取修改的文件，确认无多余/重复代码

---

## 按改动类型验证

### 后端改动（API、逻辑）

```bash
# 启动服务
docker-compose up -d
cd backend && go run cmd/server/main.go
```

验证 API：
```bash
curl -X POST http://localhost:8080/api/user/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}'
```

### 前端改动（逻辑、页面）

```bash
# 启动后端
docker-compose up -d
cd backend && go run cmd/server/main.go

# 启动前端（另一个终端）
cd frontend && npm run dev
```

使用 Playwright 验证页面：
- 检查页面能否正常加载
- 检查关键元素是否存在
- 检查控制台是否有错误

### 样式改动

使用 Playwright 截图验证：
- 检查布局是否正确
- 检查元素显示是否符合预期

### 配置/文档改动

无需启动验证，但需检查：
- YAML 格式正确
- Markdown 语法正确

### 重构改动

启动服务验证功能不变：
- 原有功能正常工作
- 无新增错误

---

## tmux 快速启动

```bash
# 创建会话
tmux new-session -d -s opc-dev

# 启动 MySQL
tmux send-keys -t opc-dev "docker-compose up -d" Enter

# 启动后端（新窗口）
tmux new-window -t opc-dev -n backend
tmux send-keys -t opc-dev:backend "cd backend && go run cmd/server/main.go" Enter

# 启动前端（新窗口）
tmux new-window -t opc-dev -n frontend
tmux send-keys -t opc-dev:frontend "cd frontend && npm run dev" Enter

# 查看所有窗口
tmux list-windows -t opc-dev
```

---

## Playwright 验证示例

```typescript
// 截图验证
await page.goto('http://localhost:5173');
await page.screenshot({ path: 'screenshot.png' });

// 检查元素存在
await expect(page.locator('h1')).toBeVisible();

// 检查控制台无错误
const errors: string[] = [];
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(msg.text());
});
// ... 操作后检查 errors 数组
```
