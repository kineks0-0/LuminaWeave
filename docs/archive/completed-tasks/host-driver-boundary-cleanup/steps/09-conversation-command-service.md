# Step 09: Conversation Command Service

状态：Completed

日期：2026-05-14

## 目标

把 `LuminaWeaveAPI.crudChatRecord()` 周围的消息命令业务迁出 Facade，建立 Core business command layer。Facade 保留旧 public 方法名，但不再直接处理 host message index、ST 写回文本、fingerprint、append/update/delete 等消息写入细节。

## 已完成

- 新增 `src/api/core/conversation/ConversationCommandService.ts`。
- 将消息 `edit`、`add`、`delete` 的业务流程迁入 `ConversationCommandService`：
  - 归一消息正文。
  - 计算 `mesRaw`、`mesST`、`mes`、`fingerprint`、`stFingerprint`。
  - 维护 `activeLeafId`。
  - 执行 message adding / added plugin hooks。
  - 通过 `ChatMessageMutationPort` 写入 host message。
  - 保存独立聊天存储。
  - 在受控 sync lock 内触发 host refresh。
- 将 `rebuildCurrentChatMessages()` 的字段重建迁入 `ConversationCommandService`。
- `LuminaWeaveAPI.crudChatRecord()` 缩减为兼容 wrapper，只负责 ready check、委托 service、转发事件意图。
- `LuminaWeaveAPI.rebuildCurrentChatMessages()` 缩减为 service wrapper。

## 边界

- `ConversationCommandService` 属于 Core Runtime / domain service 层。
- `ConversationCommandService` 不 import `STClient`、`STGlobalAccessor`、`STProtocol`、`STAdapter` 或 `host-drivers/st/*`。
- 宿主消息物理 I/O 仍由 `ChatMessageMutationPort` 及 ST host-driver 实现承担。
- 本步不改变 `ConversationDocument`、Timeline 分支语义、ST 同步策略或 Forge 主流程。

## 验证

```powershell
cd D:\LuminaWeave\luminaweave-extension
npm run type-check
npm run test -- src/api/__tests__/LuminaWeaveAPI.test.ts src/api/core/__tests__/ConversationService.test.ts src/api/core/__tests__/MessageListGateway.test.ts src/api/core/__tests__/ChatManager.test.ts
```

结果：

- `npm run type-check`：通过。
- `npm run test -- src/api/__tests__/LuminaWeaveAPI.test.ts src/api/core/__tests__/ConversationService.test.ts src/api/core/__tests__/MessageListGateway.test.ts src/api/core/__tests__/ChatManager.test.ts`：通过，4 个测试文件 / 23 个测试。

依赖扫描：

- `src/api/index.ts` 不再出现 `updateHostMessage`、`deleteHostMessage`、`appendHostMessage`、`getHostIndex`、`getFingerprint`、`getHostFingerprint`、`generateNodeId`、`syncMessageCalculatedFields` 等消息 host mutation 细节调用。
- `src/api/core/conversation/` 生产代码未发现 `STClient`、`STGlobalAccessor`、`STProtocol`、`STAdapter` 或 `host-drivers/st` 直接引用。

## 后续

- Batch 10：新增 `PromptCommandService`，把 `probePrompt()` 状态与 Prompt payload 归一逻辑迁出 `LuminaWeaveAPI`。
- Batch 11：新增 `GenerationCommandService`，迁移 `sendMessage()`、`triggerGenerate()`、`regenerateLast()`、`runEditedPrompt()`、`abortGenerate()` 编排。
- Batch 12：清理 `hal/prompt/*` 与 storage 模块中的 `host-drivers/st/SyncUtils` / `STProtocol` 残留。
