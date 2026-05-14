# Step 10: Prompt Command Service

状态：Completed

日期：2026-05-14

## 目标

把 `LuminaWeaveAPI.probePrompt()` 周围的 probing 状态、prompt event trace、payload 归一和超时诊断迁出 Facade，建立 Core `PromptCommandService`。Facade 保留旧 public 方法名，但不再拥有 `_probing`、`_probingEvents` 或直接调用 `PromptProbeService`。

## 已完成

- 新增 `src/api/core/generation/PromptCommandService.ts`。
- 将以下状态迁入 `PromptCommandService`：
  - `isProbing`
  - probe event trace
  - `lastPromptPayload`
- 将 prompt candidate 处理迁入 `PromptCommandService.recordPromptCandidate()`：
  - 记录探测期间事件轨迹。
  - 从数组、`data.prompt`、`data.chat`、`data.messages`、`data.fullPrompt` 提取 payload。
  - 判断 dry-run 和受控新建事务期间的 dry-run prompt emit 策略。
  - 更新 last prompt payload。
- 将 `LuminaWeaveAPI.probePrompt()` 缩减为 `PromptCommandService.probePrompt()` wrapper。
- `LuminaWeaveAPI` 事件监听仍负责绑定 host runtime 事件和 emit `ST_PROMPT_INTERCEPTED`，但不再持有 prompt probe 状态。
- 保留 `lastPromptPayload` 兼容 getter/setter，实际状态由 `PromptCommandService` 持有。

## 边界

- `PromptCommandService` 属于 Core Runtime / domain service 层。
- `PromptCommandService` 消费 HAL `PromptProbeService`，不直接定位 ST `generate` / `stopGeneration`。
- ST dry-run generate 与 stop 行为仍由 HAL prompt probe service 通过 host runtime port 触发。
- 本步不改变 `st-native` 行为，也不引入 Lumina-owned Prompt Assembly 默认切换。

## 验证

```powershell
cd D:\LuminaWeave\luminaweave-extension
npm run type-check
npm run test -- src/api/__tests__/LuminaWeaveAPI.test.ts src/api/core/__tests__/PromptBuilder.test.ts src/api/core/__tests__/PromptPresetComposer.test.ts
```

结果：

- `npm run type-check`：通过。
- `npm run test -- src/api/__tests__/LuminaWeaveAPI.test.ts src/api/core/__tests__/PromptBuilder.test.ts src/api/core/__tests__/PromptPresetComposer.test.ts`：通过，3 个测试文件 / 20 个测试。

依赖扫描：

- `src/api/index.ts` 已无 `_probing`、`_probingEvents` 或 `promptProbeService` 直接引用。
- `PromptCommandService` 未直接引用 `host-drivers/st`、`STClient`、`STGlobalAccessor`、`STProtocol` 或 `STAdapter`。

## 后续

- Batch 11：新增 `GenerationCommandService`，迁移 `sendMessage()`、`triggerGenerate()`、`regenerateLast()`、`runEditedPrompt()`、`abortGenerate()` 编排。
- Batch 12：继续清理 `hal/prompt/*` 与 storage 模块中的 `host-drivers/st/SyncUtils` / `STProtocol` 残留。
- Batch 13：实现插件形态显式 `lumina-assembly` route，让 Lumina 自合成 Prompt 成为可选择路径。
