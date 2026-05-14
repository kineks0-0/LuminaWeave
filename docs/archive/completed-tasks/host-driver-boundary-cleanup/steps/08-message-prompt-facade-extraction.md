# Step 08: Message / Prompt Facade Extraction

## 目标

继续清理 `LuminaWeaveAPI` 中与 SillyTavern 强绑定的消息处理和提示词探测逻辑。重点是让 facade 不再直接知道 ST 消息索引、ST 写回格式、ST 指纹算法、角色/preset 读取 driver，以及 dry-run prompt probe 的宿主函数调用细节。

## 输入

- Step 07 已将宿主 runtime 和事件绑定抽到 `HostRuntimePort`。
- `LuminaWeaveAPI` 仍直接调用 `STAdapter`、`STProtocol`、`STConversationHostDriver`、`STCharacterProfileDriver`、`SyncUtils` 等处理消息 edit/add/delete、diff、prompt probe 和角色/preset 透传。

## 处理流程

1. 新增 `ChatMessageMutationPort`，封装消息快照、diff、host index、指纹、node id、host write text、append/update/delete 物理写入。
2. 新增 `STChatMessageMutationPort`，在 ST host driver 内部组合 `STAdapter`、`STProtocol`、`SyncUtils`、`STConversationHostDriver`。
3. 新增 `ConversationHostFacadePort`，封装 preset、角色名、角色列表、角色头像、session character meta 等 facade legacy 透传。
4. 新增 `STConversationHostFacadePort`，由 ST host driver 实现 legacy facade host 能力。
5. 新增 `PromptProbeService` 到 HAL prompt 层，承接 host dry-run prompt probe 的 generate / stop 调用。
6. `LuminaWeaveAPI` 保留旧 public 方法名，但消息更新、删除、追加、diff、prompt probe 改为委托 port/service。

## 状态变化

- `LuminaWeaveAPI.crudChatRecord()` 不再直接调用 `STAdapter`、`STProtocol`、`STConversationHostDriver` 或 `SyncUtils`。
- `LuminaWeaveAPI.getSTChatMessages()` / `getSyncDiff()` 改为消费 `ChatMessageMutationPort`。
- `LuminaWeaveAPI.probePrompt()` 改为委托 HAL `PromptProbeService`。
- 角色/preset 旧 facade API 改为通过 `ConversationHostFacadePort`。

## 验收

- [x] `LuminaWeaveAPI` 中消息 edit/add/delete 不直接 import ST adapter/protocol/client。
- [x] `LuminaWeaveAPI` 中 prompt probe 不直接定位和调用 ST generate / stop 函数。
- [x] `LuminaWeaveAPI` 中角色/preset 透传不直接 import ST conversation/profile driver。
- [x] `type-check` 与消息/facade 相关测试通过。

## 验证

```powershell
cd D:\LuminaWeave\luminaweave-extension
npm run type-check
npm run test -- src/api/__tests__/LuminaWeaveAPI.test.ts src/api/core/__tests__/ChatManager.test.ts src/api/core/__tests__/MessageListGateway.test.ts src/api/core/__tests__/ConversationService.test.ts
```

- `type-check`：通过。
- 目标测试：通过，4 个测试文件 / 23 个测试。
- 依赖扫描：`src/api/index.ts` 已无 `STConversationHostDriver`、`STCharacterProfileDriver`、`STAdapter`、`STProtocol` 直接引用；仅剩 ST host provider 注册和 `SyncUtils/DiffVisualizer` legacy re-export。`hal/prompt/ContextCompactor.ts`、`hal/prompt/DCCManager.ts` 仍有历史 `SyncUtils` 直接引用，后续需单独迁移到 host-neutral message utility / HAL setting port。
