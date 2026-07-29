# Forge Agent Runtime scoped 实时事件投影

## 状态

2026-07-29 完成 P0 实现。Forge 普通生成和授权批准后的续跑统一通过 `AgentRuntimeEventBus` 的 scoped event/snapshot 链路投影；旧 Forge `stream_chunk`、`stream_done`、`stream_error`、`tool_call`、`tool_result` 不再作为传输事件。

## 公共事件契约

- `agent_start`、`turn_start`、`message_start`、`message_update`、`message_end`、`tool_execution_start`、`tool_execution_update`、`tool_execution_end`、`turn_end`、`agent_end` 均携带必填 `sessionId` 和 `turnId`。
- `queue_update` 携带 `sessionId` 和 `activeTurnId`；过滤、snapshot 和 reducer 均按 session 独立处理。
- `AgentRuntimeSnapshot` 携带 `sessionId`、`activeTurnId`；消息和 pending tool 携带 `turnId`。
- `tool_execution_update/end` 携带 `toolName`，事件自身即可生成工具投影。
- `subscribe(filter, listener)`、`getSnapshot(sessionId)` 和 `getEvents(filter?)` 均支持 session/turn 过滤；取消订阅后不再收到事件。订阅 listener 异常会记录稳定日志，但不会阻断后续 listener 或事件。

## Forge 生命周期

每次普通执行只发一次 `agent_start` / `turn_start`。pi 的每次 `message_start` 生成独立 ID：`agent-message:${sessionId}:${turnId}:${sequence}`；同一响应的 update/end 复用该 ID，批准续跑不复用 `requestId` 作为消息 ID。

等待授权时 pending tool 保持 `running`，不发 turn/agent end，也不把授权等待伪装成普通工具结果。批准、拒绝和执行失败分别发出 `completed`、`denied`、`failed` 的 `tool_execution_end` 并清理 pending 状态。批准续跑复用原 session/turn，不重复发 start；完成或拒绝后各发一次 `turn_end` / `agent_end`。异常结束同时设置 `turn_end.errorMessage` 并闭合 `agent_end`。

授权恢复必须从 Forge approval 记录读取精确的 `sessionId`、`requestId`（turn）和 `toolCallId`。任一身份缺失、找不到 pending approval 或身份不一致时返回 `resolved: false`，不得从当前活动界面推断目标。

## 单一 presentation 路径

`forgeAgentRuntimePresentation` 按 `contentIndex` 将 runtime message 投影为 `text`、`thinking` 和 `toolCall` block。`message_update` 静默更新聊天气泡和模型请求 trace；`turn_end` 提交最终气泡，错误结束清理生成态并写入稳定错误。通用 tool lifecycle 映射为 Forge running operation、模型请求 tool trace 和完成状态；Prompt Preview、授权、Semantic VFS、`workspace_patch`、模型 trace 与 session 持久化仍通过 Forge effect 边界处理。

`CardMakerStore` 在 Pinia store scope 内只建立一次总线订阅，严格匹配当前 `sessionId + turnId`，串行应用 presentation effects，并在 `onScopeDispose()` 取消订阅。`ForgeRuntimeOrchestrator.onRuntimeEvent` 只处理 Forge 专属事件；实时 Agent Runtime projection 不再与旧 stream/tool 分支并行。

## 验证

已覆盖 Agent Runtime EventBus、Core Runtime、Runtime Client、Forge AgentSession、Forge session/presentation、Orchestrator、Action Controller、CardMakerStore 和 store projection。定向测试通过后，继续运行 extension `type-check`、全量 `test` 和 `build`；构建产物只由构建命令生成。

本次修改改变 Agent Runtime 公共事件接口和 Forge 实时数据流；未改变微内核、Semantic VFS、Git 工作区版本或 SillyTavern 发布边界。
