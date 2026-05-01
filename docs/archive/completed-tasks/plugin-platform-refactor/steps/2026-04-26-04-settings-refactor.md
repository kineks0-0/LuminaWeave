# 04 Settings Refactor

## 目标

让设置逻辑和设置 UI 分离，使不同桌面模式可以主导设置页外观和交互。

## 涉及模块

- `luminaweave-extension/src/plugins/settings/`
- `luminaweave-extension/src/plugins/*/index.ts`
- `luminaweave-extension/src/platform/surface/`

## 具体改动

- settings 插件负责 schema、存储、校验和提交 intent。
- 设置页布局、设置卡片、设置控件由 desktop mode surface renderer 提供。
- 插件特殊设置组件走 business renderer，并接收 theme context。
- 当前已将 `settings.root` 与 `settings.control` 纳入 surface contract；现有 `SettingsRoot` 与 `SettingControl` 先作为 business renderer，后续主题可逐步 override。
- `SettingsDetailed` / `SettingsUnified` 内部的设置项渲染已改走 `SurfaceOutlet contractId='settings.control'`。
- 动态 tab 打开的设置根页已改走 `SettingsSurfaceRoot -> SurfaceOutlet contractId='settings.root'`。
- `SettingControl.vue` 中的 schema 解释逻辑已抽出到 `settingControlModel.ts`，包括 storage key、当前值、作用域、可见性、选项描述、布局元数据与数字范围约束；桌面模式后续实现自定义 `settings.control` renderer 时可以复用同一模型，只替换控件外观。

## 验收标准

- 不同桌面模式能为同一 setting schema 渲染不同控件外观。
- 设置写入同一 canonical key。
- 插件特殊设置组件不复制业务处理逻辑。
- 2026-04-26 已通过 `npm run type-check`。
- 2026-04-26 已通过 `npm run test -- settingControlModel officialPluginManifests SurfaceRegistry useWidgetPanels`。

## 风险点

- 后续若新增复杂设置类型，应先扩展 `settingControlModel.ts` 的 schema 处理能力，再由各 desktop renderer 实现外观。
