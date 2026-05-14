# Step 06: Core Port Injection Cleanup

## 目标

修正 Step 02-04 中“去掉 `STClient` / `STGlobalAccessor`，但 Core domain 仍直接 import ST host driver”的残留问题。

## 输入

- 审查发现 `conversation/ChatHostPorts.ts`、`conversation/MessageListGateway.ts`、`forge/ForgeTestChatService.ts` 仍直接依赖 `host-drivers/st/*Driver`。
- 目标不是改变行为，而是把 ST 具体实现移出 Core domain，让 Core 只消费端口。

## 处理流程

1. `conversation/ChatHostPorts.ts` 只保留端口、空实现、组合 provider 和注册入口。
2. 新增 ST 会话 provider 实现，由 `host-drivers/st` 注册到 Chat host port。
3. `MessageListGateway` 通过 `ChatMessageListPort` 读取 normalized snapshot。
4. `ForgeTestChatService` 通过 `ForgeTestChatHostPort` 读取 ST preset、角色卡、变量隔离和 generation settings。
5. ST Forge test chat provider 在 host driver 层注册。

## 状态变化

- Core domain 不再直接 import `STConversationHostDriver` 或 `STForgeTestChatDriver`。
- ST 具体 provider 的默认注册由 API bootstrap/facade 入口触发。
- 如果未注册宿主 provider，Core 使用空端口返回受控空值，不直接访问 ST。

## 验收

- [x] `conversation/`、`forge/`、`generation/`、`facade/` 中无直接 `STClient` / `STGlobalAccessor` import。
- [x] `conversation/`、`forge/` 中无直接 `host-drivers/st/*Driver` import。
- [x] `MessageListGateway` 仅消费 message list port。
- [x] 相关测试和 `type-check` 通过。

## 执行记录

- `ChatHostPorts` 保留会话目录、历史、消息列表端口与空实现；ST 会话 provider 迁移到 `host-drivers/st/STChatHostProvider` 并由 bootstrap 注册。
- `ChatManager` 的同步行为改为通过 `ChatSyncPort`，ST 同步实现迁移到 `host-drivers/st/STChatSyncPort`。
- `ForgeTestChatService` 改为通过 `ForgeTestChatHostPort` 读取角色卡、ST preset、instruct settings 与变量隔离能力；ST 实现由 `STForgeTestChatDriver` 注册。
- 测试改为显式注册端口 mock，避免 Core 测试继续依赖 STClient / STGlobalAccessor mock。

## 验证

```powershell
cd D:\LuminaWeave\luminaweave-extension
npm run type-check
npm run test -- src/api/core/__tests__/ChatHostPorts.test.ts src/api/core/__tests__/ChatManager.test.ts src/api/core/__tests__/MessageListGateway.test.ts src/api/core/__tests__/ConversationService.test.ts src/api/core/__tests__/ForgeTestChatService.test.ts src/api/core/__tests__/ForgePromptContextService.test.ts src/api/__tests__/LuminaWeaveAPI.test.ts
```

- `type-check`：通过。
- 目标测试：通过，7 个测试文件 / 37 个测试。
- 依赖扫描：`conversation/`、`forge/` 生产代码中未发现 `host-drivers/st`、`STClient`、`STGlobalAccessor` 或 `TavernHelper` 直连；`conversation/`、`forge/`、`generation/`、`facade/` 生产代码中未发现直接 `STClient` / `STGlobalAccessor` import。
