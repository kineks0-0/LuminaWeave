# Agent Runtime SDK Current Task

## 目标

将 Forge 已成型的 pi-style Agent runtime 抽取为 Core API 层可复用的 Agent Runtime SDK，使 Forge 以外的子插件也可以组合自己的 agent，并用统一测试 harness 验证 prompt、skill、tool、VFS、approval、trace 与 session tree 行为。

## 当前状态

2026-06-11：完成第一阶段架构边界确认。Agent Runtime SDK 不替换 Forge 当前 `src/api/core/forge/agent-app` 主链路；Forge 作为第一套 adapter 保留 Semantic VFS、`workspace_patch` 审计、Prompt Preview 事实源和真实 ST 发布边界。

2026-06-11：完成第一阶段代码骨架。新增 `luminaweave-extension/src/api/core/agent-runtime/`，包含 `AgentRuntimeCore`、`AgentSessionTree`、`AgentPromptAssembler`、`AgentToolRegistry`、`AgentSkillParser`、`AgentRuntimeTestHarness` 与 OpenFS audit mount wrapper。Forge 已通过 adapter 方式复用 `AgentRuntimeCore`、`AgentSessionTree` 和 skill catalog formatter；`ForgePiTypes.ts` wire shape、Forge Semantic VFS、`workspace_patch` 与真实 ST 发布边界未迁移到 SDK。

2026-06-11：补齐第一阶段行为收敛。`AgentPromptAssembler` 增加 cache key 与 invalidate，使同一 `requestId` 的 Prompt Preview 和真实生成复用同一个 prepared prompt object；`ForgePiAgentSession.preparePrompt()` 与 `prompt()` 已迁移为调用 SDK prompt assembly，真实 run 仍在运行阶段重新创建 Forge tool 实例以保留 effect sink。`AgentSkillParser` 按 Agent Skills 规格校验 `name`、`description`、`compatibility`、父目录匹配、`metadata` 与空格分隔的 `allowed-tools`；`AgentToolRegistry` 增加可选 phase/capability visibility filter；`AgentRuntimeTestHarness` 补齐 mock model、mock tool、mock session store、mock approval 与 mock VFS；OpenFS wrapper 测试覆盖 read/write/append/delete/move/copy audit hook 与 `axgrep` / `search` custom command 执行。

2026-06-11：完成 Forge 技能资源规范化。`src/resources/forge-agent/base/skills/<skill-name>/SKILL.md` 与默认主预设的 reference skills 现在都以标准 `SKILL.md` frontmatter 开头，并通过 SDK `AgentSkillParser` 在 Forge registry / Semantic VFS 测试中校验；项目级旧 Markdown 技能仍保留标题回退，标准 `SKILL.md` 项目技能优先使用 frontmatter `description`。

2026-06-11：完成 pi agent 工作流与 UI 状态链路整理。pi 的底层 agent loop 是事件驱动 runtime，不内置“规划 / 执行 / 汇报”业务状态机；Plan Mode 由 extension 通过 tool set 切换、hidden custom context、turn progress marker、custom session entry 和 UI status/widget 实现。Agent Runtime SDK 下一阶段应补稳定 lifecycle event、queue event、runtime snapshot、extension workflow hook 和 UI projection payload，而不是把 Plan Mode 固化进 Core。

2026-06-11：补充 pi 扩展加载与 workspace tools 调研。pi 扩展由 `loadExtensions()` / `discoverAndLoadExtensions()` 从项目本地扩展、全局扩展和显式配置路径加载 TypeScript / JavaScript factory；扩展通过 `ExtensionAPI` 注册 event handler、tool、command、flag、message renderer、provider 和资源发现 hook。pi 内置 workspace tools 使用短名 `read`、`bash`、`edit`、`write`、`grep`、`find`、`ls`，并通过可插拔 operations 替换底层 I/O。LuminaWeave 的 `workspace-tools` 规划应参考该模式，但底层 I/O 走 OpenFS / just-bash 或 adapter operations，不绑定本地 `fs`。

2026-06-11：落地 extension runner 与 Workspace Tools Kit 初始实现。新增 `AgentRuntimeExtensionRunner`，支持代码配置 extension factories 注册 tool、`beforeAgentStart` / `agentEnd` hook 和 resource discovery，且 invalidation 后不再执行旧 context；新增 `workspace-tools/AgentWorkspaceTools`，按接入方显式选择注册 `read`、`write`、`edit`、`delete`、`bash`，其中 `read` / `write` / `edit` / `delete` 已通过 in-memory FS 测试覆盖，`edit` 使用精确唯一文本替换、同文件 mutation queue 和 patch 返回，`bash` 仍要求 adapter 提供真实实现。

2026-06-11：落地 SDK event / snapshot contract 初始实现。新增 `AgentRuntimeEventBus`，记录 `agent_start`、`turn_start`、`message_start`、`message_update`、`message_end`、`tool_execution_start`、`tool_execution_update`、`tool_execution_end`、`turn_end`、`agent_end` 与 `queue_update` 事件顺序，并投影 `isStreaming`、`streamingMessage`、`pendingToolCalls`、`messages`、`errorMessage`、active tools summary 与 queue snapshot；`AgentRuntimeTestHarness` 已暴露事件记录器，adapter 测试可直接断言事件顺序和 runtime snapshot。

2026-06-11：完成 SDK event bus 到 Core 与 Forge adapter 的首轮接入。`AgentRuntimeCore` 现在持有可选共享 `AgentRuntimeEventBus`，并在创建 managed session 时传入同一个 bus；`ForgePiCoreRuntime` 暴露 `getAgentRuntimeSnapshot()` / `getAgentRuntimeEvents()`，`ForgePiAgentSession` 将 pi-agent-core 的 assistant stream、tool execution、turn start/end 和 abort 投影到 SDK snapshot，同时保留原有 `ForgeRuntimeEvent` 返回结构。Forge adapter 会过滤 pi stream 的空文本与重复最终文本，避免 UI projection 收到重复 text block。

2026-06-11：完成 Forge store / Inspector 首轮 snapshot 投影。`ForgePiRuntimeClient.runTurn()` 透传 `agentRuntimeSnapshot`，`ForgeRuntimeOrchestrator` 通过 `set_agent_runtime_snapshot` effect 写入 `useForgeStore.agentRuntimeSnapshot`，并同步到匹配的 `modelRequestTrace.agentRuntimeSnapshot`；Agent Inspector 状态页与模型请求调试 pi-core 页消费 presentation 层摘要，不让 SDK import Vue 或 Pinia。`set_forge_pi_session_state` reducer 同步补回 `entries` 透传，避免 session branch UI 丢失 flat append-only entries。

2026-06-11：完成 Forge 项目 UI projection 收敛。新增 `buildForgeProjectVfsPanelTree()`，项目 VFS 面板现在从 `forgeStore.piSessionEntries` 与 `activePiNodeId` 叠加当前分支的 session 节点和 `workspace_patch` 变更路径，同时继续关闭默认 agent virtual files，避免把未写入项目 VFS 的 bundled prompt 误当作项目文件。新增 `buildWorkspacePatchGroupsByAssistantTurn()`，把聊天内“AI 更改文件”列表从 Vue 组件抽为 session-entry presentation helper，并覆盖恢复状态标记。

2026-06-11：完成 extension workflow API 初始扩展。`AgentRuntimeExtensionRunner` 现在提供 `AgentRuntimeWorkflowRegistry`，支持扩展追加可持久化 custom message、设置 status projection、设置 widget projection、请求 continuation，并暴露 adapter 代码配置后的 resolved extension paths；`AgentToolRegistry` 增加 `onBeforeToolCall` / `onAfterToolResult` hook，支持扩展在工具执行前修改参数或阻断工具调用，并在工具结果后改写返回结果。该能力仍是 SDK 端口，不加载 VFS 中的可执行代码，也不内置 Plan Mode。

2026-06-11：完成 Workspace Tools Kit 第二步扩展。`AgentWorkspaceTools` 在显式注册前提下补齐只读 `ls` / `find` / `grep` / `search`，`write` / `edit` / `delete` 支持 adapter audit payload，`bash` 改为调用 adapter 提供的 executor 并记录 partial output event；SDK 仍不默认注册任何文件工具或 `bash`。

2026-06-11：完成 Workspace Tools Kit 的 OpenFS/just-bash 非 Forge 接入验证。新增 `JustBashWorkspaceAdapter`，把 just-bash `IFileSystem` 按显式 root 映射为 `AgentWorkspaceFileSystem`，并把接入方创建的 just-bash `Bash.exec()` 映射为 SDK bash executor；测试用 OpenFS memory VFS、`AxFs`、`MountableFs`、`axgrep` / `search` custom command、显式工具注册、phase visibility、audit payload 和 partial output 串起非 Forge adapter 场景。

2026-06-11：完成 SDK ToolRegistry event hook 初始实现。`AgentToolRegistry` 可通过可选 `events` 接入 `AgentRuntimeEventBus`，非 Forge adapter 手动注册工具后，普通执行和 approval resume 执行会投影 `tool_execution_start`、`tool_execution_update`、`tool_execution_end`；Core 仍不默认注册任何工具。

2026-06-11：补齐 Forge Prompt Preview parity 覆盖。`ForgePiExtensionRunner` 暴露 `emitBeforeAgentStart()` no-op 默认实现，`ForgePiAgentSession.preparePromptState()` 在 SDK `AgentPromptAssembler` 的同一个 prepared prompt 中消费 extension hidden context、active tools summary、skill catalog 与 branch messages；同一 `requestId` 的 preview 与真实 run 只执行一次 hook，并把结果传给 pi-agent-core 初始状态。

2026-06-11：完成 Forge 模型可见 workspace tools 短名迁移。`ForgePiToolBridge` 的 registry 只暴露 `read`、`write`、`edit`、`delete`、`bash`，旧的 `readFile`、`writeFile`、`editFile`、`deleteFile` 仅作为挂起审批和历史 trace 的 adapter 兼容输入；Forge bundled skills、默认 reference skills、Prompt Resource 和运行时拼接的写入边界说明已同步为短名。

2026-06-11：收紧 Prompt Preview 与真实生成 payload 口径。`ForgePiAgentSession.preparePromptState()` 的 preview / `prompt_ready` payload 现在包含 system prompt、branch messages 与本轮 user message；真实 run 的 pi-agent-core initial state 仍只包含 system prompt 与 branch messages，本轮 user message 由 `agent.prompt()` 注入，避免重复注入同时让 Preview 展示真实请求的用户输入。

2026-06-12：新增 Research Tools Kit 初始实现。SDK 提供 `AgentResearchProvider` 和 `webResearch` 工具工厂，v1 Tavily provider 适配 Tavily search / fetch；Core SDK 不默认创建、注册或暴露联网工具。Forge adapter 在 `lumina-forge.tavilyApiKey` 非空时才注册 `webResearch`，工具结果只返回 Markdown、来源和请求元数据，不写项目 VFS、`workspace_patch`、memory 或 ST 资源。浏览器运行时不静态导入 Tavily AI SDK，避免 `@tavily/core` 的 Node proxy 依赖进入扩展启动路径。Parallel AI SDK Tools 与 Exa 后续通过同一 provider 接口接入，不在 v1 安装依赖或开放 UI 选择。

已确认方向：

- Core SDK 承载通用 agent loop、session tree、tool provider、approval、trace、Agent Skills 兼容和 test harness。
- Core SDK 暴露稳定事件流：`agent_start`、`turn_start`、`message_start`、`message_update`、`message_end`、`tool_execution_start`、`tool_execution_update`、`tool_execution_end`、`turn_end`、`agent_end` 与 `queue_update`。
- Core SDK 的 runtime snapshot 至少覆盖 `isStreaming`、`streamingMessage`、`pendingToolCalls`、`messages`、`errorMessage` 和 active tools summary。
- 规划、执行、审阅和最终汇报属于 adapter / extension workflow；Core SDK 只提供 hidden custom context、custom message、tool visibility、status/widget、trace 和 continuation trigger 等端口。
- Core SDK 第一阶段直接接入 OpenFS 能力层，提供 FS template、mount policy、approval hook、audit hook 和 trace hook；路径挂载与 shell 组合优先交给 OpenFS / just-bash。
- `bash` tool 由接入方自行组装并显式注册；Core SDK 不默认创建或注册 `bash`。
- 工具可见性由接入方定义；Core SDK 可提供可选 phase/capability filter，但不内置 Forge 阶段语义。
- Skills 默认采用 pi-style progressive disclosure：代码提供技能列表和 `SKILL.md` 路径，模型通过 `read` 按需读取完整 `SKILL.md`。
- `allowed-tools` 只作为声明和 diagnostics 信息，不授予真实权限。
- Prompt Resource Kit 不内置 Forge 路径；prompt、skill、context 路径都由 adapter 显式配置。
- Extension workflow kit 可加载由 adapter / 代码配置显式指定的 extension factories 或 resolved extension paths；Core SDK 不自动扫描用户目录、项目目录或 VFS 中的可执行代码。
- Workspace Tools Kit 可提供 pi-style 短名工具工厂：`read`、`write`、`edit`、`delete`、`bash`，并可补充只读 `grep`、`find`、`ls`、`search`；所有工具都由接入方显式选择、配置、注册。
- Research Tools Kit 可提供 `webResearch` 工具工厂和 `AgentResearchProvider` 端口；Core SDK 不默认暴露联网工具，Forge 只有在 Tavily key 非空时才注册 Tavily-backed `webResearch`。
- Forge 模型可见工具名迁移为 `read`、`write`、`edit`、`delete`、`bash`；旧会话回放和 trace 展示中的历史工具名由 Forge adapter 处理兼容。
- thinking 作为 assistant message stream block、trace 和 UI projection 输入处理，不作为默认可持久化业务状态。
- Forge adapter 继续负责 Forge Semantic VFS、项目 VFS 写入策略、`workspace_patch` 审计、session tree 到 timeline / 文件版本的投影，以及真实 ST 世界书发布/导出的用户确认边界。

## 下一步

1. 讨论并收敛 `agent_end` 后 UI 状态清理：运行中状态、pending tool calls、streaming message、active trace 和 Inspector 展示的清理边界。
2. 补真实宿主 walkthrough：Prompt Preview 与真实生成一致、Semantic VFS 读取、direct write 生成 `workspace_patch`、session branch checkout、文件版本恢复、`agent_end` 后 UI 状态清理。
3. 评估非 Forge 插件接入样例：使用 SDK test harness + 手动注册 tool + 显式 VFS mount + extension workflow hook，验证 SDK 不默认暴露文件工具或 `bash`。
4. OpenFS 包跟踪：当前 `@open-fs/just-bash@0.1.0` 实际导出 `AxFs`，`createGrepCommand()` 的 command name 为 `axgrep`；后续升级前必须重新读取包类型文件和测试。

## 恢复入口

- [Agent Runtime SDK 第一阶段实现记录](./steps/2026-06-11-agent-runtime-sdk-implementation-record.md)
- [Agent Runtime SDK 边界规划](./steps/2026-06-11-agent-runtime-sdk-boundary-plan.md)
- [pi agent 工作流与 UI 状态整理](./steps/2026-06-11-pi-agent-workflow-ui-state-plan.md)
- [Forge Agent 下一阶段可靠可控决策规划](../forge/steps/2026-06-10-forge-agent-next-stage-decision.md)
- [Forge 当前任务](../forge/)
