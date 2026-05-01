# 02 Plugin Manifest v2

## 目标

替换当前以固定 slot / component 为中心的插件注册方式，让插件成为领域能力声明，而不是 UI 页面声明。

## 涉及模块

- `luminaweave-extension/src/types/plugin.ts`
- `luminaweave-extension/src/core/PluginManager.ts`
- `luminaweave-extension/src/bootstrap/registerPlugins.ts`
- `luminaweave-extension/src/plugins/*/index.ts`

## 具体改动

- 新增 manifest v2 字段：`capabilities`、`selectors`、`intents`、`settingsSchema`、`surfaces`、`businessRenderers`。
- `PluginManager` 改为 domain registry。
- 旧 slot registry 在迁移期可作为 shell adapter 暂存，但不作为新插件 API。
- 当前已完成第一批双轨注册：
  - `lumina-chat` 声明 `chat.main`、`chat.preview` surfaces，并注册 ChatRoot / ChatPreview business renderers。
  - `lumina-settings` 声明 `settings.root` surface，并注册 SettingsRoot business renderer。
  - `PluginManager` 在注册旧插件对象时同步登记 `platformManifest`、settings schema、surface contracts 与 business renderers。
- 当前中间态已扩展为所有官方插件都声明第一批 manifest v2 surfaces，并由 `officialPluginManifests` 测试覆盖 manifest 存在性、settings schema 对齐与 primary surface 映射。
- 官方插件对象已移除旧 `slots` 声明；当前 Shell 所需导航分组由 `pluginNavigationSlots` 根据 manifest v2 primary surface 推导。

## 验收标准

- 官方插件至少能注册 manifest v2。
- settings 和 shell 不再直接从插件读取固定页面组件作为唯一 UI 来源。
- manifest v2 能被 Surface Runtime 消费。
- 2026-04-26 已通过 `npm run type-check`。
- 2026-04-26 已通过 `npm run test -- SurfaceRegistry DesktopModeRuntimeRegistry officialPluginManifests dynamicTabResolver useWidgetPanels`。

## 风险点

- 一次迁移所有插件风险高，应先 chat/settings，再 forge，再 context tools。
- `LuminaPlugin.component` 仍存在于旧 dynamic tab / legacy component 通道，后续需要在 Shell 与 SurfaceOutlet 完全收口后移除。
