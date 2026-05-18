# AI 模型 API 网关使用指南

## 概述

OPC AI Gateway 是一个统一的大模型 API 网关，提供：

- **统一接口**: 所有模型通过 OpenAI-compatible API 访问
- **多 Provider 支持**: OpenAI、DeepSeek、Anthropic、自定义
- **子账户管理**: 每个 OPC 用户获得独立的虚拟 API Key
- **Token 追踪**: 按用户/模型/渠道记录消耗和费用
- **动态配置**: 运行时增删改模型和渠道
- **负载均衡**: 优先级 + 权重路由，失败自动降级

---

## 快速开始

### 1. 启动网关服务

```bash
cd AIGateway

# 方式一: 直接运行
go run cmd/server/main.go

# 方式二: 编译后运行
go build -o aigateway cmd/server/main.go
./aigateway

# 网关启动在 http://localhost:8081
```

### 2. 添加 Provider 渠道

通过 Admin API 添加第一个渠道（例如 DeepSeek）:

```bash
curl -X POST http://localhost:8081/admin/channels \
  -H "Content-Type: application/json" \
  -d '{
    "name": "DeepSeek-Primary",
    "provider": "deepseek",
    "base_url": "https://api.deepseek.com/v1",
    "api_key": "YOUR_DEEPSEEK_API_KEY",
    "models": ["deepseek-chat", "deepseek-coder"],
    "weight": 100,
    "priority": 1
  }'
```

### 3. 配置模型定价

```bash
curl -X POST http://localhost:8081/admin/models \
  -H "Content-Type: application/json" \
  -d '{
    "name": "deepseek-chat",
    "provider": "deepseek",
    "channel_id": 1,
    "input_price": "0.0001",
    "output_price": "0.0002",
    "max_tokens": 64000
  }'
```

### 4. 为用户创建虚拟 Key

```bash
curl -X POST http://localhost:8081/admin/keys \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 25,
    "name": "V4Test Key"
  }'

# 返回: {"code": 0, "data": {"key": "sk-opc-a1b2c3d4...", ...}}
```

### 5. 使用虚拟 Key 调用模型

```bash
curl -X POST http://localhost:8081/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-opc-a1b2c3d4..." \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "你好"}],
    "stream": false
  }'
```

---

## API 端点详解

### OpenAI-Compatible API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/v1/chat/completions` | POST | 聊天补全（支持 streaming） |
| `/v1/models` | GET | 列出可用模型 |
| `/v1/models/:id` | GET | 获取模型详情 |

**请求示例（非流式）**:

```json
{
  "model": "gpt-4o",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "What is the capital of France?"}
  ],
  "max_tokens": 1000,
  "temperature": 0.7
}
```

**请求示例（流式）**:

```json
{
  "model": "deepseek-chat",
  "messages": [{"role": "user", "content": "写一首诗"}],
  "stream": true
}
```

响应为 SSE 格式：

```
data: {"id":"chat-xxx","choices":[{"delta":{"content":"春"}}]}
data: {"id":"chat-xxx","choices":[{"delta":{"content":"风"}}]}
data: [DONE]
```

---

### Admin API - 渠道管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/channels` | GET | 列出所有渠道 |
| `/admin/channels/:id` | GET | 获取渠道详情 |
| `/admin/channels` | POST | 创建新渠道 |
| `/admin/channels/:id` | PUT | 更新渠道 |
| `/admin/channels/:id` | DELETE | 删除渠道 |
| `/admin/channels/:id/test` | POST | 测试渠道连通性 |

**创建渠道请求体**:

```json
{
  "name": "渠道名称",
  "provider": "openai | deepseek | anthropic | custom",
  "base_url": "https://api.openai.com/v1",
  "api_key": "sk-xxxxx",
  "models": ["gpt-4o", "gpt-3.5-turbo"],
  "weight": 100,
  "priority": 1
}
```

---

### Admin API - 模型配置

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/models` | GET | 列出所有模型 |
| `/admin/models` | POST | 创建模型配置 |
| `/admin/models/:id` | PUT | 更新模型配置 |
| `/admin/models/:id` | DELETE | 删除模型配置 |

**创建模型请求体**:

```json
{
  "name": "gpt-4o",
  "provider": "openai",
  "channel_id": 1,
  "input_price": "0.005",
  "output_price": "0.015",
  "max_tokens": 128000
}
```

---

### Admin API - 虚拟 Key 管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/keys` | GET | 列出所有 Key |
| `/admin/keys` | POST | 创建新 Key |
| `/admin/keys/:id` | DELETE | 撤销 Key |

**创建 Key 请求体**:

```json
{
  "user_id": 25,
  "name": "开发环境 Key"
}
```

---

### Admin API - 使用统计

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/usage` | GET | 总体统计 |
| `/admin/usage/user/:user_id` | GET | 用户统计 |
| `/admin/usage/key/:key_id` | GET | Key 统计 |
| `/admin/usage/model/:model` | GET | 模型统计 |

---

## 渠道配置指南

### OpenAI

```json
{
  "provider": "openai",
  "base_url": "https://api.openai.com/v1",
  "api_key": "sk-proj-xxxxx",
  "models": ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"]
}
```

**定价参考**:

| 模型 | 输入价格 ($/1K) | 输出价格 ($/1K) |
|------|-----------------|-----------------|
| gpt-4o | $0.005 | $0.015 |
| gpt-4-turbo | $0.01 | $0.03 |
| gpt-3.5-turbo | $0.0005 | $0.0015 |

---

### DeepSeek

```json
{
  "provider": "deepseek",
  "base_url": "https://api.deepseek.com/v1",
  "api_key": "sk-xxxxx",
  "models": ["deepseek-chat", "deepseek-coder"]
}
```

**定价参考**:

| 模型 | 输入价格 ($/1K) | 输出价格 ($/1K) |
|------|-----------------|-----------------|
| deepseek-chat | $0.0001 | $0.0002 |
| deepseek-coder | $0.0001 | $0.0002 |

---

### Anthropic

```json
{
  "provider": "anthropic",
  "base_url": "https://api.anthropic.com/v1",
  "api_key": "sk-ant-xxxxx",
  "models": ["claude-3-opus", "claude-3-sonnet"]
}
```

**注意**: Anthropic 使用 Messages API 格式，网关自动转换。

**定价参考**:

| 模型 | 输入价格 ($/1K) | 输出价格 ($/1K) |
|------|-----------------|-----------------|
| claude-3-opus | $0.015 | $0.075 |
| claude-3-sonnet | $0.003 | $0.015 |

---

### Azure OpenAI

```json
{
  "provider": "openai",
  "base_url": "https://YOUR_RESOURCE.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT",
  "api_key": "azure-key",
  "models": ["gpt-4"]
}
```

---

### 自定义 Provider

支持任何 OpenAI-compatible API:

```json
{
  "provider": "custom",
  "base_url": "https://your-api.com/v1",
  "api_key": "your-key",
  "models": ["your-model"]
}
```

---

## 负载均衡策略

网关使用 **优先级 + 权重** 的路由策略:

1. **优先级**: 高优先级渠道优先使用
2. **权重**: 同优先级内按权重轮询
3. **健康检查**: 失败次数超过阈值自动降级

**配置示例**:

```json
// 主渠道（优先级最高）
{
  "name": "OpenAI-Primary",
  "priority": 10,
  "weight": 100
}

// 备用渠道（优先级较低）
{
  "name": "OpenAI-Backup",
  "priority": 5,
  "weight": 50
}

// 低成本渠道（优先级最低）
{
  "name": "DeepSeek",
  "priority": 1,
  "weight": 100
}
```

路由顺序：
- 优先尝试 OpenAI-Primary (priority=10)
- 失败后尝试 OpenAI-Backup (priority=5)
- 最后尝试 DeepSeek (priority=1)

---

## 配额与限流

### 配额管理

每个虚拟 Key 有独立的 Token 配额:

```json
{
  "key": "sk-opc-xxxxx",
  "quota": 1000000,     // 总配额: 1M tokens
  "used_quota": 234567, // 已使用: 234K tokens
  "rate_limit": 60      // 限流: 60 req/min
}
```

配额用尽后请求返回 403:

```json
{
  "error": {
    "message": "quota exceeded, please purchase more tokens",
    "type": "quota_error"
  }
}
```

### 限流策略

滑动窗口限流，超出返回 429:

```json
{
  "error": {
    "message": "rate limit exceeded, please slow down",
    "type": "rate_limit_error"
  }
}
```

---

## Token 消耗追踪

每次请求自动记录:

| 字段 | 说明 |
|------|------|
| `virtual_key_id` | 使用的虚拟 Key |
| `channel_id` | 实际调用的渠道 |
| `model` | 使用的模型 |
| `prompt_tokens` | 输入 Token |
| `completion_tokens` | 输出 Token |
| `total_tokens` | 总计 |
| `cost` | 计算费用 |
| `latency_ms` | 响应延迟 |
| `status` | 成功/失败 |

**费用计算公式**:

```
cost = (prompt_tokens / 1000) * input_price 
     + (completion_tokens / 1000) * output_price
```

---

## 最佳实践

### 1. 渠道配置

- 至少配置 2 个渠道实现故障转移
- 主渠道使用高优先级
- 低成本渠道作为降级备选
- 定期测试渠道连通性

### 2. 模型定价

- 使用精确定价（小数点后 6 位）
- 根据官方定价定期更新
- 考虑不同地区的价格差异

### 3. Key 管理

- 不同环境使用不同 Key（开发/生产）
- 设置合理的过期时间
- 定期审计 Key 使用情况
- 及时撤销可疑 Key

### 4. 监控告警

- 关注成功率变化
- 监控延迟趋势
- 设置配额预警阈值
- 定期检查费用异常

---

## 错误处理

| 状态码 | 说明 | 处理建议 |
|--------|------|----------|
| 400 | 请求格式错误 | 检查 JSON 格式 |
| 401 | Key 无效/过期 | 更换 Key |
| 403 | 配额用尽 | 增加 quota |
| 404 | 模型不存在 | 检查模型名称 |
| 429 | 请求过快 | 降低频率 |
| 500 | 网关内部错误 | 检查日志 |
| 502 | Provider 错误 | 检查渠道配置 |

---

## 集成示例

### Python (OpenAI SDK)

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8081/v1",
    api_key="sk-opc-xxxxx"
)

response = client.chat.completions.create(
    model="deepseek-chat",
    messages=[{"role": "user", "content": "Hello"}]
)
print(response.choices[0].message.content)
```

### JavaScript (fetch)

```javascript
const response = await fetch('http://localhost:8081/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer sk-opc-xxxxx'
  },
  body: JSON.stringify({
    model: 'gpt-4o',
    messages: [{role: 'user', content: 'Hello'}]
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);
```

### cURL (Streaming)

```bash
curl -X POST http://localhost:8081/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-opc-xxxxx" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hi"}],"stream":true}' \
  --no-buffer
```

---

## 配置文件

`AIGateway/config.yaml`:

```yaml
server:
  port: 8081
  mode: debug  # debug | release

database:
  host: localhost
  port: 3306
  user: opc_user
  password: opcpassword
  dbname: opc_aicom

gateway:
  default_quota: 1000000   # 新 Key 默认配额 (tokens)
  default_rpm: 60          # 默认限流 (requests/min)
  default_tpm: 100000      # 默认 Token 限流
```

环境变量覆盖：

```bash
export AIGW_SERVER_PORT=8082
export AIGW_DATABASE_HOST=192.168.1.100
export AIGW_GATEWAY_DEFAULT_QUOTA=5000000
```

---

## 常见问题

### Q: Key 创建后看不到完整内容？

A: Key 只在创建时完整返回一次，之后只显示前 4 位 + 后 4 位。请保存好创建时的完整 Key。

### Q: Streaming 响应没有 Token 统计？

A: 部分 Provider 在流式响应中不包含 Usage 字段，网关会估算 Token 数量。

### Q: 如何查看某用户的具体消耗？

A: 使用 `/admin/usage/user/:user_id` 或在管理界面查看。

### Q: 渠道测试失败怎么办？

A: 检查 API Key 是否正确，Base URL 是否可访问，网络是否有防火墙限制。

---

## 版本信息

- 网关版本: v1.0.0
- 支持的 Provider: OpenAI, DeepSeek, Anthropic, Azure, Custom
- Go 版本: 1.25+
- 数据库: MySQL 8.0 (共享 opc_aicom)