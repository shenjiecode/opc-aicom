# Frontend - OPC AICom

React 19 + TypeScript + Vite + Tailwind CSS 4 + shadcn/ui

## 关键技术

### 路由布局

- **带 Layout 页面**：有侧边栏，在 `<Layout />` 内
- **全屏页面**：无 Layout，在 `<Layout />` 外（如 login、opc-workbench）

### 主题系统

- **默认**：暗色（dark）
- **使用**：用 `var(--bg-surface)` 等 CSS 变量，不用硬编码颜色
- **状态**：Layout/Sidebar 已适配，页面组件待适配

### Layout 结构

Sidebar (16rem) + Main (可滚动)

### CSS 变量

```css
--bg-base / --bg-surface / --bg-muted
--text-primary / --text-secondary / --text-muted
--border-default / --sidebar-bg / --card-bg
```