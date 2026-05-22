# Tailwind Utility Layer

## Summary

LuminaWeave 使用 Tailwind CSS 作为 UI 实现层的 utility layer，用于减少重复布局、间距、排版和控件状态样式。Tailwind 不成为新的主题真相源，也不替代 Desktop Mode / Theme Pack 的结构级职责。

主题真相仍由 `--lw-*` 语义 token、`DesktopModeManifest.designTokens`、surface skins 与 renderer variants 承载。Tailwind 只消费这些 token，并把它们映射成少量稳定 utility。

## Build Contract

- 使用 Tailwind CSS v4 与 `@tailwindcss/vite`。
- Tailwind class 必须使用 `tw:` 前缀。
- 不启用 Preflight；入口 CSS 只导入 `theme.css` 与 `utilities.css`。
- Tailwind 入口为 `src/styles/tailwind.css`，并保留 LuminaWeave 样式标识，确保 Shadow DOM 样式克隆逻辑能识别。
- 动态 class 组合统一使用 `src/ui/cn.ts`，由 `clsx + tailwind-merge` 封装。

## Token Mapping

`src/styles/tailwind.css` 只暴露少量稳定 token：

- 字体：`font-lw-main`、`font-lw-display`、`font-lw-mono`。
- 颜色：primary、surface、elevated、subtle、text、border、danger 等语义色。
- 形状：`rounded-lw-*`。
- 阴影：`shadow-lw*`。

禁止把具体桌面模式的完整视觉语言复制进 Tailwind token。Telegram、Discord、Stage 等模式差异继续通过各自的 Desktop Design Language、manifest token 和 surface skin 表达。

## UI Primitive Policy

业务组件默认消费 `src/ui/primitives/`，而不是直接重复堆叠 utility class。第一批原语包括 Button、IconButton、Input、Select、Textarea、Toggle、SegmentedControl、Slider、Panel、EmptyState 与 ModalShell。

原语 props 保持小而稳定，例如 `variant`、`size`、`tone`、`block`、`disabled` 与必要的 `ariaLabel`。业务状态、插件状态和桌面模式状态不得进入 UI 原语内部。

## Migration Rules

- 语义容器 class 可以保留，例如 `lw-chat-stream` 或带有 data contract 的 shell class。
- 纯视觉 class 应逐步迁到 UI 原语或 Tailwind utility。
- 不以 `@apply` 作为主要迁移路径；重复组合应进入 UI 原语。
- ChatStream 气泡矩阵、Timeline / LogicFlow、Telegram / Discord 模式级 skin、safe-area / IME、复杂 `:deep()` 与 workspace drag/resize/motion 第一阶段保留 CSS。

## Accessibility Rules

- icon-only button 必须提供 `aria-label`。
- 破坏性确认继续走统一确认弹窗路径。
- row toggle、segmented control、slider、select 等交互控件必须保留键盘行为和现有状态流。
- 不引入全局 reset，不依赖浏览器默认表单样式覆盖宿主。
