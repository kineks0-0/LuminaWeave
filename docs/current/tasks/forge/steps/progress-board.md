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
