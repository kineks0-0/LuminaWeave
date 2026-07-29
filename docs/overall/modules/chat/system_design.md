# LuminaWeave Chat 子插件 - 系统设计文档 (System Design)

**版本:** v1.1
**所属系统:** LuminaWeave V2

## 一、 组件架构
1. **ChatRoot.vue（应用装配）**
   该文件是 `chat.main` renderer 入口，从 typed surface context 取得 `DesktopExperienceRuntime`，创建并销毁 `ChatApplicationController`。它只把 Controller snapshot/intents 与会话选择 presentation 状态传给 Chat 组件。
2. **ChatApplicationController.ts（应用控制器）**
   订阅 `ConversationDomainService` 与 `GenerationDomainService`，统一投影当前会话、消息和生成状态；负责发送、停止、编辑、删除、重生成、分支和 Prompt Inspector intents。Controller 使用显式取消函数闭合生命周期，并隔离单个 listener/disposer 异常。
3. **ChatStream.vue（气泡流 presentation）**
   消费传入的 messages、conversation context、generation snapshot 与 intents，负责消息展示、滚动、输入和局部交互状态，不再订阅 generation 事件或直接调用 conversation/generation 命令。

## 二、 核心依赖与数据源
- `ConversationDomainService.getContext()` 和 conversation event 是 Controller 的消息事实源。
- `GenerationDomainService.subscribe()` 输出 started/updated/ended/failed 生命周期；Controller 将其投影为带 revision 的 generation snapshot，ChatStream 只观察 revision 执行测量和自动滚动副作用。
- `useConversationContextStore` 只向 ChatRoot 提供会话列表、会话选择与 `sessionSwitchState`，不再向 ChatStream 提供消息事实源。
- 内部使用了全局 `readingSettings` (由 `App.vue` 下发或者本地注入)，利用它的响应式特性实现字号、模式 (`chat`/`document`) 的无感切换。
- **头像捕获系统**: 使用 API 层提取出的 `User/Character Avatar URIResolver` 作为占位。

## 三、数据流

```text
ConversationDomainService ─┐
                           ├─> ChatApplicationController ─> ChatApplicationSnapshot ─> Chat presentation
GenerationDomainService ───┘                            └─> ChatApplicationIntents ────> Domain Services
```

- conversation 事件更新 context 与 messages。
- generation 事件只更新 generation snapshot；结束时由正式 conversation 消息替换流式气泡。
- 所有修改型 intent 先检查当前 context 是否为 live chat 且不存在活动生成；删除确认返回后会再次检查生成态。停止命令只在 live chat 存在活动生成时调用 Domain Service，分支命令显式使用 `sourceId: 'chat'`。
- `start()` 逐项记录领域订阅；任一订阅或初始 context 加载失败时释放已建立订阅并复位启动态，允许同一 Controller 重试。
- `dispose()` 同时取消两个领域订阅并清空 presentation listeners，销毁后事件不得继续更新 UI。
