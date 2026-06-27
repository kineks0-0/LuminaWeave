# Forge 规划文档

> 分类：规划
> 原始文件：`docs/制卡功能规划.md`

## 1. 文档定位

本文件用于澄清 `Lumina Forge` 当前制卡能力的目标形态、已完成内容、缺口与后续实现顺序。

当前最大的两个问题：

1. 制卡在“收集信息”阶段仍过度依赖模型输出长篇说明文字，导致用户要从大段回复里二次摘抄填写。
2. 提示词层、XML 指令层、执行器调用层的职责边界不清，文档里混杂了“交互协议”“提示词内容”“工具调用行为”三种概念。

本版规划将重点修正这两点。

## 2. 当前状态盘点

### 2.1 已有基础

- [x] 独立制卡会话 `sessionChatId`
- [x] 制卡预设加载与前端基础提示词合成
- [x] 附件种子导入与 `SeedHandler` 片段萃取雏形
- [x] `ForgeActivityTrace` 透明追踪流
- [x] `ForgeStagingArea` 暂存区雏形
- [x] Planner / Executor 双角色方向已确定
- [x] Forge 会话已开始迁移到统一世界线节点结构

### 2.2 仍未完成

- [ ] 世界书 / 条目索引的前端注入策略未正式定稿
- [x] “分段收集信息”已切换为“对话优先 + 临时组件辅助 + 持久表单后置”的 DSL 驱动收集
- [ ] Planner 的“何时进入下一步”仍缺少明确定义
- [ ] Prompt 分层与 XML 指令协议尚未彻底拆开
- [ ] Diff 审核流还没有完整接到 Executor 的正式写回链路

## 3. 核心改动方向

### 3.1 不再让模型输出大段“请填写以下内容”

旧方式的问题：

- 模型会输出一大段说明性文字，例如“请提供以下信息，我会将其整合为规范的结构化角色卡……”
- 用户需要从文本里找字段，再手动复制回答
- 表单结构不可控，模型容易忘字段、调顺序、塞解释
- UI 无法直接复用已有 DSL 渲染能力

新方式：

- Planner 不再负责“用自然语言罗列待填项”
- Planner 负责输出结构化的 **收集组件 DSL**
- 前端把 DSL 渲染成可直接填写的输入组件
- 用户填写后，前端将结构化结果回送给 Planner
- Planner 基于结构化结果继续推进，而不是再次要求用户读长文

这意味着 Forge 的“提问”要从 `文本问答` 升级成 `对话优先的组件驱动收集`。

## 4. Forge 收集式 DSL 设计

### 4.1 总原则

- Forge 复用现有 LuminaView / `<V>` 体系，避免另起一套 UI 协议
- 模型只声明“需要什么字段”，不负责渲染细节
- 输入组件必须可以双向绑定到 Forge 当前步骤状态
- 组件支持草稿态，不要求一次填完
- 用户随时可以跳过、稍后补充或切换为自由对话模式
- 默认先走自然对话；只有缺口稳定且结构化填写更高效时，才切到持久表单
- 多个临时组件共存时，由前端统一提供消息级底部提交区，不要求模型重复输出提交按钮

### 4.2 推荐新增组件

首批建议引入以下块组件：

- `ForgeForm`
  - 用于定义一个收集任务容器
- `ForgeInput`
  - 单行输入，如姓名、代号、职业
- `ForgeTextarea`
  - 多行输入，如背景故事、性格描述
- `ForgeSelect`
  - 枚举选择，如文风、阵营、叙事侧重
- `ForgeChecklist`
  - 多选项，如能力标签、禁忌、关键词
- `ForgeChoiceGroup`
  - 长文本单选，支持“正文 + 按钮描述”
- `ForgeFacetChecklist`
  - 长文本多选，支持“正文 + 按钮描述”
- `ForgeStep`
  - 步骤导航，用于“当前步骤 / 下一步 / 稍后补完”
- `ForgeSummaryCard`
  - 展示当前已收集字段的摘要
- `ForgeMissingFields`
  - 告知还缺哪些高优先级字段

### 4.3 推荐 DSL 形态

建议走现有 `<V>` 内函数式 DSL，而不是发明新的 XML 主协议。

示例：

```xml
<V>
ForgeForm(
  id="role_core_profile",
  title="角色基元采集",
  description="先补齐角色的最小可运行骨架。"
)

ForgeInput(
  key="name",
  label="角色姓名",
  placeholder="例如：林雾、Project Raven"
)

ForgeInput(
  key="identity",
  label="一句话核心设定",
  placeholder="例如：失忆的教会审讯官，能听见神谕残响"
)

ForgeSelect(
  key="faction",
  label="阵营 / 立场",
  options="教会|帝国|雇佣兵|中立|未定"
)

ForgeTextarea(
  key="background",
  label="背景故事",
  placeholder="描述成长经历、重大创伤、当前处境"
)

ForgeMissingFields(
  fields="name,identity,background"
)
```

前端不直接把这段原样展示给用户，而是渲染为真正的表单。

### 4.4 用户填写后的回传格式

用户提交后，前端向 Planner 注入结构化结果，而不是自然语言拼接长段摘要。

建议回传为：

```xml
<FORGE_FORM_RESULT form="role_core_profile">
  <FIELD key="name">林雾</FIELD>
  <FIELD key="identity">失忆的教会审讯官，能听见神谕残响</FIELD>
  <FIELD key="faction">教会</FIELD>
  <FIELD key="background">幼年在边境修道院长大，成年后加入审讯庭……</FIELD>
</FORGE_FORM_RESULT>
```

这样 Planner 可以稳定读取字段，不必从自由文本里做信息抽取。

## 5. 制卡开局模式重构

### 5.1 详细定制模式

- 默认先通过自然语言摸清方向、偏好、协作方式与约束
- 可按需插入 `ForgeChoiceGroup`、`ForgeFacetChecklist`、`ForgeInput` 等临时组件辅助收集
- 只有当字段缺口已稳定、且集中录入明显更高效时，Planner 才切入持久 `ForgeForm`

### 5.2 素材引导模式

- 用户上传文本 / 设定片段
- `SeedHandler` 先做片段萃取
- 用户勾选高代表性片段
- Planner 根据片段先产出一份 `ForgeSummaryCard + ForgeMissingFields`
- 然后再渲染补充表单，而不是让模型问一大堆自然语言问题

### 5.3 分段迭代模式

- Planner 每次只收集当前步骤的 3-5 个关键字段
- 当前步骤完成后，Planner 才能申请下一步
- 每一步都优先自然语言给出下一步引导，再按需配合组件，而不是长文提问

### 5.4 自由对话模式

- 允许闲聊
- Planner 后台自动提取信息并尝试补全字段
- 当关键字段缺失时，优先追加最小临时组件；只有持续缺失且结构已稳定时才切持久表单

## 6. Prompt、协议、工具调用重新拆层

这是本次规划最需要厘清的部分。

### 6.1 第一层：Prompt 层

Prompt 只负责定义模型的行为规则，不负责承载具体工具调用结果。

Prompt 应拆成四块：

1. `Forge Planner System Prompt`
   - 规定 Planner 的角色
   - 规定默认先自然语言回应，再按需输出 DSL 组件
   - 规定什么时候允许进入下一步
2. `Forge Executor System Prompt`
   - 规定 Executor 只负责重写，不负责闲聊与收集表单
3. `Forge Context Payload`
   - 当前表单结果
   - 当前已激活条目
   - 种子片段摘要
   - 当前步骤状态
4. `Forge Output Protocol`
   - 定义可用 XML 标签和 `<V>` DSL 输出规则

结论：

- Prompt 是“规则和上下文”
- 不是“工具调用本体”
- 不是“UI 组件渲染代码”

### 6.2 第二层：协议层

协议层负责告诉模型“你可以输出哪些结构”。

Forge 目前应统一为三类输出：

1. 展示型
   - `<V> ... </V>`
   - 用于渲染 `ForgeForm`、摘要卡、缺失项提示等
2. 追踪型
   - `<forge_skill name="...">...</forge_skill>`
   - 用于活动追踪
3. 操作型
   - `<draft_plan>`
   - `<entry_update>`
   - `<entry_read />`
   - `<forge_step_request target="..." />`
   - `<forge_form_result_request form="..." />`

结论：

- DSL 属于展示协议
- XML 标签属于操作协议
- 两者不能混写成“提示词里的一堆说明”

### 6.3 第三层：控制 / 工具调用层

控制层负责解释 XML 指令并执行真实动作。

这里建议明确：

- `Planner` 不直接写后端
- `Planner` 只能提出“查看 / 规划 / 请求收集 / 申请下一步”
- `Executor` 只在控制层批准后运行隔离重写
- 真正的条目读取、差异对比、正式写回，都由前端控制器执行

也就是：

- 模型输出的是“意图”
- 控制层决定是否执行
- 持久化层负责真正落盘

## 7. Forge 推荐指令集

### 7.1 应保留

- `<forge_skill name="...">...</forge_skill>`
- `<draft_plan>...</draft_plan>`
- `<entry_update id="...">...</entry_update>`

### 7.2 应新增

- `<entry_read id="..."/>`
  - 请求读取某个条目全文
- `<forge_step_request target="..."/>`
  - 请求进入下一步骤
- `<forge_collect form="..."/>`
  - 请求前端渲染某个表单收集块
- `<forge_summary target="...">...</forge_summary>`
  - 输出当前阶段摘要

### 7.3 应弱化

- 让模型直接输出“请提供以下信息……”的大段自然语言
- 让模型同时负责提问、解释、总结、写回、审批

## 8. Planner / Executor 职责重定义

### 8.1 Planner

职责：

- 与用户讨论目标
- 判断当前缺失哪些关键字段
- 优先输出 `ForgeForm` / `ForgeSummaryCard`
- 产出 `<draft_plan>`
- 请求查看条目或请求下一步

禁止：

- 直接执行正式写回
- 在信息收集阶段输出冗长“填表说明书”
- 把所有缺失字段一次性堆成一大段文字

### 8.2 Executor

职责：

- 接收已批准的计划与原文
- 做短上下文高精度重写
- 只输出重写结果，不做闲聊

上下文构造：

- `[执行指令]`
- `[目标条目原文]`
- `[已批准 draft_plan]`
- `[必要的角色卡摘要 / 风格约束]`

### 8.3 Controller

职责：

- 解析 XML / DSL
- 维护步骤状态
- 渲染组件并收集用户输入
- 决定何时调用 Executor
- 将结果放入 `Staging Area`
- 在用户确认后正式写回

## 9. 推荐的制卡一般流程

### 9.1 阶段 0：启动

- 用户选择模式：详细表单 / 素材引导 / 分段迭代 / 自由对话
- 系统初始化 Forge 会话与步骤状态

### 9.2 阶段 1：最小角色骨架

先只收集最关键字段：

- 姓名 / 代号
- 一句话核心设定
- 身份 / 阵营 / 种族
- 核心冲突
- 背景概述

这一阶段必须优先使用 `ForgeForm`。

### 9.3 阶段 2：叙事与表现方式

- 核心体验
- 文风
- 对话风格
- 描写侧重

可混合 `ForgeSelect + ForgeTextarea`。

### 9.4 阶段 3：结构化扩展

- 世界规则
- 社交网络
- 行为模式
- 变量与状态机
- 触发器与演化规则

此阶段可以切换到“基元工作台 + 差异中心”。

### 9.5 阶段 4：重写与导出

- Planner 产出重写计划
- Executor 生成候选文本
- Diff 中心供用户审核
- 审批后正式写回
- 导出 ST 角色卡 / 世界书资产

## 10. UI 工作台规划

### 10.1 主聊天区

- 使用统一节点流承载 Forge 对话
- 用户输入、Planner 输出、Executor 结果都进入同一世界线
- 允许世界线面板切换查看 Forge 会话

### 10.2 右侧工作区

- 当前实现已将 `Activity Trace` 合并进主聊天流，作为与消息并列的过程事件流展示
- 右侧工作区优先承载“当前世界书条目浏览 / 编辑”，便于在 Forge 过程中直接查看和修订条目
- `Staging Area`
- `Diff Center`
- `Primitive Workspace`

### 10.3 组件式收集区

这里是本次最关键的新要求：

- 不把“待填写内容”作为普通消息文本展示
- 而是在消息流中渲染为交互组件
- 用户填写后直接产生结构化字段结果
- 结果可继续进入世界线节点，形成可追踪的“收集历史”

### 10.4 Forge 会话视图数据结构补充

- UI 层不应只消费“纯消息数组”，而应逐步演进为 `会话 Feed`
- Feed 至少应支持两类项：
  - `message`：用户 / Planner / Executor 消息节点
  - `trace`：`forge_skill`、`draft_plan`、`entry_update` 等过程事件
- 时间线仍以 `WorldlineStore` 的节点图为主，不建议把 `trace` 直接塞进世界线节点池
- 若后续引入 `ForgeForm`、步骤节点、Diff 审核节点，可继续在 Feed 层扩展新类型，而不是污染底层世界线消息模型

## 11. 记忆与上下文策略

### 11.1 Focused Lens 继续保留

- `Index`
  - 永远存在的极简条目索引
- `Active Focused`
  - 当前激活条目的全文
- `Deep Sleep Summary`
  - 非激活条目的高权重摘要

### 11.2 Forge 表单结果也属于上下文资产

新增一层：

- `Structured Form State`
  - 当前步骤已采集字段
  - 字段缺失情况
  - 用户明确锁定的字段

这层不应和世界书正文混在一起，而应作为 Forge 专用上下文输入给 Planner。

## 12. 存储边界

- Forge 中间产物存储在 Lumina 后端
- 不污染 ST 原生角色卡与世界书
- 只有在导出阶段才转换为 ST 资产
- 表单草稿、步骤状态、Diff 审核记录也应作为 Forge 专属数据存储

## 13. 推荐实现顺序

### 13.1 第一阶段

- [ ] Forge 从单页工作台扩展为“两页式结构”
- [ ] 保持默认 `workspace` 页面不变
- [ ] 新增 `session-browser` 页面，用于切换历史聊天会话与 Forge 工作会话
- [ ] 新增 Forge 工作会话持久化，支持关闭插件后继续

### 13.2 第二阶段

- [ ] 引入历史聊天会话索引层
- [ ] 支持在 Forge 中选择历史聊天会话作为参考源
- [ ] 支持新建 Forge 工作会话
- [ ] 支持恢复已有 Forge 工作会话

### 13.3 第三阶段

- [ ] 右侧世界书条目支持版本视图模式
- [ ] 支持 `follow-timeline / pinned / manual-version`
- [ ] 世界书条目可随时间线节点回溯内容
- [ ] 支持固定当前版本或手动切换版本

### 13.4 第四阶段

- [ ] 前端记忆系统与消息列表结构分层重构
- [ ] 抽离会话索引层、会话详情层、记忆快照层、展示派生层
- [ ] PromptBuilder 改为消费结构化记忆快照，而不是仅依赖当前消息数组与世界书当前态
- [ ] 导出为 ST 资产

## 14. Forge 页面结构调整

### 14.1 默认工作台页 (`workspace`)

- 继续保留当前 Forge 主工作台作为默认页面
- 保持当前主聊天区、右侧世界书区、底部输入器的核心交互不变
- 当前已经完成的 Prompt 预览、内嵌 Activity 流、Staging Area 继续保留在此页

### 14.2 会话选择页 (`session-browser`)

- Forge 内部新增一个独立页面，用于浏览和切换会话
- 该页面不替代默认工作台，只通过顶部工具栏或会话入口显式切换进入
- 页面至少展示两类会话：
  - `历史聊天会话`
  - `Forge 工作会话`
- 页面支持的最小动作：
  - 选择某个历史聊天会话作为当前 Forge 参考源
  - 打开某个已有 Forge 工作会话
  - 新建 Forge 工作会话

### 14.3 会话切换原则

- `历史聊天会话` 与 `Forge 工作会话` 必须保持概念分离
- 选择历史聊天会话时，不直接替换 Forge 工作会话本身
- Forge 工作会话只记录：
  - 当前绑定的历史聊天会话
  - 当前选中的聊天快照/节点
  - 当前制卡工作状态

## 15. 会话与状态结构规划

### 15.1 历史聊天会话索引

建议新增轻量引用对象 `ChatSessionRef`，用于 Forge 的历史聊天会话列表展示。

建议最少字段：

- `id`
- `title`
- `source`
- `createdAt`
- `updatedAt`
- `messageCount`
- `summary`
- `previewMessage`

### 15.2 Forge 工作会话

建议新增 `ForgeWorkspaceSession`，用于保存 Forge 自身的可恢复工作状态。

建议最少字段：

- `id`
- `title`
- `createdAt`
- `updatedAt`
- `presetId`
- `activeLeafId`
- `worldlineNodes`
- `selectedChatSessionId`
- `selectedChatSnapshotId`
- `draftInput`
- `stagingEntries`
- `selectedReferences`
- `workspaceMode`

### 15.3 聊天快照

建议新增 `ChatSessionSnapshot`，用于保存被 Forge 引用的历史聊天会话在某个节点/时点下的稳定视图。

建议最少字段：

- `id`
- `chatSessionId`
- `activeLeafId`
- `messages`
- `timelineGraph`
- `memorySnapshot`
- `createdAt`

### 15.4 前端状态分层

当前前端的记忆系统与消息列表结构偏临时态，建议分为四层：

1. `SessionIndexLayer`
   - 管理历史聊天会话索引与 Forge 工作会话索引
2. `ConversationStateLayer`
   - 管理当前展开会话的详细数据
3. `MemoryStateLayer`
   - 管理当前节点/快照下解析出来的记忆视图
4. `PresentationLayer`
   - 管理 UI 消费的派生展示数据

结论：

- `MessageListManager` 应收敛为“当前活动链消息视图管理器”
- 不再默认承担会话列表与记忆聚合职责

## 16. 世界书条目与时间线联动

### 16.1 世界书版本视图模式

右侧世界书区建议新增三种查看模式：

- `follow-timeline`
  - 默认模式，条目内容跟随当前时间线节点/快照变化
- `pinned`
  - 固定当前版本，后续时间线跳转不自动改变
- `manual-version`
  - 用户手动切换条目版本

### 16.2 世界书回溯目标

- 当 Forge 或聊天时间线切换到过去节点时，右侧世界书应能解析出该时点对应的条目内容
- 右侧世界书不应只展示“当前全局最新值”
- 条目编辑器应能标明：
  - 当前内容来源于哪个节点/快照
  - 当前是否处于跟随模式、固定模式或手动模式

### 16.3 建议的前端解析层

建议增加“世界书时间线解析器”，输入：

- 当前会话 id
- 当前 active node id
- 当前版本模式
- 当前选中的世界书条目

输出：

- 当前应显示的世界书条目视图结果

这层优先作为前端视图解析层实现，不要求第一阶段就修改底层世界书物理存储格式

## 17. 文件级落点建议

### 17.1 Forge 页面与会话

- `luminaweave-extension/src/plugins/forge/CardMakerPanel.vue`
  - 从单页扩展为 `workspace / session-browser` 两页状态
- `luminaweave-extension/src/plugins/forge/project/ForgeSessionBrowser.vue`
  - 项目中心单列资源树，按项目展开协作线程
- `luminaweave-extension/src/plugins/forge/project/forgeProjectCenterPresentation.ts`
  - 项目中心行与菜单展示模型
- `luminaweave-extension/src/plugins/forge/ForgeSessionToolbar.vue`
  - 新增顶部会话工具条
- `luminaweave-extension/src/plugins/forge/CardMakerStore.ts`
  - 收敛为当前激活 Forge 工作会话详情 store

### 17.2 会话索引与持久化

- `luminaweave-extension/src/stores/useSessionIndexStore.ts`
  - 新增会话索引层
- `luminaweave-extension/src/types/SessionTypes.ts`
  - 新增会话相关类型定义
- `luminaweave-extension/src/api/core/ForgeSessionRepository.ts`
  - 新增 Forge 工作会话持久化入口
- `luminaweave-extension/src/api/core/ForgeSessionMapper.ts`
  - 新增运行态与持久化对象互转映射
- `luminaweave-extension/src/api/core/ChatSessionIndexService.ts`
  - 新增历史聊天会话索引读取能力

### 17.3 世界书与记忆视图

- `luminaweave-extension/src/api/core/LorebookTimelineResolver.ts`
  - 新增世界书条目时间线解析器
- `luminaweave-extension/src/types/LorebookViewTypes.ts`
  - 新增世界书版本视图类型
- `luminaweave-extension/src/plugins/lorebook/LorebookRoot.vue`
  - 增加版本模式切换与版本来源显示
- `luminaweave-extension/src/plugins/lorebook/LorebookEditor.vue`
  - 增加当前版本信息与固定版本动作
- `luminaweave-extension/src/api/core/LorebookManager.ts`
  - 扩展为支持版本视图状态
- `luminaweave-extension/src/api/core/MemoryViewResolver.ts`
  - 新增记忆视图解析器
- `luminaweave-extension/src/types/MemorySnapshotTypes.ts`
  - 新增记忆快照类型
- `luminaweave-extension/src/stores/useConversationViewStore.ts`
  - 新增会话展示聚合层

### 17.4 保持轻量职责的现有文件

- `luminaweave-extension/src/api/core/MessageListManager.ts`
  - 保持为“当前活动链消息视图”职责，不再扩大会话索引责任
- `luminaweave-extension/src/stores/useChatStore.ts`
  - 保持为“当前聊天视图模型”
- `luminaweave-extension/src/api/core/WorldlineStore.ts`
  - 暂不重写底层图结构，优先在其上增加索引层与解析层
- `luminaweave-extension/src/api/core/PromptBuilder.ts`
  - 后续改为消费结构化记忆快照

## 18. 已执行进展

截至当前实现，以下内容已经落地：

- Forge 右侧世界书区域不再直接依赖世界书插件根壳，已抽出可复用组件 `luminaweave-extension/src/plugins/lorebook/components/LorebookWorkspace.vue`
- 世界书插件入口 `luminaweave-extension/src/plugins/lorebook/LorebookRoot.vue` 已收敛为薄包装组件，便于其他子插件按 UI 组件方式复用
- Forge 工作台已改为直接接入 `LorebookWorkspace`，并明确使用 Forge 时间线源
- 世界书前端已补最小版本视图骨架：
  - `follow-timeline`
  - `pinned`
  - `manual`
- `LorebookManager` 已增加前端快照索引与版本视图状态，但当前仍未重做底层世界书物理存储格式
- `useTimelineStore` 已补 `activeContext`，便于世界书和后续记忆系统按来源解析当前时间线上下文

## 19. 开放问题

1. Forge 收集组件是否全部复用 `chat/components/blocks` 体系，还是在 Forge 下单独建一组组件。
   - 建议：优先复用现有 LuminaView 体系，只增加 Forge 专属 block。
2. Planner 是否允许在自由对话模式下退回普通文本追问。
   - 建议：允许，但只作为降级路径，不作为默认路径。
3. Executor 是否默认启用。
   - 建议：默认启用隔离 Executor，因为制卡质量优先于成本。
4. `entry_read` 是下一轮注入还是流式即时回填。
   - 建议：优先做“下一轮注入”，实现更稳；即时回填作为增强项。
5. 历史聊天会话列表的数据源是仅限当前已加载上下文，还是需要覆盖更完整的 ST 历史会话索引。
   - 当前未验证，建议第一阶段先做“当前可访问聊天会话索引”。
6. 世界书版本视图是仅在前端做解析，还是需要补到底层版本化存储。
   - 当前未验证，建议第一阶段优先做前端解析层。
    
