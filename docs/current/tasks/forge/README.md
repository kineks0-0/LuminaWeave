# Forge Current Task

## 目标

跟踪 Forge 工作流、提示词、运行时和制卡体验相关的当前执行事项。

## 当前状态

原 Forge 进度看板已移动到 `steps/progress-board.md`。

2026-05-15：项目中心开始按“项目 / 协作线程”边界收敛，执行记录见 `steps/2026-05-15-forge-project-thread-boundary-plan.md`。当前已覆盖新建线程、删除线程、删除项目的 repository / store / UI 链路。

## 下一步

优先执行 Agent Runtime 与 Skill 系统迁移计划：

1. ~~建立 `ForgeSkillRegistry` 与项目 skill loader。~~
2. ~~建立 `ForgeCapabilityRegistry`，把低频 MCP-like 能力降级为按需 skill / namespace / shell profile。~~
3. ~~接入会话级 `project-readonly` shell，用于当前 Forge 项目 workspace 的搜索和查看。~~
4. ~~新增 `ForgeAgentGraphRuntime` 骨架。~~
5. ~~接入 Prompt Layout Slots，让 Agent runtime source units 进入 Prompt Assembly trace。~~
6. ~~实现正式 Working Statement builder 与 Prompt Preview Agent / Attention 视图。~~
7. ~~将真实生成请求同步接入 Agent source units，确保 request trace 与 Prompt Preview 使用同一套 slot / region 来源。~~
8. ~~将项目资源写入收敛到 typed effects 与 VFS。~~
9. ~~为条目重写与测试聊天接入按需 isolated subagent。~~
10. ~~接入 pi 风格能力/技能 tool calling 实验路径，Graph 仅保留状态、阶段和能力索引。~~
11. [x] 接入 human review gate UI，承接 `tool_approval_needed / tool_approval_resolved`。
12. [x] 接入真实 approve/resume 闭环和写入细节展示；真实宿主 walkthrough 单独保留。
13. [x] 将 Forge Agent runtime 收敛到 pi-style runtime。
    - 不再保留旧 XML Action、Vercel AI SDK tool loop 或 isolated subagent fallback。
    - conversation / planner / analyst / executor 统一进入 Forge 内嵌版 pi runtime。
14. [~] review / staging / export prepare 已复用 Review Gate 与 staging 链路，仍需真实宿主 walkthrough。
15. [x] Forge 主提示词切到原生 tool calling 优先，并将内置技能/能力展示文案中文化。
16. [x] 补齐模型请求调试面板的 tool calling trace 视图。
    - 模型请求调试面板已新增“工具调用”视图，可显示 tool set 摘要、tool call/result 与 approval trace。
    - `modelRequestTraces` 仍是前端会话内瞬态调试记录；长期操作记录继续由 `timelineItems` 保存。
17. [x] 执行 Forge Agent Runtime pi-coding-agent 化迁移。
    - 参考 `D:\Program\pi\packages\coding-agent` 的 AgentSession / ResourceLoader / SessionManager / ExtensionRunner 结构，在前端实现 Forge 浏览器 adapter 版本。
    - 提示词最终合成迁移到 pi runtime；Forge 只提供 context resources、Graph guidance、Review Gate 边界和工具。
    - 旧 Forge runtime 与 XML Action 工具调用路径已移除，不做向后兼容。
    - 新规划见 `steps/2026-05-20-forge-pi-agent-core-browser-runtime-plan.md`，调研快照见 `steps/2026-05-20-pi-sdk-browser-adapter-research.md`。
18. [x] 完成 Forge core 第一阶段结构归位。
    - `api/core/forge/` 只保留 `forgeConstants.ts` 与职责目录。
    - Graph / runtime / agent-app / project / prompt / effects / skills / shell / forms / test-chat 已按边界分组。
    - 空旧目录 `api/core/forge/pi/` 已移除。
19. [x] 完成 Forge plugin store 第一阶段结构拆分。
    - 已新增 `plugins/forge/store/forgeStoreHelpers.ts`，抽出 ID 生成、runtime preset 解析、history/lorebook 摘要、timeline feed 类型等纯 helper。
    - 已新增 `plugins/forge/store/ForgeTransientSelectionController.ts`，把临时表单/瞬态选择状态从主 store 中分离。
    - 已将 Forge 消息节点工厂与 runtime stream message update 外提到 store helper，减少 `CardMakerStore.ts` 内的展示状态拼装。
    - 已新增 `ForgeRuntimeActionController`、`ForgeStagingActionController` 与 `forgePromptPreviewAgentContext.ts`，完成 runtime dispatch、typed staging effects、Prompt Preview agent context 的第一阶段拆分。
    - 已新增 `ForgeFreezePublishController` 与 `ForgeFormSubmissionController`，拆出 commit-ready freeze / virtual lorebook workspace 写入，以及结构化表单/瞬态选择提交链路。
    - 已新增 `ForgePromptPreviewPayloadBuilder` 与 `ForgeAgentInspectorActions`，拆出 Prompt Preview payload 汇总和 Agent Inspector/test chat 调试动作。
    - `CardMakerStore.ts` 仍作为主状态容器保留；剩余内联函数主要是状态适配、controller dependency bridge 与正式 runtime request builder，不再为拆分而拆分。
20. [x] 将 Forge 预览提示词对齐 pi agent 实际输出。
    - `ForgePiAgentSession.preparePrompt()` 提供 dry-run prompt preview，不触发模型请求、不执行工具、不写 session tree。
    - Agent Inspector / Forge Prompt Preview 的主模型 payload 改为展示 pi runtime 实际合成的 system prompt、branch messages、context files 与 active tools 摘要。
    - 旧 Forge Prompt Context preview 仍仅作为 pi 预览输入来源和 Prompt Assembly trace 来源，不再作为主模型最终提示词事实源。
21. [x] 将 Forge 模型协议层对齐 `@earendil-works/pi-ai`。
    - `ForgePiModelRegistry` 不再直接拼旧模型协议消息；它只返回 pi-ai `streamSimple()` 兼容的 model / streamFn。
    - `ForgePiNexusProvider` 直接把 Nexus preset / API 配置映射为 pi-ai provider model 与 request options，不再桥接 AI SDK 层。
    - 模型请求调试面板新增 pi-ai 模型请求 trace，可查看 pi 原始 messages、provider payload / response、stream lifecycle、错误和 final text。
    - 同一个 Forge turn 内的多次 pi-ai provider 调用会保存在 `piModelTraces`，调试面板按调用链折叠展示。
22. [x] 完成 Forge Runtime pi-style 架构拆分。
    - `api/core/forge/agent-app` 承载 Agent runtime / session / resources / tools / model。
    - `src/plugins/forge` 已拆为 `app`、`console`、`inspector`、`review`、`project`、`store` 等交互层目录。
    - 请求面板回复内容回退链路为 `responseDisplay -> latest piModelTraces.finalText -> piModelTrace.finalText -> latest assistant node -> 暂无回复内容`。
    - 新记录见 `steps/2026-05-20-forge-pi-style-architecture-split.md`。
23. [~] 实现 Forge pi session 分支与工作区版本恢复。
    - fork / 回滚 / 切换限定为同一协作线程内的 pi session tree 分支，不创建新 Forge thread。
    - 已新增 `ForgePiSessionEntry` / `ForgePiPersistedSessionState`，`piSession.entries` 作为制卡聊天持久化事实源并贯穿 runtime result、store、session serialize / hydrate 和 ConversationDocument plugin state。
    - 已新增 `ForgePiTimelineProjector`，Forge timeline 可从 pi entries 投影生成，并保留可操作节点的 pi origin。
    - 已新增 `ForgeWorkspaceVersionManager`，支持 workspace patch / checkpoint payload、patch replay 和稳定 file tree hash。
    - 写入类 tool 的 `stage_from_shell_write` 已追加为 pi `workspace_patch` entry。
    - 已新增 runtime/client/store 级 `checkoutPiNode` 与 `branchFromPiUserNode`，可从 user 节点切回 parent 并回填原请求。
    - 已接入 Forge timeline UI 操作：pi-origin 节点详情中可执行“切换到此处”，user 节点可执行“从这里分支”并回填原请求到输入框。
    - 当当前 pi session 已存在 workspace patch / checkpoint 时，timeline 分支操作会先确认“仅切换对话”，不自动恢复文件。
    - 已修复 persisted pi entries 恢复为树结构的问题，刷新后可还原分支节点层级。
    - 已新增“文件版本”辅助面板，从 pi session entries 投影 workspace patch / checkpoint，并展示变更路径、hash 与当前 active node。
    - workspace patch / checkpoint 时间线节点已提供“查看文件版本”入口，可直接打开文件版本辅助面板。
    - 文件版本面板已显示当前分支 / 其他分支变更计数；patch 行可查看单文件 inline before/after，并可生成“恢复变更前 / 恢复变更后”的 Review/Staging 暂存条目，不直接写 VFS。
    - `StagingEntry` 已支持 `operation: upsert | delete`，删除类文件恢复会生成 delete 暂存，冻结时删除 Forge 虚拟工作区条目而不是写入空内容。
    - 剩余：真实宿主 walkthrough 与文件版本恢复的端到端手动验证。
    - 设计记录见 `steps/2026-05-20-forge-pi-session-branch-and-workspace-version-design.md`。
24. [x] 接入 Forge Agent 语义 VFS。
    - Agent 项目根显示为 `./`，底层 `/library` / `/sources` 资源 VFS 仍可通过绝对路径访问。
    - `./AGENTS.md` 作为 Agent 工作契约，不是系统提示词；默认系统提示词从 `./.forge/agent/SYSTEM.md` 暴露，模式提示词从 `./.forge/agent/<MODE>.md` 暴露，并可通过 `readFile` 读取。
    - 技能统一暴露为 `./agent/skills/<skill-name>/SKILL.md`，项目技能优先、内置技能回退；修改内置技能会生成 overlay patch proposal。
    - 当前协作线程通过 `./threads/目前/thread.md` 与 `./threads/目前/messages.md` 动态访问；历史线程稳定路径采用 `./threads/NN标题/thread.md` 与 `./threads/NN标题/messages.md`，并已接入 workspace binding / projection 数据源。
    - 已新增“项目 VFS”辅助面板，浏览 Agent 可见的 Forge 项目语义 VFS 投影：提示词、技能、记忆、当前线程、历史线程、世界书、审阅区与非内部项目素材统一以 `./...` 展示；`./chat/<conversationId>`、`project.json`、`memory/tree.json`、`lorebook/entries/*.json`、`review/*.json` 等 raw storage 结构只保留在内部映射层。
25. [x] 将 Forge Semantic VFS 挂载到 HAL Bash。
    - `BashTerminalRuntimeOptions.extraMounts` 支持调用方注入通用 `IFileSystem` mount；默认 `/sources`、`/library`、`/workspaces` 行为不变。
    - 新增 `ForgeSemanticVfsProvider` 与 `ForgeSemanticBashFs`，Forge shell cwd 继续对 Agent 显示为 `./`，底层通过 semantic mount 读取 `./AGENTS.md`、prompt、skill、thread、memory、review 与项目素材。
    - `ForgePiResourceLoader`、`ForgePiToolBridge.readFile()`、Forge shell 和项目 VFS 面板已收敛到同一 semantic VFS 数据源。
    - shell/write proposal 仍只生成 Review Gate 可审阅写入，不静默发布或改写真实 ST 世界书。
26. [x] 将 Forge prompt / Contract VFS 边界迁移到 `.forge`。
    - `./AGENTS.md` 已改为工作契约，只规定工具、审计、Review Gate、session tree / timeline / rollback 等工作边界。
    - `./.forge/agent/SYSTEM.md` 是默认系统提示词，`./.forge/agent/PLANNER.md`、`./.forge/agent/CONVERSATION.md`、`./.forge/agent/ANALYST.md`、`./.forge/agent/EXECUTOR.md` 是模式提示词。
    - `./.pi/agent/prompts/*.md` 不再作为 Forge prompt 主路径。
27. [x] 将 Forge 预设资源化为 Agent Prompt Orchestration。
    - Forge 主预设提供 `AGENTS.md`、`.forge/agent/SYSTEM.md`、`.forge/agent/<MODE>.md`、自定义技能、生成参数和 Agent 提示词编排。
    - Forge 面向 Agent / UI 的语义从 slot 拼接改为 `Contract -> System -> Mode Prompt -> Skills -> Capabilities -> Context Files -> Branch Messages`。
    - Semantic VFS 的资源优先级固定为 project override > active preset resources > bundled fallback。
    - 设置中的 Forge Agent 预设工作台已同步为资源包 / 编排视图；复制与保存自定义预设会保留 `forgeAgentResources` 和 `forgeAgentOrchestration`。
    - 预设工作台 UI 已调整为总览、资源编辑器、编排检查三段式：内置预设只读预览，自定义副本可编辑 Contract / System / Mode prompt。
28. [x] 将参考提炼预设迁移为默认预设按需技能，并移除 Forge Agent 旧 slot 公开入口。
    - `built-in:forge-main-default` 提供 `reference-needs-capture`、`reference-anti-cliche`、`reference-xp-capture` 三条 preset skills，默认 `on_demand`，可在自定义预设中改为 `always` 常驻。
    - `built-in:forge-main-reference-extract`、`built-in:forge-executor-reference-extract`、`built-in:forge-test-chat-reference-extract` 已移除；旧绑定回落到对应默认预设。
    - Semantic VFS、`skill.list`、`skill.load` 统一按 project skill > active preset skill > built-in skill 解析。
    - Forge Agent 预设工作台不再向主模型 / 执行模型展示“添加 Slot / SLOT”旧入口；测试聊天 composed 兼容链路仍保留。
29. 运行真实宿主 walkthrough，并补齐 session tree / semantic VFS / 项目 VFS 面板 / 文件版本恢复的宿主级验证。

完成后归档到 `archive/completed-tasks/forge/`。

## 恢复入口

- [Progress Board](./steps/progress-board.md)
- [Forge Agent Runtime 与 Skill 系统迁移计划](./steps/2026-05-09-forge-agent-runtime-skills-plan.md)
- [Forge 技能/能力 pi 风格迁移计划](./steps/2026-05-19-forge-pi-capability-migration-plan.md)
- [Forge 模型请求调试面板 tool calling trace 实现计划](./steps/2026-05-19-forge-model-request-tool-calling-debug-plan.md)
- [Forge Agent Runtime 前端 pi-agent-core 适配计划](./steps/2026-05-20-forge-pi-agent-core-browser-runtime-plan.md)
- [pi SDK 浏览器适配调研快照](./steps/2026-05-20-pi-sdk-browser-adapter-research.md)
- [Forge Runtime pi-coding-agent 化迁移记录](./steps/2026-05-20-forge-pi-coding-agent-runtime-migration.md)
- [Forge Runtime pi-style 架构拆分记录](./steps/2026-05-20-forge-pi-style-architecture-split.md)
- [Forge pi session 分支与工作区版本设计](./steps/2026-05-20-forge-pi-session-branch-and-workspace-version-design.md)
- [Forge 项目 / 协作线程边界重塑](./steps/2026-05-15-forge-project-thread-boundary-plan.md)
