# Forge 进度看板（2026-04-09）

> 分类：目前进度看板
> 原始文件：`docs/Forge_后续TODO_2026-04-09.md`

本文档用于承接本次对话形成的 Forge / 世界书相关上下文、已完成项与剩余待办，便于后续继续实现。

相关交接文档：

- `docs/overall/modules/forge/implementation.md`
- [Forge Agent Runtime 与 Skill 系统迁移计划](./2026-05-09-forge-agent-runtime-skills-plan.md)

## 1. 本次对话上下文

本轮需求从“先读取当前制卡功能实现内容”开始，后续逐步补充并确认为以下方向：

- Forge 输入区：
  - `Shift + Enter 换行` 右侧增加 `Prompt 预览`
- Forge 主聊天区：
  - 将 `Activity 运行轨` 合并到聊天流中，像 Codex 那样内嵌显示
- Forge 右侧区域：
  - 改为当前世界书条目查看与编辑
- Forge 会话体系：
  - 默认页面不变
  - 新增可切换的 Forge 项目中心
  - 支持新建 Forge 项目
  - 支持关闭插件后下次继续
- 历史记录体系：
  - 后续明确取消“独立历史记录面板”方向，不再继续做工作流历史面板
- 世界书与时间线：
  - 世界书条目需要支持：
    - 跟随时间线回溯内容
    - 固定当前版本
    - 手动切换版本
- 架构偏好：
  - 允许重构，包括子插件重构
  - 世界书子插件应开放成类似 UI 组件的接口，Forge 可直接调用
- 记忆系统与消息结构：
  - 当前前端记忆系统和消息列表数据结构偏简陋，允许后续继续重构优化

## 2. 当前已落地内容

### 2.1 Forge 工作台

- 已增加 `Prompt 预览`
- 已将 `Activity` 合并进 Forge 聊天流
- 已新增 `session-browser` 页面
- 已支持：
  - Forge 工作会话切换
  - 新建 Forge 工作会话
  - 项目中心右侧显示选中项目的协作线程
  - Forge 工作会话重命名
  - 当前参考聊天会话解绑
  - 最近恢复工作会话快捷入口
- 工作台自动保存已改为防抖保存，并在卸载时补一次最终持久化
- Forge 工作会话已补 `sessionChatId` 持久化，恢复旧会话时生成会话标识不再漂移
- Forge 工作会话在切换/新建/重置前会先做最终保存，降低防抖窗口内丢失最新修改的风险
- Forge 辅助状态恢复已补最小隔离：
  - `stagingArea` 跟随工作会话恢复
  - `activityLog` 切换会话时不再串会话残留
- Forge 工作会话后端镜像持久化骨架已接通：
  - Forge 工作会话已并入统一 `ConversationDocument`
  - 服务端不再以 `forge_sessions.json` 作为唯一真相源
  - 前端仓库现通过统一 conversation bridge 读写 Forge 会话
  - 工作台启动与会话索引刷新会优先读取统一会话文档，再按需回填本地存根
- Forge 已开始迁移为项目化主语：
  - `forgeProjectId / conversationId / workspacePath` normalize 后作为长期项目容器字段使用
  - 项目中心主列表显示 Forge 项目，右侧显示选中项目的协作线程
  - 顶部工具栏、辅助区和审阅空态改为围绕当前项目表达
  - 传统桌面展开态已取消重复 hero/topbar，并在重置会话左侧提供“工作区”二级菜单入口
- Forge 项目 VFS 数据层已接通第一阶段：
  - 新增 `ForgeProjectDataService`
  - `/workspaces/forge/<projectId>/project.json` 保存项目元数据、active conversation、参考聊天、预设与发布状态
  - `/workspaces/forge/<projectId>/lorebook/entries/*.json` 保存虚拟世界书条目
  - `/workspaces/forge/<projectId>/memory/tree.json` 保存项目记忆树
  - `/workspaces/forge/<projectId>/drafts/tree.json` 保存结构化草稿树与表单状态
  - `/workspaces/forge/<projectId>/review/staging.json` 保存 staging 与 commit-ready 审阅状态
  - 旧会话首次打开时若项目 VFS 文件不存在，会从现有 session 字段生成项目文件
  - 已补 `ForgeProjectDataService` 单元测试，覆盖旧会话 normalize、VFS hydrate/save、虚拟世界书条目文件清理重写
- Prompt resource binding owner 已从旧工作会话 id 迁移到项目 id：
  - 首次 hydrate 项目时迁移 `forge-workspace:<workspaceSessionId/sessionChatId>` 到 `forge-workspace:<forgeProjectId>`
  - 测试聊天与项目级绑定读取同一 owner
- 已新增最小会话视图聚合层：
  - `MemorySnapshotTypes`
  - `MemoryViewResolver`
  - `useConversationViewStore`
- Forge 工作台已开始消费统一会话视图层：
  - 顶部会话标题/副标题
  - 状态区的世界书版本标签与上下文消息数
- 统一会话存储闭环已接通：
  - 主聊天与 Forge 工作会话共享同一 `ConversationDocument` 契约
  - LocalBridge / HttpBridge / TauriBridge 都已提供统一 conversation DTO
  - 新会话文件显式带 `schemaVersion`
- Forge Prompt 预览与生成链路已开始消费统一记忆快照：
  - `MemorySnapshot` 已纳入世界书条目摘要
  - `PromptBuilder` 可优先使用解析后的世界书视图，而不只依赖 ST 当前激活世界书
  - Forge Prompt 预览会显示当前使用的会话记忆快照
- Forge Agent Prompt Layout 已进入可解释预览：
  - `ForgeWorkingStatementBuilder` 生成正式 tail restatement，不再由 graph 内联拼接临时字符串
  - `ForgeAgentGraphRuntime` 输出 `workingStatement` 与 `PromptSourceUnit`
  - Forge Prompt Preview 新增 Agent / Attention 视图，显示 graph node、capability、shell profile、working statement、slot / region 与最终 message 位置
  - 主模型预览已把 Agent source units 注入 Prompt Assembly，避免 skill / VFS / working statement 只停留在 graph trace 中
- 已增加 Forge 工作会话本地持久化骨架

相关文件：

- `luminaweave-extension/src/plugins/forge/CardMakerPanel.vue`
- `luminaweave-extension/src/plugins/forge/CardMakerStore.ts`
- `luminaweave-extension/src/plugins/forge/ForgePromptPreview.vue`
- `luminaweave-extension/src/plugins/forge/ForgeInlineTrace.vue`
- `luminaweave-extension/src/plugins/forge/ForgeSessionBrowser.vue`
- `luminaweave-extension/src/plugins/forge/ForgeSessionToolbar.vue`
- `luminaweave-extension/src/plugins/forge/ForgeSessionCard.vue`
- `luminaweave-extension/src/stores/useSessionIndexStore.ts`
- `luminaweave-extension/src/api/core/ForgeSessionRepository.ts`
- `luminaweave-extension/src/api/core/ChatSessionIndexService.ts`
- `luminaweave-extension/src/types/SessionTypes.ts`

### 2.2 世界书组件化

- 已将世界书插件根组件收敛为薄包装
- 已抽出可复用组件：
  - `luminaweave-extension/src/plugins/lorebook/components/LorebookWorkspace.vue`
- Forge 已改为直接使用该组件，而不是直接依赖插件壳
- 世界书插件入口已显式导出该组件，便于其他子插件复用
- Forge 右栏现已进一步从通用 `LorebookWorkspace` 脱钩：
  - 新增 Forge 专用侧栏 `ForgeLorebookSidebar.vue`
  - 使用“虚拟文件列表 + 条目编辑区”结构
  - Forge 右栏默认不再自动选中真实世界书，只有手动导入后才会引用已有书籍内容
  - 新建/切换 Forge 会话时默认保持空选择状态
  - 时间线/版本信息不再占据右栏主结构，虚拟条目仅显示创建/更新时间
  - 通用世界书大窗/小窗已默认隐藏 Forge 时间线视图与已记录版本区块

相关文件：

- `luminaweave-extension/src/plugins/lorebook/LorebookRoot.vue`
- `luminaweave-extension/src/plugins/lorebook/components/LorebookWorkspace.vue`
- `luminaweave-extension/src/plugins/lorebook/index.ts`
- `luminaweave-extension/src/plugins/forge/CardMakerPanel.vue`
- `luminaweave-extension/src/plugins/forge/ForgeLorebookSidebar.vue`

### 2.3 世界书版本视图骨架

- 已新增世界书版本视图类型
- 已新增世界书时间线解析器
- 已在 `LorebookManager` 中补充前端快照索引能力
- 已支持三种模式：
  - `follow-timeline`
  - `pinned`
  - `manual`
- 已在世界书工作区显示当前版本来源标签：
  - 时间线来源
  - 节点标识
  - 会话标识
- 已增加已记录版本列表，可直接切到手动查看指定快照
- 已在编辑器头部显示当前版本来源信息
- Forge 中的世界书组件已明确绑定 `forge` 时间线源

相关文件：

- `luminaweave-extension/src/types/LorebookViewTypes.ts`
- `luminaweave-extension/src/api/core/LorebookTimelineResolver.ts`
- `luminaweave-extension/src/api/core/LorebookManager.ts`
- `luminaweave-extension/src/plugins/lorebook/LorebookEditor.vue`
- `luminaweave-extension/src/stores/useTimelineStore.ts`

## 3. 当前实现边界

下面这些点很重要，当前不要误判成“已经完整完成”：

- 世界书版本能力目前是“前端解析层 + 快照索引”方案
  - 还不是底层物理版本化存储
- 当前快照依赖前端本地记录
  - 还没有正式写入后端版本仓库
- `manual` 模式现在已有基础切换能力
  - 小窗模式下已增加折叠式版本库，但仍未做更完整的版本筛选与分组
- Forge 右栏虽然已经能直接调用世界书工作区组件
  - 但“世界书条目与当前节点的命中关系”还没有做更细的可视化
- 项目中心当前只展示 Forge 项目与项目内协作线程
  - 历史聊天来源不再作为项目中心主列展示
- 记忆系统与消息结构的大重构还没有正式开始

## 4. 剩余最高优先级 TODO

### 4.1 世界书版本视图完善

- [x] 在 `LorebookWorkspace` 中增加更明确的版本列表展示
- [x] 给每个版本补充更稳定的来源说明：
  - 来源时间线
  - 来源节点
  - 来源会话
- [ ] 优化 `manual` 模式下的版本选择体验
- [~] 优化 `manual` 模式下的版本选择体验
  - 已在小窗模式下加入折叠式版本库与更紧凑的版本列表
  - 尚未提供版本筛选、分组和更完整的来源比对
- [x] 明确切换模式时的状态规则：
  - `follow-timeline -> pinned`
  - `follow-timeline -> manual`
  - `manual -> follow-timeline`
- [ ] 评估是否需要“当前版本未记录时自动补快照”的节流策略

### 4.2 世界书与时间线联动细化

- [ ] 在 Forge 右栏中标识“当前显示世界书版本来自哪个节点”
- [ ] 当 Forge 时间线回滚/跳转时，验证世界书视图是否稳定更新
- [ ] 评估是否需要为 `chat` 和 `forge` 分别维护更明确的世界书上下文绑定
- [ ] 补充世界书跟随 Forge 时间线的交互验证

### 4.3 Forge 项目中心继续完善

- [x] 历史聊天会话列表曾增加更清晰的标题、摘要与排序（现已不再作为项目中心主列）
- [x] Forge 工作会话支持重命名
- [x] Forge 工作会话支持最近更新时间显示
- [x] Forge 当前参考聊天会话支持更友好的展示与解绑
- [x] 评估是否需要“最近恢复的 Forge 会话”入口
- [x] 将 Forge 会话页迁移为项目中心
- [x] 将项目中心右侧从历史聊天来源改为选中项目的协作线程
- [x] 传统桌面展开态 Forge 视图去重内部 hero/topbar，并新增工作区二级菜单
- [x] 传统桌面展开态补回紧凑项目标题，并恢复辅助视图位置菜单与辅助按钮 toggle 语义
- [x] 增加项目线程派生回归测试，覆盖 legacy 单线程项目与选中线程消失后的最近项目 fallback
- [ ] 验证项目中心在传统桌面、自由工作台和移动端下的视觉稳定性

### 4.4 Forge 项目持久化补强

- [x] 校验 `ForgeSessionRepository` 当前持久化字段是否完整
- [x] 评估是否需要从本地持久化升级到后端持久化
- [x] 确认 `stagingArea`、草稿输入、参考聊天绑定是否都完整恢复
- [x] 增加会话切换时的保存时机与防抖策略校验
- [x] 增加项目 VFS 文件 hydrate/save 服务
- [x] 将虚拟世界书、项目记忆、draft tree、staging 写入项目 VFS
- [x] 增加旧会话字段到项目 VFS 的首次打开迁移
- [x] 增加 VFS 项目数据服务测试，验证 project.json、lorebook entries、memory/tree、drafts/tree、review/staging 可重新 hydrate
- [ ] 继续补真实宿主下的刷新恢复与文件检查 walkthrough
- [ ] 将真实生成请求同步接入 Agent source units，并让运行请求 trace 与 Prompt Preview 保持同一套 slot / region 来源

## 5. 中优先级 TODO

### 5.1 记忆系统与消息结构重构

- [~] 抽离 `会话索引层 / 会话详情层 / 记忆快照层 / UI 派生层`
  - 已补 `useConversationViewStore + MemoryViewResolver + MemorySnapshotTypes`
  - Forge 预览/生成链路已开始接入统一视图层
  - 尚未把主聊天、世界书、PromptBuilder 全面切到统一视图层
- [ ] 明确 `MessageListManager` 的单一职责边界
- [x] 设计 `MemorySnapshot` 统一类型
- [x] 让世界书解析结果最终能并入记忆视图，而不是只停留在世界书 UI
- [~] 为后续 Prompt 构建统一对接 `MemorySnapshot`
  - Forge `buildPromptPreviewPayload()` 已开始接入
  - 主聊天链路尚未接入

### 5.4 Prompt 模板层资源化

- [~] 将 Forge 的 Planner / Executor prompt 从 TS 常量中拆到独立资源文件
  - 已新增 `src/resources/prompts/forgePrompts.ts`
  - `CardMakerStore` 默认 Planner prompt 已改为读取资源模板
  - `ForgeAgentController` 隔离 Executor prompt 已改为读取资源模板
- [~] 为 `PromptBuilder` 接入轻量模板渲染层
  - 已新增 `PromptTemplateEngine`
  - 会话记忆快照块已改成模板渲染
- [~] 抽象 Forge Prompt 模板输入模型
  - 已新增 `ForgePromptTypes`
  - 已新增 `ForgePromptPayloadResolver`
  - `CardMakerStore / PromptBuilder / ForgeAgentController` 已开始共用模板输入 resolver
- [ ] 把 Preview / 其他 Forge prompt 片段继续收拢到同一模板层
- [ ] 决定下一步是继续保持内置轻量模板，还是正式引入外部模板库

### 5.5 LangGraph 工作流编排试点

- [~] 在 Forge 中引入 LangGraph 作为 workflow 编排层，而不是上下文状态核心
  - 已安装 `@langchain/langgraph`
  - 已新增 `ForgeWorkflowGraph`
  - 当前以 `clarify / plan / review / prepare_commit / await_commit_confirmation` 路由一轮用户输入
  - `review / prepare_commit / await_commit_confirmation` 已补待审批数量与用户决策语义
- [~] 将 workflow snapshot 接入 Forge 会话、Prompt 与 UI
  - `workflowSnapshot` 已进入工作会话持久化
  - `PromptBuilder` 已开始注入 workflow block
  - 工具条与状态区已显示当前 workflow 阶段
- [~] 让审批动作与 workflow 状态联动
  - 暂存区确认/丢弃后会立即重算 workflow snapshot
  - 参考聊天绑定、时间线切换后也会重算 workflow snapshot
- [~] 引入 `commit-ready` 中间态
  - staging 确认后不再直接消失，而是进入写回准备区
  - 已支持从写回准备区退回暂存区
- [ ] 评估是否需要把最终“正式写回”动作做成 LangGraph 独立提交节点
- [~] 打通 `commit-ready -> 最终确认 -> 正式写回` 最小闭环
  - 已支持从 `commit-ready` 批量确认并写回当前世界书
  - 当前仍是 UI 触发的受控提交动作，还不是 LangGraph 独立提交节点
- [ ] 评估是否需要引入 checkpoint/resume，而不只依赖现有 Forge session 持久化

### 5.2 Forge 收集组件体系

- [ ] 决定是否复用 `chat/components/blocks`
- [ ] 若复用：
  - 抽出 Forge 可用的表单块能力
- [ ] 若单独实现：
  - 明确 Forge 专属 block 协议
- [ ] 把“结构化收集组件”真正接到 Forge 工作流中

### 5.3 世界书子插件开放接口继续规范化

- [ ] 定义更正式的导出接口约定
  - 组件导出
  - 类型导出
  - 可选控制器导出
- [ ] 评估是否要让其他子插件也遵循同样模式
- [ ] 补文档说明“插件壳”与“可复用组件”的职责分离

## 6. 架构重构（2026-04-14）

> 详细设计文档：[refactoring.md](../../../../overall/modules/forge/refactoring.md)

### 6.1 CardMakerStore 拆分

- [x] Phase 1: 新增类型定义（ForgeContextTypes / ForgeOperationSubStep / ForgeWorldlineSnapshot）
- [x] Phase 2: 提取 ForgeEffectReducer（applyRuntimeEffects → 纯函数）
- [x] Phase 3: 提取 ForgeFormController（表单蓝图、字段绑定、校验、提交）
- [x] Phase 4: 提取 ForgeSessionController（会话 CRUD、序列化、恢复）
- [x] Phase 5: 提取 ForgeWorldlineManager（节点导航 + 世界线快照回滚）
- [x] Phase 6: 新建 ForgeContextBroker（三角色上下文隔离 + resolveOriginalContent 统一）
- [x] Phase 7: 精简 CardMakerStore（2282 → 1562 行）
- [x] Phase 8: 整合 ForgeAgentController（常量迁移至 forgeConstants.ts + resolveOriginalContent 委托 ContextBroker）

### 6.2 架构演进（2026-04-14 A 方向）

- [x] A.1 ForgeContextBroker 接入 PromptBuilder — analyst 角色截断历史（默认 10 条），`mes` 优先于 `mesRaw`
- [x] A.2 WorldlineManager 快照自动触发 — switchToNode 自动捕获当前节点快照，rollback 自动恢复，快照随会话序列化
- [x] A.3 CardMakerStore 继续瘦身 — 通过 Deps 扩展复用，2282 → 1564 行（-31%）

### 6.3 Forge 上下文管理（2026-04-14）

- [x] Forge 对话历史截断设置 (`lumina-forge.maxHistoryMessages`, 默认 20)
  - Planner / Conversation 角色受此限制
  - Analyst 角色独立截断（默认 10），可通过 `maxRecentMessages` 参数覆盖
  - 所有角色消息内容从 `mesRaw || mes` 改为 `mes || mesRaw`（清洗后文本优先）

## 7. DCC 完善（2026-04-14）

### 7.1 消息钉固（isPinned）

- [x] `LuminaChatMessage` / `StoredChatMessage` 新增 `isPinned?: boolean` 字段
- [x] `ContextCompactor` 主循环后补救：钉固消息豁免 `is_hidden`，始终以最优摘要形式保留
  - 优先级：`mesSummary` > `Story_Summary` 标签 > `Current_Plan` > 截取前 200 字
  - `mesST` 添加 `[📌 钉固]` 前缀，`compressionState = 'pinned'`

### 7.2 compressionState 明确化

- [x] 全量区消息：`compressionState = 'full'`（原为 undefined）
- [x] 概况区降级消息（无有效摘要）：`compressionState = 'full_in_summary'`（原为 undefined）
- [x] 钉固消息：`compressionState = 'pinned'`
- [x] 日志输出新增钉固消息计数

### 7.3 设置项完善

- [x] `lumina-chat` settingsManifest 暴露 `enableFallbackSummary`（原存在于 getDccSettings 但 UI 不可见）
  - 关闭（默认）：概况区无摘要消息以全量保留
  - 开启：截取原文前 100 字作为兜底摘要

## 8. 当前建议的下一步执行顺序

建议按下面顺序继续：

1. ~~执行架构重构 Phase 1-8~~ (已完成 2026-04-14)
2. ~~Forge 上下文管理（maxHistoryMessages + mes 优先）~~ (已完成 2026-04-14)
3. ~~DCC 完善（isPinned + compressionState 明确化 + enableFallbackSummary UI）~~ (已完成 2026-04-14)
4. 验证 Forge 时间线切换下的世界书回溯稳定性
5. 完善世界书版本列表与来源展示
6. 清理残余 `chat / forge` facade 调用并继续压缩兼容层

## 7. 当前假设与未验证前提

以下内容当前仍是“合理假设”，不是已验证事实：

- Forge 项目协作线程目前由 `ForgeWorkspaceSessionRef` 按 `forgeProjectId` 派生，后续多 conversation 项目需要继续验证真实宿主列表恢复
- 世界书前端快照索引方案足以支撑第一阶段版本回溯体验
- Forge 与 Chat 在未来可以共享更统一的会话/记忆中层结构
- 当前本地持久化不会和未来后端持久化方案冲突

后续继续开发前，优先验证：

1. Forge Agent Runtime 与 Skill 系统迁移：先按 [迁移计划](./2026-05-09-forge-agent-runtime-skills-plan.md) 接入 single Forge Agent + dynamic skills、Capability/Skill 按需加载、会话级 `project-readonly` shell 搜索查看、LangGraph orchestration harness、Prompt Layout Slots / 静态动态区域契约、Working Statement、Prompt Preview Agent/Attention 视图、typed effects 与 human review gate；isolated subagent 只在上下文隔离场景启用。
2. 真实宿主刷新恢复 walkthrough：新建项目、编辑虚拟世界书/记忆/草稿/审阅状态、刷新后检查 `/workspaces/forge/<projectId>/...` 文件与 UI 派生视图一致。
3. 多协作线程项目验证：在同一 `forgeProjectId` 下创建/恢复多个 conversation，确认项目中心按 `forgeProjectId` 聚合、打开线程不串项目。
4. Forge 时间线切换核验：确认时间线切换时虚拟世界书、staging、draft tree 与记忆树仍指向正确节点快照。
5. 真实发布/导出设计：继续保持“冻结到 Forge 虚拟项目”边界，另起步骤设计真实 ST 世界书发布与导出确认流。
6. 世界书版本体验：评估快照索引是否产生过多重复版本，并补版本筛选、分组和命中关系展示。

2026-05-09 执行进展：

- 已新增 `ForgeSkillRegistry` 与内置 skill 文本，支持 built-in fallback 与项目 VFS materialize。
- 已新增 `ForgeCapabilityRegistry`，常驻 capability index 只保留摘要、触发词、skill/namespace/shell profile 引用。
- 已新增 `ForgeWorkspaceSearchShell`，默认 `project-readonly`，允许 list/read/search/stat 类命令，阻断 redirection、写入命令、跨项目绝对路径，并限制输出长度。
- 已新增 `ForgeAgentGraphRuntime` 骨架，串起 `intent_router / skill_selector / capability_loader / context_loader`，只产出 trace、project resource snapshot 和 prompt source 候选，不写项目资源。
- 已接入 Forge Prompt Layout Slots：
  - `PromptSourceUnit` / trace 记录 `forgeSlot / forgeRegion / slotPolicy`
  - `forge-main` 预设增加 `agent_runtime_contract / agent_skill_context / agent_project_resources / agent_review_state / agent_working_statement / agent_user_input`
  - `ForgeAgentGraphRuntime` 输出的 skill、shell profile、项目资源、审阅状态、working statement、user input 可直接进入 Prompt Assembly
  - Prompt Preview / PromptInspector 来源视图可显示新增 source kind 与 slot/region
- 已验证：
  - `npm run test -- ForgePromptLayoutSlots ForgeAgentGraphRuntime`
  - `npm run test -- PromptPresetComposer PromptAssemblyTracer`
  - `npm run type-check`
- 下一步转入正式 `ForgeWorkingStatement` builder 与 Prompt Preview Agent / Attention 视图，而不是继续扩展工具面。

2026-05-19 执行进展：

- 已确认 Forge 制卡不全面切换 pi-mono；采用“Graph 负责状态/阶段/边界/能力索引，Agent loop 负责按需加载技能/能力和执行工具”的混合方案。
- 已新增执行记录：[Forge 技能/能力 pi 风格迁移计划](./2026-05-19-forge-pi-capability-migration-plan.md)。
- `ForgeToolRegistry` 已新增 pi 风格能力/技能工具面：
  - `capabilitySearch / capabilityLoad`
  - `skillList / skillLoad`
  - `readFile / bash / writeFile / editFile / stageEntry`
- `ForgeAgentGraphRuntime` 已停止预加载完整 skill/capability；Graph 现在输出 intent、项目资源、working statement 与 capability index。
- `ForgeExecutionGateway.runWithTools()` 已改为由 gateway 统一发 request lifecycle、tool call、tool result 与 stream 事件。
- `ForgeRuntimeOrchestrator` 已接入 `lumina-forge.agentToolCalling.enabled` feature flag；开启后 conversation / planner / analyst / executor runtime 请求优先走 tool calling。
- 写入工具现在只生成 reviewable effects，不直接静默发布真实 ST 世界书。
- Review Gate 已接入 transient approval 队列：
  - `tool_approval_needed` 会生成 `upsert_tool_approval` effect，并进入 `useForgeStore.toolApprovals`
  - `tool_approval_resolved` 会生成 `resolve_tool_approval` effect
  - `ForgeReviewPanel` 可显示 pending 工具授权并标记批准/拒绝
- AI SDK 原生 approval request 已接线：
  - `writeFile / editFile / stageEntry` 声明 `needsApproval: true`
  - `bash(project-write-request)` 按参数触发 approval
  - `ForgeAgentLoop` 从 `tool-approval-request` step content 转发 approval 请求
- approve/resume 闭环已接入第一阶段：
  - `ForgeRuntimeOrchestrator` 缓存 pending approval 的 request/toolset 上下文
  - Review 面板批准/拒绝会回注 AI SDK `tool-approval-response`
  - approved 工具可恢复执行并继续进入现有 tool result / staging effects 链路
- Review Gate 授权卡片已补写入细节展示：
  - `writeFile` 显示目标路径、新内容与原内容待读取提示
  - `editFile` 显示目标路径、原片段与新片段
  - `stageEntry` 显示目标条目、新内容与 proposal 合成提示
  - 完整工具参数折叠展示
- 全模式 tool calling 路由已接入：
  - 总开关：`lumina-forge.agentToolCalling.enabled`
  - 开启后 conversation / planner / analyst / executor runtime 请求优先走 `runWithTools()`
  - analyst tool calling 完成后仍继续 planner
  - executor rewrite 在总开关开启时不再优先 isolated subagent
  - 旧 XML 路径保留为总开关关闭或 tool calling 失败 fallback
- 显示与记录：
  - tool call / result / approval 事件会进入 Forge timeline operation
  - Forge inline trace 可显示并展开这些操作
  - timelineItems 会随 ForgeWorkspaceSession 序列化保存，因此操作记录会进入会话级信息记录
- 提示词与技能/能力语言：
  - Forge conversation / planner / analyst / executor prompts 已从 XML 模拟工具指令切到原生 tool calling 优先
  - 动态格式提示、A.U.T.O checklist 指令、Forge <V> DSL 协议说明已移除旧 action XML 标签指令
  - 内置 `ForgeCapabilityRegistry` 与 `ForgeSkillRegistry` 的标题、摘要、说明和 SKILL.md 内容已中文化
  - tool function id 仍保持英文稳定标识，避免破坏 AI SDK tool schema 与既有调用链路
- 模型请求调试面板：
  - 已新增“工具调用”视图，显示 tool set 摘要、tool call、tool result、approval needed/resolved 与 payload JSON
  - 执行记录见：[Forge 模型请求调试面板 tool calling trace 实现计划](./2026-05-19-forge-model-request-tool-calling-debug-plan.md)
  - `modelRequestTraces` 保持瞬态调试用途，长期操作记录继续由 `timelineItems` 保存
  - 已验证：`npm run type-check -- --pretty false`；tool calling 聚焦回归 8 个测试文件、33 个测试通过

2026-05-20 pi runtime 方向修正：

- 用户追问前端是否能内嵌 pi 后，已重新区分 “custom web UI” 与 “browser-only runtime”：
  - 官方 SDK 支持自定义 Web / Desktop / Mobile UI，但示例入口仍是 `@earendil-works/pi-coding-agent`。
  - 本地依赖分析显示 `@earendil-works/pi-coding-agent` 明显 Node-heavy，不适合直接进入浏览器前端。
  - `@earendil-works/pi-agent-core` 根入口可作为浏览器适配候选，`@earendil-works/pi-agent-core/node` 包含 Node execution env，前端禁用。
- 已按用户要求还原后端 pi runtime 改动：
  - 不再把服务端 `/forge/pi/*` API、`ForgePiRuntimeService`、server JSONL session tree 或 `@earendil-works/pi-coding-agent` 依赖作为当前主路径。
  - 后续规划限定在 `luminaweave-extension` 前端 runtime 与共享类型边界内推进。
- 联网调研结论：
  - Pi Web、pi-gui、OpenClaw、Obsidian PiChat 都更接近 UI + Node/Electron/daemon/RPC runtime。
  - 暂未发现成熟公开项目把完整 pi runtime 迁移到纯浏览器执行。
  - 可借鉴 tree history、context engineering、custom tools、tool trace 与 session UI；不能直接照搬其运行时部署方式。
- 已新增执行记录：
  - [Forge Agent Runtime 前端 pi-agent-core 适配计划](./2026-05-20-forge-pi-agent-core-browser-runtime-plan.md)
  - [pi SDK 浏览器适配调研快照](./2026-05-20-pi-sdk-browser-adapter-research.md)
- 推荐方向：
  - 前端仅复用 `@earendil-works/pi-agent-core` 根入口。
  - Forge 自实现 browser adapters：模型适配、VFS、Review Gate、资源加载、工具桥接、session tree 持久化。
  - 新增 bundling guard，阻止 `pi-coding-agent`、`pi-agent-core/node`、`node:fs`、`node:child_process` 等 Node-only 依赖进入前端。

2026-05-20 pi-agent-core 前端适配第一阶段实现进展：

- 已在 extension 引入 `@earendil-works/pi-agent-core`，并新增依赖守卫测试，确认前端 pi 适配目录只使用 root import，不引入 `pi-coding-agent` 或 `pi-agent-core/node`。
- 已新增前端 runtime 外壳：
  - `ForgePiCoreRuntime`
  - `ForgePiResourceLoader`
  - `ForgePiToolBridge`
  - `ForgePiCoreDependency`
- `ForgePiRuntimeClient` 已从服务端 `/forge/pi/*` client 改为本地 pi-core runtime facade，不再发起后端 pi API 请求。
- `ForgeRuntimeOrchestrator` 已切到 `lumina-forge.piCoreRuntimeEnabled` 开关；开启后 runtime 请求走前端 pi-core facade，关闭后保留现有 tool calling / 旧兼容路径。
- `useForgeStore` 已补 `piLoadedSkills`，继续保存 pi session tree、active node、context bundle 和 loaded extensions。
- Forge 设置项已从“服务端 pi-native”语义改为“前端 pi-agent-core Runtime”。
- 当前仍未完成：
  - pi approval resume 尚未接入；第一阶段只把写入工具转为 `tool_approval_needed`。
  - Debug Panel / Prompt Preview 尚未显示完整 pi context bundle 与 Graph guidance 差异。
- 已验证：
  - `npx vitest run src/api/core/__tests__/ForgePiRuntimeClient.test.ts src/api/core/__tests__/ForgePiResourceLoader.test.ts src/api/core/__tests__/ForgePiToolBridge.test.ts src/api/core/__tests__/ForgePiCoreRuntime.test.ts src/api/core/__tests__/ForgePiDependencyGuard.test.ts src/api/core/__tests__/ForgeRuntimeOrchestrator.pi-core.test.ts src/stores/__tests__/useForgeStore.test.ts`
  - `npm run type-check -- --pretty false`

2026-05-20 pi-agent-core 模型适配实现进展：

- 新增 `ForgePiModelAdapter`，默认 runtime 已从占位 kernel 切到 Nexus/HAL 模型适配端口。
- `ForgePiModelAdapter` 复用现有 Nexus preset、`nexus.apis` 配置、`globalNexusOrchestrator.getModelForNode()` 与 AI SDK `streamText()`，不引入新的 provider key 管理策略。
- pi context files 会注入到 system prompt 的结构化 `<pi_context_file>` 片段；模型流式 delta 会转译为 `first_response` 与 `stream_chunk` 事件，继续由现有 `modelRequestTraces` 记录。
- 无可用 Nexus 节点时保留 fallback kernel，用于配置缺失诊断；这不是长期 fallback 主路径。
- 当前仍未完成：
  - Debug Panel / Prompt Preview 仍需要继续展示 pi context bundle、session tree、active skills、Graph guidance vs 实际加载差异。
- 新增验证：
  - `npx vitest run src/api/core/__tests__/ForgePiModelAdapter.test.ts`
  - `npx vitest run src/api/core/__tests__/ForgePiCoreRuntime.test.ts`

2026-05-20 pi-agent-core Review Gate 闭环实现进展：

- `ForgePiToolBridge` 已缓存 pending approval tool call。
- approve 后会执行原工具、返回 `tool_approval_resolved` / `tool_result`，并收集工具产生的 reviewable effects，例如 `upsert_staging_entry`。
- reject 后只返回 rejected `tool_approval_resolved`，不执行工具、不产生 staging effect、不写项目 VFS 或真实 ST 世界书。
- `ForgePiRuntimeClient.resolveToolApproval()` 已保持本地前端 runtime 路径，不访问服务端 `/forge/pi/*`。
- `ForgeRuntimeOrchestrator.resolveToolApproval()` 已接入 pi-core approval resolution；旧 AI SDK tool calling pending run 仍优先按原逻辑处理。
- `ForgePiCoreRuntime.resolveToolApproval()` 会把 `approval_resolved` 与 approved `tool_result` 追加进 pi session tree。
- 新增验证：
  - `npx vitest run src/api/core/__tests__/ForgePiToolBridge.test.ts`
  - `npx vitest run src/api/core/__tests__/ForgePiRuntimeClient.test.ts`
  - `npx vitest run src/api/core/__tests__/ForgeRuntimeOrchestrator.pi-core.test.ts`
  - `npx vitest run src/api/core/__tests__/ForgePiCoreRuntime.test.ts`

2026-05-20 pi-agent-core 调试展示实现进展：

- 新增 `forgePiRuntimePresentation` 展示 helper，统一整理 pi context files、active node、session tree rows、loaded skills 与 extensions。
- `ForgeModelRequestDebugPanel` 已新增 `pi-core` 页签，显示 context bundle、session tree、active node、实际加载技能和 extensions。
- `ForgePromptPreview` 的 Agent 页已新增 pi-core 实际加载区，展示 Graph 建议 skill 与 pi 实际加载 skill 的共同项、Graph-only 项和 pi-only 项。
- 当前仍未完成：
  - Inline trace 从 pi tool events 派生更细粒度 operation item 的专门展示仍可继续增强；现阶段 pi approval/tool events 已进入通用 Forge runtime events 与 timeline effects。
- 新增验证：
  - `npx vitest run src/plugins/forge/__tests__/forgePiRuntimePresentation.test.ts src/stores/__tests__/useForgeStore.test.ts`
  - `npm run type-check -- --pretty false`

2026-05-20 Forge Runtime pi-coding-agent 化迁移进展：

- 已将 Forge Agent 执行入口收敛到前端内嵌版 pi runtime：
  - 新增 `agent-app/ForgePiCoreRuntime`、`session/ForgePiAgentSession`、`ForgePiSessionManager`、`resources/ForgePiResourceLoader`、`extensions/ForgePiExtensionRunner`、`model/ForgePiModelRegistry`、`tools/ForgePiToolBridge`。
  - 结构参考 `D:\Program\pi\packages\coding-agent`，但浏览器端不引入 `@earendil-works/pi-coding-agent`、`pi-agent-core/node` 或 Node-only `fs/child_process`。
- 已移除旧 Forge Agent runtime 主路径：
  - 删除 `ForgeExecutionGateway`、`ForgeAgentLoop`、`ForgeIsolatedSubagent`、旧 AI SDK tool loop fallback 和 `lumina-forge.agentToolCalling.enabled` 语义。
  - `ForgeRuntimeOrchestrator` 只转发到 pi runtime client，不再分支到旧 XML/tool-calling/isolated executor。
- 已移除 Forge Agent XML Action 消费路径：
  - `ForgeAgentController` 不再监听 `FORGE_TRACE` / `FORGE_ACTION_COMPLETED`。
  - `XMLInterceptor` 不再把 Forge XML 标签事件回灌为 Agent effect；全局 XML/LuminaView 展示协议仍保留。
  - `ForgeRuntimeEvent` 删除 `action_completed`。
- 提示词与上下文边界已调整：
  - Forge 只生成 context files/resources、能力索引、阶段状态和 Review Gate 边界。
  - 最终 system prompt / messages / tools / session branch context 由 pi runtime session 组装。
- 已验证：
  - `npx vitest run src/api/core/__tests__/ForgePiDependencyGuard.test.ts`
  - `npx vitest run src/api/core/__tests__/ForgePiToolBridge.test.ts src/api/core/__tests__/ForgePiResourceLoader.test.ts src/api/core/__tests__/ForgePiCoreRuntime.test.ts src/api/core/__tests__/ForgeRuntimeOrchestrator.pi-core.test.ts --testTimeout=20000`
  - `npm run type-check -- --pretty false`

2026-05-20 Forge pi runtime approval resume 补齐：

- 对照 `D:\Program\pi\packages\coding-agent\src\core\agent-session.ts` 与 `D:\Program\pi\packages\agent\src\agent-loop.ts`，确认 pi 原版 Event Flow 是 `agent.prompt()` 后由 agent loop 自动执行 tool call / tool result / next turn，直到 `agent_end`。
- Forge 浏览器版已补齐 Review Gate 后续跑：
  - approve 后 `ForgePiToolBridge` 返回 pi `toolResult` 消息。
  - `ForgePiAgentSession` 将 approved tool result 回接到对应 tool call 后，调用 `agent.continue()`，让模型继续完成最终回复。
  - continuation 产生的 assistant / stream events 继续写入 pi session tree 与 runtime events。
  - reject 仍只记录 rejected approval，不执行工具、不写 staging。
- 已新增回归验证：approve `stageEntry` 后必须触发下一次模型请求并产生最终 `stream_done`。
- 已验证：
  - `npx vitest run src/api/core/__tests__/ForgePiCoreRuntime.test.ts --testTimeout=20000`
  - `npx vitest run src/api/core/__tests__/ForgePiDependencyGuard.test.ts src/api/core/__tests__/ForgePiToolBridge.test.ts src/api/core/__tests__/ForgePiResourceLoader.test.ts src/api/core/__tests__/ForgePiCoreRuntime.test.ts src/api/core/__tests__/ForgeRuntimeOrchestrator.pi-core.test.ts --testTimeout=60000`
  - `npm run type-check -- --pretty false`

2026-05-20 Forge core 结构归位：

- 已将 `luminaweave-extension/src/api/core/forge/` 从平铺结构整理为职责目录：
  - `runtime/`：Agent 控制器、runtime orchestrator、pi runtime client。
  - `agent-app/`：前端内嵌版 pi AgentSession / SessionManager / ResourceLoader / ExtensionRunner / ModelRegistry / ToolBridge。
  - `graph/`：workflow graph、agent graph guidance、working statement。
  - `project/`：项目、协作线程、session repository、worldline、context broker。
  - `prompt/`：Forge prompt context 与 prompt payload resolver。
  - `effects/`：typed effects、shell write parser/interceptor。
  - `skills/`：中文技能与能力 registry。
  - `shell/`：Forge workspace search shell。
  - `forms/`：Forge 表单控制与自动提交目标。
  - `test-chat/`：测试聊天服务、prompt builder、host port。
- 根目录仅保留 `forgeConstants.ts`；空旧目录 `api/core/forge/pi/` 已删除。
- 本次只做结构归位和 import 更新，不改变 Forge runtime 行为。
- 已验证：
  - `npx vitest run src/api/core/__tests__/ForgeAutoSubmitTarget.test.ts src/api/core/__tests__/ForgeAgentGraphRuntime.test.ts src/api/core/__tests__/ForgePiDependencyGuard.test.ts src/api/core/__tests__/ForgePiCoreRuntime.test.ts src/api/core/__tests__/ForgeEffectReducer.test.ts src/api/core/__tests__/ForgeCapabilityRegistry.test.ts src/api/core/__tests__/ForgePiRuntimeClient.test.ts src/api/core/__tests__/ForgePiResourceLoader.test.ts src/api/core/__tests__/ForgePiToolBridge.test.ts src/api/core/__tests__/ForgeProjectDataService.test.ts src/api/core/__tests__/ForgePromptContextService.test.ts src/api/core/__tests__/ForgeWorkspaceSearchShell.test.ts src/api/core/__tests__/ForgeWorkingStatementBuilder.test.ts src/api/core/__tests__/ForgeWorkflowGraph.test.ts src/api/core/__tests__/ForgeTestChatService.test.ts src/api/core/__tests__/ForgeSkillRegistry.test.ts src/api/core/__tests__/ForgeSessionRepository.test.ts src/api/core/__tests__/ForgeRuntimeOrchestrator.pi-core.test.ts src/api/core/__tests__/ForgePromptPayloadResolver.test.ts src/plugins/forge/__tests__/forgePiRuntimePresentation.test.ts src/plugins/forge/__tests__/forgeToolApprovalPresentation.test.ts src/plugins/forge/__tests__/forgeModelRequestToolTracePresentation.test.ts src/stores/__tests__/useForgeStore.test.ts --testTimeout=60000`
  - `npm run type-check -- --pretty false`

2026-05-20 Forge plugin store 拆分第一步：

- 新增 `luminaweave-extension/src/plugins/forge/store/forgeStoreHelpers.ts`。
- 从 `CardMakerStore.ts` 抽出：
  - `BackendPresetMeta` / `BackendPresetDetail`
  - `ForgeTimelineFeedItem`
  - Forge ID 生成 helper
  - runtime preset 解析 helper
  - request node summary、history message、lorebook entry 摘要 helper
  - prompt preset generation settings 解析 helper
- 新增 `forgeStoreHelpers.test.ts` 覆盖 history sanitize 与 lorebook summary 行为。
- `CardMakerStore.ts` 仍保留主状态与 actions；下一步建议继续抽 `runtime actions`、`prompt preview actions`、`review/staging actions`。
- 已验证：
  - `npx vitest run src/plugins/forge/__tests__/forgeStoreHelpers.test.ts src/stores/__tests__/useForgeStore.test.ts --testTimeout=60000`
  - `npx vitest run src/plugins/forge/__tests__/forgeStoreHelpers.test.ts src/plugins/forge/__tests__/forgePiRuntimePresentation.test.ts src/plugins/forge/__tests__/forgeToolApprovalPresentation.test.ts src/plugins/forge/__tests__/forgeModelRequestToolTracePresentation.test.ts src/stores/__tests__/useForgeStore.test.ts src/api/core/__tests__/ForgePiCoreRuntime.test.ts src/api/core/__tests__/ForgeRuntimeOrchestrator.pi-core.test.ts --testTimeout=60000`
  - `npm run type-check -- --pretty false`

2026-05-20 Forge plugin store 拆分第二步：

- 继续收敛 `CardMakerStore.ts` 中可独立测试的状态拼装逻辑：
  - 新增 `ForgeTransientSelectionController`，接管临时表单 / 瞬态选择 scope、提交按钮文案和 submitted scope 状态。
  - 新增 `createForgeMessageNode()`，统一创建 Forge 会话消息节点。
  - 新增 `createAssistantStreamMessageUpdate()`，统一把 `stream_chunk` / `stream_done` runtime event 投影为 assistant message update。
- `CardMakerStore.ts` 仍保留主状态、runtime dispatch、prompt preview 和 review/staging actions；下一步建议继续拆 runtime actions 与 prompt preview builder。
- 新增验证：
  - `npx vitest run src/plugins/forge/__tests__/forgeTransientSelectionController.test.ts`
  - `npx vitest run src/plugins/forge/__tests__/forgeRuntimeStreamPresentation.test.ts src/plugins/forge/__tests__/forgeStoreHelpers.test.ts src/stores/__tests__/useForgeStore.test.ts --testTimeout=60000`
  - `npx vitest run src/plugins/forge/__tests__/forgeTransientSelectionController.test.ts src/plugins/forge/__tests__/forgeRuntimeStreamPresentation.test.ts src/plugins/forge/__tests__/forgeStoreHelpers.test.ts src/plugins/forge/__tests__/forgePiRuntimePresentation.test.ts src/plugins/forge/__tests__/forgeToolApprovalPresentation.test.ts src/plugins/forge/__tests__/forgeModelRequestToolTracePresentation.test.ts src/stores/__tests__/useForgeStore.test.ts src/api/core/__tests__/ForgePiCoreRuntime.test.ts src/api/core/__tests__/ForgeRuntimeOrchestrator.pi-core.test.ts --testTimeout=60000`
  - `npm run type-check -- --pretty false`

2026-05-20 Forge plugin store 拆分第三步：

- 完成 store 拆分第一阶段的三条主线：
  - 新增 `ForgeRuntimeActionController`，接管 runtime command dispatch 生命周期、processing 标记清理、running operation 失败回收和 tool approval fallback。
  - 新增 `forgePromptPreviewAgentContext.ts`，把 Graph prompt source units 与 Prompt Assembly trace 的匹配逻辑、agent context projection 移出主 store。
  - 新增 `ForgeStagingActionController`，把 staging UI 动作统一转为 typed runtime effects，保持 Review Gate / staging 链路一致。
- `CardMakerStore.ts` 从约 2224 行降到约 2089 行；仍保留主状态容器职责。
- 后续若继续拆分，优先级：
  - 完整 `PromptPreviewPayloadBuilder`，抽出 `buildPromptPreviewPayload()` 里的 preset / graph / assembly 汇总逻辑。
  - `ForgeFreezePublishController`，抽出 commit-ready freeze / virtual lorebook publish workflow。
  - `ForgeTestChatActions`，抽出 Agent Inspector/test chat 请求构建与运行。
- 已验证：
  - `npx vitest run src/plugins/forge/__tests__/ForgeRuntimeActionController.test.ts src/plugins/forge/__tests__/ForgeStagingActionController.test.ts src/plugins/forge/__tests__/forgePromptPreviewAgentContext.test.ts src/plugins/forge/__tests__/forgeTransientSelectionController.test.ts src/plugins/forge/__tests__/forgeRuntimeStreamPresentation.test.ts src/plugins/forge/__tests__/forgeStoreHelpers.test.ts src/plugins/forge/__tests__/forgePiRuntimePresentation.test.ts src/plugins/forge/__tests__/forgeToolApprovalPresentation.test.ts src/plugins/forge/__tests__/forgeModelRequestToolTracePresentation.test.ts src/stores/__tests__/useForgeStore.test.ts src/api/core/__tests__/ForgePiCoreRuntime.test.ts src/api/core/__tests__/ForgeRuntimeOrchestrator.pi-core.test.ts --testTimeout=60000`
  - `npm run type-check -- --pretty false`

2026-05-20 Forge plugin store 拆分第四步：

- 继续拆出 review/staging 后续工作流和表单提交链路：
  - 新增 `ForgeFreezePublishController`，接管 commit-ready 条目冻结到 Forge 虚拟世界书/VFS 工作区、commit-ready 移除、workspace write operation 记录、workflow refresh 与提交状态清理。
  - 新增 `ForgeFormSubmissionController`，接管结构化表单 XML 提交、临时 scope 选项汇总为用户输入、瞬态选项清理和提交错误展示。
- `CardMakerStore.ts` 从约 2224 行降到约 2037 行；仍保留主状态容器、Prompt Preview payload builder 和 test chat actions。
- 后续若继续拆分，优先级：
  - 完整 `PromptPreviewPayloadBuilder`，抽出 `buildPromptPreviewPayload()` 的 preset / graph / assembly 汇总逻辑。
  - `ForgeTestChatActions`，抽出 Agent Inspector/test chat 请求构建与运行。
- 已验证：
  - `npx vitest run src/plugins/forge/__tests__/ForgeRuntimeActionController.test.ts src/plugins/forge/__tests__/ForgeStagingActionController.test.ts src/plugins/forge/__tests__/ForgeFreezePublishController.test.ts src/plugins/forge/__tests__/ForgeFormSubmissionController.test.ts src/plugins/forge/__tests__/forgePromptPreviewAgentContext.test.ts src/plugins/forge/__tests__/forgeTransientSelectionController.test.ts src/plugins/forge/__tests__/forgeRuntimeStreamPresentation.test.ts src/plugins/forge/__tests__/forgeStoreHelpers.test.ts src/plugins/forge/__tests__/forgePiRuntimePresentation.test.ts src/plugins/forge/__tests__/forgeToolApprovalPresentation.test.ts src/plugins/forge/__tests__/forgeModelRequestToolTracePresentation.test.ts src/stores/__tests__/useForgeStore.test.ts src/api/core/__tests__/ForgePiCoreRuntime.test.ts src/api/core/__tests__/ForgeRuntimeOrchestrator.pi-core.test.ts --testTimeout=60000`
  - `npm run type-check -- --pretty false`

2026-05-20 Forge plugin store 拆分第五步 / 收束判断：

- 已拆出最后两个大型调试/预览职责：
  - 新增 `ForgePromptPreviewPayloadBuilder`，接管 Prompt Preview bundle 的 preset、Graph、Prompt Assembly、executor seed 汇总。
  - 新增 `ForgeAgentInspectorActions`，接管 Agent Inspector 图谱刷新和 planner / conversation / analyst / executor 测试运行。
- 当前 `plugins/forge/store/` 职责文件：
  - `forgeStoreHelpers.ts`
  - `ForgeTransientSelectionController.ts`
  - `ForgeRuntimeActionController.ts`
  - `ForgeStagingActionController.ts`
  - `ForgeFreezePublishController.ts`
  - `ForgeFormSubmissionController.ts`
  - `forgePromptPreviewAgentContext.ts`
  - `ForgePromptPreviewPayloadBuilder.ts`
  - `ForgeAgentInspectorActions.ts`
- `CardMakerStore.ts` 从约 2224 行降到约 1867 行。
- 收束判断：
  - `api/core/forge/` 已完成职责目录归位。
  - `CardMakerStore.ts` 仍保留主状态容器、controller dependency bridge、session/worldline/form controller 接线和正式 runtime request builder。
  - 继续拆剩余闭包会明显增加依赖穿透，收益低于复杂度；Forge 代码整理阶段在当前边界下视为完成。
  - 下一项不再是结构拆分，而是真实宿主 walkthrough 与 session tree / Review Gate / VFS 持久化恢复验证。
- 已验证：
  - `npx vitest run src/plugins/forge/__tests__/ForgePromptPreviewPayloadBuilder.test.ts src/plugins/forge/__tests__/ForgeAgentInspectorActions.test.ts src/plugins/forge/__tests__/forgePromptPreviewAgentContext.test.ts src/stores/__tests__/useForgeStore.test.ts --testTimeout=60000`
  - `npx vitest run src/plugins/forge/__tests__/ForgeRuntimeActionController.test.ts src/plugins/forge/__tests__/ForgeStagingActionController.test.ts src/plugins/forge/__tests__/ForgeFreezePublishController.test.ts src/plugins/forge/__tests__/ForgeFormSubmissionController.test.ts src/plugins/forge/__tests__/ForgePromptPreviewPayloadBuilder.test.ts src/plugins/forge/__tests__/ForgeAgentInspectorActions.test.ts src/plugins/forge/__tests__/forgePromptPreviewAgentContext.test.ts src/plugins/forge/__tests__/forgeTransientSelectionController.test.ts src/plugins/forge/__tests__/forgeRuntimeStreamPresentation.test.ts src/plugins/forge/__tests__/forgeStoreHelpers.test.ts src/plugins/forge/__tests__/forgePiRuntimePresentation.test.ts src/plugins/forge/__tests__/forgeToolApprovalPresentation.test.ts src/plugins/forge/__tests__/forgeModelRequestToolTracePresentation.test.ts src/stores/__tests__/useForgeStore.test.ts src/api/core/__tests__/ForgePiCoreRuntime.test.ts src/api/core/__tests__/ForgeRuntimeOrchestrator.pi-core.test.ts --testTimeout=60000`
  - `npm run type-check -- --pretty false`

2026-05-20 Forge 预览提示词对齐 pi agent 输出：

- `ForgePiAgentSession` 新增 `preparePrompt()` dry-run 路径，复用正式运行的 `buildContextBundle -> buildSystemPrompt -> loadTools -> branch messages` 合成链路。
- `preparePrompt()` 不调用模型 `streamFn`、不执行工具、不追加 session tree；仅返回 pi 实际 system prompt、prompt messages、context bundle、loaded extensions、active tools 与当前 session snapshot。
- `ForgePiCoreRuntime` / `ForgePiRuntimeClient` 新增 `previewPrompt()`，保持本地 browser pi runtime 路径，不访问服务端 `/forge/pi/*`。
- `ForgePromptPreviewPayloadBuilder` 现在把旧 Forge Prompt Context preview 作为 pi system fragments 输入，再以 pi preview 结果作为主模型 payload；Agent Inspector 的提示词检视会标注 “pi agent 实际输出”、context file 数和 tool 数。
- 旧 Forge Prompt Assembly trace 仍用于来源审阅，但不再作为“主模型最终提示词”的事实源。
- 已验证：
  - `npx vitest run src/api/core/__tests__/forge/ForgePiCoreRuntime.test.ts src/api/core/__tests__/forge/ForgePiRuntimeClient.test.ts src/plugins/forge/__tests__/ForgePromptPreviewPayloadBuilder.test.ts --testTimeout=60000`
  - `npm run type-check -- --pretty false`

2026-05-20 Forge pi-ai 模型协议层对齐：

- 调研修正：`@earendil-works/pi-ai` README 明确支持 browser usage；Forge 前端 runtime 可以使用 pi-ai 的 Context / Message / provider registry / streamSimple。
- 新增 `ForgePiNexusProvider`：
  - Forge pi runtime 对外保持 pi-ai `AssistantMessageEventStream`。
  - provider 直接把现有 Nexus preset / API 配置映射为 pi-ai provider model 与 request options，不再桥接 AI SDK 层。
  - 记录模型请求面板所需 trace：pi 原始 messages、provider payload、provider response、tool summary、lifecycle、final text 和 error。
- `ForgePiModelRegistry` 已收敛为薄 model registry：创建 pi-ai model 并返回 provider 包装的 `streamSimple()` 兼容 streamFn，不再直接拼旧模型协议消息。
- 模型请求调试面板 pi-core 页签新增 `pi-ai 模型请求` 区块，用 trace 显示 provider/model/system prompt/messages/provider payload。
- 已验证：
  - `npx vitest run src/api/core/__tests__/forge/ForgePiNexusProvider.test.ts src/api/core/__tests__/forge/ForgePiModelRegistry.test.ts --testTimeout=60000`
  - `npx vitest run src/api/core/__tests__/forge/ForgePiNexusProvider.test.ts src/api/core/__tests__/forge/ForgePiModelRegistry.test.ts src/api/core/__tests__/forge/ForgePiCoreRuntime.test.ts src/api/core/__tests__/forge/ForgePiRuntimeClient.test.ts src/api/core/__tests__/forge/ForgeRuntimeOrchestrator.pi-core.test.ts src/api/core/__tests__/forge/ForgeEffectReducer.test.ts src/plugins/forge/__tests__/ForgePromptPreviewPayloadBuilder.test.ts src/stores/__tests__/useForgeStore.test.ts --testTimeout=60000`
  - `npm run type-check -- --pretty false`

2026-05-20 Forge Runtime pi-style 架构拆分：

- Core Agent App 已明确落位到 `luminaweave-extension/src/api/core/forge/agent-app/`：
  - `session/`：`ForgePiAgentSession` 与 `ForgePiSessionManager`。
  - `resources/`：`ForgePiResourceLoader`。
  - `extensions/`：`ForgePiExtensionRunner`。
  - `tools/`：`ForgePiToolBridge`。
  - `model/`：`ForgePiModelRegistry` 与 `ForgePiNexusProvider`。
- `src/plugins/forge` 已按 UI 交互职责拆分：
  - `app/`：Forge 主面板与辅助面板壳。
  - `console/`：消息渲染与 inline activity trace。
  - `inspector/`：模型请求调试、Prompt Preview、Agent Inspector 和 presentation helpers。
  - `review/`：Review Gate 与 staging UI。
  - `project/`：项目中心、记忆、世界书、导出面板。
  - `store/`：UI intent 到 runtime/store 的 action controllers。
- 模型请求面板回复 Tab 已改为从 runtime snapshot 派生，回退顺序为 `responseDisplay -> piModelTrace.finalText -> latest assistant node -> 暂无回复内容`，避免“工具调用有输出但回复为空”的展示断层。
- 新增 dependency guard：
  - `src/plugins/forge` 不 import pi-agent-core / pi-ai / AI SDK / agent-app 内部实现。
  - `agent-app` model 层使用 pi-ai，不使用 AI SDK message/tool 协议。
- 已验证：
  - `npx vitest run src/api/core/__tests__/forge/ForgePiDependencyGuard.test.ts src/api/core/__tests__/forge/ForgePiModelRegistry.test.ts src/api/core/__tests__/forge/ForgePiNexusProvider.test.ts src/plugins/forge/__tests__/forgeModelRequestResponsePresentation.test.ts src/plugins/forge/__tests__/forgeModelRequestToolTracePresentation.test.ts src/plugins/forge/__tests__/forgePiRuntimePresentation.test.ts src/plugins/forge/__tests__/forgeToolApprovalPresentation.test.ts --testTimeout=60000`
  - `npx vitest run src/plugins/forge/__tests__ src/api/core/__tests__/forge --testTimeout=60000`
  - `npm run type-check -- --pretty false`

2026-05-20 Forge 模型请求调试 Agent Turn 视图收敛：

- 根因确认：同一个 Forge turn 发生多次 pi-ai provider 调用时，旧结构只保留最后一个 `piModelTrace`，而 tool call/result 来自 pi session tree，因此会出现“工具调用可见、raw/回复只剩最终模型输出”的调试断层。
- 已调整 runtime trace 协议：
  - `ForgePiNexusProvider` 按 requestId 收集 `ForgePiModelRequestTrace[]`，每次 provider 调用生成独立 `traceId` 与 `modelCallIndex`。
  - `ForgePiModelRegistry.getTraces()` 暴露同一 Forge request 下的完整 provider 调用链。
  - `useForgeStore.modelRequestTraces[].piModelTraces` 保存瞬态调用链；`piModelTrace` 继续指向最新收到的单条 trace，供旧展示字段平滑过渡。
- 模型请求调试面板 pi-core 页签已改为“pi-ai 模型请求链路”：
  - 按模型调用折叠展示 system prompt、pi messages、transformed pi messages、provider payload、provider response。
  - 回复 Tab 回退顺序更新为 `responseDisplay -> latest piModelTraces.finalText -> piModelTrace.finalText -> latest assistant node -> 暂无回复内容`。
  - `modelRequestTraces` 仍是前端瞬态调试数据，不作为长期事实源；长期执行事实源仍为 pi session tree / timeline projection。
- 已验证：
  - `npx vitest run src/stores/__tests__/useForgeStore.test.ts src/plugins/forge/__tests__/forgeModelRequestResponsePresentation.test.ts src/api/core/__tests__/forge/ForgePiNexusProvider.test.ts src/api/core/__tests__/forge/ForgePiModelRegistry.test.ts --testTimeout=60000`
  - `npm run type-check -- --pretty false`

2026-05-20 Forge pi session 分支与工作区版本设计：

- 已确认 Forge 插件内的 fork / 回滚 / 切换语义：
  - fork 是同一协作线程内的 pi session tree 分支，不创建新 Forge thread，不复制新的 workspace session。
  - 用户可见回滚/分支优先基于历史 user input 节点；选择 user node 时应切到其 parent，并把原用户输入放回输入框。
  - assistant / tool / staging 节点可用于 checkout 查看；重新生成时应定位到最近 user 分支点。
- 已确认数据源边界：
  - `piSession.entries` 是制卡聊天持久化事实源。
  - `ForgeTimelineItem[]` 是从 pi session tree 派生的 UI projection/cache，可以丢弃、合并或重组 tool/context/assistant 节点。
  - user input、approval、staging proposal、workspace patch/checkpoint、branch summary、label 节点必须保留 pi origin，供 timeline 动作映射回 runtime。
- 已确认文件版本边界：
  - 文件、VFS、staging、虚拟世界书版本由 Forge workspace version manager 负责。
  - 切换对话分支时默认不强制恢复文件，应询问用户“仅切换对话 / 恢复文件版本 / 查看差异”。
  - 辅助面板应基于 workspace patch/checkpoint history 展示文件版本树、单文件历史和 branch diff。
- 设计记录：
  - [Forge pi session 分支与工作区版本设计](./2026-05-20-forge-pi-session-branch-and-workspace-version-design.md)
- 下一步实现顺序：
  - `ForgePiSessionEntry` 持久化类型与 `ForgeWorkspaceSession.piSession`。
  - `ForgePiSessionManager` flat entries / tree / branch / checkout。
  - `ForgePiTimelineProjector` 与 timeline origin。
  - `ForgeWorkspaceVersionManager` patch/checkpoint 与可选恢复。

2026-05-21 Forge pi session 持久化与 timeline 投影第一阶段：

- 已新增共享协议：
  - `ForgePiSessionEntry`
  - `ForgePiPersistedSessionState`
  - `ForgeTimelinePiOrigin`
  - workspace patch / checkpoint payload
- `ForgePiSessionManager` 已从只维护 flat tree snapshot 扩展为 append-only entries：
  - 支持 `getEntries()`、`getTree()`、`toPersistedState()`。
  - 支持从 persisted `initialState` hydrate。
  - 支持 `createBranchFromUserNode()`：切到 user parent，并返回可编辑输入。
- runtime/store/session 持久化链路已接入 entries：
  - `ForgePiAgentSession` / `ForgePiCoreRuntime` / `ForgePiRuntimeClient` 返回 entries。
  - `useForgeStore` 保存 `piSessionEntries`。
  - `ForgeSessionController` serialize / hydrate `piSession`。
  - `ForgeSessionRepository` 通过 ConversationDocument `pluginState.forge.piSession` 保存和恢复。
- runtime/client/store 级分支动作已接入：
  - `checkoutPiNode(nodeId)` 切换 active pi node。
  - `branchFromPiUserNode(userNodeId)` 切到 user parent，并把原请求回填到输入框。
- 已新增 `ForgePiTimelineProjector`：
  - 可从 pi entries 生成 Forge timeline projection。
  - 保留 user / approval / staging / workspace patch/checkpoint 等可操作节点的 pi origin。
  - 支持按 active node 投影当前 branch。
- 已新增 `ForgeWorkspaceVersionManager`：
  - 生成 workspace patch。
  - 生成稳定 checkpoint hash。
  - 支持 patch replay。
- `ForgePiAgentSession.resolveToolApproval()` 会把 `stage_from_shell_write` 记录为 pi `workspace_patch` entry。
- 剩余实现：
  - timeline UI 的 checkout / branch 操作入口与按钮呈现。
  - branch 切换时“仅切换对话 / 恢复文件版本 / 查看差异”确认。
  - 文件版本辅助面板与 branch diff。
- 已验证：
  - `npm run test -- --run src/api/core/__tests__/forge/ForgePiSessionManager.test.ts src/api/core/__tests__/forge/ForgePiTimelineProjector.test.ts src/api/core/__tests__/forge/ForgeWorkspaceVersionManager.test.ts src/api/core/__tests__/forge/ForgePiCoreRuntime.test.ts src/api/core/__tests__/forge/ForgePiRuntimeClient.test.ts src/api/core/__tests__/forge/ForgeSessionRepository.test.ts src/stores/__tests__/useForgeStore.test.ts`
  - `npm run type-check -- --pretty false`

2026-05-21 Forge timeline pi 分支操作接入：

- `ForgeInlineTrace` 已读取 timeline item 的 `origin.runtime === "forge-pi"` 信息，在节点详情中提供：
  - “切换到此处”：对任意 pi-origin 节点调用 `checkoutPiNode(nodeId)`。
  - “从这里分支”：仅对 user 节点调用 `branchFromPiUserNode(nodeId)`，并由 store 回填原用户请求到输入框。
- `CardMakerPanel` 已把 inline trace 操作事件转发到 `CardMakerStore`，UI 层只提交节点意图，不直接修改 pi session tree。
- 当当前 pi session 中存在 workspace patch / checkpoint 时，timeline 分支操作会先通过全局确认弹窗提示“仅切换对话”，不会自动恢复项目文件、暂存区或真实世界书。
- `useForgeStore.setForgePiPersistedSessionState()` 已从 persisted flat entries 重建树结构，避免刷新后 Session Tree 退化为平铺节点。
- 新增 `workspace_versions` 辅助面板：
  - 从 `piSessionEntries` 投影 workspace patch / checkpoint。
  - 展示变更路径、变更类型、before/after hash、checkpoint hash 和 active node。
  - 展示当前分支 / 其他分支变更计数，作为 branch diff 的第一层摘要。
  - patch 行支持展开单文件 inline before/after 内容差异。
  - patch 行提供“恢复变更前 / 恢复变更后”，只生成 Review/Staging 暂存条目，不直接恢复文件、不写真实 ST 世界书。
- `StagingEntry` 已增加 `operation: upsert | delete`：
  - 文件版本恢复遇到 create/delete patch 时可生成 delete 暂存。
  - Review 面板显示删除预览。
  - freeze 到 Forge 项目 VFS 时删除虚拟工作区条目，不再用空内容覆盖。
- workspace patch / checkpoint 时间线节点详情新增“查看文件版本”，可直接切到 `workspace_versions` 辅助面板。
- 剩余实现：
  - 真实宿主 walkthrough。
  - 文件版本恢复端到端手动验证。
- 已验证：
  - `npm run test -- --run src/stores/__tests__/useForgeStore.test.ts src/api/core/__tests__/forge/ForgePiSessionManager.test.ts src/api/core/__tests__/forge/ForgePiTimelineProjector.test.ts src/api/core/__tests__/forge/ForgeWorkspaceVersionManager.test.ts src/api/core/__tests__/forge/ForgePiCoreRuntime.test.ts src/api/core/__tests__/forge/ForgePiRuntimeClient.test.ts src/api/core/__tests__/forge/ForgeSessionRepository.test.ts`
  - `npm run test -- --run src/api/core/__tests__/forge/ForgePiDependencyGuard.test.ts src/plugins/forge/__tests__ src/stores/__tests__/useForgeStore.test.ts --testTimeout=60000`（17 files / 54 tests）
  - `npm run test -- --run src/plugins/forge/__tests__/forgeWorkspaceVersionPresentation.test.ts src/stores/__tests__/useForgeStore.test.ts src/api/core/__tests__/forge/ForgeWorkspaceVersionManager.test.ts`
  - `npm run test -- --run src/plugins/forge/__tests__/forgeWorkspaceVersionPresentation.test.ts src/plugins/forge/__tests__/ForgeFreezePublishController.test.ts src/stores/__tests__/useForgeStore.test.ts`
  - `npm run type-check -- --pretty false`

2026-05-21 Forge Agent 语义 VFS 接入：

- 已新增 `ForgeSemanticVfsMapper`：
  - Agent / 调试 UI / 工具结果展示项目相对路径 `./...`。
  - `./threads/目前/` 动态映射当前 active 协作线程。
  - 历史线程映射为 `./threads/NN标题/`，内部由 `conversationId` 维护稳定映射。
  - `/library/...` 与 `/sources/...` 保持底层 Resource VFS 绝对路径直通，不被项目语义根吞掉。
- Prompt/context 暴露已调整：
- `./AGENTS.md` 作为 Agent 工作契约，不是系统提示词。
- 默认系统提示词暴露到 `./.forge/agent/SYSTEM.md`，当前 mode prompt 暴露到 `./.forge/agent/<MODE>.md`。
  - ResourceLoader 的 context files 改为 `./.pi/agent/context/...`，不向模型暴露 `forgeProjectId` / `conversationId`。
- Skill 暴露已调整：
  - 项目与内置技能对 Agent 统一显示为 `./agent/skills/<skill-name>/SKILL.md`。
  - 项目技能优先，内置技能回退。
  - `readFile("./agent/skills/<skill-name>/SKILL.md")` 在项目 skill 缺失时会回退读取内置 skill 内容。
  - 写入项目中不存在的内置 skill 路径时，不覆盖 bundled base，而是返回 overlay patch proposal：`./.pi/agent/skill-overrides/<skill-name>/SKILL.patch`。
- Tool / Shell 调整：
  - `readFile("./AGENTS.md")`、`readFile("./.forge/agent/SYSTEM.md")` 与 `readFile("./.forge/agent/<MODE>.md")` 可直接读取运行时虚拟文件内容。
  - `readFile` 支持 `./...` 项目语义路径与 `/library` / `/sources` 底层 VFS 路径。
  - `readFile("./threads/目前/messages.md")` 读取当前 runtime context 生成的语义线程 Markdown，不依赖 raw `chat/<conversationId>` 文件。
  - `bash` / Forge shell cwd 显示为 `./`，并将输出中的真实 workspace 路径反向映射为语义路径。
  - `readFile` 与 `bash` 均已通过 `ShellWorkspaceService.listForgeBindings()` 和线程 projection 支持 `./threads/NN标题/...` 历史线程路径。
  - 写入 proposal 只接受项目 workspace 语义路径；资源 VFS 写入仍需专门 fork/import 流程。
- 已验证：
  - `npx vitest run src/api/core/__tests__/forge/ForgeSemanticVfsMapper.test.ts src/api/core/__tests__/forge/ForgeSkillRegistry.test.ts src/api/core/__tests__/forge/ForgePiResourceLoader.test.ts src/api/core/__tests__/forge/ForgePiToolBridge.test.ts src/api/core/__tests__/forge/ForgeWorkspaceSearchShell.test.ts`（5 files / 25 tests）
  - `npm run type-check`

2026-05-21 Forge 项目 VFS 辅助面板接入：

- 新增 `semantic_vfs` 辅助面板与“项目 VFS”入口。
- 修正数据源边界：项目 VFS 面板不再把 raw `/workspaces/forge/<projectId>/...` 目录树直接作为公开内容，而是通过 `ForgeProjectSemanticVfsService` 生成 Agent 可见的语义 VFS 投影。
- 公开内容对齐规划：`./AGENTS.md`、`./.forge/agent/SYSTEM.md`、`./.forge/agent/<MODE>.md`、`./agent/skills/<skill-name>/SKILL.md`、`./memory/AUTO/Checklist.md`、`./memory/用户偏好.md`、`./threads/目前/`、`./threads/NN标题/`、`./lorebook/`、`./review/`。
- raw storage 结构只作为内部映射源：`./chat/<conversationId>/`、`project.json`、`memory/tree.json`、`drafts/tree.json` 不进入 Agent/面板公开项目 VFS。
- `ShellWorkspaceService.listForgeProjectEntries()` 保留为底层 workspace 枚举能力；`CardMakerStore.listProjectVfsEntries()` 已改为返回语义投影。
- 新增 `forgeSemanticVfsPresentation`：
  - 保留树形展示、目录子项清单、文件详情内容和写入边界展示。
  - 项目 VFS 面板现在消费语义服务输出，不再暴露内部 conversation id / project id 给模型或用户主视图。
  - 目录节点会显示子项清单，空目录显示“空目录”，因此 `lorebook/entries/` 等无文件目录不会从面板中消失。
- 已继续收紧语义投影边界：
  - `./threads/目前/thread.md` / `./threads/目前/messages.md` 和 `./threads/NN标题/thread.md` / `./threads/NN标题/messages.md` 成为线程可读入口。
  - raw `lorebook/entries/*.json`、`review/*.json` 与 raw `chat/<conversationId>` 输出不再进入 Agent/面板公开视图。
  - Forge shell 会把 `find .` 等命令输出中的 `./chat/<conversationId>/...` 反向映射为 `./threads/目前/...`。
- 已验证：
  - `npx vitest run src/api/core/__tests__/forge/ForgeProjectSemanticVfsService.test.ts src/api/core/__tests__/forge/ForgePiToolBridge.test.ts src/api/core/__tests__/forge/ForgeSemanticVfsMapper.test.ts src/api/core/__tests__/forge/ForgeWorkspaceSearchShell.test.ts --testTimeout=60000`（4 files / 26 tests）
  - `npm run type-check -- --pretty false`
  - `npx vitest run src/plugins/forge/__tests__ --testTimeout=60000`（16 files / 45 tests）
  - `npx vitest run src/api/core/__tests__/forge --testTimeout=60000`（30 files / 128 tests）

2026-05-21 Forge Semantic VFS 挂载到 HAL Bash：

- HAL shell 调整：
  - `BashTerminalRuntimeOptions.extraMounts` 支持调用方注入通用 `IFileSystem` mount。
  - 默认 mount 顺序保持为 base fs -> `/sources` -> `/library` -> `/workspaces` -> extra mounts。
  - HAL shell 不 import Forge 代码，非 Forge shell 默认行为不变。
- Forge runtime 调整：
  - 新增 `ForgeSemanticVfsProvider`，统一提供 `readFile()` / `listEntries()` 语义项目 VFS 读取。
  - 新增 `ForgeSemanticBashFs`，把 semantic provider 包装为 just-bash `IFileSystem` 并挂载为 Forge shell 项目根。
  - `ForgeWorkspaceSearchShell` 不再依赖 `./... -> /workspaces/forge/<projectId>/...` 的主路径字符串重写；shell cwd 对 Agent 仍显示 `./`。
  - `ForgePiResourceLoader` 从 semantic provider 读取 `./AGENTS.md`、`./.forge/agent/SYSTEM.md` 与 `./.forge/agent/<MODE>.md`。
  - `ForgePiToolBridge.readFile()` 对项目路径优先读取 semantic provider；`/sources/...` 与 `/library/...` 仍走底层 Resource VFS。
  - 写入类 shell 操作通过 `ForgeSemanticBashFs` 记录 write log，并继续转为 Review Gate proposal / staging effect。
- 当前统一数据源：
  - shell `cat ./AGENTS.md`
  - shell `find .`
  - tool `readFile("./agent/skills/<skill-name>/SKILL.md")`
  - ResourceLoader context bundle
  - 项目 VFS 面板 projection
- 已验证：
  - `npx vitest run src/api/core/__tests__/hal/BashTerminalRuntime.test.ts src/api/core/__tests__/forge/ForgeSemanticVfsProvider.test.ts src/api/core/__tests__/forge/ForgeWorkspaceSearchShell.test.ts src/api/core/__tests__/forge/ForgePiResourceLoader.test.ts --testTimeout=60000`（4 files / 14 tests）
  - `npm run type-check -- --pretty false`
  - `npx vitest run src/api/core/__tests__/forge --testTimeout=60000`（31 files / 131 tests）
  - `npx vitest run src/api/core/__tests__/hal --testTimeout=60000`（5 files / 54 tests）
  - `npx vitest run src/plugins/forge/__tests__ --testTimeout=60000`（16 files / 45 tests）

2026-05-21 Forge prompt / Contract VFS 边界迁移：

- `./AGENTS.md` 已从默认系统提示词语义改为 Agent 工作契约：规定工具使用、Review Gate、输出审计、session tree / timeline / rollback 和内部 id 隐藏规则。
- 默认系统提示词迁移为 `./.forge/agent/SYSTEM.md`，模式提示词迁移为 `./.forge/agent/PLANNER.md`、`./.forge/agent/CONVERSATION.md`、`./.forge/agent/ANALYST.md`、`./.forge/agent/EXECUTOR.md`。
- `ForgeProjectSemanticVfsService`、`ForgeSemanticVfsProvider`、`ForgePiResourceLoader`、`ForgePiToolBridge.readFile()` 与 Forge shell 已统一消费 `.forge` prompt 路径；`./.pi/agent/prompts/*.md` 不再进入公开项目 VFS 主视图。
- Prompt / Skill 仍通过 semantic VFS 暴露，workspace 覆盖优先，bundled markdown 只作为 fallback。
- 已验证：
  - `npx vitest run src/api/core/__tests__/forge/ForgeProjectSemanticVfsService.test.ts src/api/core/__tests__/forge/ForgePiResourceLoader.test.ts src/api/core/__tests__/forge/ForgePiToolBridge.test.ts src/api/core/__tests__/forge/ForgeWorkspaceSearchShell.test.ts --testTimeout=60000`（4 files / 22 tests）
  - `npx vitest run src/api/core/__tests__/forge/ForgeSemanticVfsProvider.test.ts src/plugins/forge/__tests__/forgeSemanticVfsPresentation.test.ts --testTimeout=60000`（2 files / 5 tests）

2026-05-21 Forge 预设资源化与 Agent Prompt Orchestration：

- Forge 主预设已从面向 Agent 的 slot 列表迁移为资源包：
  - `./AGENTS.md`
  - `./.forge/agent/SYSTEM.md`
  - `./.forge/agent/PLANNER.md`
  - `./.forge/agent/CONVERSATION.md`
  - `./.forge/agent/ANALYST.md`
  - `./.forge/agent/EXECUTOR.md`
- mode prompt 主路径从 `./.forge/<MODE>.md` 迁移到 `./.forge/agent/<MODE>.md`；旧 `./.forge/<MODE>.md` 不再进入 Semantic VFS 主视图。
- `PromptPresetDefinition` 新增 Forge Agent resource / orchestration 字段，Forge 面向用户和 Agent 的表达改为 `Contract -> System -> Mode Prompt -> Skills -> Capabilities -> Context Files -> Branch Messages`。
- Semantic VFS prompt fallback 优先级已固定为 project override > active preset resources > bundled fallback。
- 已验证：
  - `npx vitest run src/api/core/__tests__/forge/ForgePiResourceLoader.test.ts src/api/core/__tests__/forge/ForgeProjectSemanticVfsService.test.ts src/api/core/__tests__/forge/ForgeSemanticVfsProvider.test.ts src/plugins/forge/__tests__/forgeSemanticVfsPresentation.test.ts src/api/core/__tests__/prompt/PromptPresetRegistry.test.ts --testTimeout=60000`（5 files / 18 tests）
  - `npx vitest run src/api/core/__tests__/forge/ForgePiToolBridge.test.ts src/api/core/__tests__/forge/ForgeWorkspaceSearchShell.test.ts --testTimeout=60000`（2 files / 19 tests）

2026-05-21 Forge Agent 预设工作台同步资源化设计：

- 设置中的 Forge Prompt 预设工作台已改为 Agent 预设工作台：
  - Forge resource preset 显示 `Agent 资源包` 和 `Agent 提示词编排`。
  - 内置 Forge 预设只读展示 `./AGENTS.md`、`./.forge/agent/SYSTEM.md`、`./.forge/agent/<MODE>.md` 与编排步骤。
  - 自定义副本可编辑 Contract / System / Mode prompt 正文。
  - legacy composed / ST test-chat 预设仍保留旧条目顺序编辑入口。
- `ForgePromptPresetInlineSummary` 已显示 `Agent 资源包`、编排步数和技能数，不再把 Forge resource preset 统计为 slot 条目。
- `PromptPresetRegistry.duplicatePreset()` 已修复：复制 Forge 内置预设时保留 `forgeAgentResources` 与 `forgeAgentOrchestration`。
- 已验证：
  - `npx vitest run src/plugins/forge/__tests__/forgePromptPresetPresentation.test.ts --testTimeout=60000`（1 file / 3 tests）
  - `npx vitest run src/api/core/__tests__/prompt/PromptPresetRegistry.test.ts --testTimeout=60000`（1 file / 10 tests）
  - `npx vitest run src/plugins/forge/__tests__ --testTimeout=60000`（17 files / 48 tests）
  - `npm run type-check -- --pretty false`

2026-05-22 Forge Agent 预设工作台 UI 审视优化：

- 按产品 UI 方向将预设工作台调整为三段式：
  - 顶部总览：显示当前预设类型、编辑状态、资源数量、编排步数与技能数。
  - 左侧资源编辑器：按 `Contract / System / Mode / Skills` 分组，内置预设显示只读预览，自定义副本才显示可编辑正文。
  - 右侧编排检查：继续展示 `Contract -> System -> Mode Prompt -> Skills -> Capabilities -> Context Files -> Branch Messages` 的实际装配顺序。
- 请求参数改为折叠区，默认减少对 prompt 资源编辑的干扰。
- legacy composed / ST test-chat 预设继续保留兼容条目编辑入口，并与 Agent resource preset 视觉区分。
- presentation model 已新增 workbench overview 与 resource group 投影，避免 Vue 模板直接推断资源语义。
- 已验证：
  - `npx vitest run src/plugins/forge/__tests__/forgePromptPresetPresentation.test.ts --testTimeout=60000`（1 file / 6 tests）
  - `npm run type-check -- --pretty false`

2026-05-22 Forge 参考提炼技能化与旧 Forge Agent Slot 移除：

- 参考提炼不再作为独立 built-in preset 暴露：
  - 已移除 `built-in:forge-main-reference-extract`。
  - 已移除 `built-in:forge-executor-reference-extract`。
  - 已移除 `built-in:forge-test-chat-reference-extract`。
  - 旧绑定指向这些 preset 时回落到对应默认预设。
- 默认主预设新增三条 preset-provided skills：
  - `./agent/skills/reference-needs-capture/SKILL.md`（需求捕捉与支撑点识别）
  - `./agent/skills/reference-anti-cliche/SKILL.md`（反八股与偏向强化）
  - `./agent/skills/reference-xp-capture/SKILL.md`（XP 捕捉附加条目）
- 三条技能默认 `on_demand`，不常驻 prompt；自定义预设可在技能管理中切换为 `always`。
- Semantic VFS、`skill.list`、`skill.load` 已统一按 project skill > active preset skill > built-in skill 解析。
- Forge Agent 预设工作台继续保留资源包 / 技能 / Agent 提示词编排；主模型和执行模型不再显示旧版 Slot 添加/编辑入口。通用 PromptPresetComposer 与测试聊天 composed 兼容链路不在本次删除范围。
- 已验证：
  - `npx vitest run src/api/core/__tests__/prompt/PromptPresetRegistry.test.ts src/api/core/__tests__/forge/ForgeProjectSemanticVfsService.test.ts src/api/core/__tests__/forge/ForgePiToolBridge.test.ts src/plugins/forge/__tests__/forgePromptPresetPresentation.test.ts --testTimeout=60000`（4 files / 30 tests）
  - `npm run type-check -- --pretty false`
  - `npx vitest run src/api/core/__tests__/prompt src/api/core/__tests__/forge src/plugins/forge/__tests__ --testTimeout=60000`（54 files / 232 tests）
