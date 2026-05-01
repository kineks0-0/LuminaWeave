# Forge 实现与技术交接（2026-04-09）

> 分类：实现
> 原始文件：`docs/Forge_提示词与上下文库选型交接_2026-04-09.md`

本文档用于承接本轮关于 `Lumina Forge`“提示词合成”和“上下文管理”是否应引入成熟库的讨论结论，供后续实现与重构时直接参考。

## 1. 文档目标

本文件只回答以下问题：

1. Forge 当前的提示词合成链路由哪些部分组成。
2. Forge 当前的上下文管理链路由哪些部分组成。
3. 哪些部分适合引入成熟库。
4. 哪些部分不应被现成框架直接接管。
5. 后续若要改造，最小正确路径是什么。

不扩展讨论以下内容：

- Forge 收集式 DSL 详细协议设计
- 世界书版本仓库的底层物理实现
- Chat 主链路的全面重构方案

## 2. 当前代码事实

基于当前仓库代码，Forge 并不是“尚未实现提示词系统”，而是已经具备一条可运行的前端合成链路。

### 2.1 输入

Forge 当前生成链路实际消费的输入包括：

- Forge 当前工作会话消息树
- 选中的 preset
- 当前解析出的世界书视图
- 当前会话记忆快照
- 用户在 Forge 输入框中的当前输入

对应代码入口：

- `luminaweave-extension/src/plugins/forge/CardMakerStore.ts`
- `luminaweave-extension/src/api/core/PromptBuilder.ts`
- `luminaweave-extension/src/api/core/LorebookTimelineResolver.ts`
- `luminaweave-extension/src/api/core/MemoryViewResolver.ts`

### 2.2 处理流程

Forge 当前提示词与上下文处理链路可概括为：

1. `CardMakerStore.generate()` 收集当前用户输入并写入 Forge 世界线。
2. `buildPromptPreviewPayload()` 读取 preset，解析当前世界书视图，构建 `MemorySnapshot`。
3. `PromptBuilder.buildActiveMessages()` 合成最终 `messages`：
   - 宏替换
   - system prompt 拼接
   - 世界书条目注入
   - 记忆快照摘要注入
   - 用户 / 助手消息拼接
4. `llmEngine.cleanMessages()` 做最终消息清洗。
5. `LuminaGenerationTask` 发起生成。

### 2.3 状态变化

当前上下文并不是单纯“chat history 数组”，而是由多层状态共同决定：

- Forge 世界线节点状态
- 当前 active leaf
- 世界书版本视图状态
- 参考聊天会话绑定状态
- 记忆快照摘要状态
- DCC 压缩后的消息显示状态（全量 / 摘要 / 隐藏）

### 2.4 输出

当前链路主要输出两类结果：

- 发给模型的最终消息数组
- 供 UI 预览的 prompt preview 内容

Executor 隔离重写链路还有一条单独输出：

- 不带历史上下文的极简重写 prompt

对应代码入口：

- `luminaweave-extension/src/api/core/ForgeAgentController.ts`

## 3. 当前职责分布

### 3.1 已有提示词合成职责

`PromptBuilder` 当前已承担：

- system prompt 基础拼装
- ST 宏替换
- 世界书条目拼接
- 会话记忆快照拼接
- 最终消息数组输出

结论：

- Forge 的“提示词合成”已经存在，不是空缺能力。
- 当前问题主要是“字符串拼接逐渐膨胀”，而不是“完全没有基础设施”。

### 3.2 已有上下文管理职责

`ContextCompactor` 当前已承担：

- 发送前消息窗口裁剪
- 摘要区 / 全量区 / 隐藏区判定
- 摘要来源解析
- 与 ST 同步形态对齐

`MemoryManager` 当前已承担：

- provider 快照注册
- 节点级 snapshot 捕获
- delta 冲刷
- 按 trace 恢复状态

结论：

- Forge / Chat 当前的“上下文管理”不是单点模块，而是“世界线 + 记忆快照 + DCC 压缩 + 世界书视图”共同形成。
- 这部分已经深度绑定 Lumina 自身领域模型。

## 4. 成熟库适配判断

这里将“提示词合成”和“上下文管理”拆开判断，而不是笼统地问“要不要上 Agent/RAG 框架”。

### 4.1 适合引入成熟库的部分

#### A. Prompt 模板层

适合引入：

- `LangChain` Prompt Templates
- `Mustache`
- `Handlebars`

适用目标：

- 把 system prompt 中日益增多的字符串拼接改成显式模板
- 把不同角色 Prompt（Planner / Executor / Preview）拆成可复用模板
- 减少 if/else 拼接导致的可读性下降

不负责：

- 世界书视图解析
- 记忆快照生成
- Forge 世界线节点恢复

结论：

- 这部分适合引库。
- 如果追求最小改造成本，优先选轻量模板库即可。
- 如果后续明确要接入工作流框架，可直接使用 `LangChain` 的 Prompt Template 能力。

#### B. 流式消息状态层

适合参考或局部引入：

- `Vercel AI SDK`

适用目标：

- 简化流式消息状态管理
- 简化 provider 调用抽象
- 优化前端生成流的封装体验

不负责：

- Forge 时间线
- Lumina 节点树
- 世界书版本视图
- Snapshot / Delta 恢复

结论：

- 可参考其消息流组织方式。
- 但不应期待它接管 Lumina 的上下文模型。

### 4.2 可以评估但不建议立即接管的部分

#### C. Agent 工作流 / 持久化状态图

可评估：

- `LangGraph`

适用前提：

- Forge 后续真的要演进为明确的多阶段工作流：
  - Planner
  - 读取条目
  - 请求补充字段
  - 审批
  - Executor
  - 写回

其价值主要在：

- 状态图定义
- 节点间持久化
- checkpoint
- 短期记忆 / 长期记忆组织

当前不建议立即接管的原因：

- 当前 Forge 的领域状态核心不在“通用 agent memory”，而在 Lumina 自己的时间线、条目视图和会话快照。
- 如果在现阶段直接让 LangGraph 接管整个上下文，会把现有领域模型和通用 agent state 混在一起。
- 成本高于收益，且容易产生双重状态源。

结论：

- 可以作为 Forge 第二阶段工作流编排层候选。
- 不建议在当前阶段直接替换现有上下文核心。

### 4.3 当前不应直接外包给成熟库的部分

以下能力不建议直接交给现成库接管：

- `WorldlineStore` 的节点图与 active leaf 语义
- `MemoryManager` 的 snapshot / delta 恢复逻辑
- `ContextCompactor` 的三态压缩逻辑
- 世界书时间线视图解析
- ST 宿主宏替换与上下文兼容逻辑
- XML 协议与 Forge DSL 的解释执行

原因不是“外部库做不到”，而是：

- 这些能力已经和 Lumina 的领域模型深度耦合。
- 即使引入外部框架，也仍需在外层重建一层适配。
- 直接替换会造成更高的状态迁移成本和调试复杂度。

## 5. 推荐决策

### 5.1 总体判断

建议采用“局部引库，核心自持”的方案。

即：

- 可以引入库处理 Prompt 模板化与局部工作流辅助。
- 不应让外部框架直接接管 Forge 当前的上下文核心。

### 5.2 最小正确方案

第一阶段建议只做下面三件事：

1. 保留现有：
   - `PromptBuilder`
   - `ContextCompactor`
   - `MemoryManager`
   - `WorldlineStore`
2. 把 `PromptBuilder` 中的 system prompt 拼接改为模板化。
3. 把 Planner / Executor / Preview prompt 拆成独立模板资源，而不是继续把规则写死在 TS 字符串里。

这条路径的好处是：

- 不改变现有上下文事实来源
- 不引入第二套 memory / thread / graph 状态源
- 能先解决 prompt 可维护性问题

### 5.3 第二阶段候选

仅当 Forge 明确进入“多阶段可恢复工作流”后，再评估：

- 是否引入 `LangGraph` 作为 Planner-Executor 编排层
- 是否抽离 Forge 专用 workflow state
- 是否让 XML 指令执行从“事件监听”升级为“图节点驱动”

前提条件：

- Forge 步骤状态已经稳定
- 条目读取 / 暂存 / 审批 / 写回链路已经闭合
- 能明确区分：
  - Lumina 领域状态
  - Workflow 控制状态

## 6. 链路检查

按“输入、处理流程、状态变化、输出、上下游影响”检查如下。

### 6.1 输入检查

当前输入来源已知且可在代码中定位：

- preset
- Forge 会话消息
- 世界书解析结果
- MemorySnapshot
- 用户输入

未发现必须依赖外部框架才能成立的输入环节。

### 6.2 处理流程检查

当前处理流程闭合：

- 能构造 prompt
- 能发起生成
- 能预览
- 能执行隔离重写

问题在可维护性，不在流程缺失。

### 6.3 状态变化检查

当前最大的风险是“状态源过多”：

- Forge 工作会话
- 世界线节点
- 世界书版本视图
- 记忆快照
- DCC 压缩态

因此新增框架时必须避免出现：

- 再加一套外部 thread state
- 再加一套外部 memory state
- 再加一套外部 conversation history source

### 6.4 输出检查

当前输出目标明确：

- LLM messages
- Prompt preview
- 隔离 rewrite prompt

模板库可以直接服务这些输出。
通用 memory 框架不能直接替代这些输出定义。

### 6.5 上下游影响检查

若仅做 Prompt 模板化：

- 对下游生成链路影响较小
- 对现有世界线 / 记忆 / 世界书系统影响可控

若让外部框架接管上下文：

- 会同时影响 Forge、Chat、世界书、时间线与宿主适配
- 风险明显更高

## 7. 建议落地顺序

建议后续按以下顺序执行：

1. 先将 Forge 的 Planner / Executor / Preview prompt 资源文件化。
2. 再为 `PromptBuilder` 引入模板渲染层。
3. 再抽象 Forge Context Payload 的字段结构，明确模板输入模型。
4. Forge 工作流稳定后，再评估是否需要 `LangGraph` 一类编排层。

## 7.1 迁移库优先级

为了避免后续实现时反复讨论，当前建议将“库迁移”优先级明确排序如下：

### P0：不迁移上下文核心

当前明确不应优先迁移：

- `WorldlineStore`
- `MemoryManager`
- `ContextCompactor`
- 世界书时间线解析
- ST 宏与宿主兼容层

原因：

- 这些模块就是 Lumina 的领域状态核心。
- 当前风险不在“缺少通用框架”，而在“中层视图与 Prompt 表达层还没完全收束”。
- 现在迁移只会新增第二套状态源。

### P1：优先迁移 Prompt 模板层

当前最值得做、收益最高的迁移方向：

- 轻量模板库：
  - `Mustache`
  - `Handlebars`
- 或仅使用 `LangChain Prompt Templates`

适用范围：

- Planner prompt
- Executor prompt
- Preview prompt
- 后续 Forge 表单/步骤提示词

优先级最高原因：

- 改动集中在 Prompt 表达层
- 不改变上下文事实来源
- 能立即缓解 `PromptBuilder` 字符串拼接膨胀

当前已执行进展：

- 已新增 `PromptTemplateEngine`
- 已新增 `src/resources/prompts/forgePrompts.ts`
- 已新增 `ForgePromptTypes` 与 `ForgePromptPayloadResolver`
- Forge 默认 Planner prompt 已脱离 `CardMakerStore` 内联常量
- Forge 隔离 Executor prompt 已脱离 `ForgeAgentController` 内联常量
- `PromptBuilder` 的会话记忆快照块已开始走模板渲染
- `CardMakerStore / PromptBuilder / ForgeAgentController` 已开始共用模板输入模型

### P2：局部参考消息流封装库

可评估但不应先做全面接管：

- `Vercel AI SDK`

推荐使用方式：

- 参考其流式消息状态封装
- 参考其 provider 适配组织方式
- 仅在生成流 UI 层或调用封装层局部吸收

不建议当前直接替换：

- Lumina 的消息树
- Forge 会话状态
- 时间线与回滚语义

### P3：工作流编排框架

最后再评估：

- `LangGraph`

仅在以下条件满足后进入优先级：

- Forge 的 Planner / Executor / 审批 / 写回阶段已经稳定
- Forge 步骤状态已正式建模
- 可以清楚区分“领域状态”和“工作流控制状态”

当前不应提前推进的原因：

- 现阶段还没有闭合到值得引入完整状态图编排
- 直接上会让上下文源、流程状态和 UI 状态混杂

当前试点结论更新：

- 已在 Forge 中试接 `LangGraph`，但只作为本地 workflow 编排层使用
- 当前接入方式：
  - 根据一轮用户输入与 Forge 会话状态，路由到 `clarify / plan / review / prepare_commit / await_commit_confirmation`
  - 输出 `workflowSnapshot`
  - 将 snapshot 注入 Prompt 和 UI
  - 暂存区审批动作会触发 workflow 重算
  - staging 确认后会进入独立的 `commit-ready` 中间态，而不是直接消失
- 当前仍未让 LangGraph 接管：
  - 世界线节点
  - 记忆快照
  - 世界书版本视图
  - Forge 会话持久化主结构

因此当前判断调整为：

- `LangGraph` 已适合“局部试点”
- 但仍不适合直接替换 Lumina 上下文核心
- 更准确的优先级应为：
  - `P1` Prompt 模板层
  - `P2` LangGraph 局部 workflow 编排
  - `P3` 更重的 agent runtime / deep agents

## 8. 假设与未验证前提

以下内容是本次结论成立所依赖的假设，当前未全部实证验证：

- 当前 `PromptBuilder` 的复杂度仍处于“可局部重构”范围，尚未失控到必须整体替换。
- Forge 未来的多阶段流程会继续建立在 Lumina 自己的世界线与条目系统之上。
- 外部库的收益重点在“模板能力”和“流程编排能力”，而不是“替代 Lumina 领域状态”。
- 现阶段没有必须引入 RAG / 外部知识库索引的刚性需求。

## 9. 交接结论

一句话结论：

- Forge 的提示词合成可以引入成熟库做模板化。
- Forge 的上下文管理不应整体外包给成熟库。
- 当前最稳的路线是“保留 Lumina 自身上下文核心，只替换 Prompt 表达层”。

建议默认执行口径：

- 第一阶段只动 Prompt 模板层，不动上下文状态核心。
- 第二阶段再判断是否需要工作流编排框架。
