# LuminaWeave 产品需求文档 (PDR)

**版本:** v6.1-docs
**最后更新时间:** 2026-06-12

本文记录 LuminaWeave 长期有效的产品目标、核心能力和边界。阶段性执行记录进入 `docs/current/tasks/`，已完成任务归档到 `docs/archive/completed-tasks/`。

## 1. 产品定位

LuminaWeave（幻光织机）是运行在 SillyTavern 生态上的增强框架与综合交互操作平台。它不是单纯的 UI 插件，而是试图在宿主兼容的前提下，逐步接管聊天生成、Prompt 组装、同步、世界线、资源、工作区和 Agent 协作链路。

核心价值：

- 降低 SillyTavern 多插件堆叠带来的操作复杂度和状态漂移。
- 让对话历史从单向线性记录升级为可回滚、可分支、可追溯的世界线。
- 让 Prompt、世界书、角色卡、记忆、Forge 项目资源等生成输入可解释、可审阅、可复用。
- 让插件 UI、桌面模式和宿主适配保持隔离，避免业务逻辑散落到具体壳层或宿主全局对象中。

## 2. 用户与场景

### 主要用户

- SillyTavern 角色扮演用户。
- 长线剧情、跑团、世界观创作用户。
- 需要制卡、世界书整理和记忆维护的创作者。
- 需要调试 Prompt、同步、资源和生成链路的高级用户或开发者。

### 核心场景

- 在 ST 插件形态下增强聊天、回滚、生成恢复和世界线管理。
- 在 TauriTavern / 移动端环境下获得一致的插件运行与存储体验。
- 使用 Forge 以 Agent 协作方式创建角色卡、世界书、项目记忆和草稿。
- 在不同桌面模式下切换工作方式，例如传统桌面、自由工作台、Discord、Telegram。
- 通过 Prompt Inspector、来源 trace、VFS 和终端工具审阅生成输入与资源来源。

## 3. 产品原则

### 深度接管

LuminaWeave 应逐步接管生成前后的关键链路：Prompt 组装、世界书触发、流式生成、生成恢复、消息归一化、事务写入和同步回写。

### 绝对隔离

宿主、核心、插件、桌面模式、surface renderer 和存储层必须保持清晰边界。插件 UI 不应直接穿透同步、存储、Prompt 或宿主物理 I/O。

### 可追溯

Prompt、资源、记忆、世界线和事务必须保留来源信息。系统应能回答“这段生成输入来自哪里、经过了哪些变换、为什么被保留或裁剪”。

### 最小正确

新能力优先走现有分层：插件注册、Core API、HAL、shared 协议、store/UI 接入。避免用临时分支、局部兜底或 UI 内补丁绕开结构性问题。

## 4. 核心能力

### 4.1 Chat

Chat 是主消息体验和生成入口。

应提供：

- 消息流展示、流式状态和生成恢复。
- 用户消息、AI 消息的编辑、删除、重生成和停止。
- Prompt Inspector 与来源/合并视图。
- ST 当前聊天与 Lumina 独立存储之间的同步、冲突提示和世界线对齐。
- XML / LuminaView 标签渲染、思维链折叠和交互块展示。

边界：

- UI 只发出意图并消费状态，不直接判定同步或写入存储。
- 主聊天专属调用应显式传入 `sourceId: 'chat'`。

### 4.2 Timeline

Timeline 将聊天历史展示为可浏览、可回滚、可分支的世界线。

应提供：

- 多分支图谱和当前活跃链路。
- 从任意节点切换、分支、回滚。
- 支持主聊天和 Forge 等多会话来源。
- 与底层 Conversation Service 的世界线命令保持一致。

边界：

- Timeline 不拥有消息事实源。
- Timeline 不绕过 Conversation Service 直接操作 ST 或持久化文件。

### 4.3 Director / Memory

Director 负责剧情推演、上下文压缩、记忆整理和提示词注入策略。

应提供：

- 动态上下文压缩（DCC）。
- 剧情摘要和记忆提取。
- 可控的提示词注入与频率策略。
- 与 Chat、Forge 和 Prompt Assembly 的共享上下文。

边界：

- Director 产生的记忆或状态变更必须经过明确的存储/事务边界。
- 思维链或内部分析默认不写回 ST，也不参与后续 Prompt 回注，除非有明确协议。

### 4.4 Agent Runtime SDK

Agent Runtime SDK 是 Core API 层的跨插件 agent kernel，目标是从 Forge 当前 pi-style runtime 中抽取可复用运行能力，让 Forge 以外的子插件也可以组合自己的 agent，并用统一 test harness 验证 prompt、skill、tool、VFS、approval、trace 与 session tree 行为。

当前第一阶段代码入口位于 `luminaweave-extension/src/api/core/agent-runtime/`。Forge 通过 adapter 复用 SDK 的 runtime/session/tool/skill 边界；SDK 已提供 `AgentRuntimeEventBus`、`AgentRuntimeExtensionRunner`、可选 `workspace-tools/AgentWorkspaceTools` 与 `JustBashWorkspaceAdapter` 初始实现，`ForgePiCoreRuntime` 已可暴露 SDK runtime snapshot/events；Forge adapter 通过 typed runtime effect 把 snapshot 投影到 Forge store、模型请求 trace 和 Inspector presentation，不让 SDK import Vue 或 Pinia；Forge wire shape、Semantic VFS、`workspace_patch` 和真实 ST 发布边界仍留在 Forge 域内。

应提供：

- Agent turn 生命周期：run、continue、abort、preview。
- Agent runtime event 与 snapshot：message stream、thinking block、tool execution partial/final result、queue update、agent end cleanup，以及 `isStreaming`、`streamingMessage`、`pendingToolCalls`、`messages`、`errorMessage` 等可投影状态。
- Adapter UI projection：SDK 只输出可序列化 snapshot/events；Forge 等 adapter 负责将其写入本域 store、模型请求 trace、消息/工具摘要和项目面板 presentation。
- Tree-structured session history：append-only entries、active node、branch checkout、branch messages。
- 结构化 Agent 消息投影：SDK 的 session/event/projection 边界应能承载 adapter 定义的公开执行说明、工具记录、最终回复和审计引用；具体 prompt 语法、文件审计格式和 UI 展示仍由 adapter 定义。
- Prompt Preview 事实源：真实生成与 dry-run 必须使用同一个 prompt assembly 端口；同一 request 可通过 adapter 提供的 cache key 复用 prepared prompt object，并在真实 turn 消费后显式失效。Extension workflow 注入的 hidden context、active tools summary、skill catalog、branch messages 与本轮 user message 必须先进入 preview / `prompt_ready` payload；真实 run 的 agent initial state 不重复注入本轮 user message，由 `agent.prompt()` 注入。
- Model provider、tool provider、approval、trace/effect、session store 和 test harness 端口；`AgentToolRegistry` 可选接入 runtime event bus，把手动注册工具的执行投影为 `tool_execution_start` / `tool_execution_update` / `tool_execution_end`；test harness 应提供 mock model、mock tool、mock session store、mock approval 与 mock VFS，便于非 Forge adapter 验证。
- Agent Skills 规格兼容：以 `SKILL.md` 为兼容目标，解析并校验标准 frontmatter，输出 diagnostics，并格式化 skill catalog；`name`、`description`、`compatibility`、`metadata` 与 `allowed-tools` 按 Agent Skills 规格处理。
- Extension workflow 接入：由 adapter / 代码配置显式传入 extension factories 或 resolved extension paths；扩展可以注册 event handler、custom tool、custom message、resource discovery hook、provider、status/widget projection，但必须经过 SDK tool registry、Prompt Preview、approval、audit 和 trace 边界。
- Agent-visible VFS 接入：通过 FS template、mount metadata、mount policy、approval hook、audit hook 和 trace hook 接入多个 VFS mount；第一阶段直接接入 OpenFS 能力层，shell mount dispatch 优先交给 OpenFS / just-bash；copy/move 等写入类操作同样必须进入 audit hook。
- Workspace Tools Kit：作为可选工具包提供 pi-style 短名 `read`、`write`、`edit`、`delete`、`bash`，并可补充只读 `grep`、`find`、`ls`、`search`；底层 I/O 必须通过 OpenFS / just-bash 或 adapter operations 注入。
- Research Tools Kit：作为可选工具包提供 `webResearch` 工具工厂和 `AgentResearchProvider` 端口；第一版 provider 为 Tavily search / extract 适配，浏览器运行时不静态导入 Tavily AI SDK，避免把 Node proxy 依赖带入扩展启动路径。后续 Parallel / Exa 通过同一端口接入。

边界：

- Core SDK 不拥有 Forge Semantic VFS、Forge prompt 路径、`workspace_patch` 格式、ST 世界书发布边界或 Vue UI。
- Core SDK 不默认暴露文件读写工具，不默认创建或注册 `bash` tool。
- Core SDK 不默认暴露联网 research 工具；接入方必须显式配置 provider 和凭据后注册。
- Core SDK 不默认提供 skill activation tool；默认 skill 使用路径与 pi 一致，即代码提供 skill catalog 和 `SKILL.md` 路径，模型通过 `read` 按需读取完整 `SKILL.md`。
- Core SDK 不根据 skill 的 `allowed-tools` 自动授予权限。
- Core SDK 不扫描项目目录或用户目录；prompt、skill 和业务上下文必须由 adapter 或可选 kit 通过 VFS source 提供。
- Core SDK 不自动加载 VFS 中的 TypeScript / JavaScript 扩展代码。
- Core SDK 不内置 Plan Mode、Planner / Executor 阶段语义或最终汇报协议；规划、执行、审阅和汇报由 adapter / extension workflow 通过 hook、custom context、custom message、status/widget 和 continuation trigger 组合。
- Core SDK 不规定 Forge `<process>` / `<final>` prompt 协议；它只提供可复用的 session、event、trace、tool 和测试边界。
- Core SDK 不把 thinking 写入默认业务状态；thinking 只作为 assistant message stream block、trace 和 UI projection 输入。
- 非写入阶段不得暴露写工具，也不得暴露可写 bash。
- 写入审计由具体 write adapter 负责；Forge adapter 的审计产物继续是 `workspace_patch`。

### 4.5 Forge

Forge 是制卡工坊和 Agent 工作台。

[Forge 文档索引](./modules/forge/index.md)

应提供：

- 以 `forgeProjectId` 为长期容器的项目模型。
  - 多协作线程共享同一项目资源、项目记忆、草稿和文件版本审计记录。
- Planner / Analyst / Executor 等分工明确的 Agent 流程。
  - Forge 是 Agent Runtime SDK 的第一套 adapter；当前主链路仍由 `src/api/core/forge/agent-app` 承载，并由 Forge browser adapters 维护 tree-structured session history、上下文包、技能/能力资源、工具桥接、direct workspace patch 审计和真实 ST 发布边界。
- Forge Agent 使用项目相对语义 VFS：`./AGENTS.md` 是 Agent 工作契约，不是系统提示词；默认系统提示词位于 `./.forge/agent/SYSTEM.md`，模式提示词位于 `./.forge/agent/<MODE>.md`，Forge `<V>` DSL 位于 `./.forge/agent/UI_DSL.md`，可见推理边界位于 `./.forge/agent/REASONING.md`，技能位于 `./agent/skills/<skill-name>/SKILL.md`，当前协作线程通过 `./threads/目前/thread.md` 与 `./threads/目前/messages.md` 动态访问。
- Forge 预设提供 Agent 资源包与提示词编排，而不是面向模型暴露 slot 拼接概念；编排顺序固定为 Contract、System、Mode Prompt、UI DSL、Reasoning Boundary、Skills、Capabilities、Memory Index、Context Files、Branch Messages。默认主预设提供参考提炼类 preset skills，默认按需加载，可在自定义预设中改为常驻；内置和默认 preset skill 资源必须以标准 `SKILL.md` frontmatter 暴露，供 SDK skill parser 校验与 catalog 格式化。
- Forge Agent 预设工作台是提示词与预设技能的默认维护入口：内置预设只读，自定义副本可编辑 Contract、System、Mode Prompt、技能名称/标题/说明/加载策略/正文和编排检查信息。
- 项目 VFS 面板浏览 Agent 可见的语义 VFS 投影，而不是 raw workspace storage 树；`./chat/<conversationId>`、`project.json`、`memory/tree.json`、`lorebook/entries/*.json`、`review/*.json` 等内部结构只作为映射源，不进入模型长期上下文。项目级 `./AGENTS.md`、`./.forge/agent/SYSTEM.md`、`./.forge/agent/<MODE>.md` 与 `./agent/skills/*/SKILL.md` 覆盖从这里写入项目 VFS，并生成 `workspace_patch` 审计，不回写 active preset 或 bundled fallback；`UI_DSL.md` 与 `REASONING.md` 仍是固定运行时资源。
- Forge `read`、Forge shell、Prompt/Skill loader 和项目 VFS 面板必须共用 Forge Semantic VFS provider；HAL Bash 只提供通用 mount 扩展，不理解 Forge 业务语义。
- Forge Agent 可在用户配置 `lumina-forge.tavilyApiKey` 后暴露 `webResearch`，通过 Tavily 执行 search / fetch 并返回 Markdown 和来源 metadata；该工具不写项目 VFS、不生成 `workspace_patch`、不写 memory，也不发布或改写 ST 资源。
- 制卡聊天内的 fork / 回滚 / 切换应基于同一协作线程内的 pi session tree 分支；Forge timeline 是用户可见投影，必须保留可操作的用户输入节点映射。
  - 项目文件和虚拟世界书的版本恢复由 Forge workspace version manager 生成反向或重放 `workspace_patch`，切换对话分支时默认询问用户是否同时恢复文件版本。
  - 虚拟世界书、Forge memory tree、draft tree、workspace patch 审计记录和发布/导出。
- Forge Agent 聊天记录、执行过程、最终回复、timeline 和文件版本投影必须以 `piSessionEntries + activePiNodeId` 为唯一事实源。模型通过 `<process>` 显式输出公开执行说明，通过 `<final>` 输出最终回复；`process` 持久化到 pi session tree，并允许以压缩执行记录进入下一轮上下文。文件版本仍以 active branch 的 `workspace_patch` / checkpoint history 为事实源，不能从 `process` 文案推断。
- Forge 专属 `<V>` 交互块由 `./.forge/agent/UI_DSL.md` 作为 pi prompt 固定资源承载；旧 `PromptBuilder` 不再作为 Forge Agent prompt 构建 API。

边界：

- Forge 默认写入项目 VFS，不静默改写真实 ST 世界书。
- 发布到 ST 或导出必须是用户确认后的后置动作。
  - Forge 项目资源写入走 direct workspace patch reducer 或 typed runtime effects；每次 AI 写入必须留下可撤回的 `workspace_patch`。
  - Agent Runtime SDK 只抽取通用 agent kernel；ST 宿主适配、Vue UI、Forge Semantic VFS、`workspace_patch` 审计和真实发布边界仍属于 LuminaWeave Forge adapter。

### 4.6 Resource / VFS / Terminal

Resource Domain 负责统一 ST、本地和未来订阅源等资源来源。VFS 是资源域的路径化视图。

应提供：

- 稳定 Resource Ref。
- `/sources/<sourceId>/...`、`/library/...`、`/workspaces/...` 路径视图。
- Forge Agent 语义 VFS 的 `./...` 是项目级视图；绝对 `/sources/...` 与 `/library/...` 仍可直通底层 Resource VFS。
- Forge 项目 VFS 浏览器应展示面向 Agent 的语义项目视图，并用 `./...` 形式隐藏内部项目 id、conversation id 和 raw storage 文件名；底层 `/workspaces/forge/<projectId>/...` 只由 Core/HAL 服务消费。
- HAL Bash 支持调用方注入额外挂载点；Agent Runtime SDK 的 FS template 与 policy wrapper 可把业务 VFS 包装成 OpenFS / just-bash 可访问文件系统。Forge 通过该机制把 semantic VFS 挂到 Agent shell 项目根；非 Forge shell 默认挂载行为不变。
- 只读浏览、搜索、读取和受控写入。
- 终端和 Agent shell 共用同一 Resource-backed FS、权限门和写入策略。
- 非写入阶段不暴露写工具，也不暴露可写 bash。
- 写入阶段通过 write adapter 检查 mount policy、phase、approval，并记录业务审计。

边界：

- VFS 不是第二份资源事实源。
- ST 或订阅源资源不得被静默改写。
- 外部资源编辑需要明确写回策略或 fork 到本地。

### 4.7 Desktop Modes / Surface Runtime

Desktop Modes 定义完整工作方式，不只是皮肤。

应提供：

- Traditional、Freeform、Discord、Telegram 等可替换壳层。
- 由 desktop mode 决定导航、surface 映射、交互策略和设计 tokens。
- `DesktopModeManifest` 是桌面模式的唯一公开事实源；Desktop Mode Runtime、设置详情、surface overrides 与 Activity placement 都应从该 manifest 派生运行时描述，不再维护并行的第二份公开 manifest。
- 当前早期阶段不保留旧 Theme Pack 兼容层；代码和 storage 统一使用 `activeDesktopMode` 与 `desktop-mode-*`，旧 `activeThemePack` / `theme-pack-*` 配置可直接失效。
- 插件通过 surface contract 暴露业务 renderer，桌面模式可以包裹、替换布局或提供 variant。
- 插件或业务组件通过 Activity LaunchIntent 启动页面，只声明目标、默认/小窗偏好、嵌套/独立页面和可选状态栏/标题栏/二级菜单 metadata；具体落到主区、右侧栏、临时移动页、Telegram 移动页面栈或自由工作台窗口，由 desktop mode 解析。

边界：

- 桌面模式不得越权修改会话状态机、同步协议、Prompt 或持久化逻辑。
- Surface renderer 只消费受控 state snapshot、intents 和 theme context。
- 业务组件不得直接把“大窗口/小窗口”绑定为具体容器；旧 `mode: large/small` 仅作为迁移期兼容输入。

### 4.8 Server

Server 是 SillyTavern server plugin 的后端补充能力。

应提供：

- 独立存储与本地数据目录支持。
- Nexus 生成代理、SSE 流式输出、生成状态查询和断线恢复。
- 后端 Storage、Streaming、Nexus 服务。

边界：

- `luminaweave-server/src/` 是源码。
- `luminaweave-server/index.js` 是构建产物。
- `luminaweave-server/data/` 禁止提交用户数据。

## 5. 数据与同步要求

LuminaWeave 的数据策略以可追溯和事务安全为核心。

长期要求：

- 会话主数据使用统一 `ConversationDocument`。
- 事务日志用于幂等、序列对账、回滚和重连补偿。
- AI 消息保留原始输出、清洗文本、ST 写回文本和指纹口径。
- 多源资源以 Resource Ref 绑定，不仅按名称绑定。
- 当前 ST 活跃聊天可参与物理同步；非当前 ST 活跃聊天默认走 Lumina 独立存储视图。

## 6. 运行形态

LuminaWeave 至少支持三类运行形态：

- SillyTavern 插件环境。
- TauriTavern / 原生宿主环境。
- Standalone / local fallback 路径。
- 普通 Tauri Android 客户端的 safe area 由 native bridge 提供：Android `WindowInsets` 的物理像素必须转换为 Web CSS px 后写入 `--lw-native-safe-*`，再归一化为不可覆盖的 `--lw-safe-*`。Root shell 以 full-bleed panel 背景和 `--lw-root-safe-*` padding 统一消费，并用 `--lw-content-safe-*` 表达子内容剩余可消费 safe-area，避免组件级状态栏补丁和重复 padding。
- Activity 可声明状态栏背景、图标颜色与 safe-area 所有权。状态栏背景由 root shell 的 edge-to-edge Web 层消费 `--lw-activity-statusbar-bg` 渲染，不作为 native Android 背景色 ABI；`iconColor: auto` 由 Desktop Mode Runtime 按当前外观解析：深色外观使用白色状态栏图标，浅色外观使用黑色状态栏图标；`light` / `dark` 可由页面手动覆盖。`safeArea: shell` 由 root shell 消费顶部状态栏区域，`safeArea: manual` 保留顶部 `--lw-content-safe-top` 给独立页面自行适配。Lumina 原生 Android 客户端通过 WebView JS bridge 只消费解析后的图标颜色；TauriTavern 不新增宿主 ABI，保持 safe-area / 背景消费，状态栏图标颜色在该宿主下为 no-op。
- Web / PWA fallback 路径只通过全局 `--lw-web-safe-* = env(safe-area-inset-*)` 暴露浏览器 safe-area；前端 `auto` 来源优先使用 native / TauriTavern host layout，只有宿主布局源不可用时才落到 Web safe-area 变量。

运行形态由 Runtime Host、host-drivers 与 HAL runtime ports 描述；资源来源由 Resource Source 描述。二者不应混为一谈。

当前 runtime port 模式：

- `st-plugin-enhanced`：SillyTavern 插件环境下的 HTTP 后端增强模式。
- `tauri-native`：TauriTavern / 原生宿主模式。
- `standalone-local`：无后端或无宿主增强能力时的本地 fallback。

## 7. 当前限制

- 项目仍处于快速演进阶段，插件 API、桌面模式 API 和存储结构仍可能破坏式调整。
- 群聊、前端卡、完整移动端体验、Forge 详细定制流程和部分附件能力仍未稳定。
- ST 原生合成与 Lumina 自合成的边界为：ST native 只作为绑定 ST 聊天时的聊天续写引擎；Forge、制卡、Agent 协作和插件内独立会话必须走 Lumina/HAL Prompt 合成。
- 文档仍在从阶段性记录向长期设计文档收敛。

## 8. 非目标

当前阶段不追求：

- 完全替代 SillyTavern。
- 对所有 ST 插件提供无差别兼容。
- 在 UI 层绕过 Core/HAL 快速堆功能。
- 为尚未落地的能力写成稳定公开承诺。

## 9. 文档维护

改动以下内容时必须同步更新本文或相邻文档：

- 产品定位和核心能力范围。
- 模块职责和用户可见行为。
- 运行形态或宿主支持边界。
- 数据与同步策略。
- 已公开承诺的限制或非目标。
