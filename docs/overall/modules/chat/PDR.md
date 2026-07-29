# LuminaWeave Chat 子插件 - 产品需求文档 (PDR)

**版本:** v1.1
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

## 三、 用户体验
- 全局根据 App 的 `readingSettings` 自适应字号和行距。
- 接收到新消息或进入视图时顺滑自动滚动到底部。
- Controller 销毁后必须取消 conversation 与 generation 订阅，不再更新已卸载的 Chat surface。

## 四、边界

- `ConversationDomainService` 是消息、会话上下文与世界线命令入口；`GenerationDomainService` 是发送、停止、重生成、Prompt Inspector 自定义生成与流式状态入口。
- `ChatApplicationController` 将两个领域事件源投影为单一 `ChatApplicationSnapshot`，并暴露强类型 intents。
- `useConversationContextStore` 只保留会话选择、切换状态与会话列表等 presentation 状态，不再拥有第二份消息事实源。
- Chat presentation 不直接访问 Pinia、`lwApi`、宿主对象或具体桌面模式是 Official Surface Kit 完成时的最终验收条件；迁移期间残留的头像、测量和外部 UI 事件适配必须在 Surface Kit 任务中收口。
