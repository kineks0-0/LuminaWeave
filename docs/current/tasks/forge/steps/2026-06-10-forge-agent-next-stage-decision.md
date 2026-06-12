# Forge Agent 下一阶段可靠可控决策规划

> 日期：2026-06-10
> 范围：联网分析 Agent 设计和实现后，确定 Forge Agent 下一阶段的落点。
> 取向：可靠可控优先，不替换当前 Forge pi-style runtime。

## 1. 结论

Forge 下一阶段不引入新的外部主 Agent 框架，不把 OpenAI Agents SDK、Claude Agent SDK 或 LangGraph 切换为 Forge 主 runtime。当前主链路已经收敛到 `src/api/core/forge/agent-app`，应继续强化现有 `ForgePiCoreRuntime` / `ForgePiAgentSession` / `ForgePiResourceLoader` / `ForgePiToolBridge` / `ForgePiSessionManager` 这组 browser adapter，而不是重建一套替换性调度层。

下一阶段优先级固定为：

1. 真实宿主 walkthrough：覆盖 Prompt Preview 与真实生成一致性、语义 VFS、direct write、session branch、文件版本恢复。
2. Agent trace 收敛：让一轮 Forge turn 的 prompt、model、tool、`workspace_patch`、timeline origin、cache usage 能被同一条 request / session 线索串起。
3. Tool boundary 验证：重点验证 `readFile`、`writeFile`、`editFile`、`deleteFile`、`bash` 是否全部走 Forge Semantic VFS、只读保护、写入审计和用户确认发布边界。
4. 可靠性回归集：把真实宿主 walkthrough 中能自动化的部分沉淀成 focused tests；不能自动化的部分保留手动验证清单。

2026-06-11 追加决策：

- Forge 不切换到外部主 Agent 框架，但需要从当前 pi-style runtime 抽取 LuminaWeave 内部 Agent Runtime SDK。
- Forge 作为第一套 adapter，继续保留 Semantic VFS、`workspace_patch`、Prompt Preview 事实源和真实 ST 发布边界。
- Skills 默认采用 pi-style progressive disclosure：代码提供技能列表和 `SKILL.md` 路径，模型通过 `read` 按需读取完整 `SKILL.md`；第一阶段不引入 skill activation tool。
- 跨插件 SDK 后续任务移入 `docs/current/tasks/agent-runtime-sdk/`。

## 2. 外部资料对 Forge 的约束

- Anthropic 的 Agent 工程建议强调从简单、可组合模式开始，只有在确实需要时才增加复杂度；同时要求 agent 在每一步从环境拿到真实反馈，并在检查点或阻塞时回到人类判断。Forge 对应策略：保留现有 pi loop，强化工具结果、trace 和 checkpoint，不升级成新的框架栈。来源：<https://www.anthropic.com/engineering/building-effective-agents>
- OpenAI Agents SDK 文档把 agent 定义为会规划、调用工具、跨 specialist 协作并持有足够状态的应用；当应用拥有 orchestration、tool execution、approval 和 state 时才进入 SDK 路线。Forge 已经拥有这些边界，因此应吸收设计，不迁移 runtime。来源：<https://developers.openai.com/api/docs/guides/agents>
- OpenAI Agents SDK TypeScript 文档的核心原语是 agent loop、sandbox execution、handoff、guardrails、function tools、MCP、sessions、human-in-the-loop 和 tracing。Forge 对应映射分别是 `ForgePiAgentSession`、Forge Semantic VFS + HAL Bash、模式分工、受保护写入、`ForgePiToolBridge`、能力/技能/VFS、`ForgePiSessionEntry`、真实发布确认、模型请求调试面板。来源：<https://openai.github.io/openai-agents-js/>
- OpenAI sandbox update 强调 agent 需要可预测 workspace、文件/命令/编辑能力，以及 harness 与执行环境分离。Forge 对应策略：继续把模型可见环境限制在 `./...` 语义 VFS，底层 `/workspaces/forge/<projectId>` 只由 Core/HAL 消费。来源：<https://openai.com/index/the-next-evolution-of-the-agents-sdk/>
- LangGraph 的价值集中在 durable execution、streaming、human-in-the-loop、memory 和 persistence。Forge 已有 `ForgePiSessionEntry`、timeline projection、workspace version manager 和 confirmation boundary；LangGraph 继续只用于 Graph guidance 和阶段状态，不接管 prompt 合成或 tool loop。来源：<https://docs.langchain.com/oss/javascript/langgraph/overview>
- MCP 将资源、提示词、工具、进度、取消、错误、日志、用户同意和 tool safety 作为协议层主题。Forge 暂不做外部 MCP server 集成；只把 MCP 作为内部能力/资源/工具授权的设计参照。来源：<https://modelcontextprotocol.io/specification/2025-11-25>

## 3. 五条分析线

### 3.1 Agent loop

当前事实源：

- `ForgePiCoreRuntime.runTurn()` 调用 `ForgePiAgentSession.prompt()`。
- `ForgePiCoreRuntime.previewPrompt()` 调用 `ForgePiAgentSession.preparePrompt()`。
- `ForgePiCoreRuntime.continue()`、`resolveToolApproval()`、`abortActiveGeneration()` 已提供继续、审批恢复和中止入口。

下一步不重写 loop。需要验证的是事件链是否足够完整：`request_started`、`prompt_ready`、model trace、tool call/result、`workspace_patch`、assistant final text、session entries 和 timeline item 是否能在调试面板中按一次请求归并查看。

### 3.2 Context engineering

当前事实源：

- `ForgePiResourceLoader` 读取 `./AGENTS.md`、`./.forge/agent/SYSTEM.md`、`./.forge/agent/<MODE>.md`、`./.forge/agent/UI_DSL.md`、`./.forge/agent/REASONING.md`。
- 短期对话通过 branch messages 进入模型；`./threads/目前/messages.md` 保留为 Semantic VFS 可读资源。
- 长期记忆默认注入 `./.pi/agent/context/memory-index.md`，正文继续通过 `readFile` 按需读取。

下一步不改变编排顺序。需要验证 Prompt Preview、真实生成和模型请求 trace 三者显示的 system prompt、context files、branch messages、active tools 摘要是否完全同源。

### 3.3 Tool safety

当前事实源：

- `ForgePiToolBridge` 暴露 `capabilitySearch`、`capabilityLoad`、`skillList`、`skillLoad`、`bash`、`readFile`、`writeFile`、`editFile`、`deleteFile`。
- `writeFile`、`editFile`、`deleteFile` 是 direct project write，默认写入 Forge 项目 VFS 并生成 `workspace_patch`。
- 受保护目标包括 Resource VFS、运行时 prompt、内置 skill、线程消息投影和内部 raw storage；发布或覆盖真实 ST 世界书仍是用户确认边界。

下一步重点是错误口径和审计闭环：只读目标必须失败且不得部分写入；每次可写目标变更必须能在 assistant 消息、timeline、文件版本面板和项目 VFS 中追溯。

### 3.4 State and versioning

当前事实源：

- `ForgePiSessionEntry` / `ForgePiPersistedSessionState` 是 pi session 持久化事实源。
- `ForgePiTimelineProjector` 从 pi entries 派生 Forge timeline。
- `ForgeWorkspaceVersionManager` 负责 workspace patch / checkpoint、patch replay 和文件树 hash。
- 分支操作限定在同一协作线程内，不创建新的 Forge thread。

下一步不新增新的状态事实源。需要验证刷新恢复、branch checkout、从 user 节点分支、文件版本查看、反向或重放 `workspace_patch` 后，`piSession.entries`、timeline projection 和项目 VFS 内容仍保持一致。

### 3.5 Observability and eval

当前事实源：

- `modelRequestTraces` 是前端会话内瞬态调试记录。
- `piModelTraces` 记录 pi messages、provider payload / response、stream lifecycle、final text 和 error。
- cache usage 已进入 trace model；真实宿主 walkthrough 仍未完成。

下一步要建立可重复验证矩阵，而不是只靠一次手动试用。验证矩阵分两层：

- 自动化 focused tests：runtime prompt preview、resource loader、tool bridge、semantic VFS、workspace version、presentation model。
- 手动真实宿主 walkthrough：ST 环境下发起真实 Forge turn，核对 Prompt Preview、模型请求 trace、tool trace、项目 VFS、timeline、文件版本面板、发布确认边界。

## 4. 下一阶段任务拆分

### P0：真实宿主可靠性 walkthrough

目标：证明当前 Forge pi runtime 主链路在真实 ST 宿主中闭环。

覆盖场景：

- 打开 Forge 项目，运行 Prompt Preview，确认主模型视图来自 `ForgePiAgentSession.preparePrompt()`。
- 发起真实生成，确认模型请求 trace 的 prompt、context files、branch messages 与 Prompt Preview 同源。
- 让模型调用 `readFile("./AGENTS.md")`、`readFile("./.forge/agent/SYSTEM.md")`、`readFile("./threads/目前/messages.md")`，确认全部来自 Semantic VFS。
- 让模型写入 `./memory/**/*.md` 或 `./lorebook/entries/*.md`，确认生成 `workspace_patch`，并在项目 VFS、assistant “AI 更改文件”列表、timeline、文件版本面板中可见。
- 执行 branch checkout 和从 user 节点分支，确认只改变当前 pi session tree，不创建新的 Forge thread。
- 执行文件版本恢复，确认通过反向或重放 `workspace_patch` 写回 Forge 项目 VFS。
- 尝试发布或覆盖真实 ST 世界书，确认仍要求用户确认。

### P1：trace 统一视图规划

目标：把调试信息从多个面板的并列展示收敛为同一 turn 的可追溯链路。

最小接口不新增运行态事实源，只整理现有投影：

- request：`requestId`、`sessionId`、`forgeProjectId`、`conversationId`。
- prompt：system prompt hash、context files、branch messages 摘要、active tools 摘要。
- model：provider payload / response、stream lifecycle、final text、cache read / write usage。
- tools：tool call args、tool result、只读/写入边界、error。
- workspace：`workspace_patch`、affected paths、before/after refs、active pi node。
- timeline：`runtime: "forge-pi"`、`sessionId`、`nodeId`、`parentNodeId`、`entryType`。

### P2：tool boundary 回归集

目标：把工具边界的高风险点沉淀为自动化测试。

优先覆盖：

- `readFile` 读取语义 VFS、目录提示、历史线程路径、底层 `/library` / `/sources` 直通。
- `writeFile` / `editFile` / `deleteFile` 对项目可写路径生成 `workspace_patch`。
- 写入运行时 prompt、内置 skill、线程消息投影、Resource VFS 时失败且不产生部分写入。
- `bash` 输出路径反向映射为 `./...`，项目写入进入 direct patch reducer。

### P3：walkthrough 结果回写文档

目标：真实宿主验证完成后，把结果写回当前任务 README 和对应 steps 文档。

必须记录：

- 验证日期、宿主形态、使用的项目和协作线程。
- 成功路径和失败路径。
- 触发的测试命令。
- 未自动化的手动检查项。
- 对 `docs/overall/PDR.md` / `docs/overall/system_design.md` 的影响判断。

## 5. 非目标

- 不引入新的外部主 Agent 框架。
- 不把内部 Agent Runtime SDK 做成外部框架替换；它只抽取当前 Forge 已验证的通用 runtime 能力。
- 不恢复旧 XML Action、旧 slot 拼接或旧 AI SDK tool loop。
- 不新增 skill activation tool。
- 不把 Review Gate 恢复为 AI 项目 VFS 写入主路径。
- 不让模型直接记忆或输出 raw `conversationId`、`project.json`、`memory/tree.json`、`lorebook/entries/*.json`、`review/*.json`。
- 不让 Agent 写入真实 ST 世界书、导出或覆盖宿主数据时绕过用户确认。
- 不在本阶段实现外部 MCP server 集成。

## 6. 验收标准

本规划进入实现阶段后，至少满足：

- Prompt Preview 与真实生成同源：主模型输入都来自 `ForgePiAgentSession.preparePrompt()` / runtime prepared prompt。
- 语义 VFS 同源：`ForgePiResourceLoader`、`ForgePiToolBridge.readFile()`、Forge shell 和项目 VFS 面板消费同一个语义 provider / projection。
- Direct write 可审计：每次项目写入都有 `workspace_patch`，并能从 assistant 消息、timeline 和文件版本面板追溯。
- Session tree 是事实源：分支、checkout、恢复和刷新后都能由 flat append-only `ForgePiSessionEntry` 重建。
- 真实 ST 发布边界不变：真实世界书发布、导出或覆盖宿主数据必须用户显式确认。
- 自动化测试覆盖 P1 / P2 的可自动化部分；P0 的真实宿主手动步骤必须有记录。

## 7. 文档影响

2026-06-10 本文只新增当前任务决策文档，并同步 Forge 当前任务入口。

2026-06-11 追加的 Agent Runtime SDK 抽取方向已经改变长期架构表述，需要同步：

- `docs/overall/PDR.md`
- `docs/overall/system_design.md`
- `docs/overall/modules/forge/index.md`
- `docs/current/tasks/agent-runtime-sdk/`
- `docs/current/README.md`
- `docs/index.md`
