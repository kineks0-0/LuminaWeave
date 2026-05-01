# LuminaWeave Storage 组件 - 系统设计文档 (System Design)

**版本:** v1.0
**所属系统:** LuminaWeave V2 Core API

## 一、 架构与定位
`StorageCore` 不暴露具体的 UI 面板，它存在于 `api/storage.js` 或类似的核心底层中。
它是统一存储机制，不仅囊括偏好设置，更是连庞大的“重构后聊天状态数据”也交由它负责分发。

## 二、 核心接口设计
```javascript
// 基于策略模式的级联读取
// 当查询 config.fontSize 时，API 会内部探查它的设定作用域。
const val = lwStorage.get('settings.chat.fontSize');

// 插件注册示例 (PluginManager 层面)
PluginManager.register('settings', {
  settingsManifest: {
    fontSize: {
      default: 16,
      allowedScopes: ['Global', 'Character', 'Chat', 'Session'], 
    }
  }
});
```

## 三、 作用域解决引擎 (Scope Resolver)
`Storage` 的内部实现需拦截获取器：
- **Global**: 直接落盘至 `extension_settings.luminaWeave.global` 或者 `localStorage`。
### 扩展：未来 Phase 23 全栈 (Hybrid Full-Stack) 落盘设计
由于纯前端环境受到 ST 原生 `settings.json` 的捆绑限制，未来的终极方案是将前端（目前的 LuminaWeave 扩展）与后端（独立 Node.js 读写脚本）合并通过 Webpack 打包为带有 `index.js` 后端控制链的混合插件体系（参考 `SillyTavern/Plugin-WebpackTemplate`）：
1. 建立后端端点：向 ST 主程序注册独立的 Express 路由（例如 `/api/plugins/luminaweave/save`），用于直接执行 `fs.writeFileSync()`。
2. 前后端静默挂载：由服务端的 `index.js` 主动分发前端 Vue 视图包到浏览器环境。
3. 一键分发体验：用户仅需单个 Repo 链接，便可实现前端沙箱解脱和数据库 JSON 文件独立权。
- **Character/Chat**: 引擎通过侦听 ST 主进程获取当前的 `context.characterId` 和 `context.chatId`，然后在存储树中寻找 `extension_settings.luminaWeave.characters[X]` 的片段并返回。如果切换了环境，触发 `SETTINGS_CHANGED` 广播。
- **Session**: 保留在前端闭包的 Vue reactive 变量或 Map 中，不触及落盘写 I/O。
- **Custom Rule**: 执行一段暴露给用户的 `eval()` 或者 Function，带入 ST 前置上下文注入给它读取。

## 四、 与对话数据引擎的融合
原本阶段 21 规划的 “本地影子数据库” 将直接改写为本模块的消费者：
- `lwStorage.saveChat(chatId, data, scope='Session')`
实现真正的数据持久化流向多端分离。
