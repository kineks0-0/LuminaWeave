# Forge Agent Runtime 与 Skill 系统迁移计划

## 背景

Forge 项目化 UI 与 VFS 数据边界已经进入一期可用状态，但 P0 真实宿主 walkthrough 不能直接基于旧的对话式运行链路继续测试。原因是当前 Forge 仍有一部分 Agent 行为停留在“前端 store + runtime if/else + prompt 协议副作用”的组合形态，真实流程测试会混杂旧运行时缺陷，无法判断项目化 VFS 本身是否稳定。

下一阶段目标是先把 Forge Agent 收敛为“项目工作区 Agent”：以 `forgeProjectId` 为长期容器，所有工具读写默认落在 `/workspaces/forge/<projectId>/...`，真实 ST 世界书发布继续后置，并通过 human review gate 显式确认。

## 总体目标

- 使用成熟 Agent 编排框架承载 Forge 的长流程状态机，而不是继续扩展零散手写分支。
- 引入项目级 Skill 系统，让 Forge Agent 能按任务读取明确的操作说明和脚本入口。
- 让 Agent 的所有写入通过 VFS 与 typed effects 进入项目资源文件，避免直接写 ST 世界书或绕过 `ForgeProjectDataService`。
- 控制模型常驻工具面：高频能力保留为少量结构化工具，低频 MCP-like 能力降级为 capability/skill 按需加载，搜索和查看默认走会话级受控 shell。
- 保持现有 Forge UI、Prompt preset、审阅区和测试聊天可渐进迁移，避免一次性重写整个制卡工坊。
- 默认执行形态是 single Forge Agent + dynamic skills；isolated subagent 只用于明确的上下文隔离场景，不作为 planner/executor 的固定物理分层。

## 框架选择

### 编排层：LangGraph JS

采用 `@langchain/langgraph` 作为 Forge Agent 编排层。仓库已经依赖该包，且 Forge 的流程天然包含可恢复状态、分支路由、human-in-the-loop、审阅 gate 与工具副作用，适合用 graph runtime 表达。

LangGraph 在本轮只作为 Forge runtime 内部实现，不直接暴露给 Vue 组件。UI 仍只订阅 store 派生状态、timeline feed、request trace 与项目资源视图。

LangGraph 的职责是 orchestration harness：路由、状态推进、gate、trace 与失败恢复。它不等同于“必须拆出多个物理 agent”。如果某个能力只是操作说明或输出协议，优先做成 skill；只有当任务需要隔离上下文窗口时，才启用 isolated subagent。

### 调用层：现有 Prompt Preset / GenerationDomain

模型调用继续走现有 Prompt Preset 与生成领域层，不新增第二套 provider 配置。LangGraph 节点只产出 `executionRequest / effects / trace`，实际发送仍复用当前 Forge prompt preset、request trace、streaming 和测试聊天能力。

Prompt Preset 仍是最终提示词的用户可配置主入口。Graph 节点只声明当前 intent、node role、允许工具、需要的 skill 与动态工作状态；这些内容作为 `PromptSourceUnit` 交给 Prompt Assembly 合成。禁止 graph node 自己拼接不可追踪的大段最终 prompt。

### Prompt Layout Slots：预设声明布局，资源进入槽位

下一轮的提示词合成不是把 skill 文本直接塞进某个固定 system prompt，也不是让 Agent graph 临时拼最终 prompt。更准确的边界是：

- Prompt Preset 负责声明最终 messages 的布局契约：有哪些 slot、slot 属于哪个 attention region、是否必填、预算和降级策略。
- Skill、VFS 项目资源、工作状态、审阅状态和用户输入都只是 `PromptSourceUnit`，由 Prompt Assembly 按 preset slot policy 放入对应位置。
- Skill 不成为 preset 正文的一部分；preset 只知道 `skill_full / skill_summary` 等槽位，不保存具体 skill 内容。
- Graph 只选择 intent、skill、工具 scope 和运行状态；Graph 不决定最终 messages 的字符串拼接顺序。
- `ForgeWorkingStatement` 必须进入靠近尾部的动态区域，用来把本轮关键约束重新推到模型注意力较强的位置。

首版 slot / region 契约建议如下：

```ts
type ForgePromptSlot =
  | 'system_static'
  | 'runtime_contract'
  | 'skill_full'
  | 'skill_summary'
  | 'project_resources'
  | 'conversation_context'
  | 'review_state'
  | 'working_statement'
  | 'user_input';

type ForgePromptRegion =
  | 'static_system'
  | 'stable_context'
  | 'task_context'
  | 'tail_restatement'
  | 'live_input';

interface ForgePromptSlotPolicy {
  slot: ForgePromptSlot;
  region: ForgePromptRegion;
  required: boolean;
  maxTokens?: number;
  priority: 'critical' | 'high' | 'normal' | 'low';
  fallback?: 'summary' | 'hidden' | 'diagnostic';
}
```

| Slot | Region | 来源 | 说明 |
|---|---|---|---|
| `system_static` | `static_system` | Prompt Preset / 内置静态规则 | 长期稳定规则，例如不直接写真实 ST 世界书。 |
| `runtime_contract` | `static_system` | Forge runtime | typed effects、VFS 写入和审阅 gate 的硬协议。 |
| `skill_full` | `task_context` | 当前项目 skill | 当前 intent 首次或关键步骤需要的完整 skill。 |
| `skill_summary` | `tail_restatement` | skill 摘要器 | 长任务后续轮次的 3-7 条关键规则。 |
| `project_resources` | `stable_context` | VFS 项目文件 | 世界书、记忆、draft、review 的结构化快照或摘要。 |
| `conversation_context` | `stable_context` | ConversationDocument | 当前协作线程的必要历史与 active leaf 上下文。 |
| `review_state` | `task_context` | VFS review staging | staging / commit-ready / gate 状态。 |
| `working_statement` | `tail_restatement` | ForgeWorkingStatement | 当前项目、下一步、技能、写入范围和禁止事项。 |
| `user_input` | `live_input` | 用户本轮输入 | 最后一层即时任务输入。 |

Prompt Preview 必须按 slot 和 region 展示来源、预算、保留状态和最终 message 位置。这样用户能看到“预设结构如何承载 skill”，而不是只看到一段不可解释的合并文本。

### 工具层：Capability + Session Shell + VFS

Skill 与工具执行优先复用现有：

- `ShellWorkspaceService`
- `BashTerminalRuntime`
- `AgentBashToolService`
- `ShellPermissionService`
- `ForgeProjectDataService`
- `PromptResourceBindingService`

浏览器前端不直接打包 Node-only 的 bash-tool 创建器；仍使用当前兼容 adapter，把读写收束到 Resource-backed FS 与权限门。

工具面默认按“发现入口常驻、能力按需加载、shell 受控执行”的方式设计。目标不是把所有 MCP 工具 schema 塞进每轮上下文，而是让模型知道能力索引，需要时再加载对应 skill、namespace 或 shell profile。

#### 常驻工具面

首版常驻工具控制在 5-8 个以内：

| Tool | 用途 | 备注 |
|---|---|---|
| `forge.capability.search` | 查找当前 Forge 可用能力 | 返回 capability 摘要，不返回完整 skill。 |
| `forge.capability.load` | 按需加载 skill / namespace / shell profile | 进入 trace，并影响 Prompt Preview。 |
| `forge.workspace.searchShell` | 在当前项目 workspace 内搜索和查看 | 走会话级 `project-readonly` shell profile。 |
| `forge.resource.read` | 按 URI/range 读取 VFS resource | 用于精确读取资源片段，限制 `maxBytes`。 |
| `forge.effect.apply` | 应用 typed effects | 唯一默认业务写入入口。 |
| `forge.prompt.preview` | 构建预览与来源 trace | 不触发真实模型生成。 |

#### Capability 降级规则

不常用 MCP-like 能力默认不常驻暴露完整 schema，而是作为 capability index item 或 skill 存在：

```ts
interface ForgeCapabilityIndexItem {
  id: string;
  title: string;
  summary: string;
  triggers: string[];
  loadAs: 'tool-namespace' | 'skill' | 'shell-skill';
  namespace?: string;
  skillUri?: string;
  risk: 'low' | 'medium' | 'high';
}
```

| 能力 | 默认形态 | 何时加载 |
|---|---|---|
| `virtual-lorebook-editor` | skill + `forge.lorebook` namespace | 用户要求新增、拆分、合并、重写或审阅世界书条目。 |
| `memory-curator` | skill + `forge.memory` namespace | 用户表达偏好、硬约束、禁忌或设定决议。 |
| `review-stager` | skill + `forge.review` namespace | 需要生成 staging、commit-ready 或审阅摘要。 |
| `test-chat-runner` | skill + `forge.testChat` namespace | 用户要求测试聊天、验证角色一致性。 |
| `export-preparer` | skill + `forge.export` namespace | 用户要求导出、发布准备或打包。 |
| `material-analyzer` | skill + read-only shell | 用户上传素材并要求抽取设定、片段或候选条目。 |

#### 会话级受控 Shell

搜索、查看、统计和轻量文本处理优先走 shell，因为 shell 对文件树探索和批量查询更省 schema token。Shell 的硬边界必须来自现有会话级权限服务，而不是靠 prompt 自觉：

```ts
type ForgeShellAccessMode =
  | 'project-readonly'
  | 'project-write-request'
  | 'sandbox-write'
  | 'network-request';

interface ForgeShellSessionScope {
  actor: 'forge-agent' | 'sub-agent';
  sessionId: string;
  forgeProjectId: string;
  cwd: string;
  mode: ForgeShellAccessMode;
  allowedOps: Array<'list' | 'read' | 'search' | 'stat'>;
}
```

默认 Forge Agent shell profile：

- `cwd` 固定为 `/workspaces/forge/<projectId>`。
- 默认只允许 `list/read/search/stat`。
- 禁止 shell 直写业务真相文件；项目资源写入必须走 `forge.effect.apply`。
- 写 `/tmp`、运行转换脚本、网络访问或外部路径访问必须通过 `ShellPermissionService` 发起会话级权限申请。
- shell 输出必须限制 `maxOutputBytes`；超长结果写入 trace/resource，再给模型摘要和 resource link。
- shell 读取到的文件内容默认标记为 `data-only`，不得覆盖 Prompt Preset、runtime contract 或 trusted skill 指令。

#### Shell 与 Typed Effects 的边界

| 操作 | 默认入口 | 原因 |
|---|---|---|
| 查找文件、搜索文本、查看目录 | `forge.workspace.searchShell` | 省 schema token，模型熟悉，适合探索。 |
| 读取明确资源片段 | `forge.resource.read` | 可控 range / maxBytes / provenance。 |
| 修改世界书、记忆、draft、review | `forge.effect.apply` | 需要 reducer 校验、审阅 diff 和 VFS 结构一致性。 |
| 素材转换临时文件 | shell 权限申请后写 `/tmp` | 低频、高风险，需 trace。 |
| 导出或发布准备 | skill + namespace + review gate | 第一阶段仍不写真实 ST 世界书。 |

## Skill 系统边界

### Skill 存放位置

项目级 skill 安装到：

```text
/workspaces/forge/<projectId>/skills/<skillName>/SKILL.md
```

Skill 可包含脚本或模板，但第一阶段只要求读取 `SKILL.md` 与使用 VFS 工具完成任务，不要求执行复杂外部脚本。

### 首批内置 Skill

| Skill | 职责 | 默认写入范围 |
|---|---|---|
| `forge-project-writer` | 维护 `project.json`、drafts、review、memory 的结构化更新 | `/workspaces/forge/<projectId>/` |
| `virtual-lorebook-editor` | 增删改虚拟世界书 entries，生成可审阅条目 | `/workspaces/forge/<projectId>/lorebook/entries/` |
| `memory-curator` | 将用户偏好、硬约束、禁忌和设定决议整理进项目记忆 | `/workspaces/forge/<projectId>/memory/tree.json` |
| `review-stager` | 把草案转换为 staging / commit-ready 审阅状态 | `/workspaces/forge/<projectId>/review/staging.json` |
| `test-chat-runner` | 使用项目资源和测试聊天 preset 运行验证对话 | 只写 trace 与测试结果 |
| `export-preparer` | 准备导出包和发布检查清单，不直接写真实 ST 世界书 | `/workspaces/forge/<projectId>/export/` |

### Skill 读取规则

- Agent 只能读取当前项目下已安装 skill。
- 内置 skill 可由代码在项目初始化时 materialize 到 VFS，也可由 registry 以虚拟只读 skill 形式提供。
- Skill 内容进入 Prompt Assembly trace，必须能在请求调试面板看到来源。
- Skill 不保存用户偏好；用户偏好仍写入 `memory/tree.json`。
- Skill 全文只在当前 intent 需要时注入。长任务后续轮次优先注入 skill 摘要和关键规则 restatement，避免旧 skill 文本被上下文中段埋没。
- Skill 不能取代 Prompt Preset；skill 只描述任务操作手册、工具约束和局部执行规则。

## Context Engineering Policy

Forge Agent 的稳定性不只来自“有记忆”或“有工具”，还取决于提示词中信息的位置。下一阶段把提示词信息分成静态规则、动态状态和上下文隔离三类处理。

### 静态规则

长期稳定、所有 Forge 请求都必须遵守的规则放在 Prompt Preset / system prompt：

- 不直接写真实 ST 世界书。
- 所有项目资源写入必须走 VFS 与 typed effects。
- 审阅前不得发布或导出到真实宿主资源。
- 输出协议必须能被 reducer 解析，不能用自由文本直接写项目文件。
- 非当前项目资源不得静默混入当前项目。

### 动态 Restatement

会随任务变化、需要持续提醒模型的信息放在最新消息尾部附近，作为一等 prompt source：`ForgeWorkingStatement`。

`ForgeWorkingStatement` 至少包含：

- 当前 `forgeProjectId / conversationId / workspacePath`
- 当前 visible phase、active layer、detail mode
- 当前下一步任务
- 当前 selected skills
- 当前 VFS 写入范围
- 当前 staging / commit-ready 数量
- 本轮禁止事项和必须保持的局部规则
- 是否需要 human review gate

这段内容的价值不是记录，而是把关键动态信息重新推到模型注意力较强的位置。它应进入 Prompt Preview 和 request trace。

### Skill Restatement

当长任务跨多轮执行时，不重复注入完整 skill，而是周期性注入：

- skill id 与版本
- 本轮最相关的 3-7 条关键规则
- 本轮允许的文件路径与工具
- 本轮输出必须满足的 typed effect contract

Prompt Preview 需要标记 skill 当前是 `full / summary / hidden / restated` 哪种注入状态。

### 上下文隔离

isolated subagent 只用于“不该看到的信息被看到了”导致质量下降的场景，例如：

- 针对单个世界书条目的执行重写，不希望继承大量旧草稿导致同质化。
- 测试聊天需要干净上下文，不应继承 planner 中间推理。
- 大段条目或变量生成需要局部创意判断，只给必要约束和少量参考。

普通 memory 更新、staging 转换、项目文件保存、Prompt Preview、资源读取不应启用 isolated subagent。

## Prompt Preview 接入

Forge Prompt Preview 必须能解释 Agent runtime 的输入来源，避免 Graph、Preset、Skill、VFS 资源合成后变成黑箱。

### 新增 Agent / Attention 视图

在现有 `Messages / 合并 / 来源` 基础上增加 Agent 视图，至少展示：

- 当前 graph node / intent
- 使用的 prompt preset profile
- prompt slot / attention region 布局
- selected skills 及路径
- skill 注入状态：`full / summary / hidden / restated`
- capability 加载记录、tool namespace 展开状态与 shell profile
- `ForgeWorkingStatement` 内容摘要
- 读取的 VFS 项目文件
- 允许工具和写入 scope
- shell 命令、输出截断、权限申请和拒绝原因
- 静态规则与动态 restatement 在最终 messages 中的位置
- 每个 source unit 的 token 预算、保留状态与降级原因

### 数据流

```text
ForgeAgentGraphRuntime
  -> buildGraphNodePromptContext()
  -> PromptSourceUnit[]
  -> PromptPresetComposer / PromptAssemblyTracer
  -> PromptAssemblyResult
  -> ForgePromptPreview
```

Graph 不直接生成最终 messages；Graph 只生成结构化 prompt context。最终 messages 仍由 Prompt Assembly 统一合成并保留来源 trace。

## Runtime Graph 设计

### 状态对象

Forge Agent graph 的最小状态：

```ts
interface ForgeAgentGraphState {
  forgeProjectId: string;
  conversationId: string;
  workspacePath: string;
  activeLeafId: string | null;
  workflowSnapshot: ForgeWorkflowSnapshot | null;
  userInput: string;
  selectedSkills: string[];
  workingStatement: ForgeWorkingStatement;
  projectResources: ForgeProjectResourceSnapshot;
  pendingEffects: ForgeRuntimeEffect[];
  reviewState: {
    stagingCount: number;
    commitReadyCount: number;
    requiresHumanDecision: boolean;
  };
  trace: ForgeModelRequestTrace[];
}
```

`projectResources` 是从 VFS hydrate 得到的项目资源快照，不直接把 Vue store 当成 graph 真相源。

### Graph 节点

| 节点 | 输入 | 输出 |
|---|---|---|
| `intent_router` | 用户输入、workflow snapshot、当前审阅状态 | 路由意图：对话、规划、编辑、审阅、测试、导出 |
| `skill_selector` | 路由意图、项目资源、已安装 skill | `selectedSkills` |
| `context_loader` | 项目 id、conversation id、selected skills | VFS 项目资源、skill 文本、Prompt source units |
| `capability_loader` | intent、用户输入、capability index | 本轮加载的 skill / namespace / shell profile |
| `working_statement_builder` | 当前任务状态、skill 摘要、权限边界 | 最新一轮 `ForgeWorkingStatement` |
| `planner` | 用户输入、项目资源、skill 指南 | 高层计划、需要的工具动作、是否需要用户确认 |
| `analyst` | 参考资源、历史、项目记忆 | 精简分析摘要，不直接写项目资源 |
| `executor` | 计划、skill、上下文 | typed effects、staging 更新、memory 更新、draft 更新 |
| `isolation_router` | intent、上下文体积、同质化风险 | 是否启用 isolated subagent |
| `effect_reducer` | typed effects | 纯数据变更，写入 store 派生状态与 VFS |
| `human_review_gate` | staging / commit-ready / export 请求 | 等待用户批准或拒绝 |
| `project_persist` | reducer 后项目状态 | 保存 ConversationDocument，再保存 VFS 项目文件 |

### 迁移策略

第一阶段不删除现有 `ForgeWorkflowGraphRuntime` / `ForgeRuntimeOrchestrator`，而是新增 `ForgeAgentGraphRuntime`。入口按 feature flag 或内部开关逐步切换：

1. `refresh_workflow / noop` 先走新 graph，验证状态读取。
2. 接入 `working_statement_builder` 与 Prompt Preview Agent 视图，但不改变生成结果。
3. 接入 capability index 与 `project-readonly` shell profile，先允许搜索/查看，不允许 shell 写业务文件。
4. `send_user_input` 中不涉及写入的普通对话走新 graph。
5. `memory_update / draft_plan / entry_update` 走新 graph 与 typed effects。
6. 只在条目重写、测试聊天、创意隔离等场景启用 isolated subagent。
7. `approve / freeze_workspace / export_prepare` 接入 human review gate。
8. 旧 runtime 只保留兼容入口，待真实宿主 walkthrough 通过后再删除或降级。

## 数据与权限边界

### 允许

- 读 `/workspaces/forge/<projectId>/project.json`
- 读写 `/workspaces/forge/<projectId>/lorebook/entries/*.json`
- 读写 `/workspaces/forge/<projectId>/memory/tree.json`
- 读写 `/workspaces/forge/<projectId>/drafts/tree.json`
- 读写 `/workspaces/forge/<projectId>/review/staging.json`
- 读取绑定的 Prompt resources 与项目级 skill
- 写入 Forge request trace 和 workflow timeline operation
- 通过 `project-readonly` shell profile 在当前项目 workspace 内执行 list/read/search/stat
- 通过 capability loader 按需加载 skill、tool namespace 或 shell profile

### 禁止

- 直接写 ST 真实世界书。
- 直接改 `window.world_info`。
- 直接绕过 `ConversationDocument` 写消息树。
- 在 UI 组件里执行 Agent 工具逻辑。
- 把用户偏好写进 skill 文件。
- 把非当前项目资源静默混入当前项目生成。
- 用 shell 直写 Forge 业务真相文件；世界书、记忆、draft、review 必须走 typed effects。
- 默认开放网络、外部路径或 sandbox write；这些能力必须通过会话级权限申请并进入 trace。

## 实施拆分

### Step 1：Skill Registry 与 VFS materialize

- [x] 新增 `ForgeSkillRegistry`，定义内置 skill metadata。
- [x] 新增 skill loader：按 `forgeProjectId` 读取 `/skills/*/SKILL.md`。
- [x] 支持项目初始化时把内置 skill materialize 到 VFS，或以 virtual readonly skill 暴露。
- [x] 测试 skill 发现、读取、缺失诊断和 project scope 限制。

### Step 2：Capability Index 与受控 shell profile

- [x] 新增 `ForgeCapabilityRegistry`，提供常驻 capability 摘要与触发词。
- [x] 实现 `forge.capability.search / forge.capability.load` 的 runtime 适配层。
- [x] 将低频 MCP-like 能力降级为 skill 或 namespace 按需加载。
- [x] 接入 `ShellPermissionService`，为 Forge Agent 建立 `project-readonly` shell session scope。
- [x] 实现 `ForgeWorkspaceSearchShell`，限制 cwd、操作类型、输出长度与 trace 记录。
- [x] shell 写入业务文件时返回阻断诊断，并提示改用 `forge.effect.apply`。

### Step 3：ForgeAgentGraphRuntime 骨架

- [x] 新增 `ForgeAgentGraphRuntime`。
- [x] 定义 `ForgeAgentGraphState` 与 graph node input/output 类型。
- [x] 先接入 `intent_router / skill_selector / capability_loader / context_loader`。
- [x] 输出 graph trace，但不写项目资源。

### Step 4：Prompt Layout Slot 契约

- [x] 扩展 Forge Prompt Preset profile，支持声明 `ForgePromptSlotPolicy`。
- [x] 将 Graph 输出的 skill、VFS、review、working statement、user input 统一转换为带 slot 候选的 `PromptSourceUnit`。
- [x] Prompt Assembly 按 preset slot policy 合成最终 messages，并在 trace 中记录 slot、region、source、budget 与 fallback。
- [x] 测试 preset 顺序保留、skill 不写入 preset 正文、动态状态进入 tail restatement、静态规则不混入动态区。

当前实现状态：

- `PromptSourceUnit` / `PromptSourceTrace` 已增加 `forgeSlot / forgeRegion / slotPolicy`。
- `ForgeAgentGraphRuntime` 已输出可直接进入 Prompt Assembly 的 source units，并保留 `slot/title/summary` 兼容字段。
- `forge-main` 内置预设已增加 `agent_runtime_contract / agent_skill_context / agent_project_resources / agent_review_state / agent_working_statement / agent_user_input` 槽位。
- `PromptPresetComposer.composeWithTrace()` 对 agent slot 保留原始 source unit provenance，不再把 skill、shell profile 或 working statement 压扁成普通 preset 文本。
- `ForgePromptPreview` 与 `PromptInspector` 的来源视图已可显示新增 source kind，并展示 `forgeSlot / forgeRegion`。

### Step 5：Working Statement 与 Prompt Preview

- 新增 `ForgeWorkingStatement` 类型与 builder。
- 将当前阶段、下一步、selected skill、VFS 写入范围、审阅 gate 状态注入尾部动态 prompt source。
- `ForgePromptPreview` 增加 Agent / Attention 视图，展示 graph node、slot / region、capability 加载、shell profile、skill 注入状态、working statement、VFS 文件、token 预算和工具 scope。
- 请求调试面板保存同一份 preview context，便于回放。

### Step 6：Typed Effects 与 VFS 写入

- 将 `memory_update / draft_plan / entry_update / review_staging` 收敛为 typed effects。
- `effect_reducer` 只接受 typed effects，不接受模型自由文本直接写文件。
- `project_persist` 通过 `ForgeProjectDataService.saveFromSession()` 写 VFS。

2026-05-15 增量：`ForgeEffectReducer` 已为 memory、staging/review 移动、虚拟世界书写入、参考聊天绑定和 workspace freeze 等项目资源类 effects 增加批量持久化保证。同一批 effects 在 reducer 应用完后统一触发一次 `persistSession()`，并沿用 `ForgeSessionRepository -> ForgeProjectDataService.saveFromSession()` 写回项目 VFS。

2026-05-15 收口：legacy XML bridge 的 `ForgeAgentController.stageDraftEntry()` 不再直接写 `useForgeStore().upsertStagingEntry()`，而是发出 `FORGE_RUNTIME_EFFECTS_REQUESTED` typed effects，由 `CardMakerStore` 复用同一套 `applyForgeEffects()` target 执行。`upsert_staging_entry` 的 reducer 语义也已修正为写入 review staging；虚拟世界书写入保留在 commit-ready freeze 流程中，避免 entry update 绕过审阅 gate。

### Step 7：按需上下文隔离

- 新增 `isolation_router`，只在明确需要干净上下文的任务中启用 isolated subagent。
- 条目重写、测试聊天、批量创意生成可以使用隔离窗口。
- memory 更新、staging 转换、项目保存不得启用 isolated subagent。
- 隔离窗口只注入必要约束、skill 摘要、当前条目和少量参考，避免旧草稿导致同质化。

### Step 8：Human Review Gate

- 所有 `commit-ready`、`freeze_workspace`、`export_prepare` 必须进入 gate。
- gate 输出 UI 可读的待确认状态。
- 用户批准后才推进 review 或 export prepared 状态。
- 第一阶段仍不写真实 ST 世界书。

### Step 9：真实宿主 walkthrough

- 新建 Forge 项目。
- 安装/读取默认 skill。
- 生成记忆、草稿、虚拟世界书条目与 staging。
- 刷新后检查 VFS 文件和 UI 一致。
- 多次切换项目中心协作线程，验证 `forgeProjectId` 聚合不串项目。

## 测试计划

### 单元测试

- `ForgeSkillRegistry.test.ts`
  - 内置 skill 列表稳定。
  - 项目 skill 路径限制生效。
  - 缺失 skill 返回明确 diagnostics。
- `ForgeCapabilityRegistry.test.ts`
  - 常驻 capability index 稳定且摘要短。
  - 低频能力只返回 skill / namespace / shell profile 引用，不返回完整工具 schema。
  - capability load 能记录加载原因、风险等级和 trace。
- `ForgeWorkspaceSearchShell.test.ts`
  - 默认 cwd 限制在 `/workspaces/forge/<projectId>`。
  - `project-readonly` profile 只允许 list/read/search/stat。
  - shell 写业务文件会被阻断，并返回 typed effect 替代建议。
  - 输出超过 `maxOutputBytes` 时返回摘要和 resource link。
- `ForgeAgentGraphRuntime.test.ts`
  - intent router 能区分对话、审阅、编辑、测试、导出。
  - skill selector 能根据 intent 选择 skill。
  - capability loader 能按 intent 加载 skill / namespace / shell profile。
  - context loader 能读取项目 VFS 与 skill 文本。
- `ForgeWorkingStatement.test.ts`
  - 静态规则不进入动态 restatement。
  - 当前项目、下一步、skill 摘要、VFS 写入范围和 gate 状态会进入 tail source。
  - skill 注入状态能标记为 `full / summary / hidden / restated`。
- `ForgePromptLayoutSlots.test.ts`
  - Prompt Preset 能声明 slot / region / fallback policy。
  - skill 进入 `skill_full / skill_summary` slot，不写入 preset 正文。
  - `working_statement` 固定进入 `tail_restatement`。
  - 静态 system slot 不接受当前项目动态字段。
- `ForgePromptPreview.test.ts`
  - Agent / Attention 视图能显示 graph node、slot / region、selected skill、capability load、shell profile、VFS project files、allowed tools、token budget 和 source position。
- `ForgeEffectReducer.test.ts`
  - [x] 项目资源类 effects 应用后会统一触发 `persistSession()`。
  - [x] 只读/trace/message 类 effects 不触发项目 VFS 持久化。
  - [x] `upsert_staging_entry` 写入 review staging，不直接合并到虚拟世界书。
  - [x] memory / staging / review movement effects 通过 reducer 进入项目状态并触发持久化。
- `ForgeProjectDataService.test.ts`
  - 继续覆盖 hydrate/save 和旧项目迁移。

### 集成测试

- 从用户输入到 graph decision，再到 typed effects，再到 VFS hydrate。
- Prompt preview 能显示 skill source、working statement 和 attention position。
- capability search/load 不会把完整低频工具 schema 常驻塞进上下文。
- read-only shell 能搜索项目文件，且输出受限、越权写入被阻断。
- 测试聊天能读取项目级 resource binding 与 VFS 项目资源。
- human review gate 能阻止真实 ST 发布。

### 手动验证

- 传统桌面展开态。
- 自由工作台窗口。
- 移动端隐藏辅助栏模式。
- ST 插件环境刷新恢复。
- TauriTavern 环境 extensionStore/VFS 恢复。

## 完成标准

- Forge Agent 的项目资源写入全部通过 VFS 与 typed effects。
- Forge Agent 常驻工具面保持小而稳定；低频能力通过 capability/skill/namespace 按需加载。
- 项目搜索与查看默认走会话级 `project-readonly` shell，并受 `ShellPermissionService`、cwd、操作类型和输出长度限制。
- 默认 skill 能在新项目中被发现、读取并进入 trace；长任务能用摘要/restatement 保持关键规则可见。
- Prompt Preset 能声明 slot / region 布局，Skill/VFS/Working Statement 作为 source unit 进入对应槽位，而不是被写死在 preset 正文或 graph 节点中。
- Prompt Preview 能解释 Graph、Preset、Skill、Capability、Shell、Working Statement、VFS 项目资源和工具权限的来源、位置、预算与降级状态。
- 旧 runtime 不再承担新的项目资源写入逻辑。
- isolated subagent 只在上下文隔离场景启用，不成为默认 planner/executor 分层。
- 真实宿主刷新后，项目资源文件与 UI 派生视图一致。
- 冻结仍只进入 Forge 虚拟项目，不写真实 ST 世界书。

## 风险与约束

- LangGraph 只能作为 runtime 内部编排，不能让 Vue 组件直接依赖 graph 节点。
- Skill 系统不能变成第二套设置或偏好存储。
- Skill materialize 到 VFS 时要避免覆盖用户修改过的项目 skill。
- Agent 工具 trace 必须足够透明，否则后续调试会比旧 runtime 更困难。
- 受控 shell 的省 token 收益来自少 schema，但 stdout 仍可能污染上下文；必须强制截断、摘要和 resource link。
- capability index 如果摘要过长，会重新制造工具膨胀；常驻描述必须保持短句与明确触发词。
- 第一阶段不追求多 Agent 并行执行，只把 single Forge Agent 的项目工作区闭环做稳。
- Restatement 不是简单重复全文；需要控制长度，只重复本轮真正会影响执行的动态信息。
- 上下文隔离会降低历史一致性，必须由 `isolation_router` 明确记录启用原因。

## 下一步执行顺序

1. ~~实现正式 `ForgeWorkingStatement` builder，把 visible phase、下一步、写入范围、审阅 gate、skill 注入状态从当前 graph 拼接逻辑中抽成可测试对象。~~
2. ~~扩展 Prompt Preview Agent / Attention 视图，按 graph node、slot/region、capability load、shell profile、source position 与预算展示。~~
3. ~~将真实生成请求同步接入 Agent source units，确保 request trace 与 Prompt Preview 使用同一套 slot / region 来源。~~
4. ~~将 memory/draft/lorebook/review 写入改走 typed effects。~~
5. 为条目重写与测试聊天接入按需 isolated subagent。
6. 接入 human review gate。
7. 运行真实宿主 walkthrough。

## 本轮验证记录

- `npm run type-check`
- `npx vitest run src/api/core/__tests__/ForgeAgentGraphRuntime.test.ts src/api/core/__tests__/ForgeWorkingStatementBuilder.test.ts src/api/core/__tests__/ForgePromptLayoutSlots.test.ts src/api/core/__tests__/ForgePromptContextService.test.ts`

2026-05-15 真实生成接入验证：

- `npm run test -- --run src/api/core/__tests__/ForgePromptContextService.test.ts src/api/core/__tests__/ForgeAgentGraphRuntime.test.ts`
- `npm run type-check`
