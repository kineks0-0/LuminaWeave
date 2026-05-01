# Step 06: Desktop Chrome Tools and Resize

## 目标

落地 Telegram 桌面三项增强：默认圆角外边距三栏、左侧工具入口、左右面板自由拖拽宽度。

## 输入与前置条件

- 本步骤基于第 4 张桌面聊天精修稿的圆角三栏结构。
- 右侧资料栏仍以角色资料页 / `telegram-profile` 为目标，不回退到状态摘要卡片页。
- 只修改 Shell / Theme / Surface / View-model 层。

## 状态

已完成代码实现与定向验证，待真实宿主视觉走查。

## 需要修改的子系统

- `src/theme/builtinThemePacks.ts`
  - 新增 `panelChromeStyle` 与 `topBlankSpace`。
  - `telegram.frame` 输出圆角浮层与贴边兼容所需 CSS vars。
- `src/components/DiscordCharacterRail.vue`
  - 左栏新增 Telegram 工具入口渲染。
  - `所有 / 角色 / 工具 / 筛选` 按工具与角色分流。
- `src/composables/shell/useWidgetPanels.ts`
  - 新增左栏宽度状态与拖拽持久化。
  - 右栏移除 Telegram 桌面下固定 `800px` 上限，改为保留中间区最小宽度的动态约束。
- `src/App.vue`、`src/shell/LuminaShellRoot.vue`、`src/shell/traditional/TraditionalShell.vue`
  - 串接工具入口 intent、左栏拖拽和 shell runtime 类型。

## 交互与验收检查

- 默认进入 Telegram 桌面为 `floating-rounded`：
  - 三栏之间有 gap。
  - 三栏各自圆角、边框和柔和阴影。
  - 顶部留白由 `topBlankSpace=true` 控制。
- 切到 `edge-to-edge`：
  - 保留旧贴边结构作为兼容样式。
  - 不恢复 macOS 三色按钮或标题栏。
- 左栏工具入口：
  - `启动台` 第一，点击只切换主区到 `lumina-launcher`。
  - `制卡工坊` 第二，点击只切换主区到 `lumina-forge`。
  - 点击工具入口清除角色概览选中态，不创建聊天、不打开会话。
  - `所有` 显示工具 + 角色，`角色` 只显示角色，`工具` 只显示工具。
  - `筛选` 二级菜单继续为 `全部会话 / 未读优先 / 收藏角色 / 最近更新`，只过滤角色/会话。
- 宽度拖拽：
  - 左栏默认 `320px`，最小 `260px`，持久化键为 `luminaWeave.telegram.leftRailWidth`。
  - 右栏默认 `360px`，最小 `280px`，继续使用 `luminaWeave.widgetWidth`。
  - 中间聊天区保留最小 `520px`。
  - 右栏在 Telegram 桌面不再被旧 `800px` 固定上限截断。

## 验证记录

- `npm run type-check`：通过。
- `npm run test -- src/theme/__tests__/themeRegistry.test.ts src/platform/desktop/__tests__/DesktopModeRuntimeRegistry.test.ts src/shell/__tests__/dynamicTabResolver.test.ts src/composables/__tests__/useWidgetPanels.test.ts`：通过，4 个测试文件 / 26 个测试。

## 文档同步

本步骤新增 Telegram desktop mode settings，并改变 Telegram shell 的桌面宽度交互，因此已同步更新：

- `docs/overall/PDR.md`
- `docs/overall/system_design.md`

## 禁止事项

- 不改 `ConversationService`。
- 不改同步、持久化、Prompt 或 ST adapter。
- 不把 Timeline / Director / Lorebook 放进 Telegram 主导航。
- 不引用下载目录中的设计稿作为运行时资源。
