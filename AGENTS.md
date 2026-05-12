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

<!-- 根据项目实际情况调整 -->
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

# 按需加载


任务涉及多个领域时，加载所有相关规则。拿不准时宁可多加载。
| 任务 | 额外加载 |
|------|---------|
| 写代码/修 Bug | behavior.md |
| 重构/提交代码 | review.md |
| API/数据库/安全/错误码/配置/日志/提交 | conventions.md |
| 前端开发 | frontend.md |
| 后端开发 | backend.md |
| 架构修改 | architecture.md |
| 部署 | deployment.md |
| 写 Dockerfile | templates.md |
| 修改/新增/删除规则 | philosophy.md |

规则未覆盖的情境，优先遵循项目既有代码风格。
