# LuminaWeave 业务行为定义规范 (Business Behavior Specification)

**版本:** v1.0
**适用范围:** LuminaWeave 所有核心模块及子插件开发
**最后更新时间:** 2026-04-04

本文档旨在规范 LuminaWeave 框架下各业务模块的行为准则，确保代码在架构约束下运行，保障系统的高可用性、数据一致性及 UI 隔离性。

---

## 一、 核心架构与隔离原则

### 1. 独立自治与状态隔离
*   **禁止直接污染 ST 原生状态**: 所有插件的内部状态（如对话历史、角色属性、物品栏）必须首先写入 Lumina Core 的**影子数据库（Shadow Database/LocalChatData）**，禁止直接绕过核心层操作 `window.chat` 或 ST 的 DOM 结构。
*   **UI 隔离（Shadow DOM）**: 所有的 UI 渲染默认在开启的 Shadow DOM 内进行。开发 UI 组件时，必须确保样式独立，禁止编写影响全局的 CSS。样式注入必须通过克隆带有 `data-vite-dev-id` 或 `LuminaWeave` 标识的节点来实现。

### 2. 生命周期驱动的数据流
*   **XML 标签化流转**: 模型输出的非对话文本必须使用 XML 标签包裹，并严格遵守数据生命周期（Tag-Driven Lifecycle）：
    *   **Transient (阅后即焚)**: 如 `<Thoughts>`。提取后直接丢弃或仅供推演，**绝不可**进入 ST 聊天记录或持久化存储。
    *   **Ephemeral (单次必需)**: 如 `<Next_Plan>`。仅暂存于 `DirectorStore`，作为下次请求的指导，用后即焚。
    *   **Persistent (持久状态)**: 如 `<Inventory_Change>`。必须通过 `MutationEngine` 路由至相应的状态表（Tier 1）进行持久化，并通过快照机制管理。
    *   **Core (核心对话)**: 如 `<Chat_Reply>`。仅此部分进入 `Tier 2` 近期记忆并同步至 ST 界面。

---

## 二、 数据同步与持久化规范

### 1. 强一致性同步 (Sync Protocol)
*   **插件数据源优先**: 在混合同步场景下，LuminaWeave 的独立存储（JSONL 节点池）为**最高优先级**。
*   **不可合并冲突决议**: 仅当本地与 ST 均产生独立的、不可自动合并的节点（hasDivergence）时，才允许抛出冲突弹窗交由用户决议。
*   **双标识符校验**: 数据同步和去重必须同时依赖 `id`（稳定 UUID）与 `fingerprint`（内容哈希），禁止仅依赖单一维度。
*   **防回灌机制**: 向 ST 写回数据时，必须在 `extra` 字段注入溯源标记（`_lw_sync_source='lumina'` 等），读取时需结合时间窗进行过滤，防止“自写自读”死循环。

### 2. 事务化写入 (Transactional Writes)
*   所有涉及核心状态修改的接口（如 `/chat/save`，`/chat/:chatId(PATCH)`）必须遵循事务状态机：`pending → running → committed | aborted | rolled_back`。
*   前端发起写入时必须携带 `idempotencyKey` 与 `expectedSeq`，后端需执行幂等重放与序列校验，遇冲突返回 `TXN_SEQUENCE_CONFLICT` 并触发对账补偿链路。

---

## 三、 提示词与大模型交互规范

### 1. 非侵入式提示词注入
*   **禁止粗暴覆盖**: 严禁直接拦截并硬改 ST 的 `mesRaw` / `mes` 组装过程。
*   **虚拟世界书注入**: 所有系统级规则、框架协议必须通过 `PromptWorldInfoMount` 注册为虚拟世界书的 `Constant` 条目，由 ST 的原生引擎负责 Token 裁剪与拼装。
*   **宏替换 (Macro Pipeline)**: 短效指令（如 `<Next_Plan>`）应通过拦截最终 `payload`，替换预设中的占位符（如 `{{lumina_director_rules}}`）来实现。

### 2. 动态上下文压缩 (DCC)
*   在构建发送请求时，必须通过 `ContextCompactor` 执行分层策略（全量区、概览区、隐藏区）。
*   被判定为“隐藏区”的消息必须通过 `STClient.updateMessages(..., { is_hidden: true })` 设置 `is_hidden` 原生属性（并同步 `is_system`），而非物理删除。
*   发送给模型的权威字段为 `mesST`，渲染 UI 的字段为 `mes`，必须严格解耦。

---

## 四、 增量更新与状态突变 (Mutation)

### 1. 增量更新引擎 (Incremental Updater)
*   各子系统若需维护状态，必须在 `TableRegistry` 中注册对应的数据模型（DataModel）及其 `schema`。
*   大模型输出的更新指令必须被路由至注册的模型，通过标准化的 CRUD（`add/insert`, `update/replace`, `delete`）动作执行，系统保障其原子性。

### 2. 快照与时间游走
*   对话图谱的时间线跳转必须遵循 **“增量 (Delta) + 快照 (Snapshot)”** 机制。
*   切换分支时，系统必须溯源至最近的 `tier1Snapshot`，然后向下重放 `tier1Delta`，以确保对应时空的状态精准重建。

---

## 五、 UI/UX 与流式渲染规范

### 1. 流式平滑输出 (Streaming UX)
*   流式渲染必须基于 `StreamHandler` 进行双层缓存（`Confirmed` 与 `Pending`），禁止直接在未稳定的字符串上执行复杂的正则替换导致 UI 闪烁。
*   事件网关转发 `BUFFER_UPDATED` 时，仅对展示文本 `displayText` 应用正则，保留未处理的 `rawBuffer` 用于后台恢复与状态计算。

### 2. 组件化呈现 (LuminaView)
*   对话内容必须经过 DSL 解析为结构化的组件流（TextBlock, StatBlock, ChoiceBlock 等）。
*   交互型 UI（如选项、按钮）必须通过 `<V>` 标签包裹，利用 `Presentational` 生命周期将其从文本过滤规则中隔离。

---

## 六、 异常处理与降级策略

*   **API 探测兜底**: 使用 `LuminaWeaveAPIBase` 进行跨环境 API 探测时，必须提供默认的回退逻辑（Fallback），确保在非 ST 标准环境或扩展沙箱中不引发白屏崩溃。
*   **网络异常中断**: 生成过程中的网络中断或主动停止，必须触发 `aborted` 终态，并执行一次强制的数据对齐同步，禁止静默失败。
*   **模型未就绪访问**: `MutationEngine` 等执行沙箱必须实现代理拦截（Proxy），针对未初始化的核心模型访问提供安全降级，防止运行时异常。
