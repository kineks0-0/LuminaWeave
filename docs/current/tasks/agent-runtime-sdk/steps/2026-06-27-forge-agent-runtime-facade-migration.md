# Forge pi session 迁移到 AgentRuntime façade

## 背景

`AgentRuntime` 高层 façade 已提供 setup、session lifecycle、event bus、tool registry、extension host、显式 scanner 与显式 loader。Forge 之前直接组合 `AgentRuntimeCore`，导致主运行路径绕过 façade，无法验证 Forge adapter 是否已经站在通用 runtime API 之上。

## 本次实现

- `ForgePiCoreRuntime` 改为组合 `AgentRuntime`。
- `ForgePiCoreRuntime.runTurn()`、`previewPrompt()`、`continue()`、`resolveToolApproval()` 和 `abortActiveGeneration()` 统一经由 façade 调用。
- `getAgentRuntimeSnapshot()` 和 `getAgentRuntimeEvents()` 继续暴露给 Forge adapter、store 和 Inspector。
- `ForgePiAgentSession`、`ForgePiToolBridge`、Forge Semantic VFS、写入摘要、Git-backed 版本和 ST 发布边界仍留在 Forge adapter 内。

## 边界

- 本次不把 Forge 工具注册迁移到 `AgentRuntime.tools`。
- 本次不把 Forge extension workflow 迁移到 `AgentRuntimeExtensionHost`。
- 本次不改变 Prompt Preview 与真实生成的同源路径。
- 本次不改变 `ForgePiRuntimeClient`、`ForgeRuntimeOrchestrator`、Forge store 或 UI projection wire shape。

## 验证

- 新增 `ForgePiDependencyGuard.test.ts` 边界测试，断言 `ForgePiCoreRuntime` 依赖 `AgentRuntime` façade，不再直接 import 或实例化 `AgentRuntimeCore`。
- `npm run test -- --run src/api/core/__tests__/forge/ForgePiDependencyGuard.test.ts` 通过 1 个测试文件、6 个用例。
- `npm run test -- --run src/api/core/__tests__/forge/ForgePiCoreRuntime.test.ts` 通过 1 个测试文件、3 个用例。

## 后续

下一步评估 Forge extension workflow 是否接入 `AgentRuntimeExtensionHost`。评估时必须保持 Forge Prompt Preview 与真实生成同源，并继续让 Forge Semantic VFS、写入摘要、Git-backed 版本和 ST 发布边界留在 Forge adapter。
