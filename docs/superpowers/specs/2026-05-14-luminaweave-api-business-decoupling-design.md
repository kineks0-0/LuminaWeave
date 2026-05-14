# LuminaWeaveAPI 业务解耦设计

日期：2026-05-14

## 目标

继续推进 Host Driver Boundary Cleanup，允许一次聚焦业务流的重构。目标是让 `LuminaWeaveAPI` 回到兼容 Facade 的位置，不再同时承载会话命令、Prompt 探测、生成路由和 ST 宿主操作。

本轮保持既有用户可见行为和 public API 方法名不变，但把消息与 Prompt 行为迁入领域服务，由窄 HAL 端口或 host-driver 端口提供宿主能力。

## 范围

本设计覆盖：

- 当前集中在 `LuminaWeaveAPI.crudChatRecord()` 周围的消息命令。
- 当前由 `LuminaWeaveAPI.probePrompt()` 暴露的 Prompt 探测。
- 当前分散在 `sendMessage()`、`triggerGenerate()`、`regenerateLast()`、`runEditedPrompt()`、`abortGenerate()` 中的生成入口路由。
- HAL 或 Core 通用模块中残留的 ST 专用 helper 引用，例如 `host-drivers/st/SyncUtils`。
- `LuminaWeaveAPI` 为旧调用方保留的兼容 wrapper。

本批不覆盖：

- 重写 `ConversationDocument`、事务语义、Timeline 分支或 Forge 主流程。
- 替换绑定 ST 聊天时的 ST native generation 行为。
- 改变插件 UI 行为或 desktop mode contract。
- 在下游调用方迁移前移除 public facade 方法。

## 当前问题

`LuminaWeaveAPI` 仍承担过多职责：

- 判断消息写入 ST 还是 Lumina 独立存储。
- 计算消息展示字段、写回字段和 fingerprint。
- 协调 plugin hook、同步事件和宿主消息变更。
- 探测 ST Prompt payload 并持有 probing 状态。
- 触发宿主生成函数，同时处理 Lumina backend generation 路由。

Step 08 已引入 `ChatMessageMutationPort`、`ConversationHostFacadePort`、`PromptProbeService` 等端口，但主要业务流程仍在 Facade 内。也就是说，Facade 已减少对 ST 具体类的依赖，但仍以宿主形态组织业务逻辑。

## 推荐架构

下一步引入业务命令层作为边界：

```text
LuminaWeaveAPI public 兼容方法
  -> ConversationCommandService / PromptCommandService / GenerationCommandService
  -> HAL business ports
  -> host-drivers/st implementations
```

CommandService 属于 Core Runtime / domain service 层，不进入 HAL，也不由各宿主 adapter 分别实现。HAL 与 adapter 只提供资源、网络、事件、token、macro、host generation、host message writer 等窄能力。如果把 `ConversationCommandService`、`PromptCommandService`、`GenerationCommandService` 做成 per-host adapter，会导致消息字段语义、hook 时机、sync intent 和 Prompt diagnostics 在不同宿主之间分叉。

允许的宿主差异应通过端口能力表达，例如 ST 可以实现 dry-run prompt probe，Standalone 可以返回不支持该能力的 diagnostics；业务流程仍由 Core CommandService 统一编排。

### ConversationCommandService

职责：

- 承接消息编辑、追加、删除和字段重建命令。
- 统一维护消息字段语义：`pluginRaw`、`mesRaw`、`mesST`、`mes`、`fingerprint`、`stFingerprint`、`thinkingText`、`extra`。
- 判断当前命令写入活跃宿主聊天，还是只写入 Lumina 独立存储。
- 协调 plugin hook，并返回事件意图，而不是让底层 host port 直接发事件。

输入：

- 命令类型：`edit`、`add`、`delete`、`rebuild`。
- 目标消息 id 或 index。
- 新文本和可选 metadata。
- 当前 conversation trace。
- HAL/session port 提供的宿主绑定信息。

处理流程：

1. 通过 session 或 message port 归一目标消息身份。
2. 从领域服务读取当前 conversation trace。
3. 构建领域 mutation plan，包含消息字段变化。
4. 在业务边界执行 plugin hook。
5. 当前会话绑定宿主时，只通过 `HostMessageWriter` 写入 ST。
6. 当前会话不绑定宿主，或既有行为要求独立持久化时，写入 Lumina 独立存储。
7. 返回 `MESSAGE_RECEIVED`、`CHAT_UPDATED`、sync refresh 等事件意图。

输出：

- 更新后的消息或 mutation 结果。
- Facade 需要 emit 的事件意图。
- 可选的 `syncFromST()` 或 world-info prompt sync 意图。

边界：

- 该服务可以理解 Lumina 消息语义。
- 该服务不得 import `STClient`、`STGlobalAccessor`、`STProtocol`、`STAdapter` 或 `host-drivers/st/*`。
- 该服务消费 `ChatMessageMutationPort`，或后续拆出的 `HostMessageWriter`。

### PromptCommandService

职责：

- 承接 Prompt 探测业务命令。
- 把 `_probing`、`_probingEvents`、`lastPromptPayload` 状态移出 `LuminaWeaveAPI`。
- 返回结构化 Prompt 结果，让调用方不需要知道 payload 来自 ST 事件还是 Lumina assembly。

输入：

- probe 模式。
- world-info sync 策略。
- `PromptAssemblyRouter` 的当前 route diagnostics。
- timeout 和 quiet-run 选项。

处理流程：

1. 通过回调或领域事件请求 probe 前 world-info sync。
2. 通过 HAL prompt service 启动 prompt probe。
3. 收集截获的 prompt 事件或 Lumina prompt-built payload。
4. 归一为 `{ messages, settings, diagnostics }`。
5. 在未观察到 prompt 事件或无法提取 payload 时返回失败原因。

输出：

- `PromptCommandResult`，包含 `payload`、`messages`、`settings`、`diagnostics`、`source`。

边界：

- HAL prompt 通用代码不得直接 import ST driver。
- ST 专属 dry-run generate 和 stop 行为属于 host prompt probe provider。
- Facade 保留 `probePrompt()` 作为兼容 wrapper。

### GenerationCommandService

职责：

- 承接生成入口路由。
- 根据 prompt route、session binding 和 preset route 判断走 ST native generation 还是 Lumina backend generation。
- 尽量把 abort controller 和生成状态处理移出 `LuminaWeaveAPI`。

输入：

- 用户消息文本或 edited prompt payload。
- send options 和 prompt assembly options。
- active preset id。
- 当前 conversation state。

处理流程：

1. 通过 `PromptAssemblyRouter` 解析 prompt route。
2. route 为 `st-native` 时，调用 host generation invoker port。
3. route 为 Lumina backend 时，调用 `PromptCommandService` 获取 prompt payload。
4. 清洗 messages，并运行 `LuminaGenerationTask`。
5. 通过现有 stream/finalization 路径完成最终文本处理。
6. 返回事件意图和生成状态。

输出：

- 为兼容方法保留的 boolean command success。
- generation status、error 和 finalization intents。

边界：

- 该服务可以使用 `LuminaGenerationTask`、`llmEngine` 和 domain services。
- 该服务不得直接定位 `generate`、`regenerate`、`stopGeneration` 等宿主函数。
- 宿主生成函数由 HAL 或 host runtime port 暴露。

## 插件形态下的 Lumina Prompt Assembly 规划

长期方向是让插件形态下的 Prompt 也优先由 Lumina 自己合成，而不是依赖 ST dry-run generate 获取最终 Prompt。ST prompt probe 应降级为兼容、调试、对比或 `st-native` route 的辅助路径。

目标链路：

```text
Chat / Forge / API send intent
  -> GenerationCommandService
  -> PromptAssemblyRouter
  -> Lumina Prompt Assembly
      -> SessionBindingResolver
      -> PromptSourceRegistry
      -> WorldInfoResolver
      -> CharacterCardProvider
      -> PersonaProvider
      -> PresetComposer
      -> TokenBudgetPlanner
  -> LLM payload
  -> LuminaGenerationTask / NexusClient
```

ST 在该模式下只作为资源来源和可选 native engine：

```text
ST character card / persona / world info / preset / chat history
  -> host-drivers/st / hal/adapters/st
  -> normalized Prompt Sources
  -> Lumina Prompt Assembly
```

### 双轨 Prompt Engine

保留两条 route：

```text
engine: st-native | lumina-assembly
```

- `st-native`：绑定 ST 聊天时保留当前 ST native generation 与 prompt probe 行为。
- `lumina-assembly`：Lumina 读取 ST 资源，但由自身组装 messages 和 settings。

初期默认策略：

```text
绑定 ST 聊天：
  默认 st-native
  可显式切换 lumina-assembly

Forge / 独立会话：
  默认 lumina-assembly
```

成熟后可以把新会话默认值逐步切到 `lumina-assembly`，但 `st-native` 保留为兼容路径。

### ST 资源作为 Prompt Source

Prompt 业务服务不得直接读取 ST。ST adapter 只提供 normalized source：

```text
STCharacterCardProvider
STPersonaProvider
STWorldInfoProvider
STPresetProvider
STChatHistoryProvider
STMacroResolver
STTokenCounter
```

Core / HAL prompt 通用层看到的是稳定 Prompt Source：

```ts
interface PromptSource<T> {
  sourceId: string;
  kind: 'character' | 'persona' | 'world_info' | 'preset' | 'history';
  payload: T;
  trace: PromptSourceTrace;
}
```

Prompt Assembly 负责资源合并、宏替换顺序、世界书触发、preset/template 组合、token budget 裁剪和 trace 生成。ST adapter 不拥有业务 Prompt 合成逻辑。

### Prompt Probe 降级

`probePrompt()` 后续只服务以下场景：

- `st-native` route 需要观察 ST 实际 prompt。
- Prompt Inspector 调试。
- ST native prompt 与 Lumina assembled prompt 对比。
- Lumina assembly 尚未覆盖的临时兼容路径。

业务主路径不再依赖 `probePrompt()` 才能生成 Lumina backend payload。

### 行为风险

Lumina 自合成 Prompt 的主要风险是 ST 行为复刻不完整，尤其包括：

- 世界书触发规则。
- macro 替换顺序。
- instruct / completion / chat completion preset 差异。
- persona、character depth、example dialogue 的注入位置。
- extension prompt / injection prompt 顺序。
- token 预算和裁剪口径。

因此迁移顺序应为：

```text
显式 lumina-assembly 模式
  -> Prompt trace / compare
  -> per-session opt-in
  -> 新会话默认
  -> st-native 长期兼容保留
```

## 端口调整

### 拆分或重命名 `ChatMessageMutationPort`

当前 `ChatMessageMutationPort` 同时包含 snapshot 读取、状态比较、fingerprint 和宿主写入。下一批按概念拆成：

- `MessageProjectionPort`：提取展示文本/写回文本，计算 fingerprint。
- `HostMessageWriter`：获取 host index、append、update、delete、读取 host snapshot。
- `SessionIdentityPort`：归一 chat/session id。

代码迁移可以增量进行：先保留 `ChatMessageMutationPort` 作为兼容 adapter，待 call site 迁移后再拆窄。

### 新增 `HostGenerationInvoker`

暴露：

- `generate()`
- `regenerate()`
- `stop()`
- 可选 `slash(command)`

ST 实现可以复用当前 runtime driver 逻辑。Core service 只消费 invoker。

### 新增 `PromptProbePort`

暴露：

- `probe(input): Promise<PromptProbeResult>`

ST 实现负责 dry-run host generate、事件监听和 stop 行为。HAL prompt 通用服务只负责归一结果。

## 迁移计划

### Batch 09：Conversation Command Service

- 新增 `ConversationCommandService`。
- 将 `crudChatRecord()` 内部逻辑迁入 service。
- 保留 `LuminaWeaveAPI.crudChatRecord()` wrapper。
- 将 rebuild 字段计算迁入 service 或 `MessageProjectionPort`。
- 增加基于 mock port 的 edit/add/delete 测试。

验收：

- `LuminaWeaveAPI` 不再计算 ST 写回文本、host fingerprint 或 host message index。
- `host-drivers/st` 与 `hal/adapters/st` 之外不新增 ST 直接引用。

### Batch 10：Prompt Command Service

- 新增 `PromptCommandService`。
- 将 probe 状态移出 `LuminaWeaveAPI`。
- 将 `PromptProbeService` 调整为返回结构化结果的低层 HAL service。
- 增加 prompt payload 提取、无事件诊断、Lumina prompt-built fallback 测试。

验收：

- `LuminaWeaveAPI.probePrompt()` 只保留 wrapper，不拥有 `_probing` 状态。
- HAL prompt 通用模块不 import `host-drivers/st/*`。

### Batch 11：Generation Command Service

- 新增 `GenerationCommandService`。
- 迁移 `sendMessage()`、`triggerGenerate()`、`regenerateLast()`、`runEditedPrompt()`、`abortGenerate()` 编排。
- 引入 `HostGenerationInvoker`。
- 保留 Facade 兼容签名。

验收：

- `LuminaWeaveAPI` 委托 generation routing。
- 宿主函数定位由 host runtime 或 generation invoker port 承担。

### Batch 12：HAL/Core 跨层清理

- 将 `ContextCompactor` 对 ST `MessageTextResolver` 的依赖替换为 `MessageProjectionPort`。
- 将 `DCCManager` 对 `SyncUtils.getDccSettings()` 的依赖替换为 storage/settings port。
- 梳理 `PersistenceService`、`TimelineManager`、`WorldlineStore` 中残留的 `STProtocol` / `SyncUtils` 引用，迁移到 neutral utility 或 host adapter call。

验收：

- 通用 `hal/prompt/*` 模块无直接 `host-drivers/st` import。
- Core storage 模块不再为了 host-neutral 操作 import ST 专用 protocol helper。

### Batch 13：插件形态 Lumina-owned Prompt Assembly

- 为绑定 ST 聊天增加显式 `lumina-assembly` route。
- 将 ST 角色卡、persona、世界书、preset、聊天历史接入 normalized Prompt Source provider。
- 让 `GenerationCommandService` 在 `lumina-assembly` route 下不调用 ST dry-run generate 获取 Prompt。
- 为 Prompt Inspector 增加 Lumina assembled prompt trace，并保留 ST native prompt 对比能力。
- 保留 `st-native` route 作为兼容路径。

验收：

- 插件形态下可显式选择 `lumina-assembly`。
- `lumina-assembly` 不依赖 `probePrompt()` 才能得到 LLM payload。
- ST 只作为 Prompt Source provider 和可选 native engine，不拥有 Prompt 业务合成。
- Prompt Inspector 能展示 Lumina assembled prompt 的来源 trace。
- `st-native` 行为不回退。

## 测试计划

每批都运行：

```powershell
cd D:\LuminaWeave\luminaweave-extension
npm run type-check
```

Batch 09：

```powershell
npm run test -- src/api/__tests__/LuminaWeaveAPI.test.ts src/api/core/__tests__/ConversationService.test.ts src/api/core/__tests__/MessageListGateway.test.ts src/api/core/__tests__/ChatManager.test.ts
```

Batch 10：

```powershell
npm run test -- src/api/__tests__/LuminaWeaveAPI.test.ts src/api/core/__tests__/PromptBuilder.test.ts src/api/core/__tests__/PromptPresetComposer.test.ts
```

Batch 11：

```powershell
npm run test -- src/api/__tests__/LuminaWeaveAPI.test.ts src/api/core/__tests__/StreamHandler.test.ts src/api/core/__tests__/NexusClient.test.ts
```

Batch 12：

```powershell
npm run test -- src/api/core/__tests__/ContextCompactor.test.ts src/api/core/__tests__/MemoryManager.test.ts src/api/core/__tests__/PersistenceService.test.ts
```

Batch 13：

```powershell
npm run test -- src/api/__tests__/LuminaWeaveAPI.test.ts src/api/core/__tests__/PromptBuilder.test.ts src/api/core/__tests__/PromptPresetComposer.test.ts src/api/core/__tests__/ForgePromptContextService.test.ts
```

每批结束后扫描 `STClient`、`STGlobalAccessor`、`STProtocol`、`STAdapter`、`host-drivers/st`，确认直接依赖只出现在允许边界内。

## 文档影响

现有 PDR 目标不变：LuminaWeave 保持 ST 兼容行为，同时把宿主物理 I/O 收口到 host drivers 和 HAL 后。实现完成后需要更新 System Design，在 Core Runtime 下记录新的业务命令层，并明确 Facade public methods 是兼容 wrapper，不是消息或 Prompt 业务逻辑的所有者。

如果 Batch 13 落地，还需要在 System Design 的 Prompt 章节补充：ST native prompt probe 是兼容/调试路径；插件形态下的 Lumina-owned Prompt Assembly 是长期主路径，ST 资源通过 Prompt Source provider 进入合成链路。

## 假设

- `LuminaWeaveAPI` 现有 public 方法名属于兼容面，重构期间继续保留。
- ST 插件模式行为必须保持不变。
- 当前工作区包含大量无关脏变更；实施批次只能 stage 和验证本任务触碰的文件。
- 当前 `ChatMessageMutationPort` 可暂时作为兼容 adapter 保留，后续再拆为更窄端口。
