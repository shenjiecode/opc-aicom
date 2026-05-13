# Frontend - OPC AICom

React 19 + TypeScript + Vite + Tailwind CSS 4 + shadcn/ui

## 项目结构

```
frontend/
├── src/
│   ├── components/        # 可复用组件
│   │   ├── ui/           # shadcn/ui 组件
│   │   ├── Layout.tsx    # 主布局组件
│   │   ├── Header.tsx    # 顶部导航栏
│   │   └── Sidebar.tsx   # 侧边导航栏
│   ├── contexts/         # React Context
│   │   └── ThemeContext.tsx  # 主题上下文
│   ├── pages/            # 页面组件
│   │   ├── Home.tsx
│   │   ├── Community.tsx
│   │   ├── Tasks.tsx
│   │   └── ...
│   ├── lib/              # 工具函数
│   ├── App.tsx           # 路由配置
│   ├── index.css         # 全局样式 + CSS 变量
│   └── main.tsx          # 入口文件
├── package.json
└── vite.config.ts
```

## 路由布局

### 带 Layout 的页面（有侧边栏 + 顶部栏）

```tsx
<Route element={<Layout />}>
  <Route path="/" element={<Home />} />
  <Route path="/community" element={<Community />} />
  <Route path="/tasks" element={<Tasks />} />
  <Route path="/ai-resources" element={<AiResources />} />
  <Route path="/service-center" element={<ServiceCenter />} />
  <Route path="/my-opc" element={<MyOPC />} />
  <Route path="/my-agents" element={<MyAgents />} />
  <Route path="/my-workflows" element={<MyWorkflows />} />
  <Route path="/points-mall" element={<PointsMall />} />
</Route>
```

### 全屏页面（无 Layout）

```tsx
<Route path="/login" element={<Login />} />
<Route path="/register" element={<Register />} />
<Route path="/opc-workbench" element={<OPCWorkbench />} />
```

**添加新全屏页面**：将路由放在 `<Layout />` 外面即可。

## 主题系统

### 主题切换

- **默认主题**：亮色（light）
- **切换按钮**：Header 右侧（太阳/月亮图标）
- **存储**：localStorage（key: `opc-theme`）

### CSS 变量

```css
/* 亮色主题 */
:root.light {
  --bg-base: #ffffff;
  --bg-surface: #f9fafb;
  --text-primary: #111827;
  --text-secondary: #374151;
  --sidebar-bg: #f9fafb;
  --card-bg: #ffffff;
  /* ... */
}

/* 暗色主题 */
:root.dark {
  --bg-base: #030712;
  --bg-surface: #111827;
  --text-primary: #f9fafb;
  --text-secondary: #e5e7eb;
  --sidebar-bg: #111827;
  --card-bg: #1f2937;
  /* ... */
}
```

### 使用主题变量

```tsx
// 正确：使用 CSS 变量（支持主题切换）
<div className="bg-[var(--bg-surface)] text-[var(--text-primary)]">

// 错误：硬编码颜色（不支持主题切换）
<div className="bg-slate-50 text-slate-900">
```

### 主题适配状态

| 组件 | 状态 |
|------|------|
| Layout | ✅ 已适配 |
| Sidebar | ✅ 已适配 |
| Header | ✅ 已适配 |
| Home.tsx | ❌ 待适配 |
| Community.tsx | ❌ 待适配 |
| 其他页面 | ❌ 待适配 |

## Layout 组件

```tsx
// Layout.tsx 结构
<div className="h-screen overflow-hidden flex">
  <Sidebar />           {/* 侧边导航 */}
  <div className="flex-1 flex flex-col">
    <Header />          {/* 顶部导航 */}
    <main>              {/* 主内容区域 */}
      <Outlet />        {/* 子页面渲染位置 */}
    </main>
  </div>
</div>
```

### 尺寸变量

```css
--header-height: 4rem;
--sidebar-width: 16rem;
--sidebar-collapsed: 4rem;
```

## 开发命令

```bash
# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview

# 类型检查
npm run typecheck
```

## 技术栈详情

- **React 19** - 最新版 React
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Tailwind CSS 4** - 原子化 CSS
- **shadcn/ui** - UI 组件库
- **Lucide React** - 图标库
- **React Router** - 路由管理

## 渐进式主题适配

修改页面组件时，逐步替换硬编码颜色：

```tsx
// 替换这些硬编码
bg-slate-50    → bg-[var(--bg-surface)]
bg-white       → bg-[var(--bg-base)]
text-slate-900 → text-[var(--text-primary)]
text-slate-500 → text-[var(--text-muted)]
border-slate-200 → border-[var(--border-default)]
```

详见 `AGENTS.md` 中的渐进式更新规则。
