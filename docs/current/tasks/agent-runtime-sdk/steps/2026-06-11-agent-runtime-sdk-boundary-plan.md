# Agent Runtime SDK 边界规划

> 日期：2026-06-11
> 范围：从 Forge pi-style runtime 抽取跨插件 Agent Runtime SDK 的架构边界。
> 取向：可靠可控优先，保留 Forge 现有事实源，不把外部 Agent 框架切为主 runtime。

## 1. 决策

LuminaWeave 需要内部 Agent Runtime SDK，而不是把 OpenAI Agents SDK、Claude Agent SDK、LangGraph 或 MCP 作为主 runtime。外部方案只作为 loop、tool boundary、approval、trace、durable state、sandbox/workspace 和 protocol 设计参考。

Forge 是第一套 adapter。当前 Forge 主链路已经由 `src/api/core/forge/agent-app` 承载 runtime / session / resources / tools / model；后续抽取不能破坏 `ForgePiAgentSession.preparePrompt()` 作为 Prompt Preview 与真实生成的事实源，也不能绕过 Forge Semantic VFS 和 `workspace_patch` 审计。

Skills 默认采用 pi-style progressive disclosure：

- 代码提供技能列表：名称、描述和 `SKILL.md` 路径。
- 模型需要使用技能时，通过 `read` 读取完整 `SKILL.md`。
- 相对路径资源继续通过 agent-visible VFS 按需读取。
- 第一阶段不提供专用 skill activation tool。
- `allowed-tools` 不授予权限，只进入声明、UI 展示和 diagnostics。

## 2. Core SDK 包含什么

Core SDK 应包含：

- Agent turn 生命周期：run、continue、abort、preview。
- Session tree：append-only entries、active node、branch checkout、branch messages。
- Prompt Preview 端口：真实生成与 dry-run 共用同一个 prompt assembly 结果。
- Model provider 端口：模型请求、stream、request trace、response trace。
- Tool provider 端口：工具注册、schema、执行、结果、错误、增量事件。
- Approval 端口：工具执行前 pause、approve、deny、resume。
- Trace / effect bus：模型、工具、approval、session 持久化和业务 effect 都可记录。
- Runtime event / snapshot：输出 `agent_start`、`turn_start`、`message_start`、`message_update`、`message_end`、`tool_execution_start`、`tool_execution_update`、`tool_execution_end`、`turn_end`、`agent_end`、`queue_update`，并维护 `isStreaming`、`streamingMessage`、`pendingToolCalls`、`messages`、`errorMessage`、active tools summary。
- Extension workflow hooks：支持 `before_agent_start` hidden custom context、turn / agent end hook、custom message append、status / widget projection、continuation trigger、tool before/after hook 和 context transform。
- Extension loading boundary：支持 adapter / 代码配置显式传入 extension factories 或 resolved extension paths；扩展可以注册 event handlers、custom tools、custom messages、resource discovery hook 和 provider，但必须经过 SDK tool registry、Prompt Preview 和 trace 边界。
- Test harness：mock model、mock tool、mock session store、mock approval、mock VFS。
- Agent Skills 兼容：解析标准 `SKILL.md` frontmatter，输出 diagnostics，格式化 skill catalog。
- OpenFS 接入边界：FS template、mount metadata、mount policy、approval hook、audit hook、trace hook。
- 可选 phase/capability filter：由 adapter 提供阶段状态和工具可见性规则。

Core SDK 不包含：

- Forge Semantic VFS 语义。
- Forge prompt 路径。
- `workspace_patch` 格式或 reducer。
- ST 世界书发布、导出或覆盖宿主数据。
- Vue UI、Pinia store、Surface Runtime。
- 默认文件读写工具。
- 默认 `bash` tool。
- skill activation tool 的默认实现。
- Plan Mode 或固定“规划 / 执行 / 汇报”状态机。
- VFS 中 TypeScript / JavaScript 扩展代码的自动加载。
- 自动扫描项目目录或用户目录。
- 根据 `allowed-tools` 自动放权。
- 把 thinking 写入默认业务状态；thinking 只作为 assistant message stream block、trace 和 UI projection 输入。

## 3. 可选 Kit 边界

Prompt Resource Kit：

- 从 adapter 配置的 VFS 路径读取 Contract、System、Mode Prompt、UI DSL、Reasoning Boundary、Skills、Capabilities、Memory Index、Context Files、Branch Messages。
- 输出 prompt source trace 和 dry-run 结果。
- 不内置 Forge 路径，不拥有 skill 标准，不授予工具权限。

VFS Skill Source：

- 按 adapter 配置扫描 `SKILL.md`。
- 把读取到的文件交给 Core SDK Agent Skills parser。
- 不决定 skill 何时使用，不提供默认 activation tool。

Workspace Tools Kit：

- 可提供 pi-style 短名工具工厂：`read`、`write`、`edit`、`delete`、`bash`。
- 可补充只读 `grep`、`find`、`ls`、`search`。
- `read`、`write`、`edit`、`delete`、`bash` 的底层 I/O 通过 OpenFS / just-bash 或 adapter operations 注入，不直接绑定本地 `fs`。
- `write`、`edit`、`delete` 应串行化同一文件的并发修改，并输出可审计 diff / patch 或 adapter 审计 payload。
- 默认不启用任何工具。
- 写入工具和可写 bash 只能由 adapter 在写入阶段显式注册。

OpenFS / just-bash Kit：

- 第一阶段直接依赖 OpenFS 能力层。
- just-bash / `MountableFs` 负责 shell 视角路径解析和 mount dispatch。
- Core SDK 负责 policy wrapper、approval hook、audit hook 和 trace hook。
- `bash` tool 仍由接入方按自己的 mount、command 和工具可见性策略组装。

## 4. Forge Adapter 责任

Forge adapter 继续拥有：

- Forge Semantic VFS。
- Forge prompt 路径和资源包编排。
- Forge 项目 VFS 写入策略。
- `workspace_patch` 审计。
- Forge timeline / workspace version 与 session tree 的投影。
- Prompt Preview 主模型视图的事实源语义。
- 真实 ST 世界书发布、导出和覆盖宿主数据的用户确认边界。

Forge adapter 不应把这些业务语义上移到 Core SDK。其他插件只需要满足 SDK 端口，并显式选择自己的 model、session、prompt、skill、tools、approval、trace 和 VFS mount。

## 5. 验证场景

后续实现计划必须保留：

- Prompt Preview 与真实生成使用同一 prompt assembly 结果。
- 技能列表只展示摘要和路径，完整 `SKILL.md` 由模型通过 `read` 读取。
- Extension 注册的新工具进入同一 tool registry、active tool set、Prompt Preview active tools summary 和真实生成工具集合。
- Extension resource discovery 追加的 skill / prompt 路径进入同一 prompt assembly 结果。
- Workspace tools 的同文件并发写入按工具包队列串行化。
- Forge `read`、Forge shell、Prompt ResourceLoader 和项目 VFS 面板共用同一 Semantic VFS provider/projection。
- 非写入阶段不出现 `write`、`edit`、`delete` 和可写 bash。
- 写入阶段 direct write 生成 Forge `workspace_patch`。
- 受保护目标写入失败且不产生部分写入。
- Session branch checkout 保持 append-only entries 为事实源。
- 文件版本恢复通过反向或重放 `workspace_patch` 写回 Forge 项目 VFS。
- 真实 ST 世界书发布、导出和覆盖宿主数据必须由用户确认。

## 6. 文档影响

本规划需要同步：

- `docs/overall/PDR.md`
- `docs/overall/system_design.md`
- `docs/overall/modules/forge/index.md`
- `docs/current/README.md`
- `docs/index.md`
- Forge 当前任务入口
