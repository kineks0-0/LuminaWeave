# Step 11: Generation Command Service

状态：Completed

日期：2026-05-14

## 目标

把 `LuminaWeaveAPI` 中的生成入口路由、生成会话状态、Task 引用、Nexus stop、ST generate/regenerate/stop 函数定位迁入 Core `GenerationCommandService`。Facade 保留旧 public 方法名。

## 已完成

- 新增 `src/api/core/generation/GenerationCommandService.ts`。
- 迁移以下编排：
  - `sendMessage()`
  - `triggerGenerate()`
  - `regenerateLast()`
  - `runEditedPrompt()`
  - `abortGenerate()`
  - 生成事务收口与 `TRANSACTION_COMMITTED` 处理。
- `LuminaWeaveAPI` 中 `sendMessage()`、`triggerGenerate()`、`regenerateLast()`、`runEditedPrompt()`、`abortGenerate()` 改为兼容 wrapper。
- `LuminaWeaveAPI` 不再持有 `_session`、`_currentTask`、`NexusClient` 生成状态。
- `generateAbortController` 保留兼容 getter/setter，实际状态由 `GenerationCommandService` 持有。
- Host generation 函数定位通过 host runtime port 在 service 内完成，不直接接触 ST 具体类。

## 验收

- `LuminaWeaveAPI` 不再 import `llmEngine`、`LuminaGenerationTask`、`GenerationSession`、`NexusClient` 或 `PromptAssemblyRouter`。
- `GenerationCommandService` 不直接引用 `STClient`、`STGlobalAccessor`、`STProtocol`、`STAdapter` 或 `host-drivers/st/*`。

## 验证

- `npm run type-check`：通过。
- `npm run test -- src/api/__tests__/LuminaWeaveAPI.test.ts src/api/core/__tests__/StreamHandler.test.ts src/api/core/__tests__/NexusClient.test.ts`：包含在 Step 11-13 联合验证中通过。

## 后续

- 继续拆分 `GenerationCommandService` 内的 host generation invoker 窄端口，便于后续 Tauri / Standalone 实现替换。
