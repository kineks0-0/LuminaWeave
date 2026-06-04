# 阶段 7：Lumina Shell Root 运行时边界收窄

## 目标

把 `LuminaShellRoot.vue` 的入口从大量平铺 props 收敛为结构化 `ShellRuntimeContext`、`ShellRuntimeSurfaces`、`ShellRuntimeActions` 与 `ShellRuntimeFrame`。`App.vue` 继续作为运行时编排入口，负责组装 shell runtime payload；`LuminaShellRoot.vue` 只负责 header / body / traditional-freeform 分发与 legacy global panel 挂载。

## 边界

- 不修改 `DesktopModeManifest` 公开协议。
- 不修改 Desktop Mode Runtime descriptor 派生、Activity placement、Surface Runtime 优先级。
- 不修改 Core、HAL、Conversation、Prompt、Storage 或同步语义。
- 保留 `data-layout-mode` 兼容属性；运行时策略输入继续使用 `shellKind`。
- `PanelHeader` 暂留在 `LuminaShellRoot.vue`，避免同时移动 header 布局边界。

## 实施步骤

1. 新增结构测试，约束 `LuminaShellRoot.vue` 只声明结构化 runtime props。
2. 在 `shell/types.ts` 增加 `ShellRuntimeFrame`，承载 header/body 显示状态和样式；DOM element 回调归入 `ShellRuntimeActions.frame`。
3. 在 `App.vue` 组装 `shellRuntimeContext`、`shellRuntimeSurfaces`、`shellRuntimeActions`、`shellRuntimeFrame`。
4. 简化 `LuminaShellRoot.vue` props，删除内部 runtime 对象组装逻辑，改为直接消费结构化 props。
5. 运行 shell/runtime/activity 相关 targeted Vitest、`npm run type-check`、`npm run build` 和 `git diff --check`。

## 验收检查

- `npm run test -- --run src/shell/__tests__/shellRootRuntimeBoundary.test.ts src/platform/desktop-mode-runtime/__tests__/DesktopModeRuntimeRegistry.test.ts src/platform/activity/__tests__/activityLaunchResolver.test.ts src/shell/__tests__/dynamicTabResolver.test.ts src/composables/__tests__/useWorkspaceNavigation.test.ts`
- `npm run type-check`
- `npm run build`
- `git diff --check`

## 执行记录

- 结构测试：先运行 `npm run test -- --run src/shell/__tests__/shellRootRuntimeBoundary.test.ts`，确认旧的平铺 props 结构不满足测试。
- 实现后 targeted Vitest：5 个测试文件、19 个测试通过。
- `npm run type-check`：通过。
- `npm run build`：通过，仍输出既有浏览器兼容与 chunk size 警告。
- `git diff --check`：通过，仅输出工作区换行规范提示。
