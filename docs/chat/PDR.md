# LuminaWeave Chat 子插件 - 产品需求文档 (PDR)

**版本:** v1.0
**所属系统:** LuminaWeave V2

## 一、 定位与愿景
`Chat` 子插件是 LuminaWeave 在全景掌控态下替代 SillyTavern 原生聊天界面的核心展现层。其愿景是提供类似现代通讯软件的“气泡式交互 UI”，摒弃陈旧的表格结构，让由于时间线回溯或修改而导致的聊天流具有更高自由度的美学和操作感。

## 二、 核心功能
1. **气泡级聊天渲染**：动态响应并渲染左侧聊天流，具备头像获取、区分发言者（User/Character/System）的能力。
2. **多模态阅读体验**：支持切换至 “Document Mode (纯文本网文模式)”，去除头像和气泡。
3. **极速交互栏**：在每条气泡上悬停提供针对性动作：`Edit` (编辑)、`Delete` (删除)、`Regenerate` (覆盖重生成)、`Branch` (从该节点分化世界线)。
4. **底层事件解耦集成**：具备到底层 `api` 中 `triggerGenerate` 和 `crudChatRecord` 的直连网关，完全替代 ST 的操作栏。

## 三、 用户体验
- 全局根据 App 的 `readingSettings` 自适应字号和行距。
- 接收到新消息或进入视图时顺滑自动滚动到底部。
