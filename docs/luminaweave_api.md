# LuminaWeave (幻光织机) 底层 API 开发文档

`LuminaWeave` 插件的核心理念是提供一个 **全景掌控态 (Full-Canvas)** 的宿主框架，并通过统一的 `lwApi` 接口向运行在其中（如小窗口 / Widget 挂载侧边栏）的所有子插件提供对底层环境（SillyTavern）的安全访问。

## 引入 API

在 Vue 组件中，强烈推荐通过 `App.vue` 下发的 `provide/inject` 机制获取全局单例，或者直接在子插件中导入核心库：

```javascript
import { inject } from 'vue';
const lwApi = inject('lwApi');

// 或者
import { luminaWeaveApi as lwApi } from '../api/index.ts';
```

## 核心接口分类

### 1. 聊天与上下文数据访问 (Data Access)
这类接口将 ST 原生的、易变的 `window` 状态封装为安全稳定的返回值，并通过**本地影子数据库 (Shadow Buffer)** 隔离底层刷新频发的原生数据源。

- **`getChat()`**
  - **返回**: `Array<ChatObject>`
  - **用途**: 获取当前正在对话的完整上下文气泡记录。返回的是隔离后的 `localChatData` 快照副本。
- **`getMessage(index: number)`**
  - **返回**: `ChatObject | null`
  - **用途**: 抓取特定楼层的详细数据。
- **`syncFromST()` / `commitToST()`**  **(新架构机制)**
  - **用途**: `syncFromST()` 从 SillyTavern 单向同步原生记录至内部 `localChatData`；`commitToST()` 在执行破坏性操作（编辑、重生成）后，安全地将差异提交回原生环境，并阻挡不必要的 UI 撕裂。
- **`getCurrentCharacter()`**
  - **返回**: `CharacterData | null`
  - **用途**: 获取当前正在聊天的角色设定（头像、描述、预设等信息）。
- **`getUserAvatar()` / `getCharAvatar(charName)`**
  - **返回**: `string` (图片 URL 路径)
  - **用途**: 稳定获取用户、角色的头像用于渲染独立UI，兼容 ST 多种获取缩略图的方式。

### 2. 生命周期与事件监听 (Event Bus)
避免原生的强侵入式 Hook，统一通过事件下发机制刷新自己开发的小组件。

- **`stEventOn(eventName: string, callback: Function)`**
  - **支持事件**: `MESSAGE_RECEIVED`（新消息）, `CHARACTER_LOADED`（角色卡加载）, `chat_generated`（消息生成完毕）等。
  - **用途**: 当 ST 底层发生改变时，自动触发组件重绘（常用于 Timeline 的监听）。
- **`stEventEmit(eventName: string, ...data)`**
  - **用途**: 触发底层广播通知（或主动向 ST 通知特定钩子执行完毕）。

### 3. 主动交互控制引擎 (Active Interaction)
这是子插件实现“点击卡片影响聊天”的基础能力！

- **`sendMessage(text: string)`**
  - **用途**: 模拟在原生系统底部的输入框内输入并按回车的全流程。自动触发大模型回复（带有 DOM 操作防御Fallback，防版本失效）。
- **`triggerGenerate(type: 'normal' | 'quiet' | 'swipe')`**
  - **用途**: 迫使 ST 继续生成。`swipe` 则触发刷卡（Regenerate）机制。
- **`regenerateLast()`**
  - **用途**: 便捷地抹除最后一条并重新生成。
- **`crudChatRecord(index: number, action: 'delete' | 'edit', newText?: string)`**
  - **用途**: 指定篡改或抹除某个历史楼层！调用后会自动向框架反射重绘事件，实现无缝操作。

### 4. 高级能力：事务与时光机 (FSM & Event Sourcing)
为了应对未来诸如“记忆管理与时空回溯”的需求，底层引擎实现了 JSONPath 的状态库：

- **`modify(path, value)` / `update(path, value)`**
  - 按类似于 `status.health` 或 `inventory[0]` 的路径安全修改当前虚拟环境的状态。
- **`rollback(targetTransactionId)`**
  - 原地抹平所有修改，实现一键穿梭回目标存档点的快照记忆！

---
### 5. 插件管理器 API (PluginManager)
系统架构现已彻底插件化。通过 `core/PluginManager.js`，所有 UI 模块均独立加载。

- **`register(pluginConfig: PluginConfig)`**
  - **用途**: 挂载子插件。
  - **配置参数 (`PluginConfig`)**:
    - `id`: 唯一标识符（例如 `'lumina-chat'`）。
    - `name`: 侧边栏/顶栏显示名称。
    - `icon`: 渲染用 SVG 字符串。
    - `slots`: 允许插入的占位符列表，例如 `['mainView', 'widget', 'headerCenter']`。
    - `component`: 用于占位符的主视图 Vue 组件。
    - `headerCenterComponent`, `headerRightComponent`: 额外的特殊挂载位组件。

---
> 💡 **Plugin 开发指南**
> 任何新的功能模块只需打包为标准的 Vue SFC 组件库（例如 `plugins/your-plugin/`），对外暴露 `index.js` 导出兼容 `PluginConfig` 的对象。在 `App.vue` 或外部入口中调用 `pluginManager.register(YourPlugin)`，即可享受开箱即用的顶部导航、主题引擎与底层 ST API 共生，彻底实现业务解耦！
