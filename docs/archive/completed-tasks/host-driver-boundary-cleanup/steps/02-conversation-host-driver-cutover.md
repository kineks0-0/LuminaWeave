# Step 02: Conversation Host Driver Cutover

## 目标

将会话目录、角色 roster、ST 物理消息列表读取与消息写回从 `conversation/` 和 `LuminaWeaveAPI` 收口到 `host-drivers/st/STConversationHostDriver`。

## 输入

- Core / Facade 调用会话打开、新建、重命名、删除、关闭、角色资料解析。
- Chat 同步与消息编辑/追加/删除需要读取或写回当前 ST live chat。

## 处理流程

1. 新增 `STConversationHostDriver`，封装 ST 会话和消息物理操作。
2. `ChatHostPorts` 保留端口与组合策略，ST 调用委托给 driver。
3. `MessageListGateway` 消费 driver 返回的 normalized snapshot。
4. `ChatManager`、`ChatSessionIndexService` 的 chat id normalize 改走 HAL session normalizer。
5. `LuminaWeaveAPI` 保留 public facade 方法名，但实现委托 host driver。

## 状态变化

- `conversation/` 不再直接 import `STClient`。
- ST 消息 `update/delete/append/flush` 归口到 `STConversationHostDriver`。
- Core 会话 ID 规范化优先使用 HAL，HAL 未初始化时保留本地纯函数回退。

## 验收

- [x] `conversation/` 中无 `STClient` / `STGlobalAccessor` import。
- [x] `LuminaWeaveAPI` 的会话、preset、角色列表和消息写回透传不再直接调用 `STClient`。
- [x] `npm run type-check` 通过。
