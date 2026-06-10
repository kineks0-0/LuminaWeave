# 阶段 8：Shell 模式目录收敛

## 目标

把 Discord / Telegram 的模式专属 shell 组件从 `src/shell/traditional/` 移入 `src/shell/modes/<mode>/`。`desktop-modes/builtins/<mode>/` 继续只作为声明式桌面模式事实源，承载 manifest、settings、tokens、skins 与受控 policy；实际 Vue shell 组件留在 `src/shell/` 边界内。

## 边界

- 不修改 `DesktopModeManifest` 公开协议。
- 不修改 Desktop Mode Runtime descriptor 派生逻辑。
- 不修改 Activity placement、Surface Runtime 优先级或插件 surface contract。
- 不拆分 `TraditionalShell.vue` 内部渲染逻辑；本阶段只做目录归位和 import 修正。
- 不修改 Core、HAL、Conversation、Prompt、Storage 或同步语义。

## 实施步骤

1. 新增结构测试，约束模式专属 shell 组件必须位于 `src/shell/modes/<mode>/`。
2. 移动 Discord mobile shell 到 `src/shell/modes/discord/`。
3. 移动 Telegram bottom nav、角色视图、用户信息面板和 Telegram visual helper 到 `src/shell/modes/telegram/`。
4. 修正 `TraditionalShell.vue`、Telegram settings、Discord character rail、Desktop Mode Runtime 初始化和测试 mock 的 import 路径。
5. 同步 Desktop Modes 当前任务文档和模块目录边界文档。
6. 运行 shell/runtime 相关 targeted Vitest、`npm run type-check`、`npm run build` 和 `git diff --check`。

## 验收检查

- `npm run test -- --run src/shell/__tests__/shellModeDirectoryStructure.test.ts src/shell/__tests__/shellRootRuntimeBoundary.test.ts src/shell/__tests__/dynamicTabResolver.test.ts src/platform/desktop-mode-runtime/__tests__/DesktopModeRuntimeRegistry.test.ts`
- `npm run type-check`
- `npm run build`
- `git diff --check`

## 执行记录

- 结构测试：先运行 `npm run test -- --run src/shell/__tests__/shellModeDirectoryStructure.test.ts`，确认旧目录结构不满足测试。
- 实现后 targeted Vitest：4 个测试文件、14 个测试通过。
- `npm run type-check`：通过。
- `npm run build`：通过，仍输出既有浏览器兼容与 chunk size 警告。
- `git diff --check`：通过，仅输出工作区换行规范提示。
