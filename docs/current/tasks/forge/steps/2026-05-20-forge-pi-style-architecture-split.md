# Forge Runtime pi-style 架构拆分记录

## 目标

按 pi 的“极简核心 + 可互操作扩展”理念拆分 Forge Runtime：

```text
src/api/core/forge/agent-app        Agent runtime / session / tools / model / resources
src/plugins/forge                   Vue UI shell / interaction / projections / store actions
src/stores/useForgeStore.ts         跨 UI 的轻量状态投影
shared/ForgePiTypes.ts              runtime 与 UI 的共享协议
```

## 已完成

- `agent-app` 成为 Forge Agent runtime 唯一核心目录。
- `src/plugins/forge` 拆为 `app`、`console`、`inspector`、`review`、`project`、`store`。
- `ForgePiModelRegistry` / `ForgePiNexusProvider` 改为 pi-ai 原生模型链路，不再生成 AI SDK `ModelMessage[]`。
- `ForgeModelRequestDebugPanel` 的回复内容改为从 runtime snapshot 派生：
  `responseDisplay -> piModelTrace.finalText -> latest assistant node -> 暂无回复内容`。
- 新增 dependency guard，防止 UI 层 import pi/model/runtime 内部实现。

## 边界

- `src/plugins/forge` 只做输入、输出、面板、状态投影和操作分发。
- Agent loop、模型请求、工具执行、提示词合成留在 `src/api/core/forge/agent-app`。
- Review Gate 仍是写入边界；UI 不直接写 VFS，不直接写真实 ST 世界书。
- `modelRequestTraces` 仍是调试视图；长期执行事实源是 pi session tree / timeline projection。

## 验证

```powershell
cd D:\LuminaWeave\luminaweave-extension
npx vitest run src/api/core/__tests__/forge/ForgePiDependencyGuard.test.ts src/api/core/__tests__/forge/ForgePiModelRegistry.test.ts src/api/core/__tests__/forge/ForgePiNexusProvider.test.ts src/plugins/forge/__tests__/forgeModelRequestResponsePresentation.test.ts src/plugins/forge/__tests__/forgeModelRequestToolTracePresentation.test.ts src/plugins/forge/__tests__/forgePiRuntimePresentation.test.ts src/plugins/forge/__tests__/forgeToolApprovalPresentation.test.ts --testTimeout=60000
npx vitest run src/plugins/forge/__tests__ src/api/core/__tests__/forge --testTimeout=60000
npm run type-check -- --pretty false
```

## 后续

- 真实宿主 walkthrough：发送消息、tool calling、Review approve/reject、刷新恢复 session tree。
- 检查 `CardMakerStore.ts` 是否还能继续缩减，但不得为了拆分制造更多依赖穿透。
