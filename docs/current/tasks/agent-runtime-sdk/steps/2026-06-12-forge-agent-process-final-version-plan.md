# Forge Agent process / final 与文件版本规划

## Summary

目标是在 Forge Agent 中建立可持久、可回看、可切换分支、可审计文件变更的执行显示模型。运行中展示模型显式输出的公开执行说明、工具调用和文件变更；结束后自动折叠执行过程，保持最终回复展开，并让文件版本面板继续以 `workspace_patch` 为事实依据。

本记录先作为规划文档创建，随后已完成代码落地：Prompt Preview / 真实生成输出协议、严格 parser、`process` / `assistant` session 投影、stream message 字段写回、timeline `process` 投影、active branch feed、执行过程内联段分层显示和文件变更归属测试已接入；真实宿主 walkthrough 和流式节流观感仍在后续项。

## Confirmed Decisions

- Forge Agent 聊天与 UI 投影的唯一事实源是 `piSessionEntries + activePiNodeId`。
- 时间线切换必须切换 Forge pi session active node，再从 active branch 重新投影聊天、执行过程、最终回复和文件版本。
- 过程性自然语言由模型显式输出，不由 UI 自动编写。
- `process` 过程消息持久化到 pi session tree，并允许进入下一轮 LLM 上下文。
- `process` 是公开执行说明，不是隐藏推理；它可以描述“我要读取文件确认结构”“现在更新文件内容”，不要求模型输出完整内部推理。
- 第一阶段采用显式块协议：

```text
<process>
我需要先读取 xx.md 确认当前结构。
</process>

<final>
已完成修改，主要调整了...
</final>
```

- `<process>` 内容保存为过程消息，显示在执行过程内联段。
- `<process>` 正文直接显示为文本，不显示专用过程标题，也不作为步骤列表项。
- `<final>` 内容保存为最终 assistant 回复。
- 工具调用、工具结果和 `workspace_patch` 只由 runtime / tool bridge 产生，不从模型文本推断。
- 标签外文本、未闭合标签和混乱嵌套不自动归类到最终回复；解析失败进入诊断和 trace，不污染正式 session tree。
- 文件版本事实源是 `workspace_patch`、checkpoint / restore 状态和当前项目 VFS 内容，不是 `process` 文案。

## Runtime Message Model

Forge active branch 上的 Agent turn 使用以下语义记录：

```text
user              用户输入
process           模型显式输出的公开执行说明
tool_call         工具调用
tool_result       工具结果
workspace_patch   文件变更与审计记录
assistant         最终回复
```

这些记录全部从 active branch 投影。`children`、timeline rows、console messages、文件变更列表、执行过程内联段和 model debug summary 都是 projection，不是长期事实源。

## Prompt Preview 与真实生成

`ForgePiAgentSession.preparePrompt()` 仍是 Prompt Preview 与真实生成的事实源。新增的 `<process>` / `<final>` 协议必须同时进入 Prompt Preview 和真实请求：

- Preview / `prompt_ready` payload 展示模型可见协议、本轮 user message、branch messages、active tools summary 和 skill catalog。
- 真实 run 继续复用同一个 prepared prompt object。
- 本轮 user message 仍由 `agent.prompt()` 注入，不在 pi-agent-core initial state 中重复注入。
- 解析失败必须能在 trace/debug 中定位到原始输出和失败原因。

## 运行中 UI

运行中默认展开执行过程内联段：

```text
用户输入

执行过程 · 运行中  [收起]
  让我思考一下，用户希望...，我需要读一下文件确定...
  - 正在读取文件
    现在我需要更新一下文件内容...
  - 正在编辑文件
    文件已编辑，结果已等待用户确认
  - xx.md 文件被更改 +10 -1
    版本面板 / 撤回
  - 已生成 workspace_patch

最终回复区域：
  流式显示 assistant text
```

UI 只生成状态标签、折叠摘要和工具 / 文件变更外壳，不生成过程正文。

## 结束后 UI

Agent 结束后默认折叠执行过程内联段，最终回复保持展开；折叠态仍保留在用户输入和最终回复之间：

```text
用户输入

执行过程 · 读取 3 个文件 · 编辑 1 个文件 · 生成 1 条回复  [展开]

最终回复：展开

文件变更：独立展示 patch / checkpoint / restore
  - xx.md 文件被更改 +10 -1
    版本面板 / 撤回
```

折叠摘要由工具事件和 `workspace_patch` 记录生成。`workspace_patch` 可同时在过程段和文件变更区展示，但底层只保存一份记录；文件操作按钮只保留在最终回复后的文件变更区。

## 流式解析与性能

- `<process>` 打开后，内容实时显示到执行过程内联段；闭合并解析成功后才持久化。
- `<final>` 打开后，内容实时显示到最终回复区域；闭合并解析成功后才保存为 assistant。
- 每个 stream chunk 不重算完整 timeline；UI 只更新当前 active turn。
- 对累计文本流做节流渲染，例如按 animation frame 或短时间窗口合并。
- 流式阶段使用轻量文本显示，结束后再做完整 Markdown 渲染和过程折叠。
- 解析失败时显示可见诊断，原始输出留在 trace/debug，不进入正式 `process` 或 `assistant`。

## LLM 上下文回看

下一轮上下文允许包含 `process`，但必须压缩为执行记录格式，不把 UI 卡片原样塞入 prompt：

```text
[Process]
- 我需要先读取 xx.md 确认当前结构。
- 现在我会更新对应段落，并保持原格式。

[Tools]
- read xx.md: success
- edit xx.md: success

[File Changes]
- xx.md +10 -1

[Final]
已完成修改，主要调整了...
```

当前 turn 可以完整保留；较早 turn 保留关键过程、工具摘要、文件变更和最终回复。工具结果正文不长期塞入上下文，需要事实时让 agent 重新通过 `read` 读取 VFS。

## 文件版本控制

- `read` 只读取，不产生版本。
- `write` / `edit` / `delete` 必须走 Forge Semantic VFS 和 `ForgePiToolBridge`，不允许绕过 `workspace_patch`。
- 写入类工具成功后生成 `workspace_patch`，并进入 active branch 的 session entries。
- 文件版本面板从 active branch 的 `workspace_patch` / checkpoint history 投影，不从 UI 局部状态投影。
- `xx.md +10 -1` 来自 patch diff / 变更记录，不来自 `process` 文案。
- “确定 / 撤回 / restore” 操作绑定 patch / checkpoint / restore 状态。
- 切换 session branch 后，文件版本列表必须随 `activePiNodeId` 重新计算。
- 恢复动作直接生成反向或重放 `workspace_patch` 并写回 Forge 项目 VFS；真实 ST 世界书发布、导出或覆盖宿主数据仍必须由用户确认。

## Lifecycle Cleanup

- 正常完成、approval resume 完成、abort 和 error 都要产生明确终止状态。
- `agent_end` 是 UI 收束边界：清理 pending tool calls、streaming message、active trace，触发执行过程内联段自动折叠。
- `turn_end` 表示单轮完成；如果一次 agent run 包含继续执行，最终折叠以真正结束为准。

## Implementation Priority

1. [x] Prompt Preview 与真实生成统一注入 `<process>` / `<final>` 协议。
2. [x] 增加严格流式解析与 `process` / `assistant` 投影。
3. [x] `process` entry 进入 timeline execution projection，并允许下一轮 branch messages 回看。
4. [x] Forge stream message update 写回解析后的 `mes` / `mesRaw` / `thinkingText`，raw 输出保留在 `pluginRaw`。
5. [x] 文件变更分组锁定 `workspace_patch -> process -> assistant` 仍归属同一 assistant turn。
6. [x] 修正 Forge 完成态时间线切换，使聊天、执行过程、最终回复和聊天内文件变更从 active branch 的 `piSessionEntries + activePiNodeId` 投影；当前仍需继续做真实 UI walkthrough。
7. [x] 重做执行过程内联段和最终回复分层显示：公开过程正文直接显示，工具/文件事实进入步骤列表；运行中过程展开，结束后在用户输入和最终回复之间保留一行摘要并可手动展开/收起；assistant 最终回复区只显示 final text。
8. [~] 文件版本面板维持 active branch 的 `workspace_patch` / checkpoint 投影；仍需真实宿主恢复验证。
9. [ ] 补 `agent_end` 后 UI 状态清理和流式节流观感的真实 UI 验证。
10. [ ] 覆盖 Prompt Preview、真实生成、branch checkout、`workspace_patch`、restore、解析失败和流式性能测试。

## Implementation Record

- 新增 `ForgePiAgentOutputParser`，解析 `<process>` / `<final>`，返回 `processBlocks`、`finalText`、`diagnostics` 和 streaming projection。
- `ForgePiAgentSession.preparePromptState()` 在同一个 prepared prompt 中追加输出协议，使 Prompt Preview 与真实 `prompt_ready` 同源。
- `ForgePiAgentSession` 在 `message_update` 中把 `<process>` 投影为 thinking stream，把 `<final>` 投影为 visible stream；在 `message_end` 中把 `process` 与 assistant final 分开写入 pi session entries。
- 解析 diagnostics 通过 `agent_output_parse` trace 暴露；无合法 `<final>` 时不写 assistant session entry。
- `ForgePiRuntimeEventType` 和 `ForgePiMessagePayload.role` 增加 `process`。
- `ForgePiTimelineProjector` 把 `process` entry 展示为 `Agent 过程` execution row。
- `createAssistantStreamMessageUpdate()` 把解析后的 final/process 写回 `mes`、`mesRaw` 和 `thinkingText`；`pluginRaw` 继续保留完整 raw text。
- `CardMakerPanel` 向 `ForgeMessageRenderer` 传入 `syncStatus === 'streaming'`，让通用 renderer 按流式状态处理 thinking block。
- `CardMakerStore` 在 `stream_done` 提交最终 assistant message 后清空临时 `streamText` / `streamThinkingText`。
- `CardMakerStore.timelineFeed` 在完成态从 active pi branch 投影 user message、process/tool/workspace operation 和 assistant final；流式阶段继续使用 worldline streaming message 作为临时 UI。
- `buildWorkspacePatchGroupsByAssistantTurn()` 支持 `activeNodeId`，聊天内文件变更列表只展示当前 active branch 的 `workspace_patch`。
- active branch feed projection 留在 Forge plugin helper，避免 UI shell 依赖 `agent-app/session` runtime。
- 新增 `buildForgeAgentProcessPresentation()`，把 `process`、tool call/result、文件变更和 `workspace_patch` 投影为聊天内“执行过程”摘要与步骤。
- `CardMakerPanel` 不再用 `ForgeInlineTrace` 渲染聊天内过程；运行中执行过程内联段默认展开，完成态折叠为一行摘要，并支持手动展开 / 收起。
- 模型公开过程正文通过 `processBlocks` 直接显示，不进入步骤列表；步骤列表只显示工具、文件变更和 `workspace_patch` 等过程事实。
- assistant 最终回复渲染时抑制已进入过程段的 `thinkingText`，避免 `<process>` 内容和 `<final>` 正文混在同一个回复区域。
- 聊天内文件变更区文案收敛为“文件变更”，继续通过版本面板和撤回动作绑定 `workspace_patch` / restore 状态。

## Acceptance Checks

- Prompt Preview 和真实生成展示同一 `<process>` / `<final>` 协议。
- 运行中 `<process>` 进入执行过程内联段，`<final>` 进入最终回复区域。
- `<process>` 正文不显示专用过程标题，也不作为步骤列表项。
- 结束后执行过程内联段自动折叠为一行摘要，摘要保留在用户输入和最终回复之间，最终回复保持展开。
- 时间线切换后，pi message、执行过程、最终回复、文件版本全部随 active branch 切换。
- 写入类工具生成 `workspace_patch`，文件变更区可打开版本面板并撤回；恢复由文件版本面板绑定 patch / checkpoint / restore 状态处理。
- `process` 出现在下一轮 LLM 上下文的压缩执行记录中。
- 解析失败不写入正式 `process` / `assistant`，只进入诊断和 trace。
- 流式输出不再因为每个 chunk 重算全量 timeline / Markdown / trace 而卡顿。

## Test Scope

- `AgentRuntimeEventBus`：`agent_end` 清理、message stream、tool execution 顺序。
- `AgentPromptAssembler`：Preview 与真实生成共用 prepared prompt object，并包含 `<process>` / `<final>` 协议。
- `ForgePiAgentSession`：解析 `process` / `final`、保存 session entries、上下文回看格式。
- `ForgeRuntimeOrchestrator` / Forge store：runtime snapshot、stream chunk 节流、终止状态清理。
- `ForgePiTimelineProjector`：timeline origin 指向 pi session active branch。
- `ForgeWorkspaceVersionManager`：active branch patch projection、撤回、恢复。
- Forge plugin presentation：执行过程内联段、最终回复、文件变更区。
