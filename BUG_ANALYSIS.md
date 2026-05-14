# Bug 分析报告：AiBIT 消息未正确渲染

## 问题现象

用户发送消息后，AI 回复显示为原始 JSON 字符串，而非解析后的内容和选项按钮：

```
{"msg":"你好！我是你的客户管家「比特」...","options":["产品推广海报","品牌宣传海报",...]}
```

期望效果：
- 显示解析后的 `msg` 文本内容
- 底部渲染可点击的选项按钮

---

## 问题定位过程

### 1. 添加日志系统

首先添加了完整的日志系统，覆盖以下流程阶段：
- `SESSION`: 会话初始化
- `CONNECTION`: 健康检查
- `MESSAGE`: 消息发送/接收
- `PARSE`: JSON 解析
- `RENDER`: 页面渲染

### 2. 通过 Playwright 自动化测试

使用 Playwright 访问页面，发送测试消息，收集控制台日志。

### 3. 日志分析

关键日志发现：

```
[RENDER] 处理消息 #1 {role: assistant, partsCount: 4, partsTypes: Array(4)}
```

**问题发现**：代码检查的是 `role === 'model'`，但 API 返回的角色是 `assistant`！

---

## 根本原因

### API 响应结构分析

OpenCode API 返回的消息结构：

```json
{
  "info": {
    "role": "assistant",  // ⚠️ 不是 "model"！
    "mode": "build",
    "agent": "build"
  },
  "parts": [
    { "type": "step-start" },
    { "type": "reasoning", "text": "..." },
    { "type": "text", "text": "{\"msg\":...,\"options\":[...]}" },  // JSON 在这里
    { "type": "step-finish" }
  ]
}
```

### 代码中的错误判断

```typescript
// 错误代码 (第236行)
if (msg.info?.role === 'model' && msg.parts && msg.parts.length > 0) {
  // JSON 解析逻辑...
}
```

**问题**：`'model' !== 'assistant'`，条件永远为 `false`，导致：
1. JSON 解析逻辑从未执行
2. 原始 `parts` 直接传给渲染组件
3. `text` 字段显示原始 JSON 字符串

---

## 解决方案

### 修复代码

```diff
- if (msg.info?.role === 'model' && msg.parts && msg.parts.length > 0) {
+ if (msg.info?.role === 'assistant' && msg.parts && msg.parts.length > 0) {
```

### 为什么是 'assistant'

OpenCode API 遵循标准的 LLM API 规范：
- `user`: 用户消息
- `assistant`: AI 助手消息

这与 OpenAI、Anthropic 等主流 API 保持一致。

---

## 验证结果

修复后，日志显示：

```
[PARSE] 开始解析消息 #1 {rawTextLength: 1234, ...}
[PARSE] 标准解析成功 {parsed: {msg: "...", options: [...]}}
[PARSE] 提取 msg 字段成功 {msg: "你好！...", options: [...]}
[RENDER] 消息 #1 解析完成 {hasOptions: true, optionsCount: 4}
```

页面正确显示：
- ✅ 解析后的文本内容
- ✅ 可点击的选项按钮

---

## 经验教训

### 1. API 角色名称不一致

不同 API 可能使用不同的角色名称：
- OpenAI / Anthropic / OpenCode: `assistant`
- Google Gemini: `model`
- 自定义 API: 可能是其他名称

### 2. 日志系统的重要性

完整的日志帮助快速定位问题：
- 记录每个阶段的关键数据
- 使用统一的日志格式 `[PHASE] action`
- 支持导出离线分析

### 3. 自动化测试的价值

Playwright 自动化测试可以：
- 快速复现问题
- 收集详细的运行时数据
- 验证修复效果

---

## 文件变更

| 文件 | 变更 |
|------|------|
| `frontend/src/pages/AiBit.tsx` | 修复角色判断 + 添加日志系统 |
| `frontend/package.json` | 添加 axios 依赖 |

---

## 提交记录

```
72e2c97 fix: Correct role check from 'model' to 'assistant' for OpenCode API
```
