# Provider-native structured message 主路径规划

## 决策

2026-06-12 选择方案 C：Agent Runtime SDK 与 Forge adapter 的下一阶段消息主路径改为 provider-native structured messages。

这意味着 Forge 后续不再要求模型输出 `<process>` / `<final>` 标签，也不保留标签协议作为过渡兼容层。已经完成的标签解析只作为历史实现记录；后续实现目标是移除对标签协议的依赖，让 provider 原生结构化内容直接进入 SDK session、event、trace 和 adapter projection。

## 目标状态

Agent turn 的消息事实源分为三层：

1. Provider raw message
   - 保留 provider 原始响应、签名 reasoning artifact、provider 专属 metadata 和错误信息，用于 trace、调试和同 provider replay。
   - raw thinking 不进入普通用户可见历史、Forge memory、虚拟世界书或 `workspace_patch` 内容。

2. Replay-safe structured message
   - SDK 记录跨轮可回放的结构化消息块：最终可见 `text`、可投影执行过程的 `thinking` / reasoning、tool call、tool result、必要的 audit reference。
   - 该层是 session tree、branch messages、continue / resume 和测试 harness 的主要输入。

3. Adapter presentation
   - Forge 从 replay-safe structured message 和 runtime events 投影聊天 UI。
   - `text` 投影为最终回复。
   - `thinking` / reasoning 投影为执行过程正文。
   - tool call、tool result、approval、`workspace_patch`、checkpoint / restore 投影为过程事实、文件变更列表和文件版本面板。

## Core SDK 边界

Core SDK 应提供结构化消息承载能力，而不是规定 Forge 文本协议：

- session/event/projection 可表达 provider-native `text`、`thinking` / reasoning、tool call、tool result 和 audit reference。
- runtime event bus 支持流式 block 增量、block 完成、tool execution partial/final result、agent end cleanup。
- prompt preview 与真实生成共用同一个 prepared prompt object；preview 展示 active tools、branch messages、本轮 user message 和 provider-native structured message contract。
- test harness 可模拟 provider-native thinking/text 流式输出、工具调用、工具结果、approval pause / resume 和 branch checkout。

Core SDK 不做：

- 不定义 `<process>` / `<final>` 标签协议。
- 不把过程文本转成文件变更事实。
- 不拥有 Forge Semantic VFS、`workspace_patch` 格式、ST 发布边界或 Vue UI。
- 不默认注册 `read`、`write`、`edit`、`delete`、`bash` 或联网工具。

## Forge Adapter 边界

Forge adapter 继续拥有 Forge 业务语义：

- `ForgePiAgentSession.preparePrompt()` 仍是 Prompt Preview 与真实生成同源的事实入口。
- `ForgePiToolBridge` 继续负责 `read`、`write`、`edit`、`delete`、`bash` 与 `webResearch` 的 Forge 适配。
- 写入类工具继续通过 Forge Semantic VFS 和 direct workspace patch reducer 生成 `workspace_patch`。
- Forge store / presentation 只消费 runtime snapshot、pi session entries、active pi node、workspace patch / checkpoint history，不直接读取 SDK runtime 实例。
- 真实 ST 世界书发布、导出或覆盖宿主数据仍必须经过用户确认。

## 唯一事实源

Forge 完成态 UI 必须继续以 active branch 为事实源：

- 聊天记录、执行过程、最终回复、timeline rows、文件变更列表和文件版本面板都从 `piSessionEntries + activePiNodeId` 投影。
- 时间线切换不能只改 UI 状态，必须先切换 Forge pi session active node，再重新投影 active branch。
- 运行中可以使用 streaming projection 作为临时 UI；`agent_end` 后必须清理临时状态，并落回 active branch session projection。
- 文件版本仍以 `workspace_patch` / checkpoint / restore 状态和当前项目 VFS 内容为事实源。
- `xx.md +10 -1` 等摘要来自 patch diff / checkpoint 记录，不来自执行过程正文。

## UI 目标

运行中：

```text
用户输入
执行过程：展开
  provider-native thinking / reasoning 正文
  工具调用、工具结果、approval、workspace_patch 等过程事实
最终回复区域：流式显示 provider-native text
```

结束后：

```text
用户输入
执行过程：折叠为一行摘要
最终回复：展开
文件变更：独立展示 patch / checkpoint / restore
```

折叠摘要由 structured message block、tool event 和 `workspace_patch` 记录生成；文件操作按钮只绑定文件变更区和文件版本面板。

## 验证场景

- Prompt Preview 与真实生成看到同一 prepared prompt、active tools、branch messages、本轮 user message 和 provider-native structured message contract。
- provider-native `thinking` / reasoning 流式进入执行过程，provider-native `text` 流式进入最终回复，不依赖标签解析。
- tool call / tool result / approval / `workspace_patch` 事件顺序稳定，结束后过程自动折叠且可手动展开。
- direct write 生成 `workspace_patch`，聊天内文件变更区、timeline 和文件版本面板指向同一条 patch 事实。
- session branch checkout 后，聊天、执行过程、最终回复和文件变更从新的 `activePiNodeId` 重新投影，pi messages 不停留在旧分支。
- 文件版本撤回和 restore 通过反向或重放 `workspace_patch` 写回 Forge 项目 VFS，不从过程正文推断。
- raw provider reasoning artifact 只进入 trace / replay-safe 通道，不进入 Forge memory、虚拟世界书、workspace patch 或普通用户可见历史。

## 2026-06-13 首轮落地记录

已完成：

- `AgentRuntimeEventBus` 的 message block 更新优先按 `id` / `contentIndex` 匹配，其次才回退到旧 `type` 匹配，避免多个 provider-native 同类型 block 相互覆盖。
- `ForgePiAgentSession` 不再向 system prompt 注入 `<process>` / `<final>` 标签协议，改为注入 provider-native structured message contract。
- `ForgePiAgentSession` 不再使用标签 parser；assistant `thinking` 内容进入 `process` session entry，assistant `text` 内容进入最终 assistant entry。
- `ForgePiAgentOutputParser` 与对应单测已删除。
- `stream_chunk` / `stream_done` 事件继续分离 `displayText`、`thinkingText` 和 `rawText`；文件版本和 `workspace_patch` 事实源未改变。

仍需继续：

- 覆盖 provider-native tool call / tool result content block 到 runtime snapshot 的更细粒度回归。
- 验证 session branch checkout 后 process / assistant / workspace patch 的 active branch 重投影。
- 真实宿主 walkthrough：Prompt Preview、真实生成、Semantic VFS 读取、direct write、branch checkout、文件版本恢复和 `agent_end` 后 UI 状态清理。

## 后续文档要求

若实现阶段改变 Forge runtime、数据流、持久化格式、公开类型或对外 API，必须同步更新：

- `docs/overall/PDR.md`
- `docs/overall/system_design.md`
- `docs/overall/modules/forge/index.md`
- `docs/current/tasks/agent-runtime-sdk/README.md`
- `docs/current/tasks/forge/README.md`
