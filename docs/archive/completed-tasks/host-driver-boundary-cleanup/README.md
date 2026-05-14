# Host Driver Boundary Cleanup

## 目标

清理 `LuminaWeaveAPI`、`LuminaWeaveAPIBase`、`LorebookManager` 等 Core / Facade 层对 SillyTavern、TavernHelper、宿主全局对象和 ST REST 细节的直接依赖，将宿主物理操作统一移动到 `src/api/core/host-drivers/` 与 HAL host provider。

本任务不改变 ST 插件模式的业务行为；目标是收口依赖方向：

```text
UI / plugins -> domain service / manager -> HAL port / host driver -> ST / TavernHelper / Tauri / standalone
```

## 当前状态

- `host-drivers/st/` 已存在 `STClient`、`STAdapter`、`STSyncService`、`STResourceSource`、`STWorldInfoDriver` 等宿主层文件。
- `LorebookManager` 已改为通过 `LorebookHostPort` 消费 `STWorldInfoDriver`，不再直接访问 `this.stHelper`、`this.ctx`、`STClient.getCsrfToken()` 或 `/api/worldinfo/get`。
- `LuminaWeaveAPIBase.waitForEnvironment()` 已改为委托 `STEnvironmentDriver`。
- `LuminaWeaveAPI` 的 ST 函数定位、ST regex、生成状态安全检查、角色名和头像读取已委托给 ST host driver。
- `LuminaWeaveAPI.crudChatRecord()` 已委托 `ConversationCommandService`，消息 edit/add/delete 的字段计算、host 写入和独立存储更新不再由 Facade 直接承担。
- `LuminaWeaveAPI.probePrompt()` 已委托 `PromptCommandService`，prompt probing 状态、事件轨迹和 payload 归一不再由 Facade 直接承担。
- `LuminaWeaveAPI` 的生成入口已委托 `GenerationCommandService`，生成会话状态、Task、Nexus stop 和 host generation 函数定位不再由 Facade 直接承担。
- `hal/prompt/*` 与 `storage/*` 中的 host-neutral 操作已去除 ST `SyncUtils` / `STProtocol` 直连。
- 插件形态可显式选择 `promptAssembly.engine: 'lumina-assembly'`，该路径不依赖 ST dry-run prompt probe。
- `LorebookManager` 默认 ST driver、`PromptWorldInfoMount` ST regex 同步、HAL resource source 注册已收口到 host port / adapter registration。
- 排除 `host-drivers/st/`、`hal/adapters/st/` 和测试文件后，生产 Core 已无 STClient / STGlobalAccessor / TavernHelper / STProtocol / SyncUtils 直连。

## 边界

- 不重写 ConversationDocument、ST 同步语义、Timeline 或 Forge 运行时。
- 不新增独立的世界书业务路径；世界书仍保留现有 UI 和 manager 状态模型。
- 不把 Helper 缺失时的业务兜底散落回 Core；宿主能力缺失由 host driver 返回受控空值或失败。

## 步骤

- [Step 01: Lorebook Host Driver Cutover](./steps/01-lorebook-host-driver-cutover.md) - Completed
- [Step 02: Conversation Host Driver Cutover](./steps/02-conversation-host-driver-cutover.md) - Completed
- [Step 03: Forge Prompt Read Dependency Cutover](./steps/03-forge-prompt-read-dependency-cutover.md) - Completed
- [Step 04: Generation / Facade Boundary Cutover](./steps/04-generation-facade-boundary-cutover.md) - Completed
- [Step 05: HAL Adapter Boundary Rule](./steps/05-hal-adapter-boundary-rule.md) - Completed
- [Step 06: Core Port Injection Cleanup](./steps/06-core-port-injection-cleanup.md) - Completed
- [Step 07: Facade Runtime Port Cleanup](./steps/07-facade-runtime-port-cleanup.md) - Completed
- [Step 08: Message / Prompt Facade Extraction](./steps/08-message-prompt-facade-extraction.md) - Completed
- [Step 09: Conversation Command Service](./steps/09-conversation-command-service.md) - Completed
- [Step 10: Prompt Command Service](./steps/10-prompt-command-service.md) - Completed
- [Step 11: Generation Command Service](./steps/11-generation-command-service.md) - Completed
- [Step 12: HAL/Core Cross-Layer Cleanup](./steps/12-hal-core-cross-layer-cleanup.md) - Completed
- [Step 13: Lumina-Owned Prompt Assembly Route](./steps/13-lumina-owned-prompt-assembly-route.md) - Completed
- [Step 14: 收尾边界扫描与残留清理](./steps/14-closeout-boundary-sweep.md) - Completed

## 验证

优先运行与本次边界相关的验证：

```powershell
cd D:\LuminaWeave\luminaweave-extension
npm run type-check
npm run test -- src/api/core/__tests__/forgeVirtualLorebook.test.ts src/api/__tests__/LuminaWeaveAPI.test.ts
```

若修改影响生成停止、角色头像或宿主环境等待，再补充对应测试。

最新验证：

- `npm run type-check`：通过。
- `npm run test -- src/api/core/__tests__/forgeVirtualLorebook.test.ts src/api/__tests__/LuminaWeaveAPI.test.ts`：通过，2 个测试文件 / 8 个测试。

2026-05-14 后续批次验证：

- `npm run type-check`：通过。
- `npm run test -- src/api/core/__tests__/ChatHostPorts.test.ts src/api/core/__tests__/ChatManager.test.ts src/api/core/__tests__/MessageListGateway.test.ts src/api/core/__tests__/ConversationService.test.ts src/api/core/__tests__/ForgePromptContextService.test.ts src/api/core/__tests__/ForgeTestChatService.test.ts src/api/core/__tests__/forgeVirtualLorebook.test.ts src/api/__tests__/LuminaWeaveAPI.test.ts src/api/core/__tests__/StreamHandler.test.ts src/api/core/__tests__/ContextCompactor.test.ts src/api/core/__tests__/MemoryManager.test.ts`：通过，11 个测试文件 / 64 个测试。

2026-05-14 Step 06 验证：

- `npm run type-check`：通过。
- `npm run test -- src/api/core/__tests__/ChatHostPorts.test.ts src/api/core/__tests__/ChatManager.test.ts src/api/core/__tests__/MessageListGateway.test.ts src/api/core/__tests__/ConversationService.test.ts src/api/core/__tests__/ForgeTestChatService.test.ts src/api/core/__tests__/ForgePromptContextService.test.ts src/api/__tests__/LuminaWeaveAPI.test.ts`：通过，7 个测试文件 / 37 个测试。
- 依赖扫描：`conversation/`、`forge/` 生产代码中未发现 `host-drivers/st`、`STClient`、`STGlobalAccessor` 或 `TavernHelper` 直连；`conversation/`、`forge/`、`generation/`、`facade/` 生产代码中未发现直接 `STClient` / `STGlobalAccessor` import。

2026-05-14 Step 07 验证：

- `npm run type-check`：通过。
- `npm run test -- src/api/__tests__/LuminaWeaveAPI.test.ts src/api/core/__tests__/StreamHandler.test.ts`：通过，2 个测试文件 / 13 个测试。
- 依赖扫描：`core/facade/` 未发现 `STEnvironmentDriver` / `ST_EVENT` / `STGlobalAccessor` / `host-drivers/st` 直接引用；`src/api/index.ts` 未发现 `STEnvironmentDriver`、独立 `ST_EVENT`、`this.ctx`、`this.stMain`、`this.stEventSource`、`this.stEventTypes`、`event_types` 残留。

2026-05-14 Step 08 验证：

- `npm run type-check`：通过。
- `npm run test -- src/api/__tests__/LuminaWeaveAPI.test.ts src/api/core/__tests__/ChatManager.test.ts src/api/core/__tests__/MessageListGateway.test.ts src/api/core/__tests__/ConversationService.test.ts`：通过，4 个测试文件 / 23 个测试。
- 依赖扫描：`src/api/index.ts` 已无 `STConversationHostDriver`、`STCharacterProfileDriver`、`STAdapter`、`STProtocol` 直接引用；仅剩 ST host provider 注册和 `SyncUtils/DiffVisualizer` legacy re-export。`hal/prompt/ContextCompactor.ts`、`hal/prompt/DCCManager.ts` 仍有历史 `SyncUtils` 直接引用，后续需单独迁移。

2026-05-14 Step 09 验证：

- `npm run type-check`：通过。
- `npm run test -- src/api/__tests__/LuminaWeaveAPI.test.ts src/api/core/__tests__/ConversationService.test.ts src/api/core/__tests__/MessageListGateway.test.ts src/api/core/__tests__/ChatManager.test.ts`：通过，4 个测试文件 / 23 个测试。
- 依赖扫描：`src/api/index.ts` 不再出现消息 host mutation 细节调用；`src/api/core/conversation/` 生产代码未发现 `STClient`、`STGlobalAccessor`、`STProtocol`、`STAdapter` 或 `host-drivers/st` 直接引用。

2026-05-14 Step 10 验证：

- `npm run type-check`：通过。
- `npm run test -- src/api/__tests__/LuminaWeaveAPI.test.ts src/api/core/__tests__/PromptBuilder.test.ts src/api/core/__tests__/PromptPresetComposer.test.ts`：通过，3 个测试文件 / 20 个测试。
- 依赖扫描：`src/api/index.ts` 已无 `_probing`、`_probingEvents` 或 `promptProbeService` 直接引用；`PromptCommandService` 未直接引用 `host-drivers/st`、`STClient`、`STGlobalAccessor`、`STProtocol` 或 `STAdapter`。

2026-05-14 Step 11-13 验证：

- `npm run type-check`：通过。
- `npm run test -- src/api/__tests__/LuminaWeaveAPI.test.ts src/api/core/__tests__/StreamHandler.test.ts src/api/core/__tests__/NexusClient.test.ts src/api/core/__tests__/ContextCompactor.test.ts src/api/core/__tests__/MemoryManager.test.ts src/api/core/__tests__/PersistenceService.test.ts src/api/core/__tests__/PromptAssemblyRouter.test.ts src/api/core/__tests__/PromptBuilder.test.ts src/api/core/__tests__/PromptPresetComposer.test.ts src/api/core/__tests__/ForgePromptContextService.test.ts`：通过，10 个测试文件 / 64 个测试。
- 依赖扫描：`src/api/index.ts` 不再 import `llmEngine`、`LuminaGenerationTask`、`GenerationSession`、`NexusClient` 或 `PromptAssemblyRouter`；`hal/prompt/*` 无 ST driver 直连；`storage/*` 无 `STProtocol` / ST `SyncUtils` 直连；`GenerationCommandService` 未直接引用 ST driver 或 ST 全局类。

2026-05-14 Step 14 收尾验证：

- `npm run type-check`：通过。
- `npm run test -- src/api/core/__tests__/forgeVirtualLorebook.test.ts src/api/core/__tests__/STWorldInfoDriver.test.ts src/api/core/__tests__/ResourceRuntime.test.ts src/api/core/__tests__/PromptAssemblyRouter.test.ts src/api/__tests__/LuminaWeaveAPI.test.ts src/api/core/__tests__/StreamHandler.test.ts src/api/core/__tests__/ContextCompactor.test.ts src/api/core/__tests__/MemoryManager.test.ts src/api/core/__tests__/PersistenceService.test.ts`：通过，9 个测试文件 / 90 个测试。
- 依赖扫描：排除 `core/host-drivers/st/`、`core/hal/adapters/st/`、测试文件后，生产 Core 未发现 `host-drivers/st` import、`STClient.`、`STGlobalAccessor.`、`STProtocol.`、`SyncUtils.`、`STWorldInfoDriver`、`new STResourceSource` 或 `TavernHelper.` 直连；`lorebook/` 剩余命中仅为注释文本。

## 恢复方式

先读：

- `docs/index.md`
- `docs/overall/PDR.md`
- `docs/overall/system_design.md`
- `docs/current/tasks/hal-architecture-migration/README.md`
- 本任务的 `steps/`

本任务已归档到 `docs/archive/completed-tasks/host-driver-boundary-cleanup/`；如需追溯，从 `steps/01-lorebook-host-driver-cutover.md` 开始阅读。
