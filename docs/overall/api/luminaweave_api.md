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
- **统一会话世界线 API [UPDATED]**
  - **查询接口**: `listConversationSources()`、`listConversationSessions(sourceId?)`、`getConversationContext(override?)`、`getConversationMessages(override?)`、`getConversationTimelineGraph(override?)`
  - **命令接口**: `switchConversationContext(input)`、`switchConversationNode(input)`、`branchConversationNode(input)`、`rollbackConversationNode(input)`
  - **用途**: 将 `chat / forge` 会话来源、时间线图、活跃节点与世界线切换统一收敛到同一底层服务；UI 只负责消费快照并发送意图。
  - **说明**: 对于 `chat` 来源，非当前 ST 活跃聊天默认走 Lumina 独立存储视图与写回，不强行驱动宿主切换聊天。
  - **迁移约束**: 旧的 `getChat()`、`getTimelineNodes()`、`branchFromNode()`、`rollbackFromNode()`、`activeLeafId` 已移除。所有主聊天专属调用都必须显式传 `sourceId: 'chat'`。

### 2. 生命周期与事件监听 (Event Bus)
避免原生的强侵入式 Hook，统一通过事件下发机制刷新自己开发的小组件。

- **`on(eventName: string, callback: Function)`**
  - **支持事件**: `MESSAGE_RECEIVED`（新消息）, `CHARACTER_LOADED`（角色卡加载）, `chat_generated`（消息生成完毕）等。
  - **用途**: 当 ST 底层发生改变时，自动触发组件重绘（常用于 Timeline 的监听）。
- **`emit(eventName: string, ...data)`**
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

### 4.1 调试专用入口 (Debug-only)
- **`debugChat`**
  - **用途**: 为开发者工具箱提供低层消息节点检视与干预能力，如 `listNodes()`、`getNode()`、`getChildren()`、`upsertNode()`、`removeSubtree()`、`persistCurrentChat()`。
  - **边界**: 该命名空间仅供内部调试 UI 使用，不属于正式的会话/世界线公共 API。业务型插件应优先使用统一会话 API。

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

### 6. 自定义桌面模式 API (Desktop Modes)

桌面模式是完整壳层模式，不是局部皮肤。`Discord 桌面`、`传统桌面`、`自由工作台` 都属于同级桌面模式。

- **`registerDesktopMode(manifest: DesktopModeManifest)`**
  - **用途**: 注册一个新的桌面模式，并让它自动进入设置中的桌面模式列表、设置详情和 Desktop Mode Runtime。
  - **约束**: `id` 必须唯一；重复注册会抛出错误。
- **`listDesktopModes()`**
  - **返回**: 当前所有已注册桌面模式的清单。
- **`getDesktopMode(id: string)`**
  - **返回**: 指定桌面模式 manifest，若不存在则返回 `undefined`。

`DesktopModeManifest` 最少应包含：

- `id`
- `name`
- `shell.kind`
- `composition.version`（固定为 `1`）
- `composition.desktop`
- `composition.mobile`
- `navigationPreset?`
- `surfacePreset?`
- `settingsManifest?`

开放边界：

- 允许自定义 shell、navigation、surface、settings 与受控 renderer variants
- composition 节点只允许 `group`、`surface`、`activity-slot`，且只能引用已注册 Surface contract
- 不允许直接替换核心会话、同步、持久化与事务运行时
- `layoutMode` 只保留为旧命名兼容；Activity placement 和运行时策略使用 manifest 派生的 `shellKind`
- runtime shell renderer 必须由 Desktop Mode Runtime 注册，root 不按 `shell.kind` 提供 renderer fallback

最小注册示例：

```ts
import { luminaWeaveApi as lwApi } from '../api/index.js';

lwApi.registerDesktopMode({
  id: 'operator-deck',
  name: 'Operator Deck',
  description: '面向高密度信息浏览的自定义桌面。',
  shell: {
    kind: 'traditional',
  },
  composition: {
    version: 1,
    desktop: {
      id: 'operator-deck-desktop-activity',
      kind: 'activity-slot',
      size: 'fill',
      visibility: 'visible',
    },
    mobile: {
      id: 'operator-deck-mobile-activity',
      kind: 'activity-slot',
      size: 'fill',
      visibility: 'visible',
    },
  },
  navigationPreset: {
    traditional: {
      headerVariant: 'default',
      leftRail: 'none',
      widgetVariant: 'default',
      headerDesktopPosition: 'top',
      headerMobilePosition: 'top',
    }
  },
  surfacePreset: {
    mainSurfaceVariant: 'default',
    widgetSurfaceVariant: 'default',
    chatVariant: 'default',
    settingsVariant: 'default',
    timelineVariant: 'default',
  },
  settingsManifest: {
    density: {
      default: 'compact',
      label: '信息密度',
      type: 'options',
      allowedScopes: ['Global'],
      options: [
        { value: 'compact', label: '紧凑' },
        { value: 'cozy', label: '舒适' },
      ]
    }
  }
});
```

接入结果：

- 新模式会自动进入“桌面模式”设置选项
- 新模式会自动进入 Desktop Mode Runtime；注册入口负责为 manifest 派生明确的 shell renderer 与已校验 composition
- `desktop-mode-operator-deck.*` 会成为正式设置命名空间
- 不需要额外手写设置页接线代码

`registerPanel(id, component, config)` 的 `config.surfaceContractId` 是 panel 进入 typed Surface Runtime 的唯一身份声明。`id` 与 contract 同名不会触发隐式映射；`defaultInput` 提供默认 Surface input，`navigation.group/hidden` 控制通用导航分组与可见性。未声明 `surfaceContractId` 时仍使用传入的 `component`。

---
> 💡 **Plugin 开发指南**
> 任何新的功能模块只需打包为标准的 Vue SFC 组件库（例如 `plugins/your-plugin/`），对外暴露 `index.js` 导出兼容 `PluginConfig` 的对象。在 `App.vue` 或外部入口中调用 `pluginManager.register(YourPlugin)`，即可享受开箱即用的顶部导航、主题引擎与底层 ST API 共生，彻底实现业务解耦！
