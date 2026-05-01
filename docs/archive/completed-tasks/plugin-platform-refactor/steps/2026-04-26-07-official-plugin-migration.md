# 07 Official Plugin Migration

## 目标

把官方插件迁移到 manifest v2 和 surface contract 模型。

## 涉及模块

- `luminaweave-extension/src/plugins/chat/`
- `luminaweave-extension/src/plugins/settings/`
- `luminaweave-extension/src/plugins/forge/`
- `luminaweave-extension/src/plugins/timeline/`
- `luminaweave-extension/src/plugins/lorebook/`
- `luminaweave-extension/src/plugins/director/`
- `luminaweave-extension/src/plugins/stats/`

## 具体改动

- `chat` 迁移为 conversation domain + `chat.main / chat.preview / chat.composer` surfaces。
- `settings` 迁移为 settings domain host + `settings.root / settings.control` surfaces。
- `forge` 保留复杂业务组件，外壳、辅助区和工作台布局交给 desktop mode。
- `timeline/lorebook/director/stats` 迁移为 context tool surfaces。
- 当前已完成第一批 manifest v2 声明：
  - `lumina-chat`: `chat.main`、`chat.preview`
  - `lumina-settings`: `settings.root`、`settings.control`
  - `lumina-timeline`: `timeline.navigator`
  - `lumina-stats`: `stats.panel`
  - `lumina-lorebook`: `lorebook.workspace`
  - `lumina-director`: `director.panel`
  - `lumina-forge`: `forge.workspace`、`forge.settings.summary`、`forge.settings.workbench`
  - `lumina-launcher`: `launcher.root`
  - `lumina-dev`: `dev.tools`
- 当前迁移进展：
  - 官方插件清单已收敛到 `src/plugins/officialPlugins.ts`，启动注册与 manifest v2 测试共用同一来源，避免后续官方插件迁移时注册顺序和测试覆盖漂移。
  - 新增 `pluginNavigationSlots` 过渡层，从插件 manifest v2 的 primary surface 推导当前 Shell 仍需要的 `mainView / widget` 导航分组；`PluginManager` 注册导航入口时改为走该推导函数。
  - 官方插件对象已移除重复的旧 `slots` 声明，导航入口由 `platformManifest.surfaces` 的 primary surface 推导；`timeline.navigator` 与 `lorebook.workspace` 维持当前一对多导航挂载，避免改变现有主区/侧栏入口行为。

## 验收标准

- 官方插件都能通过 manifest v2 注册。
- 不同 desktop mode 能把同一插件 surface 放到不同导航和布局位置。
- 插件业务逻辑不因 UI 迁移而复制。
- 官方插件清单、启动注册清单、manifest 测试清单保持同源。
- 官方插件的导航分组能从 primary surface 推导，旧 `slots` 只作为第三方或尚未迁移插件的显式覆盖。

## 验证记录

- 2026-04-26 已通过 `npm run type-check`。
- 2026-04-26 已通过 `npm run test -- officialPluginManifests`。
- 2026-04-26 官方插件移除旧 `slots` 声明后已通过 `npm run type-check`。
- 2026-04-26 官方插件迁移回归已通过 `npm run test -- officialPluginManifests dynamicTabResolver useWidgetPanels`。

## 风险点

- Forge 业务组件复杂，必须保持业务 renderer 和主题 renderer 的边界。
