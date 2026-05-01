# LuminaWeave Chat 子插件 - 系统设计文档 (System Design)

**版本:** v1.0
**所属系统:** LuminaWeave V2

## 一、 组件架构
1. **ChatRoot.vue (主容器)**
   该文件注册在 `PluginManager` 中作为 `Chat` 插件的根入口。提供顶部 `PanelHeader` 的挂载以及插槽位，内部引入 `ChatStream.vue`。
2. **ChatStream.vue (气泡流组件)**
   主要负责对 `window.chat` 数据（经过代理或者直接拉取）进行数组驱动的列表渲染。

## 二、 核心依赖与数据源
- 代理于统一会话 API 的 `getConversationMessages({ sourceId: 'chat' })` 视图模型，并在其自身钩子内部实现基于 `nextTick` 的自动底端滚动 (Auto-Scroll-To-Bottom)。
- 内部使用了全局 `readingSettings` (由 `App.vue` 下发或者本地注入)，利用它的响应式特性实现字号、模式 (`chat`/`document`) 的无感切换。
- **头像捕获系统**: 使用 API 层提取出的 `User/Character Avatar URIResolver` 作为占位。

## 三、 向外抛出的通信结构 (Events Hook)
- 气泡上的按钮通过调用 `window.lwApi`：
  - 发送 (`sendMessage`)
  - 重生成 (`triggerGenerate`)
  - 指定层级记录编辑 (`crudChatRecord`)
  - 新世界线分支点建立 (`branchConversationNode({ sourceId: 'chat', targetNodeId })`) 

这些直接穿透 ST 或者 Lumina 代理数据层，将界面请求落实为实质动作。
