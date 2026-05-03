# LuminaWeave 产品需求文档 (PDR)

**版本:** v6.0-dev (Lifecycle & Stability Focus)
**最后更新时间:** 2026-04-20

## 一、产品定位

**LuminaWeave（幻光织机）** 是基于 SillyTavern (ST) 生态的下一代增强框架与综合交互操作平台。其核心目标是解决现存 ST 原生界面的多插件堆叠卡顿、聊天流单向不可逆（失忆、逻辑崩塌）等问题，致力于通过现代化 UI 与底层"全局状态重塑"，提供完美的跑团/角色扮演体验。

## 二、核心功能需求

系统由多个解耦的官方子插件构成，共同服务于沉浸式体验：

0. **Plugin Platform v2（插件平台重构）[NEW]**
   - **早期破坏式重构原则**：本轮不保留旧插件 API、旧主题 API、旧设置注册方式或 `activeThemePack` 兼容路径；新实现以 `Plugin Manifest v2 + Desktop Mode Runtime + Surface Runtime` 为主线。
   - **逻辑与 UI 分离**：Core Runtime 只负责业务真相；Plugin Domain 只声明能力、selectors、intents、settings schema 与 surface contracts；Desktop Mode / Theme 主导 Shell、导航、布局、交互和大部分 UI。
   - **主题桌面高度定制**：不同桌面模式可以拥有完全不同的信息架构和交互逻辑，例如频道式、即时通讯式、多窗工作台式；但只能通过插件暴露的 selectors / intents 操作业务，不得复制或绕过同步、存储、Prompt、事务链路。
   - **Surface Contract 连接层**：第一批官方 surface contract 固定为 `chat.main`、`chat.preview`、`chat.composer`、`settings.root`、`settings.control`、`forge.workspace`、`forge.settings.summary`、`forge.settings.workbench`、`timeline.navigator`、`stats.panel`、`director.panel`、`lorebook.workspace`、`launcher.root`、`dev.tools`、`telegram.infoPanel`。插件特殊 UI 作为 business renderer 暴露，主题可包裹、替换布局或提供 variant。
   - **API Facade 收缩 [NEW]**：`LuminaWeaveAPI` 不再作为继续堆叠 UI 能力的主要边界；桌面模式与 surface 打开/注册能力已开始下沉到 `DesktopSurfaceService`，宿主 toast / confirm 下沉到 `HostInteractionService`，会话上下文读取与世界线命令下沉到 `ConversationDomainService`，聊天发送/重生成与 PromptInspector 自定义提示词运行下沉到 `GenerationDomainService`，设置读写与 canonical/legacy key 处理下沉到 `SettingsDomainService`，facade 只保留委托入口。
   - **Tailwind Utility Layer [NEW]**：前端样式系统开始迁移到 Tailwind CSS v4 + Lumina UI primitives。Tailwind 只作为实现层 utility，使用 `tw:` 前缀并禁用 Preflight；`--lw-*`、Desktop Mode manifest、surface skin 仍是主题真相源，避免把桌面模式降级为局部样式堆叠。
   - **执行文档持久化**：当前任务落在 `docs/current/tasks/`，完成任务归档到 `docs/archive/completed-tasks/`；插件平台重构记录已归档到 `docs/archive/completed-tasks/plugin-platform-refactor/`，避免长周期重构因上下文压缩丢失状态。

1. **Lumina Timeline（幻光时间线）**
   - **Git 化分支导航**：将对话历史重塑为标准的 Git 风格多轴轨道图，通过 `trackIndex` 算法实现分支的“岔开”与“交汇”视觉。
   - **LogicFlow 架构**：迁移至 LogicFlow 画布引擎，增强了对 Shadow DOM 的隔离支持。
   - **精确文本测量 (Accurate Layout) [NEW]**：引入 `pretext` 库进行毫秒级 Canvas 文本测量，彻底消除由于字符宽度不一导致的高度计算偏误。
   - **自适应视口聚焦 (Smart Focus) [NEW]**：在切换横竖向布局时，系统会自动平稳对焦至当前活跃节点，保障操作连续性。
   - **轨道对齐布局**：优化布局计算逻辑，确保同一分支节点在轴向上严格对齐，彻底消除“梯形下降”问题。
   - **自由视角切换 [NEW]**：支持一键在“横向逻辑流”与“纵向时间流”视图之间切换。大窗口全景模式默认自动聚焦于当前活跃节点并重置缩放比例，提升即时操作效率。
   - **全维度自由漫游 [NEW]**：修复旧版只能左右滚动的限制，支持双向平滑滚动；配合改进的渲染引擎，确保缩放 (Zoom) 时节点与连线完美同步。
   - **智能分支剪枝 (Zero-noise Pruning)**：侧边栏仅全量展示活跃世界线，非活跃分支仅保留首层节点作为入口，彻底解决大规模复杂图谱下的 UI 拥堵与重叠。
   - **强一致性同步**：分支回退操作会实时物理截断 ST 对话列表，确保底层引擎与所有插件状态绝对对齐。

2. **Lumina Director (幻光导演引擎) [Consolidated]**
   - **记忆与策划一体化**：整合原 `Lumina Memory` 插件，由 Director 统一控制对话上下文的“深度”与“广度”。
   - **权限管控下放到子插件维度，用户可以随意启停 Timeline, Director 的独立提示词流入，保留绝对的数据安全与控制感。**
   - **物理隔离与频率引导 (Physical Isolation & Frequency Weighting) [NEW v5.8.3]**
     - `PromptBuilder` 在组装提示词时实时感应 `dialogueUIFrequency`。
     - 如果设为 0，系统会自动从 `PromptRegistry` 的汇总结果中执行黑名单过滤，强制移除 `V` 标签协议。
     - 非 0 时，通过 `weightDesc` 指令将用户的频率偏好显式告知 LLM，利用指令从属度（Instruction Following）实现软性频率控制。
   - **消息范围控制 (Message Scope Control) [v5.8.2 增强]**：通过原生 `is_hidden` 实现非侵入管理，支持条数/Token/字符限制。引入条件化 UI 呈现与专用步进组件，提升配置精准度。
   - **动态上下文压缩 (Dynamic Context Compaction, DCC) [NEW]**：针对长对话历史实施分层发送策略，极大节省 Context 资源。
     - **全量区 (Full Range)**：最近 N 条或 X Token 内的消息，按原样发送，保留所有叙事细节。
     - **概览区 (Overview Range)**：全量区之外的消息。内容不再按原样发送，而是替换为 `<Story_Summary>` 标签中的摘要。使 AI 在看不到历史细节的情况下依然能感知完整的剧情脉络。
     - **隐藏区 (Hidden Range)**：超出概览限制的消息被物理标记为 `is_hidden`，彻底移出上下文。
   - **剧情概况 (Story Summary)**：隐藏的消息由 AI 自动摘要并通过虚拟世界书注入补充。

3. **Lumina Forge（幻光制卡工坊）**
   - **Agent 驱动的工业级制卡架构**：引入“规划者-执行者 (Planner-Executor)”分离模式。主模型负责规划与讨论，隔离的执行模型负责高精度重写，彻底解决长上下文导致的逻辑偏移（OOC）。
   - **detailMode 分流的可见阶段 + 七层后台设计模型 [UPDATED v6.0-dev]**：Forge 内部继续保留 `概念 / 实体 / 状态机 / 描写 / 变量 / 汇总 / 输出` 七层制卡模型，但前台阶段改为按 `detailMode` 分流展示。`detailed` 模式显示 `alignment / entity_world / state_topology / narrative_style / variables_index / output_delivery` 六段可见阶段；`quick` 模式压缩为 `kickoff / build / finalize` 三段，只暴露当前最小任务。前台阶段负责用户理解与节奏控制，后台层负责真实执行目标。
   - **素材引导开局 (Seed Mode) [NEW]**：支持上传小说或设定片段作为种子。系统自动执行“片段萃取 (Snippet Extraction)”，允许用户勾选代表性片段，快速建立世界观基元（Primitives）。
   - **双节奏启动 [UPDATED v6.0-dev]**：Forge 启动页改为 `详细定制` 与 `快速开始` 两种协作节奏。`详细定制` 默认先通过自然语言摸清方向、偏好与约束，再按需插入临时组件，持久表单后置；`快速开始` 只保留当前推进所需的最小问题与最小临时组件/表单，并允许 Planner 在判断仍需收集信息时通过 `<form_prefill>` 为当前本地表单预填建议值，用户可直接确认后提交。模式仅影响后续提问密度与提示词，不清空已采集数据。
   - **组件驱动的信息采集 (Component-first Intake) [UPDATED v6.0-dev]**：制卡不再依赖模型输出大段“请填写以下信息”的自然语言问卷，而是采用“对话优先、临时组件辅助、持久表单后置”的收集策略。启动阶段不再强制标准化表单，而是允许先自然语言对齐思路，再按需输出基于 LuminaView `<V>` DSL 的临时组件；当单条消息中存在多个临时组件时，前端统一在底部自动渲染提交区。`ForgeChoiceGroup`、`ForgeFacetChecklist` 现支持“正文 + 按钮描述”的富选项；骨架/叙事/扩展阶段继续使用 `ForgeForm`、`ForgeInput`、`ForgeTextarea`、`ForgeSelect`、`ForgeChecklist` 等组件。
- **Forge 独立文件化记忆 [NEW v6.0-dev]**：Forge 会话新增独立 `forgeMemoryTree`，与虚拟世界书并列持久化，用于保存 `启动/用户偏好`、`约束/硬性限制`、`约束/禁忌`、`参考内容/*`、`设定决议/*`、`规划/待确认问题` 等事实。用户明确表达偏好、协作方式、必须/不能改动规则、禁忌和参考片段时，由控制层按稳定路径覆盖或追加写入；主模型、执行模型与中间态分析模型共享该记忆摘要，而不是仅依赖聊天历史。
   - **虚拟工作区闭环 [UPDATED v6.0-dev]**：制卡过程中的 staging、审阅和冻结默认落在 Forge 虚拟工作区，不直接写真实 ST 世界书；真实世界书发布与导出后置。
   - **V 视图渲染解耦 [NEW v6.0-dev]**：`<V>` 协议继续复用，但 Forge 不再绑定聊天区默认块组件。相同 DSL 组件可在 `chat` 与 `forge` 上下文中映射到不同实现，例如 `Choices(...)` 在 Forge 中绑定 Forge 专属交互块。
   - **Forge Prompt 半专用化 [UPDATED v6.0-dev]**：Forge Planner / Analyst / Executor 的提示词不再只是通用 Agent 模板补充几条约束，而是显式内建 `visiblePhase + 七层 + detailMode + forgeMemoryTree + 虚拟工作区优先 + <thinking>` 规则，并通过 Forge 专属协议快照暴露 `<forge_skill>`、`<draft_plan>`、`<entry_update>`、`<memory_update>`、`<context_read>`、`<analysis_handoff>`、`<form_prefill>` 与 Forge `<V>` 组件语义。
   - **统一 Prompt Preset 合成 [NEW v6.0-dev]**：Forge 主模型、执行模型与测试聊天开始共享同一套前端 Prompt Preset 领域层。预设以 `profile + entries + specials + bindings` 组织，调用方显式传入世界书、角色卡、聊天历史、记忆树等 sources；底层 composer 本身不直接绑定 ST 当前世界书或角色卡，从而允许自定义世界书、角色卡与历史注入。内置预设继续保持只读身份，但允许用户对单个条目的 `enabled` 状态做持久化覆写。
   - **前端 Runtime 编排层 [UPDATED v6.0-dev]**：Forge 不再依赖 `CardMakerStore` 直接串起“状态判断 + Prompt 组装 + 流式副作用 + Staging 写入”，而是改为以前端 `LangGraph runtime orchestrator` 统一产出 `workflowSnapshot / executionRequest / effects`。该编排层现支持 `Planner / Conversation / Analyst / Executor` 四类执行模式；其中 Analyst 负责隔离读取上下文并只回注精简摘要。Store 仍是唯一真状态源，但副作用通过 typed effect/apply 层收敛，避免控制逻辑散落。
   - **Forge Prompt 设置工作台 [NEW v6.0-dev]**：Forge 设置页新增“概览 + 详细工作台”双层交互。统一设置总览页只展示三处 active preset 的绑定结果；详细页提供按目标（主模型 / 执行模型 / 测试聊天）切换的 preset workbench，支持复制、新建、重命名、删除、恢复默认、条目排序与 special prompt 编辑。
   - **全透明流水线交互 (Transparent Pipeline)**：
     - **统一工作流时间线 (Unified Workflow Timeline) [UPDATED v6.0-dev]**：Forge 不再把“消息流”和“技能日志”拆成不同概念，而是在同一条工作流时间线中并列展示用户消息、Assistant 正文、thinking 折叠块、技能执行、规划结果、表单提交、审阅与冻结结果。用户始终沿一条时间线理解“AI 说了什么”和“系统做了什么”。
     - **执行过程持久化 (Persistent Operations) [UPDATED v6.0-dev]**：`forge_skill`、`draft_plan`、`entry_update` 以及用户审批/冻结等操作不再只是临时 trace，而是作为会话级时间线节点持久化保存，刷新后仍可追溯。
     - **差异对比审阅 (Diff-based Review)**：所有条目修改在入库前必须以 Diff 视图形式展示，确保用户拥有最终裁定权。
     - **来源可追溯的 Draft Projection [UPDATED v6.0-dev]**：Staging / Commit-ready / Publish-candidate 投影节点必须保留 `layer`、`sourceTag`、`sourceMessageId`、`sourceSessionId` 等来源元数据，避免所有草案被当前 `activeLayer` 覆盖，确保审阅与冻结后仍能追溯原始生成来源。
   - **并行会话与状态隔离**：制卡流程与主聊天独立运行，互不干扰（独立 `sessionChatId`）。
   - **统一节点模型接入 (Unified Node Model) [NEW v6.0-dev]**：Forge 会话已开始迁移到与主聊天一致的世界线节点结构。节点通过 `conversationType / conversationId / nodeKind` 等元数据区分来源与用途，从而允许时间线和后续扩展共享同一套节点式会话容器。
   - **前端导向合成 (Frontend Directed Synthesis) [NEW v6.0]**: 提示词合成权完全下放至前端扩展插件（Director Mode）。利用 `PromptBuilder` 实时注入 ST 的世界书条目并处理宏替换，使后端 Nexus 保持轻量化代理角色。
   - **异步演化同步 (Async Step 2.4)**：集成基于回合计数的异步检测机制，模拟角色在深度睡眠或梦境中的状态质变与逻辑反思。
   - **预设与基元管理**：通过可视化表格双向同步生存、功能、关系等基元数据。

4. **Lumina Settings & Storage（统一设置与存储引擎）**
   - 彻底解耦的 Storage API，支持 `全局`、`随角色`、`随对话`、`临时会话` 等多级作用域。
   - **统一会话文档 [UPDATED v6.0-dev]**：聊天与 Forge 扩展状态不再分别持久化为 `chat jsonl + forge_sessions` 两套真相源，而是统一收敛为单个 `ConversationDocument`。文档内显式包含 `schemaVersion`、消息节点、插件状态与事务游标；事务日志仍独立保存。
   - **环境隔离层开关 [NEW]**：支持在设置中动态切换 Shadow DOM 开启/关闭状态，以适配不同浏览器扩展的兼容性需求。
   - **分离式模块配置原则**：`lumina-settings` 仅负责宿主级全局设置，各子插件通过 `settingsManifest`接口向设置总线动态渲染表单。
   - **Prompt Preset 持久化 [NEW v6.0-dev]**：统一 Prompt Preset 使用全局注册表键 `lumina-prompt-presets.registry`、绑定键 `lumina-prompt-presets.bindings` 与内置条目覆写键 `lumina-prompt-presets.builtin-overrides` 持久化；其中 `builtin-overrides` 仅记录内置预设条目的启停状态，不承载名称、排序、special prompt 或正文改写。Forge 测试聊天旧键在首次读取时迁移到新结构，主模型与执行模型默认自动绑定内置预设。
- **桌面模式设置分层 [NEW]**：设置系统开始拆成 `core settings / desktop-mode settings / plugin settings` 三层。当前桌面模式可以单独声明自己的设置项，用于驱动工作模式、导航组织、界面承载方式与表层视觉参数，不再把所有外观项都塞回插件私有设置。设置持久化的正式命名已切到 `activeDesktopMode + desktop-mode-*`，旧 `activeThemePack + theme-pack-*` 只作为兼容别名。
- **对话外观归属 Desktop Mode [UPDATED]**：聊天气泡、文档流、头像位置、字体、字重、字号、最大阅读宽度、行高、段距与字距不再由 `lumina-chat` 插件私有设置负责，而是下沉为桌面模式设置的一部分。桌面模式需要能按 `assistant / user` 角色分别声明 `message shape`、`avatar placement` 与可跟随统一值的角色级字号/行高/字距覆盖，以支持 Discord 的“文档 + inline 头像”、Telegram 的“气泡 + 顶栏头像/消息内隐藏头像”等差异化呈现。
- **Telegram Liquid Glass 桌面模式 [UPDATED]**：`telegram` 桌面模式设置组提供 `appearanceMode / glassIntensity / messageDensity / panelChromeStyle / topBlankSpace / rightInfoPanel / showUsernames / avatarShape` 以及角色化消息渲染参数。该模式已升级为结构级三栏桌面壳层，通过 Telegram 专用 frame、chat list、conversation、info panel 与 composer surface contract 支持主题扩展；桌面端默认使用 `floating-rounded` 圆角外边距三栏与顶部呼吸空间，`edge-to-edge` 保留旧贴边结构作为兼容选项，但不恢复 mac 三色按钮或窗口标题栏。左栏新增固定工具入口，`启动台` 与 `制卡工坊` 在 `所有` tab 中置顶展示、在 `工具` tab 中单独展示，点击只切换主区 surface，不创建聊天或切换会话；搜索和 `所有 / 角色 / 工具 / 筛选` 只作用于本地 `CharacterChannelState` 与 shell view-model 派生视图。左栏与右侧资料栏支持桌面端拖拽调整宽度，左栏宽度持久化到 `luminaWeave.telegram.leftRailWidth`，右栏复用 `luminaWeave.widgetWidth`，约束由当前视口、另一侧栏宽度和中间聊天区最小宽度共同决定。未打开聊天时中间主区显示欢迎态、最近会话/角色和开始入口；右侧资料页只展示角色/会话摘要及 Timeline、状态、导演、世界书等上下文工具入口。上下文插件的 Telegram 表层新增 `stats.panel`、`director.panel` skin，并复用 Timeline、Lorebook、Settings 的 Telegram variant，使状态、导演、时间线、世界书和设置在右栏、临时面板和移动端单列页中保持同一浅雾蓝轻玻璃风格。该模式只改变 Shell、导航、主题 token、组件 surface 与设置页皮肤，不改变 `ConversationService`、聊天同步、持久化或 Prompt 构建链路。
- **Telegram Shell Stack Navigation [NEW]**：Telegram desktop 与 mobile 均隐藏全局 `lw-panel-header`，由 Telegram shell 自己承载导航。桌面端左栏 / 中栏 / 右栏各自维护独立 stack；左栏包含 `会话列表页` 与 `角色列表页`，会话列表页支持 `角色聚合 / 对话文件` 双模式。移动端底部一级 tab 固定为 `对话 / 角色 / 设置 / 个人资料`，四个 tab 内容区各自维护独立 stack；`个人资料` 在移动端表示用户本人资料，角色/会话资料继续由 `telegram.infoPanel` / `TelegramUserInfoPanel` 承载。

5. **Lumina Status（幻光状态栏）**
   - 面向硬核跑团的 RPG 数据展示区，含 HP、亲密度、物品栏及数值动效。

6. **Lumina Nexus（幻光枢纽）**
   - 可视化数据流路由节点绑定，允许用户自由分配模型（轻量模型总结状态 / 主力模型推演剧情）。
   - 支持用户配置任意 OpenAI 兼容 API（URL + Key），通过 TavernHelper `custom_api` 参数路由请求。

7. **Lumina Director (幻光导演引擎) [NEW]**
   - **导演/剧情策划子系统 (Director Subsystem)**：应对不同算力预算和剧情复杂度，提供两种核心工作模式：
     - **轻量模式 (Piggyback / 合并请求)**：不单独发请求，在本次输出结尾附带 `<Next_Plan>`，作为下次请求的前置约束，适合连贯短线动作推演。
     - **重量模式 (Async / 独立后台请求)**：特定条件（如场景切换、N轮对话）触发的后台独立请求，专门调用逻辑强的模型梳理长线剧情并更新至长期记忆中。
   - **分层记忆系统 (Layered Memory System)**：
     - **Tier 0 (核心灵魂)**：常驻 System Prompt，包含核心人设和世界观。
     - **Tier 1 (结构化状态)**：由插件 Vue Store 维护的动态数据（物品栏、关系网）。
     - **Tier 2 (近期记忆)**：最近 N 轮的本地对话内容。
     - **Tier 3 (概况记忆)**：近期剧情的摘要总结。
     - **Tier 4 (历史档案)**：需要通过重量模式主动检索的深层背景或远古记忆。
    - **混合调度路由 (Hybrid Gateway)**：支持在一次对话中**合并请求**（剧情规划+对话生成，Piggyback 模式），也支持通过设定条件触发**独立后台请求**（深层图谱总结，Async 模式）。
    - **自动状态对齐 (Auto-Sync)**：在新建对话、切换分支或节点时，系统自动执行底层记忆重置或状态恢复，并实时同步至 ST 提示词世界书，确保 AI 随时感知当前分支的长效记忆。
    - **高自由度请求编排**：赋予用户对请求分流和数据组装极高控制权。支持用户自定义变量，通过图形化节点图（Node Graph）或高级设置面板，决定特定数据流的提取与插入规则。
   - **核心插槽化 Prompt 构建 (Prompt Mutator)**：系统拦截原生 ST 的 Prompt 载荷，实施高优先级的结构化重塑：
     - **前置插槽 (Pre-Context)**：强制前置 Tier 1 状态和上一回合的 `<Next_Plan>` 等优先执行指令。
     - **后置插槽 (Post-Context)**：强制将 XML 输出规范置于 Prompt 最末尾，确保 AI 绝对服从。
   - **数据标识驱动生命周期 (Tag-Driven Lifecycle)**：强制要求所有的 XML 设定必须包含明确的生命周期定义，并以此决定何时应该写入上下文记忆区，何时应该销毁。
     - **Transient (阅后即焚)**：辅助推演，如 `<Thoughts>`。提取后直接丢弃，绝不污染 Tier 2 (近期记忆) 上下文记录。
      - **Ephemeral (单回必需)**：次轮生成的强制前置，如 `<Next_Plan>`。由 `MemoryManager` 捕获并暂存。
      - **Persistent (持久结构)**：如 `<Inventory_Change>`。修改由 `MemoryManager` 管理的持久状态表（Tier 1）。
     - **Core (核心对话)**：如 `<Chat_Reply>`。仅此部分标签内容会流入 Tier 2 (近期记忆) 与 ST UI 界面。
   - **可插拔的 XML 流水线**：框架内置基础正则切割流。并开放扩展接口，各路衍生插件（如掷骰子系统或属性修正补丁）可注册自定义的 XML 拦截器，以及赋予该 XML 何种等级之生命周期（`transient | ephemeral | persistent`），实现无限机制扩展与自由度。
   - **通用增量更新引擎 (Universal Incremental Updater) [v5.3 增强]**：提供一套底层的标准化数据操作协议。
     - **极致简化语法**：支持 `target(args)` 隐式调用 `update`，显著降低 LLM Token 消耗。
     - **细粒度模型拆分**：将核心状态拆分为独立 `inventory`、`skills`、`characters` 等 Target，支持原生 `add`/`remove` 指令，实现高效的局部状态同步。
     - **自说明文档 (Self-documenting API)**：引擎根据当前注册的 DataModel 动态生成 Markdown 文档，实时注入 Prompt，确保 AI 指令依从性。
    - **核心状态记忆管理器 (Core MemoryManager) [NEW]**：状态数据不再仅停留在插件层，而是通过核心 API 统一管理。
      - **提供者模式 (Provider Pattern)**：插件（如 Director, Tier 1）注册为状态提供者，核心引擎自动感应变化。
      - **自动快照 (Snapshotting)**：在根节点、分歧点及每 10 个节点处自动执行全量状态持久化，解决切换分支时的状态丢失。
      - **精准增量重播 (Delta Replay)**：记录 `Mutation` 引擎的指令增量（Deltas），切换节点时依靠“快照 + 重播”机制无缝重建平行时空状态。
    - **生成调度流 EventFlow [NEW v6.0]**: 彻底分离硬编码。提供响应接口 `beforeGenerationStartFlow` 与 `messageReceivedFlow`。
      - `beforeGenerationStartFlow`: 允许在生成触发前收集操作（如 DCC 压缩）。
      - `messageReceivedFlow`: 允许 UI 与存储层在收到流式消息后异步协调刷新，彻底消除初次同步时的死锁风险。
    - **生成会话管理 (GenerationSession) [NEW v6.0]**: 引入 `GenerationSession` 与 `LuminaGenerationTask` 对生成任务进行“数据/逻辑”分离封装。
      - **数据自治 (GenerationSession)**: 纯数据容器，管理 `finalText`、`committedInfo` 与 `nodes` 节点状态，支持多对话并发隔离。
      - **逻辑自治 (LuminaGenerationTask)**: 独立执行逻辑。负责 SSE 连接、看门狗监控及与后端 Nexus 的协议交互，确保生成过程的健壮性。
      - **生命周期锁定**: 确保当且仅当“流结束”与“后端事务确认”双信号均满足时才触发收口同步。

8. **Lumina Lorebook (世界书编辑器) [NEW]**
   - **可视化 Entries 管理**：在 Lumina 界面内直接进行关键词条目的增删改查。
   - **双向同步**：通过原生 API 代理实现 Lumina 编辑器与官方世界书面板的数据强一致性。

9. **全环境上下文适配层 (Cross-Context Adapter) [Standardized]**
    - **统一 API 探测器 (Unified API Discovery)**：引入 `LuminaWeaveAPIBase` 标准化 Getters。
    - **多路径路由机制**：
        - **核心上下文 (`this.ctx`)**：采用 `getContext() > Global` 优先级，动态获取聊天列表、角色及用户快照。
        - **事件源探测 (`stEventSource`)**：自动遍历 `Context > Main API > Window` 链路，定位标准的 EventEmitter 并排除 SSE 干扰。
        - **工具集接入 (`stHelper`)**：透明适配全局 `TavernHelper`，屏蔽不同部署环境导致的路径差异。
    - **初始化激活锁 (Activation Lock) [NEW v6.0]**: 在 `LuminaWeaveAPI.init()` 阶段引入物理激活机制。只有环境（ST Core/TavernHelper）探测确实就绪后，才允许 `ChatManager` 激活响应式监听，防止冷启动时由于环境半就绪导致的同步回灌崩溃。
    - **静默环境探测 (Silent Probing)**: 针对冷启动阶段的探测失败执行静默处理，消除控制台冗余报警日志。
    - **平滑兼容**：确保插件逻辑与宿主运行模式（Iframe 嵌套 vs 标准插件）完全脱钩。

10. **LuminaView 结构化渲染引擎 (Structured UI Engine) [NEW v5.3]**
    - **双模式 DSL 解析**：支持高级函数式语法（如 `Stat()`）与极简管道语法（如 `C|`），针对大模型输出进行极致 Token 压缩。
    - **组件化渲染管线**：消息不再是纯文本，而是一个有序的组件流（TextBlock, StatBlock, ChoiceBlock 等）。
    - **展示层标签隔离**：引入 `<V>` 标签作为 UI 容器，通过 `Presentational` 生命周期将其从文本过滤规则中隔离，确保渲染完整性。
    - **交互行为可配置 (Configurable Interaction) [NEW v5.8.3]**：支持在“直接发送”与“填充输入框”模式间切换，赋予用户对 AI 建议选项的二次确认权。
    - **动态频率与物理隔离 (Dynamic Frequency & Physical Isolation) [NEW v5.8.3]**：通过系统提示词注入 5 档频率权重（关闭、极低、适中、频繁、总是）。在“关闭”状态下，系统执行“物理隔离”策略，彻底剔除所有 UI 渲染协议、元数据及相关 XML 标签说明，确保 AI 无法感应相关功能。
    - **上下文化 Prompt 协议边界 [NEW v6.0-dev]**：提示词片段与 XML 协议不再默认视为“主聊天全局通用”，而是按 `chat / forge / director / shared` 上下文构建。Forge 在拼 Prompt 时只读取 Forge 与 shared 片段，避免主聊天协议外溢到制卡流程。

11. **流式平滑显示系统 (Streaming UX) [NEW v5.3]**
    - **双层缓存输出**：将流式输出拆分为 `Confirmed`（已确认文本）与 `Pending`（本帧新增文本），解决流式更新时的闪烁问题。
    - **多样化视觉效果**：支持 `fade-in`（淡入）、`gpt-style`（渐变显现）及 `typewriter`（带光标打字机）等多种流式动画模式。

12. **多端解耦与宿主中立架构 (Host-Agnostic Infrastructure) [NEW v6.0]**
    - **战略目标**：解决 LuminaWeave 移动端（Android）发布的通信壁垒。在移动端环境下，浏览器跨域限制与后端服务的本地暴露方式与桌面端完全不同，必须实现逻辑与传输的彻底解耦。
    - **逻辑同构化 (Isomorphic Core) [NEW v6.0]**：将同步差异比对 (`SyncEngine`) 与事务序列管理 (`TransactionEngine`) 算法从前端扩展层下沉至 `luminaweave-extension/shared/` 共享层。
      - **算法一致性**：确保前端（JS）、后端（Node.js）或原生 Bridge 按照完全相同的逻辑判定消息一致性。
      - **后端无关性 (Backend-Agnostic)**：前端 Manager 层不再感知具体的后端类型，而是通过注入不同的 Bridge 实现来完成物理写入，核心状态机始终由共享引擎维护。
    - **Bridge 适配层**：定义一套抽象的“服务桥接器”接口。前端业务代码（同步、生成、持久化）只调用桥接器，不再感知底层是 `HTTP/SSE` 还是 `Tauri/Native Invoke`。
    - **透明式 Android 适配**：通过 `TauriBridgeAdapter` 自动对接 Android 底层通信协议。新版适配层优先调用官方 `api.extension.store` ABI，并支持符合官方规范 `[A-Za-z0-9_.-]` 的 Key 命名空间，使插件在无需修改业务逻辑的前提下，即可在 TauriTavern 等原生容器中流畅运行并享受原生拦截带来的稳定性。
    - **鲁棒性对冲**：即使在标准 Web 环境下，Bridge 模式也提供了更强的 CSRF 容错与流式重连能力，显著提升了生产环境下的稳定性。

## 三、用户界面体验（UI/UX）

LuminaWeave 采用现代化极客风格，以 **Lumina Blue (幻光蓝)** 为核心品牌色，提供两种交互形态：

- **沉浸伴随态（Sidebar/Split-Pane Mode）**：通过顶部状态栏和侧边小窗时间线实现无感伴随。
- **全景掌控态（Full-Canvas Expanded Mode）**：完整接管主界面，左侧聊天流 + 右侧插件操作区 + Quick Chat 悬浮输入窗。
- **传统桌面（Traditional Desktop）[UPDATED v6.0-dev]**：在桌面端保持顶部主导航 + 主内容区 + 辅助右栏；在移动端，原“小窗 / 辅助窗口”统一改为临时标签页打开，避免窄视口下的双栏挤压。
- **自由工作台（Stage Manager Workspace）[NEW v6.0-dev]**：自由工作台不再只是横向多窗，而是向 iPadOS 台前调度收敛。当前舞台支持窗口自由拖拽、二维调整大小、窗口覆盖、前台聚焦置顶，以及更明确的窗口进场 / 关闭过渡与细微阻尼收尾动画；窗口只受舞台边界约束，不再执行边缘磁吸。左侧最近舞台组（Stage Strip）与底部 Dock 默认不常驻，改为条件触发或手动展开。移动端下窗口默认更接近全幅工作卡片，顶部拖拽区域与底部切换横条按触控手势优化。关闭全部窗口后保持空舞台而不是自动弹出启动台。
- **桌面模式（Desktop Mode）[UPDATED v6.0-dev]**：前端主题已从“全局浅深色 + 局部聊天配色”演进为平台级桌面模式。当前用户态采用单轴模型，正式主状态为 `activeDesktopMode`；`traditional / freeform` 仅作为桌面模式内部的壳层种类。桌面模式通过 `shell.kind + navigation preset + surface preset` 决定整套工作方式、导航结构、主区与辅助区承载方式，`design tokens`、`surface skins` 与受控 `renderer variants` 仅作为表层落地层。桌面模式不得越权修改核心会话状态机、同步协议与持久化逻辑。`Discord`、`Telegram` 与 `传统桌面`、`自由工作台` 同级；其中 Discord 接管频道式聊天主区与角色轨，Telegram 接管 Liquid Glass 三栏、气泡聊天、会话资料页与移动端四项底栏。长期设计文档分为全局 Core Design Spec 与每个桌面模式的完整 Desktop Design Language，允许未来 M3 Expressive 等强个性化主题在共同 token 契约上表达独立视觉。
- **Telegram 上下文工具约束 [UPDATED v6.0-dev]**：Telegram 桌面端以聊天列表 / 会话 / 资料页三栏为默认信息架构，移动端底栏只暴露 `对话 / 角色 / 设置 / 个人资料` 四项。Timeline、Lorebook、Memory、Director、Stats 等依赖聊天数据的官方组件不进入 Telegram 主导航，而是作为聊天顶部更多菜单、composer 工具菜单或当前角色/会话资料页下的上下文工具出现。资料页只读现有插件 store / conversation context 派生摘要，点击入口打开既有插件面板，不在资料页内嵌重型编辑器。移动端上下文插件通过 Telegram tab stack 的工具页或 `mobile-widget:*` 临时页打开，采用单列、全宽、触控优先布局；Timeline 在 Telegram 移动端默认展示纵向节点列表而不是复杂画布。
- **Discord 角色频道直建对话 [NEW v6.0-dev]**：Discord 角色频道的每个角色分组都支持直接新建对话，而不是仅打开已有历史。桌面侧栏与移动端角色 sheet 复用同一交互；创建成功后系统立即切入该角色的新空聊天，并把空会话写入统一 `ConversationDocument`，确保角色频道、会话索引与世界线视图能马上识别这段新对话。
- **Discord 角色频道历史会话管理 [NEW v6.0-dev]**：当角色历史会话较多时，角色频道默认只展示最近几条，并提供“查看更多 / 收起”以控制侧栏长度。每条历史会话还支持直接重命名和删除，且这些动作继续走统一 `ConversationService` 收口，同步更新宿主 chat 文件、统一会话索引与 `ConversationDocument` 持久化状态。
- **Discord 角色频道宿主接口分层 [UPDATED v6.0-dev]**：角色频道不再把宿主数据读取、角色分组拼装与 UI 展示混在同一层；前端开始以 `CharacterChannelService` 作为角色频道的意图/状态中枢，并通过 `ChatSessionDirectoryPort + ChatHistoryAccessPort` 分离“会话管理能力”与“宿主读取能力”。当前会话读取与管理都统一回退到 ST/Helper 路径，原生宿主读取 ABI 暂时不启用，但接口边界保留不变。
- **Forge 工作台态（Forge Workspace Mode）[UPDATED v6.0-dev]**：制卡主界面进一步向 Codex 风格工作台靠拢，但前台结构已按宿主模式分流：
  - 自由工作台：Forge 使用“主对话窗 + 辅助区双态”。同一工作会话可在 `内嵌右栏` 与 `拆出小窗` 之间切换，并记住上次选择；拆出态下 `虚拟世界书 / 记忆管理 / 审阅中心 / 导出发布 / 后置轨` 作为独立 workspace window 打开，再次点击同类入口只做聚焦，不重复建窗。
  - 传统桌面：不在全局 Shell 漂浮 Forge 小窗，只在 Forge 前台内部显示辅助面板切换条；同一时刻只显示一个同级辅助区。
  - 启动阶段提供模式选择，工作阶段以 Forge 专属 `<V>` 组件直接在消息流中承载表单、摘要卡和层导航；拆出态下主聊天区取消内部 hero/topbar 与额外外边距，原顶部操作迁移到 workspace window 顶栏，审阅、导出和后置轨转入独立辅助区承载。
- **全局会话查看上下文 [NEW v6.0-dev]**：消息型官方子插件开始共享一个全局会话上下文切换入口，默认放在主 Shell Header。Timeline、Lorebook、Memory 视图等默认跟随当前查看上下文；Forge 的“参考聊天绑定”继续保留为工作会话自身属性，不与全局查看上下文混淆。
- **统一会话世界线 API [UPDATED v6.0-dev]**：全局查看上下文不再主要由前端 store/UI 自行拼装，而是下沉为底层 `ConversationService + ConversationSourceAdapter`。`chat` 与 `forge` 统一暴露 `context/session/messages/timelineGraph/focusedMessage` 查询接口，以及 `switch / branch / rollback` 世界线命令。旧 `getChat / getTimelineNodes / branchFromNode / rollbackFromNode` 等 chat-only facade 已移除，主聊天专属调用必须显式传 `sourceId: 'chat'`。

## 四、开发状态与风险评估

### 已完成阶段（v5.3）

- **Lumina Core 微内核架构**：`PluginManager` 驱动，影子数据库与 ST `window.chat` 完全切割。
- **高性能解析引擎 (Refactored Interceptor)**：从正则迁移至 `TagTokenizer` 栈式解析，支持嵌套标签与 `Presentational` 生命周期。
- **结构化 UI 系统 (LuminaView)**：实现了 DSL 解析、组件注册中心及消息流式渲染器。
- **流式 UX 增强**：支持平滑文本输出与 CSS 动画。
- **Chat 发送流（Vercel AI SDK 迁移）**：
  - `sendMessage()` → `triggerGenerate()`。
  - **拦截阶段**：利用 `probePrompt()` 截获 ST 组装的完整消息载荷（含世界书、宏等）。
  - **生成阶段**：`llmEngine.generateStream(promptPayload)` 通过后端 `/nexus/generate-sse` 提供的原生 SSE 流接收增量消息；后端统一使用 **Vercel AI SDK** 并以 `text/event-stream` 推送到前端。
  - **Nexus 路由**：支持根据 Nexus 节点配置动态切换 Provider。
  - **终态感知与断线恢复**：后端自动关联 `AbortController` 并在 `req.on('close')` 时中止生成。支持 `generationId` 级别的 SSE 续传与状态轮询，确保在页面刷新后仍能对齐生成进度。
  - **流式过滤稳定化 [NEW]**：过滤模式下统一以原始 XML 缓冲派生显示文本、状态文本与已过滤字数，显著降低状态抖动、过滤闪烁与后台恢复后的错乱。
- **消息存储分离**：每条消息存储 `mesRaw`（原始文本）和 `mes`（ST 正则处理后的显示文本），`crudChatRecord` 统一调用 `applySTRegex()` 处理。
| 字段 | 含义 | 用途 |
|---|---|---|
| `pluginRaw` | 完整原始 LLM 响应 | **(权威源)** 包含 XML 标签的原始输出，作为提取数据的最高级事实来源。 |
| `mesRaw` | 提取后的干净对话文本 | **(内容源)** 经清洗后的纯文本内容。指纹计算的核心输入，用于多端同步比对。 |
| `mesST` | ST 同步专用展示文本 | **(同步输出)** 加上 DCC 压缩/摘要后的写入内容。ST 侧最终看到的文本。 |
| `fingerprint` | 内容指纹 | **(逻辑主键)** 基于 `mesRaw` 计算。用于判定内容是否发生实质变更，驱动缓存刷新。 |
| `mes` | 插件展示文本 | **(派生/呈现)** 基于 `mesRaw` 自动生成的本地 UI 展示文本。 |
| `thinkingText` | 独立思维链文本 | **(本地派生)** 从 `pluginRaw` 中的 `<thinking>` / `<think>` 提取，仅供 Lumina 本地折叠视图显示，不写回 ST，也不参与后续 Prompt 回注。 |

- **统一 XML 标签注册源 [NEW v6.0-dev]**：
  - XML 标签的 canonical 名称、别名、生命周期、状态文案与协议展示不再分散定义。
  - 系统引入独立 `XMLTagRegistry` 作为元数据真相源；插件仍可动态注册自己的标签和别名，再单独挂载处理器，实现“统一协议 + 灵活动态扩展”。
- **统一思维链协议与共用视图 [NEW v6.0-dev]**：
  - `thinking` 成为唯一 canonical 标签名，`think` 仅作为兼容别名。
  - 聊天与 Forge 共用一套折叠式思维链视图；显示开关为全局设置，支持 `hidden` 与 `collapsible`。
  - 默认行为更新为：仅在流式思考且正文尚未出现时自动展开；一旦正文文本或 `<V>` 可见内容出现即自动收起，并保留用户手动重新展开的能力。

`WorldlineStore` 写入时，系统会自动启动 **归一化同步管道 (Normalization Pipeline)**：
- 对于 AI 消息，优先从 `pluginRaw` 提取内容，强制纠正 `mesRaw` 和指纹。
- **自动纠偏**：任何缺失计算字段（如指纹、呈现文本）的消息在存入 Store 时都会被自动补全。
- **流式优化**：针对 `streaming` 消息执行“静默更新”，跳过高频哈希计算以响应性能需求。
  - **数据源绑定**：AI 消息渲染优先绑定 `pluginRaw`，确保包含生命周期标签的完整内容流入渲染器。
- **消息动作增强 (v4.3 Native 改版)**：
  - 支持用户消息 and AI 消息的内联编辑与删除。
  - **编辑重塑**：从“对象重建同步”方案切换至“原生原地修改 (In-place Edit)”。直接操作 `getContext().chat` 中的原始对象引用，严格保留 `swipe_id` 和 `swipes_info` 等所有 ST 隐藏元数据。
  - **同步重载**：编辑后调用官方 `saveChat()` 触发磁盘写入，优先调用 TavernHelper `builtin.reloadAndRenderChatWithoutEvents()` 触发安全的 UI 强制重绘，避免状态丢失风险。
  - **中断收尾与去重对齐 [NEW]**：主动停止生成时改为“先同步后收尾”，并将终态标记为 `aborted` 反馈前端；命中已有子节点时不再向 ST 追加重复消息，改为切换活跃节点并回写当前链路，避免重复用户节点与世界线错位。
- **全量对话感应同步**：`LuminaWeaveAPI` 实时监听 ST `chat_id_changed`、`CHARACTER_SELECTED` 等事件，支持多会话/多角色无缝切换。
- **字段深度精简**：实施去重算法，剔除 `mesRaw` 与 `mes` 的副本以及冗余的 `send_date` 和 `swipes`，文件体积减少 30%-60%。(v4.9.4 新增 `characterId` 字段以增强角色溯源)。
- **增量追加 (Incremental Append)**：支持消息即时上云，无需全量重传，大幅降低大规模对话时的 API 负载。 (基于 `/chat/append` 接口)。
- **智能跟随滚动 (v4.1)**：生成过程中识别用户位置，向上翻阅时自动“锁定视角”，防止内容闪跳。
- **构建优化 [UPDATED]**：前端扩展已从库模式单文件输出切换为 Vite/Rolldown ESM 多 chunk 分发。`dist/index.js` 作为入口继续由 `manifest.json` 加载，`dist/style.css` 保持固定样式输出，Forge workflow、Local Nexus、Timeline 大画布、Forge 专属块组件和部分设置/资料/工具 surface 通过异步 chunk 按需加载。发布、同步和安装必须携带完整 `dist/` 目录；本地通过 `npm run analyze` 生成 `dist/bundle-report.html` 追踪入口包、第三方 vendor 与大画布 chunk 的体积来源。
- **初始化导入守卫与单飞锁 (v5.8.2) & 冷启动激活优化 (v6.0)**：`LuminaWeaveAPI.init()` 增加 `_ready/_readyPromise/_probing` 防重入守卫；`syncFromST` 在初始化阶段采用非阻塞 `emit` 分离，配合 `ChatManager.activate()` 激活锁，彻底解决了初次加载时的“同步死锁”与冷启动日志爆炸问题。
- **混合同步与主动冲突冲突解决 (v4.6)**:
    - **数据优先级原则 (Data Priority)**: 明确以插件影子数据库为最高优先级。当插件首次介入时自动导入 ST 对话；当插件拥有数据时，以插件侧的数据为准尝试同步（覆盖）ST 对话。
    - **不可合并冲突嗅探**: 只有当 ST 侧与插件侧均存在各自独立生成的新节点（不可合并）时，系统才会触发冲突提醒弹窗，并将决议权交还用户。
    - **显式强覆盖条件收敛 (v5.8.2, Task5 更新)**: `forceOverwrite` 仅在两类场景触发：显式用户意图（`options.forceOverwrite=true` 或 `resolveIntent='st'`）与本地空池启动引导（`BOOTSTRAP_EMPTY_LOCAL`）。
    - **分歧决议策略 (Conflict Resolution Policy) [v6.0 完善]**: 
      - **通知并等待 (Notify and Wait)**：命中 `hasDivergence` 时触发 `CHAT_CONFLICT` 信号并中断物理同步，将决议权完全交还用户，严禁在未确认前执行不可逆覆盖。
      - **增量后代跟随 (Incremental Descendant Following)**：在 `Lumina-First` 模式下，若 ST 侧新节点是当前活跃指针的直接后代（如生成追加），系统会自动跟随刷新，保障操作连贯性。
- **解耦式同步引擎与插件化视图路由 (v4.7)**:
    - **MVVM 单向数据流**: UI 视图层（如时间线、冲突比对组件）仅做数据渲染与动作意图（Intent）分发。所有的业务同步决策、网络请求、独立存储回写，被彻底下放至底层的 `ChatManager` 与 `STSyncService`。
    - **st-adapter 命名空间 (ST Adapter Layer)**: 将 ST 环境交互、消息协议转换与指纹口径收敛为稳定边界：
      - `STProtocol` 统一文本清洗与双指纹（`fingerprint`/`stFingerprint`）生成，并提供 ST ↔ Lumina、Storage 序列化互转；
      - `STClient` 负责与 SillyTavern/TavernHelper 的物理 I/O；
      - `STAdapter` 对业务层暴露 `compareStates/applyDelta/getSnapshot` 等高阶同步门面。
      以后“需要对比什么/怎么对比”只需调整 `STProtocol`，避免业务层散落口径。
- **Dynamic Panel API**: 重构 `LuminaWeaveAPI`，支持 `registerPanel` 机制。插件可动态注册视图组件并由系统统一调度展示模式 (Modal/Tab)。
- **世界线多会话切换 [NEW v6.0-dev]**：`useTimelineStore` 开始支持在主聊天与 Forge 会话之间切换数据源。时间线面板不再默认只服务 ST 主对话，而是逐步演进为统一的多会话世界线浏览器。
- **多聊天独立存储视图优先 [UPDATED v6.0-dev]**：当全局查看上下文切到非当前 ST 活跃聊天时，系统默认从 Lumina 独立存储读取并操作对应世界线；仅当前 ST 活跃聊天继续参与宿主物理同步，避免“查看其它聊天”强制驱动宿主切换。
- **原始数据优先策略**: 确保数据回传至独立存储或写回 ST 时，始终保留最完整的原始输出流。
- **物理回滚与图谱同步策略 (v5.0)**:
    - **数据模型演进**：`localChatData` 角色转变为“节点池”，通过 `parentId` 链接形成树图。
- **非侵入式提示词注入重构 (v5.6) [NEW]**:
  - **拟态虚拟世界书 (Mimic Virtual Lorebook)**: 插件定义了一套独立于 ST 的“虚拟世界书”逻辑，ST 仅作为最终渲染同步的输出目标（书籍名称可配置，默认 `LuminaWeave_System`）。如果该书在 ST 中不存在则自动创建，插件内部状态是提示词的唯一事实来源。
  - **动态宏注入管道**: 针对如 `<Next_Plan>` 等短效指令，改用解析替换预设中的占位符 (`{{lumina_xxx}}`)。
  - **插件颗粒度授权**: 设置中暴露各子系统对于主提示词的注入权限，保障数据安全感。
    - **活跃路径溯源**：`TimelineManager.getTrace(activeLeafId)` 负责从池中动态计算出当前的线性对话流，供 ST 同步使用。
    - **节点合并算法**：`SyncEngine.mergeNodePool` 确保从 ST 读取新消息时，能正确识别重复节点并链入新分支。
    - **增量追加与生成同步 (Incremental Append & Generation Sync) [v6.0 增强]**：
    - **内存先行策略 (Memory-First)**：后端读写优先操作内存缓存。所有查询接口（GET /chat）实时反映未落盘的内存变更。
- **统一会话文件落盘 [UPDATED v6.0-dev]**：会话主数据改为单文件 `ConversationDocument` 落盘，主聊天与 Forge 共享同一物理契约；事务日志继续独立写入 `.tx.jsonl`，用于序列对账与回滚。
    - **事务日志同步**：生成收口时强制触发事务日志刷盘，确保 `committed` 状态的物理不可逆性。
- **节点化统一会话持久化 [UPDATED v6.0-dev]**：节点仍是一条消息一个事实单元，但外层容器已从 `metadata-first JSONL` 收敛为 `ConversationDocument`。`activeLeafId`、插件数据与事务游标直接进入文档字段，前端不再消费原始 JSONL 结构。
- **强一致性同步**：分支跳转后自动触发 `SyncEngine.applyDelta`，将 ST 的线性视图物理同步至当前活跃链路，解决回滚后输入乱序的顽疾。
- **持久化锚定机制 (v5.2)**：重构 `PersistenceService` 与 `ChatManager` 的保存链路。异步 IO 操作强制绑定到发起时的 `chatId`（ID 锚定），从架构层面消除由于 SillyTavern 会话快速切换导致的竞态覆盖风险。
- **事务化写入协议 (v5.8) [NEW]**：`/chat/save` 与 `/chat/:chatId(PATCH)` 引入事务实体（`id/seq/status/scope/payloadDigest/error`），统一走 `pending → running → committed|aborted|rolled_back` 状态机。
- **幂等与序列防冲突 (v5.8) [NEW]**：前端写入请求携带 `idempotencyKey + expectedSeq`；后端基于事务日志执行幂等重放，并在序列不连续时返回 `TXN_SEQUENCE_CONFLICT`，阻断过期写入覆盖。
- **事务序列持久化 (v5.8) [NEW]**：独立存储 `metadata.transaction.lastCommittedSeq` 与 `lastTransactionId`，用于刷新重连后的写入对账。
- **事务查询/回滚与重连补偿 (v5.8.1) [NEW]**：新增事务查询与回滚接口，支持 `afterSeq` 拉取未确认事务；前端在重连后命中序列冲突时执行“按序列拉取增量事务 → 回滚同幂等键悬挂事务（pending/running）→ 按新序列重试一次写入”，并将流式重连从本地长度进度推断切换为后端缓冲对账。
- **写回来源标记防回灌 (v5.8.2) [NEW]**：`SyncEngine.applyDelta` 在写入 ST 的 `extra` 中注入 `_lw_sync_source/_lw_sync_ts/_lw_sync_chat_id`；回读时在可配置时间窗内识别 Lumina 写回消息并抑制反向再导入，阻断“写回→监听→再写回”的回灌环。
- **防双节点与链路自愈 (v5.8.2) [NEW]**：ST 归一化阶段对稳定 ID 去重，增量同步阶段执行 `processedIds` 与 `fingerprint` 双重去重，并拦截自引 `parentId` 关联，避免同内容/同 ID 在同一链路重复成节点。
- **UI 跨设备自适应定位 (v5.2)**：针对移动端和 PC 端屏幕尺寸差异，在 `MiniSidebar` 中引入实时视口纠偏算法。读取持久化坐标时自动执行边界检测，确保悬浮组件始终在有效可视区域内，解决移动端“组件丢失”问题。
- **极致轻量且高度兼容**：成功从过时的 OpenAI-Edge 迁移至官方的 OpenAI SDK。
- **Shadow DOM 深度隔离 (v5.7)**：实现样式过滤算法，仅注入插件自身样式，解决 SillyTavern 全局样式对插件 UI 的负面覆盖。

### 待办与演进方向
- 持续引入 TavernHelper 事件与游戏数值联动。
- 实现后台状态增量补丁（Incremental Patch）逻辑及 UI 高亮。
- 补齐记忆提取网络与视图编排（Lumina Memory Engine）。
- **Lumina Director 编排面板落地**：实现可视化连线节点，让用户自由定义双轨分流触发器（Trigger）和 XML 解析器的加载机制。

