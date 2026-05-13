# AGENTS.md

# 技术栈

| 领域 | 选择 |
|------|------|
| 前端 | React + TypeScript，shadcn/ui + Tailwind |
| 小程序/移动端 | Taro |
| 后端 | Go（Gin + GORM + Viper + Zap） |
| AI/ML | Python（FastAPI） |
| 工具/脚本 | TypeScript（Node.js） |
| 格式化 | gofmt（Go）/ ruff（Python）/ Prettier（TS），提交前必须格式化 |
| 测试 | gotests / pytest / Vitest + Playwright |

---

## ⚠️ 项目说明索引

各子项目的关键信息记录在各自的 README.md 中：

| 项目 | 说明文件 | 关键内容 |
|------|----------|----------|
| frontend | `frontend/README.md` | 路由布局、主题系统、组件结构、渐进式适配 |

**AI 行为要求**：
- 开始任务前，先阅读相关项目的 README.md
- 了解项目的关键设计决策和当前状态
- 遵循项目中已有的模式和约定

---

⚠️ **执行任何操作前，先匹配下方触发词，加载对应规则文件**

---

# 按需加载

| 触发词 | 规则文件 | 核心内容 |
|--------|----------|----------|
| `写代码`、`修Bug`、`重构`、`Debug`、`优化` | behavior.md + verification.md | 思考方式、工作原则、验证流程 |
| `提交`、`commit`、`git`、`push` | conventions.md + review.md + verification.md | Git提交规范、提交前检查、验证流程 |
| `API`、`数据库`、`字段`、`表`、`安全`、`错误码`、`配置`、`日志` | conventions.md | API/DB/安全/错误码/配置/日志规范 |
| `架构`、`模块`、`依赖`、`分层`、`新建项目`、`初始化目录` | architecture.md + frontend.md + backend.md | 架构原则、前后端目录结构 |
| `部署`、`Docker`、`docker-compose`、`容器` | deployment.md + templates.md | 部署规范、Dockerfile模板 |
| `写Dockerfile` | templates.md | Dockerfile模板 |
| `修改规则`、`新增规则`、`删除规则`、`AGENTS.md` | philosophy.md | 规则哲学 |

**规则文件位置**: `docs/rules/`

---

## 渐进式更新规则

### 项目说明更新时机

当以下情况发生时，更新相关项目的 README.md：

| 情况 | 操作 |
|------|------|
| 新增关键架构决策 | 记录到项目 README.md |
| 新增重要组件/模块 | 记录到项目 README.md |
| 修改现有架构 | 更新项目 README.md 对应部分 |
| 发现 AI 频繁误解某模块 | 补充说明到项目 README.md |
| 完成"系统级"功能 | 更新项目 README.md（如主题系统、权限系统） |

### 更新原则

1. **记录关键决策**：为什么这样设计，而非代码细节
2. **记录当前状态**：哪些已完成、哪些待完成
3. **记录常见陷阱**：AI 容易误解或出错的地方
4. **保持简洁**：README.md 是概览，细节在代码注释

### 示例：新增功能后的更新

```markdown
## 新增功能：权限系统

### 架构决策
- 使用 RBAC 模型
- 权限存储在 JWT token 中
- 前端路由守卫 + 后端 API 鉴权

### 当前状态
- ✅ 后端权限中间件
- ✅ 前端路由守卫
- ❌ 权限管理页面（待实现）

### 常见陷阱
- 前端权限只是 UX 优化，后端必须重新验证
- token 过期后需要刷新权限
```

---

# 行为底线

## 先理解，再动手

- 修改前必须阅读相关代码，理解模块职责和调用关系
- 禁止猜测未确认的行为，搜索到确认或读完代码为止

## 最小修改

- 只解决当前任务，禁止顺手重构、升级依赖、改架构、统一风格
- 修复问题时仅修改必要范围，保持兼容

## 验证后结束

- 修改后必须验证：编译、类型检查、相关测试
- 禁止提交构建失败、类型错误或测试失败的代码

## 安全底线

- 禁止硬编码密钥/密码/Token，禁止提交 .env
- 禁止静默吞掉错误、空 catch
- 禁止绕过类型系统（any、@ts-ignore）

---

规则未覆盖的情境，优先遵循项目既有代码风格。
