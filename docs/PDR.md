# LuminaWeave 产品需求文档 (PDR)

**版本:** v5.3-dev (Orchestration Refresh)
**最后更新时间:** 2026-04-01

## 一、产品定位

**LuminaWeave（幻光织机）** 是基于 SillyTavern (ST) 生态的下一代增强框架与综合交互操作平台。其核心目标是解决现存 ST 原生界面的多插件堆叠卡顿、聊天流单向不可逆（失忆、逻辑崩塌）等问题，致力于通过现代化 UI 与底层"全局状态重塑"，提供完美的跑团/角色扮演体验。

## 二、核心功能需求

系统由多个解耦的官方子插件构成，共同服务于沉浸式体验：

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
   - **消息范围控制 (Message Scope Control) [v5.8.2 增强]**：通过原生 `is_hidden` 实现非侵入管理，支持条数/Token/字符限制。引入条件化 UI 呈现与专用步进组件，提升配置精准度。
   - **剧情概况 (Story Summary)**：隐藏的消息由 AI 自动摘要并通过虚拟世界书注入补充。

3. **Lumina Forge（幻光工坊）**
   - 全屏高可用制卡器，对偏好与人设系统进行模块封装，实现"一键套用"和环境切换。

4. **Lumina Settings & Storage（统一设置与存储引擎）**
   - 彻底解耦的 Storage API，支持 `全局`、`随角色`、`随对话`、`临时会话` 等多级作用域。
   - **环境隔离层开关 [NEW]**：支持在设置中动态切换 Shadow DOM 开启/关闭状态，以适配不同浏览器扩展的兼容性需求。
   - **分离式模块配置原则**：`lumina-settings` 仅负责宿主级全局设置，各子插件通过 `settingsManifest`接口向设置总线动态渲染表单。

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

8. **Lumina Lorebook (世界书编辑器) [NEW]**
   - **可视化 Entries 管理**：在 Lumina 界面内直接进行关键词条目的增删改查。
   - **双向同步**：通过原生 API 代理实现 Lumina 编辑器与官方世界书面板的数据强一致性。

9. **全环境上下文适配层 (Cross-Context Adapter) [Standardized]**
    - **统一 API 探测器 (Unified API Discovery)**：引入 `LuminaWeaveAPIBase` 标准化 Getters。
    - **多路径路由机制**：
        - **核心上下文 (`this.ctx`)**：采用 `getContext() > Global` 优先级，动态获取聊天列表、角色及用户快照。
        - **事件源探测 (`stEventSource`)**：自动遍历 `Context > Main API > Window` 链路，定位标准的 EventEmitter 并排除 SSE 干扰。
        - **工具集接入 (`stHelper`)**：透明适配全局 `TavernHelper`，屏蔽不同部署环境导致的路径差异。
    - **平滑兼容**：确保插件逻辑与宿主运行模式（Iframe 嵌套 vs 标准插件）完全脱钩。

## 三、用户界面体验（UI/UX）

LuminaWeave 采用现代化极客风格，以 **Lumina Blue (幻光蓝)** 为核心品牌色，提供两种交互形态：

- **沉浸伴随态（Sidebar/Split-Pane Mode）**：通过顶部状态栏和侧边小窗时间线实现无感伴随。
- **全景掌控态（Full-Canvas Expanded Mode）**：完整接管主界面，左侧聊天流 + 右侧插件操作区 + Quick Chat 悬浮输入窗。

## 四、开发状态与风险评估

### 已完成阶段（v5.2）

- **Lumina Core 微内核架构**：`PluginManager` 驱动，影子数据库与 ST `window.chat` 完全切割。
- **Chat 发送流（OpenAI-Edge 重构）**：
  - `sendMessage()` → `triggerGenerate()`。
  - **拦截阶段**：利用 `probePrompt()` 截获 ST 组装的完整消息载荷（含世界书、宏等）。
  - **生成阶段**：`llmEngine.generateCustomStream(promptPayload)` 使用 **OpenAI-Edge** 库发起请求，通过手动解析 SSE 流实现极致轻量且高度兼容的生成体验。
  - **Nexus 路由**：支持根据 Nexus 节点配置动态切换 Provider。
  - **终态感知增强 [NEW]**：后端状态新增 `success | error | aborted`，并回传 `errorMessage`；前端据此区分成功收尾与异常结束，避免流式中途消失后无反馈。
  - **流式过滤稳定化 [NEW]**：过滤模式下统一以原始 XML 缓冲派生显示文本、状态文本与已过滤字数，显著降低状态抖动、过滤闪烁与后台恢复后的错乱。
- **消息存储分离**：每条消息存储 `mesRaw`（原始文本）和 `mes`（ST 正则处理后的显示文本），`crudChatRecord` 统一调用 `applySTRegex()` 处理。
  | 字段名 | 描述 | 用途 |
  |---|---|---|
  | `pluginRaw` | 完整原始 LLM 响应 | 支持跨生命周期的原始数据分析与再处理 |
  | `mesRaw` | 原始 AI 输出文本 | 编辑、重新计算正则 |
  | `mes` | ST 正则处理后的显示文本 | UI 展示 |
  | `characterId` | 所属角色 ID | 用于多角色/群组模式下的角色溯源 |
- **消息动作增强 (v4.3 Native 改版)**：
  - 支持用户消息 and AI 消息的内联编辑与删除。
  - **编辑重塑**：从“对象重建同步”方案切换至“原生原地修改 (In-place Edit)”。直接操作 `getContext().chat` 中的原始对象引用，严格保留 `swipe_id` 和 `swipes_info` 等所有 ST 隐藏元数据。
  - **同步重载**：编辑后调用官方 `saveChat()` 触发磁盘写入，优先调用 TavernHelper `builtin.reloadAndRenderChatWithoutEvents()` 触发安全的 UI 强制重绘，避免状态丢失风险。
  - **中断收尾与去重对齐 [NEW]**：主动停止生成时改为“先同步后收尾”，并将终态标记为 `aborted` 反馈前端；命中已有子节点时不再向 ST 追加重复消息，改为切换活跃节点并回写当前链路，避免重复用户节点与世界线错位。
- **全量对话感应同步**：`LuminaWeaveAPI` 实时监听 ST `chat_id_changed`、`CHARACTER_SELECTED` 等事件，支持多会话/多角色无缝切换。
- **字段深度精简**：实施去重算法，剔除 `mesRaw` 与 `mes` 的副本以及冗余的 `send_date` 和 `swipes`，文件体积减少 30%-60%。(v4.9.4 新增 `characterId` 字段以增强角色溯源)。
- **增量追加 (Incremental Append)**：支持消息即时上云，无需全量重传，大幅降低大规模对话时的 API 负载。 (基于 `/chat/append` 接口)。
- **智能跟随滚动 (v4.1)**：生成过程中识别用户位置，向上翻阅时自动“锁定视角”，防止内容闪跳。
- **构建优化**：重塑模块导入依赖树，彻底消除静态/动态混合导入导致的 Vite 编译路径警告。
- **初始化导入守卫与单飞锁 (v5.8.2) [NEW]**：`LuminaWeaveAPI.init()` 增加 `_ready/_readyPromise/_probing` 防重入守卫；`syncFromST` 在独立存储已成功恢复本地节点时跳过 ST 首次引导导入，避免“先恢复后被空覆盖”的初始化竞态。
- **混合同步与主动冲突冲突解决 (v4.6)**:
    - **数据优先级原则 (Data Priority)**: 明确以插件影子数据库为最高优先级。当插件首次介入时自动导入 ST 对话；当插件拥有数据时，以插件侧的数据为准尝试同步（覆盖）ST 对话。
    - **不可合并冲突嗅探**: 只有当 ST 侧与插件侧均存在各自独立生成的新节点（不可合并）时，系统才会触发冲突提醒弹窗，并将决议权交还用户。
    - **显式强覆盖条件收敛 (v5.8.2, Task5 更新)**: `forceOverwrite` 仅在两类场景触发：显式用户意图（`options.forceOverwrite=true` 或 `resolveIntent='st'`）与本地空池启动引导（`BOOTSTRAP_EMPTY_LOCAL`）；命中分歧时不再自动强覆盖，统一进入冲突提示与人工决议流程。
- **解耦式同步引擎与插件化视图路由 (v4.7)**:
    - **MVVM 单向数据流**: UI 视图层（如时间线、冲突比对组件）仅做数据渲染与动作意图（Intent）分发。所有的业务同步决策、网络请求、独立存储回写，被彻底下放至底层的 `ChatManager` 与 `STSyncService`。
    - **ChatConverter (解耦转换器)**: 引入独立转换层，强制以 `mesRaw` (原始文本) 为基准进行双向转换与冲突比对，彻底隔离正则处理带来的分歧噪音。
    - **Dynamic Panel API**: 重构 `LuminaWeaveAPI`，支持 `registerPanel` 机制。插件可动态注册视图组件并由系统统一调度展示模式 (Modal/Tab)。
    - **原始数据优先策略**: 确保数据回传至独立存储或写回 ST 时，始终保留最完整的原始输出流。
- **物理回滚与图谱同步策略 (v5.0)**:
    - **数据模型演进**：`localChatData` 角色转变为“节点池”，通过 `parentId` 链接形成树图。
- **非侵入式提示词注入重构 (v5.6) [NEW]**:
  - **拟态虚拟世界书 (Mimic Virtual Lorebook)**: 插件定义了一套独立于 ST 的“虚拟世界书”逻辑，ST 仅作为最终渲染同步的输出目标（书籍名称可配置，默认 `LuminaWeave_System`）。如果该书在 ST 中不存在则自动创建，插件内部状态是提示词的唯一事实来源。
  - **动态宏注入管道**: 针对如 `<Next_Plan>` 等短效指令，改用解析替换预设中的占位符 (`{{lumina_xxx}}`)。
  - **插件颗粒度授权**: 设置中暴露各子系统对于主提示词的注入权限，保障数据安全感。
    - **活跃路径溯源**：`TimelineManager.getTrace(activeLeafId)` 负责从池中动态计算出当前的线性对话流，供 ST 同步使用。
    - **节点合并算法**：`SyncEngine.mergeNodePool` 确保从 ST 读取新消息时，能正确识别重复节点并链入新分支。
    - **节点化存储 (Node-based Persistence) [v5.2 优化]**：JSONL 本质上实现“一条消息一个节点”。首位保留极简 `metadata` (含 `activeLeafId` 和版本 2.1)。记忆状态（Tier 1/3）完全物理跟随消息节点，时间线切换时若无数据则自动清空状态。
- **强一致性同步**：分支跳转后自动触发 `SyncEngine.applyDelta`，将 ST 的线性视图物理同步至当前活跃链路，解决回滚后输入乱序的顽疾。
- **持久化锚定机制 (v5.2)**：重构 `PersistenceService` 与 `ChatManager` 的保存链路。异步 IO 操作强制绑定到发起时的 `chatId`（ID 锚定），从架构层面消除由于 SillyTavern 会话快速切换导致的竞态覆盖风险。
- **事务化写入协议 (v5.8) [NEW]**：`/chat/save` 与 `/chat/:chatId(PATCH)` 引入事务实体（`id/seq/status/scope/payloadDigest/error`），统一走 `pending → running → committed|aborted|rolled_back` 状态机。
- **幂等与序列防冲突 (v5.8) [NEW]**：前端写入请求携带 `idempotencyKey + expectedSeq`；后端基于事务日志执行幂等重放，并在序列不连续时返回 `TXN_SEQUENCE_CONFLICT`，阻断过期写入覆盖。
- **事务序列持久化 (v5.8) [NEW]**：独立存储 `metadata.transaction.lastCommittedSeq` 与 `lastTransactionId`，用于刷新重连后的写入对账。
- **事务查询/回滚与重连补偿 (v5.8.1) [NEW]**：新增事务查询与回滚接口，支持 `afterSeq` 拉取未确认事务；前端在重连后命中序列冲突时执行“按序列拉取增量事务 → 回滚同幂等键悬挂事务（pending/running）→ 按新序列重试一次写入”，并将流式重连从本地长度进度推断切换为后端缓冲对账。
- **写回来源标记防回灌 (v5.8.2) [NEW]**：`SyncEngine.applyDelta` 在写入 ST 的 `extra` 中注入 `_lw_sync_source/_lw_sync_ts/_lw_sync_chat_id`；回读时在可配置时间窗内识别 Lumina 写回消息并抑制反向再导入，阻断“写回→监听→再写回”的回灌环。
- **防双节点与链路自愈 (v5.8.2) [NEW]**：ST 归一化阶段对稳定 ID 去重，增量同步阶段执行 `processedIds` 与 `fingerprint` 双重去重，并拦截自引 `parentId` 关联，避免同内容/同 ID 在同一链路重复成节点。
- **UI 跨设备自适应定位 (v5.2)**：针对移动端和 PC 端屏幕尺寸差异，在 `MiniSidebar` 中引入实时视口纠偏算法。读取持久化坐标时自动执行边界检测，确保悬浮组件始终在有效可视区域内，解决移动端“组件丢失”问题。
- **极致轻量 (337KB)**：成功从 Vercel AI SDK 迁移至 OpenAI-Edge。
- **Shadow DOM 深度隔离 (v5.7)**：实现样式过滤算法，仅注入插件自身样式，解决 SillyTavern 全局样式对插件 UI 的负面覆盖。

### 待办与演进方向
- 持续引入 TavernHelper 事件与游戏数值联动。
- 实现后台状态增量补丁（Incremental Patch）逻辑及 UI 高亮。
- 补齐记忆提取网络与视图编排（Lumina Memory Engine）。
- **Lumina Director 编排面板落地**：实现可视化连线节点，让用户自由定义双轨分流触发器（Trigger）和 XML 解析器的加载机制。
