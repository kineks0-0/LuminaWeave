# 阶段 9：TraditionalShell Telegram 分支拆分

## 目标

把 `TraditionalShell.vue` 中的 Telegram 专属桌面左栏、Telegram mobile stack 和 mobile route 派生逻辑拆到 `src/shell/modes/telegram/`。`TraditionalShell.vue` 保持 traditional shell 组合层职责，继续承接主区、动态 tab、右侧 widget panel 和 mode 分发。

## 边界

- 不修改 `DesktopModeManifest` 公开协议。
- 不修改 Desktop Mode Runtime descriptor 派生、Activity placement 或 Surface Runtime 优先级。
- 不修改 Discord mobile shell、traditional right panel、freeform workspace 行为。
- 不修改 Core、HAL、Conversation、Prompt、Storage 或同步语义。
- 不把 Telegram shell 组件放入 `desktop-modes/builtins/telegram/`；那里继续只承载声明式 manifest / settings / tokens / skins。

## 实施步骤

1. 新增结构与 view-model 测试，约束 `TelegramDesktopPane.vue`、`TelegramMobileStack.vue`、`telegramRouteViewModel.ts` 存在，并约束 `TraditionalShell.vue` 不再内联 Telegram mobile route 细节。
2. 新增 `telegramRouteViewModel.ts`，承载 mobile route root 判断、底栏显示、stack bar 显示、标题、tool contract、activity、props 和 aux sidebar 派生。
3. 新增 `TelegramDesktopPane.vue`，承载 Telegram 桌面左栏的会话/角色切换、角色列表和左栏 resize 入口。
4. 新增 `TelegramMobileStack.vue`，承载 Telegram mobile stack 的 route 渲染和 standalone activity 容器。
5. 简化 `TraditionalShell.vue`，改为组合 `TelegramDesktopPane`、`TelegramMobileStack` 和 `telegramRouteViewModel`。
6. 运行 shell/runtime 相关 targeted Vitest、`npm run type-check`、`npm run build` 和 `git diff --check`。

## 验收检查

- `npm run test -- --run src/shell/__tests__/telegramShellSplitStructure.test.ts src/shell/__tests__/shellModeDirectoryStructure.test.ts src/shell/__tests__/shellRootRuntimeBoundary.test.ts src/shell/__tests__/dynamicTabResolver.test.ts src/platform/desktop-mode-runtime/__tests__/DesktopModeRuntimeRegistry.test.ts`
- `npm run type-check`
- `npm run build`
- `git diff --check`

## 执行记录

- 结构与 view-model 测试：先运行 `npm run test -- --run src/shell/__tests__/telegramShellSplitStructure.test.ts`，确认旧结构不满足测试。
- 拆出 `src/shell/modes/telegram/telegramRouteViewModel.ts`，承载 Telegram mobile route 的显示、标题、tool contract、activity、props 和 aux sidebar 派生。
- 拆出 `src/shell/modes/telegram/TelegramDesktopPane.vue`，承载 Telegram desktop 左栏与左栏 resize 入口。
- 拆出 `src/shell/modes/telegram/TelegramMobileStack.vue`，承载 Telegram mobile stack route 渲染与 standalone activity 容器。
- `TraditionalShell.vue` 收敛为组合层：保留 traditional 主区、动态 tab、右侧 panel 和 mode 分发，Telegram 专属分支由 `src/shell/modes/telegram/` 承载。
- 更新 `shellModeDirectoryStructure.test.ts`，让目录结构约束跟随阶段 9 拆分后的真实边界。
- 验证结果：
  - `npm run test -- --run src/shell/__tests__/telegramShellSplitStructure.test.ts src/shell/__tests__/shellModeDirectoryStructure.test.ts src/shell/__tests__/shellRootRuntimeBoundary.test.ts src/shell/__tests__/dynamicTabResolver.test.ts src/platform/desktop-mode-runtime/__tests__/DesktopModeRuntimeRegistry.test.ts`：5 个测试文件、17 个测试通过。
  - `npm run type-check`：通过。
  - `npm run build`：通过；保留既有 Vite `node:fs` browser externalized 与 chunk size 警告。
  - `git diff --check`：退出码 0；仅有 Git 换行提示。
