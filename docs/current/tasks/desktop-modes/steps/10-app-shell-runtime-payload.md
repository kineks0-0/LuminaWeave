# 阶段 10：App Shell Runtime Payload 收敛

## 目标

把 `App.vue` 中 `ShellRuntimeContext / ShellRuntimeSurfaces / ShellRuntimeActions / ShellRuntimeFrame` 的对象组装抽到 `src/composables/shell/useShellRuntimePayload.ts`。`App.vue` 继续拥有状态、生命周期、bootstrap、host layout、activity launch 和具体 handler，只把这些 refs、computed 与 actions 输入给 shell payload composable。

## 边界

- 不修改 `DesktopModeManifest` 公开协议。
- 不修改 Desktop Mode Runtime descriptor 派生、Activity placement 或 Surface Runtime 优先级。
- 不修改 `LuminaShellRoot.vue` 的外部 props。
- 不修改 TraditionalShell、FreeformShell、Discord mobile shell、Telegram mobile stack 的行为。
- 不修改 Core、HAL、Conversation、Prompt、Storage 或同步语义。
- 不把 App 的状态所有权迁入 shell 组件；payload composable 只负责结构化组装。

## 实施步骤

1. 新增结构测试，约束 `useShellRuntimePayload.ts` 存在，并约束 `App.vue` 不再内联四个 ShellRuntime computed 对象。
2. 新增 `useShellRuntimePayload.ts`，用输入 refs / computed / actions 派生 `shellRuntimeContext`、`shellRuntimeSurfaces`、`shellRuntimeActions` 和 `shellRuntimeFrame`。
3. 修改 `App.vue`，保留原有状态与 handler，只调用 `useShellRuntimePayload()` 取得传给 `LuminaShellRoot` 的四个 runtime payload。
4. 更新 Desktop Modes 模块文档和当前任务 README。
5. 运行 shell/runtime 相关 targeted Vitest、`npm run type-check`、`npm run build` 和 `git diff --check`。

## 验收检查

- `npm run test -- --run src/shell/__tests__/shellRuntimePayloadComposable.test.ts src/shell/__tests__/shellRootRuntimeBoundary.test.ts src/shell/__tests__/shellModeDirectoryStructure.test.ts src/shell/__tests__/telegramShellSplitStructure.test.ts src/shell/__tests__/dynamicTabResolver.test.ts src/platform/desktop-mode-runtime/__tests__/DesktopModeRuntimeRegistry.test.ts`
- `npm run type-check`
- `npm run build`
- `git diff --check`

## 执行记录

- 结构测试：先运行 `npm run test -- --run src/shell/__tests__/shellRuntimePayloadComposable.test.ts`，确认旧结构不满足测试。
- 新增 `src/composables/shell/useShellRuntimePayload.ts`，承载 shell runtime payload 的四类 computed 组装。
- `App.vue` 改为传入自身拥有的 refs、computed 和 actions，不再直接内联四个 `ShellRuntime*` computed 对象。
- 阶段内初步验证：
  - `npm run test -- --run src/shell/__tests__/shellRuntimePayloadComposable.test.ts`：1 个测试文件、2 个测试通过。
  - `npm run type-check`：通过。
- 最终验证结果：
  - `npm run test -- --run src/shell/__tests__/shellRuntimePayloadComposable.test.ts src/shell/__tests__/shellRootRuntimeBoundary.test.ts src/shell/__tests__/shellModeDirectoryStructure.test.ts src/shell/__tests__/telegramShellSplitStructure.test.ts src/shell/__tests__/dynamicTabResolver.test.ts src/platform/desktop-mode-runtime/__tests__/DesktopModeRuntimeRegistry.test.ts`：6 个测试文件、19 个测试通过。
  - `npm run type-check`：通过。
  - `npm run build`：通过；保留既有 Vite `node:fs` browser externalized 与 chunk size 警告。
  - `git diff --check`：退出码 0；仅有 Git 换行提示。
