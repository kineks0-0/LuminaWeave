# Forge 文档索引

本目录用于集中维护 `Lumina Forge` 的专属文档，按“规划 / 实现 / 目前进度看板”分类，避免 Forge 相关说明继续散落在 `docs/` 根目录。

## 文档分类

- [规划文档](./planning.md)
  - 面向产品目标、交互方向、协议边界与后续演进路线。
- [实现与技术交接](./implementation.md)
  - 面向当前代码事实、提示词/上下文链路、库选型与技术改造判断。
- [Prompt 参考预设提炼](./prompt-preset-reference-extract.md)
  - 面向参考预设的能力拆解、可迁移模块与 Forge 主/执行/测试预设落位建议。
- [架构重构设计](./refactoring.md)
  - 面向 CardMakerStore 拆分、三角色上下文隔离、世界线快照回滚的架构设计与实施计划。
- [pi session 分支与工作区版本设计](../../../current/tasks/forge/steps/2026-05-20-forge-pi-session-branch-and-workspace-version-design.md)
  - 历史设计记录；当前文件版本事实源已切换为 Forge 工作区 Git，旧审计与快照路径不再生成。
- [进度看板](../../../current/tasks/forge/steps/progress-board.md)
  - 面向已完成事项、剩余待办、阶段性结论与短期推进顺序。

## 使用建议

- 需要了解 Forge 想做成什么：先看 `planning.md`
- 需要了解现在代码是怎么接起来的：看 `implementation.md`
- 需要了解参考预设被提炼成了哪些可迁移能力：看 `prompt-preset-reference-extract.md`
- 需要了解架构重构方向和实施计划：看 `refactoring.md`
- 需要继续推进或盘点缺口：看 `../../../current/tasks/forge/steps/progress-board.md`

## 当前代码状态（2026-05-24）

- 项目中心按“项目 / 协作线程”组织：项目是 `forgeProjectId` 对应的长期资源容器，协作线程是项目内独立 ConversationDocument。
- 项目中心支持新建协作线程、删除协作线程和删除项目；删除线程保留项目 VFS，删除项目会清理该项目所有线程与项目资源。
- Forge 前台阶段已改为按 `detailMode` 分流：`detailed` 使用 6 段可见阶段，`quick` 压缩为 `kickoff / build / finalize`。
- 自由工作台下，Forge 主窗支持 `内嵌右栏 / 拆出小窗` 双态切换，并按工作会话记住当前辅助区呈现模式；拆出态时 `虚拟世界书 / 记忆管理 / 审阅中心 / 导出发布 / 后置轨` 以独立 workspace window 打开。
- 传统桌面下，辅助能力不再漂浮到全局 Shell，而是在 Forge 前台内部切换单一辅助区。
- 自由工作台拆出态下主聊天区会去掉内部 hero/topbar 与额外边距，原顶部动作迁移到 `WorkspaceWindow` 顶栏；传统桌面展开态也会取消重复 hero 与聊天区顶栏，并在重置会话左侧提供“工作区”二级菜单。
- 聊天与 Forge 共用思考折叠块，默认只在“有思考、无正文”时展开，正文或 `<V>` 一出现即自动收起。
- Forge 拥有独立排版设置：AI 回复、用户输入、消息内组件分别提供字号、行距、字距配置。设置写入 `lumina-forge.*` 命名空间，只在 Forge 工作台根节点输出 CSS 变量，不影响主聊天、桌面模式消息矩阵或核心生成链路。
- Forge workspace 的布局决策归 `src/plugins/forge/app/forgeWorkspacePlacementPresentation.ts`：纯 resolver 只根据移动端、Workspace 嵌入态与辅助栏模式计算 presentation flags，Shell/Widget 不再按 Forge panel ID 推断布局。`ForgeSidebar` 归 Forge app presentation 所有，侧栏折叠状态由每个 `CardMakerPanel` Surface 实例独立持有，不跨实例共享。
- Forge Agent runtime 已转向前端 pi-style runtime：制卡聊天的长期事实源收敛为同一协作线程内的 pi session tree，Forge timeline 作为 UI 投影保留用户可操作节点的 pi origin。
- Forge Agent 实时生命周期统一由 scoped `AgentRuntimeEventBus` 驱动：事件和 snapshot 按 `sessionId + turnId` 隔离，pi 每次 `message_start` 使用 `agent-message:${sessionId}:${turnId}:${sequence}`，普通生成与授权续跑共用同一消息、thinking、工具和运行时快照投影。旧 Forge stream/tool 事件不再作为传输契约；`CardMakerStore` 在 Pinia scope 内串行订阅并在销毁时取消。
- Forge 是 Agent Runtime SDK 的第一套 adapter 来源；后续抽取 SDK 时，Forge 仍保留 Semantic VFS、Git-backed 工作区版本、Prompt Preview 事实源和真实 ST 发布边界。
- Forge Agent 当前消息主路径为 provider-native structured messages：provider 原生 `thinking` / reasoning 投影执行过程，provider 原生 `text` 投影最终回复，tool call / tool result / approval 投影过程事实；不保留 `<process>` / `<final>` 标签协议作为过渡兼容层。
- Forge 插件内 fork / 回滚 / 切换语义为当前协作线程内分支，不创建新 Forge thread；文件版本恢复由 ForgeWorkspaceGitService 读取 Git log/diff 并写回 Forge 项目 VFS。
- Forge Agent 现在通过项目相对语义 VFS 与项目交互：`./AGENTS.md` 是 Agent 工作契约，不是系统提示词；主模型系统提示词位于 `./.forge/agent/SYSTEM.md`，执行模型额外读取 `./.forge/agent/EXECUTOR.md`，`./.forge/agent/UI_DSL.md` 固定承载 Forge `<V>` 组件 DSL，`./.forge/agent/REASONING.md` 固定承载可见推理边界；技能统一映射为 `./agent/skills/<skill-name>/SKILL.md`，当前协作线程可通过 `./threads/目前/thread.md` 与 `./threads/目前/messages.md` 访问；`/library/...` 与 `/sources/...` 仍作为底层 Resource VFS 绝对路径直通。
- Forge 预设已资源化：预设提供 `AGENTS.md`、`.forge/agent/SYSTEM.md`、`.forge/agent/EXECUTOR.md`、技能、Pi 扩展、生成参数与 Agent 提示词编排；项目覆盖优先于 active preset，active preset 优先于 bundled fallback。
- Forge Agent 预设工作台是预设资源包维护中心：内置预设只读，自定义副本可编辑提示词、技能名称、标题、说明、加载策略、正文，并展示最终编排顺序、资源路径和来源层；用户可见 profile 收敛为 Agent 与测试聊天。
- Forge Skills 默认采用 pi-style progressive disclosure：代码提供技能列表和 `SKILL.md` 路径，完整 `SKILL.md` 通过 `read` 按需读取；第一阶段不新增 activation tool，`allowed-tools` 不授予真实权限；内置与默认 preset skill 资源本身必须携带标准 `SKILL.md` frontmatter，并通过 base 层加当前预设层合并。
- Prompt Preview 与真实生成共享 `ForgePiAgentSession.preparePrompt()` / runtime prompt preparation；preview / `prompt_ready` payload 展示 provider-native structured message contract、active tools、branch messages 和本轮 user message。旧 `ForgePromptContextService` 不再组装最终模型消息，Prompt Assembly trace 只作为来源解释层。旧 `PromptBuilder` 仅保留 Chat / ST 世界书提示词挂载能力，不再提供 Forge Agent prompt 构建 API。
- Forge Agent 默认 prompt 输入已按缓存边界拆分：Contract / System / Executor Prompt / UI DSL / Reasoning Boundary 形成稳定核心前缀，Skills、Extensions、能力索引、Memory Index 与项目上下文位于其后，branch messages 承载短期对话历史。`./threads/目前/messages.md` 与 `./memory/**/*.md` 仍是 Semantic VFS 可读资源；默认 prompt 只注入 `./.pi/agent/context/memory-index.md` 的长期记忆路径、标题、来源、更新时间和摘要，不把完整线程消息或长期记忆正文注入 system prompt。
- Forge pi runtime 会把稳定 `sessionId` 透传给 `pi-agent-core` / `pi-ai`，用于 provider prompt cache key 或 session affinity；模型请求 trace 会记录 cache read / write usage，便于排查缓存命中。
- 模型可见工具已收敛为 `readFile`、`writeFile`、`editFile`、`deleteFile`、`bash`、技能/能力加载工具；`writeProposal`、`editProposal`、`stageEntry` 和旧 XML action tags 不再进入新 prompt 或 tool summary。
- “项目 VFS”辅助面板浏览 Agent 可见的 Forge 语义 VFS 投影，显示 `./...` 项目相对路径、写入边界、目录子项清单和文件内容；受管理的 `./AGENTS.md`、`./.forge/agent/SYSTEM.md`、`./.forge/agent/EXECUTOR.md` 与 `./agent/skills/<skill-name>/SKILL.md` 可在该面板创建/编辑项目覆盖，写入项目 VFS 后生成本轮文件变更摘要并提交 Git，不回写 active preset 或 bundled fallback；raw workspace storage 只作为内部映射源，`./chat/<conversationId>`、`project.json`、`memory/tree.json`、`lorebook/entries/*.json`、`review/*.json` 等内部结构不得暴露给模型或主视图。
- Forge Semantic VFS 已挂载到 HAL Bash：`BashTerminalRuntime` 提供通用 `extraMounts`，Forge runtime 注入 `ForgeSemanticBashFs`，使 shell、`readFile`、Prompt/Skill loader 和项目 VFS 面板使用同一份语义 VFS 内容。
- AI 对 Forge 项目 VFS 的写入默认直接应用并生成本轮文件变更摘要；`./memory/**/*.md`、`./lorebook/entries/*.md` 和项目级 Agent 资源覆盖会同步写入项目数据。对话内“AI 更改文件”列表只读取本轮写入摘要，“文件版本”面板读取 Git log/diff 并通过 Git restore 恢复，不再生成 Review/Staging 条目。
- Forge Agent bundled 资源按 Agent 包形态维护：默认底座位于 `src/resources/forge-agent/base/`，内置 skills 位于 `src/resources/forge-agent/base/skills/<skill-name>/SKILL.md`，内置 Pi 扩展位于 `src/resources/forge-agent/base/extensions/`；默认 Agent 预设位于 `src/resources/forge-agent/presets/forge-agent-default/`，`SYSTEM.md`、`EXECUTOR.md` 与默认 preset reference skills 均以标准 Markdown / `SKILL.md` 文件维护。`ForgeSkillRegistry` 只维护 metadata、优先级和 loader，长期文本不再堆在 TS 常量里。
- 真实 SillyTavern 世界书发布、导出或覆盖宿主数据仍属于显式用户确认边界；direct write 只覆盖 Forge 项目 workspace。
