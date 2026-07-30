# LuminaWeave Chat 子插件 - 产品需求文档 (PDR)

**版本:** v1.2
**所属系统:** LuminaWeave V2

## 一、 定位与愿景
`Chat` 子插件是 LuminaWeave 在全景掌控态下替代 SillyTavern 原生聊天界面的核心展现层。其愿景是提供类似现代通讯软件的“气泡式交互 UI”，摒弃陈旧的表格结构，让由于时间线回溯或修改而导致的聊天流具有更高自由度的美学和操作感。

## 二、 核心功能
1. **气泡级聊天渲染**：动态响应并渲染左侧聊天流，具备头像获取、区分发言者（User/Character/System）的能力。
2. **多模态阅读体验**：支持切换至 “Document Mode (纯文本网文模式)”，去除头像和气泡。
3. **极速交互栏**：在每条气泡上悬停提供针对性动作：`Edit` (编辑)、`Delete` (删除)、`Regenerate` (覆盖重生成)、`Branch` (从该节点分化世界线)。
4. **统一应用控制**：消息投影、流式状态、发送、停止、编辑、删除、重生成、分支和 Prompt Inspector intent 统一经过 `ChatApplicationController`，presentation 不直接编排 Domain Service 命令。
5. **只读会话保护**：历史会话与非当前宿主会话保持可浏览，但修改、生成和世界线命令只允许作用于当前 live chat。
6. **生成互斥保护**：生成期间拒绝发送、编辑、删除、重生成、分支和自定义 Prompt；停止命令只在当前 live chat 存在活动生成时接受。
7. **可组合展示**：角色、会话、消息流、流式消息、输入区、工具栏、header 与 Prompt Inspector 以 Official Surface Kit 暴露，桌面和插件通过 typed contract 组合，不直接引用业务 store 或宿主对象。

## 三、 用户体验
- 通过 `SurfaceRuntimeContext.theme` 的受控 tokens 自适应字号、行距与 renderer variant。
- 接收到新消息或进入视图时顺滑自动滚动到底部。
- 最后一个 Chat surface scope 释放后必须销毁 Controller，取消 conversation、generation、Prompt inspection 与 presentation command 订阅，不再更新已卸载的 Chat surface。

## 四、边界

- `ConversationDomainService` 是消息、会话上下文与世界线命令入口；`GenerationDomainService` 是发送、停止、重生成、Prompt Inspector 自定义生成与流式状态入口。
- `ChatApplicationController` 将 conversation、generation lifecycle、Prompt inspection 与 presentation command 四条订阅通道投影为单一 `ChatApplicationSnapshot`，并暴露强类型 intents。
- `useConversationContextStore` 只保留会话选择、切换状态与会话列表等 presentation 状态，不再拥有第二份消息事实源。
- Chat presentation 不直接访问 Pinia、`lwApi`、存储、宿主对象、Shell 或具体桌面模式；头像解析、theme、消息渲染设置和导航动作分别由 runtime capability、Surface context 与 typed callback/intents 注入。
- `chat.main`、`chat.transcript`、`chat.composer` 与 `chat.promptInspector` 共享同一 runtime-owned Controller scope；独立 surface 不得创建第二份消息或生成状态。
- 设置页只能通过 `settingsPreviewSurface` 和 `SurfaceOutlet` 挂载需要 typed context 的 Chat 预览，不能直接渲染 renderer component 绕过 input 校验、theme 和错误边界。
