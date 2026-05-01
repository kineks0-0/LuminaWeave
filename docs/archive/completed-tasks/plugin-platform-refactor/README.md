# LuminaWeave Plugin Platform Refactor

本目录记录已完成的插件平台重构任务。遇到上下文压缩或中断时，先读取本文件了解最终状态；新的后续任务应在 `docs/current/tasks/` 下重新建任务目录。

## 重构目标

- Core 只负责业务真相与运行时能力，不依赖主题、桌面模式或具体 Vue 页面。
- Plugin 只声明领域能力、状态选择器、意图、设置 schema、surface contract 与必要业务组件。
- Desktop Mode / Theme 主导 Shell、导航、布局、交互模式与大部分 UI renderer。
- Surface Runtime 作为 Plugin 逻辑与 Desktop Mode UI 之间的唯一连接层。

## 归档规则

- 本任务已经完成，所有步骤文件保留在 `steps/`。
- 不再在本目录新增当前执行步骤。
- 如果需要继续扩展插件平台，创建新的 `docs/current/tasks/<task-name>/`。

## Progress

| Step | Status | Notes |
|---|---|---|
| 00 Architecture Boundaries | Completed | 见 `steps/2026-04-26-00-architecture-boundaries.md`。Core / Plugin Domain / Desktop Mode / Surface Runtime 边界已写入全局文档；`src/api/core` 已清除对 `theme/`、`shell/`、`plugins/` 的直接导入命中。 |
| 01 Surface Contract Runtime | Completed | 见 `steps/2026-04-26-01-surface-contract-runtime.md`。已建立类型、resolver、SurfaceOutlet、空态 renderer；官方 contract 类型已显式列出并由 SurfaceRegistry 测试覆盖。 |
| 02 Plugin Manifest v2 | Completed | 见 `steps/2026-04-26-02-plugin-manifest-v2.md`。所有官方插件已声明 manifest v2；官方插件对象已移除旧 `slots`，导航分组由 primary surface 推导。 |
| 03 Desktop Mode Runtime | Completed | 见 `steps/2026-04-26-03-desktop-mode-runtime.md`。已建立 v2 registry，内置桌面已声明 shellRenderer，componentOverrides 可进入 Surface Runtime。 |
| 04 Settings Refactor | Completed | 见 `steps/2026-04-26-04-settings-refactor.md`。`settings.root` / `settings.control` 已进入 surface contract；设置项渲染走 SurfaceOutlet；`settingControlModel` 已抽出 schema 解释逻辑供不同 desktop renderer 复用。 |
| 05 Shell Refactor | Completed | 见 `steps/2026-04-26-05-shell-refactor.md`。Shell renderer runtime outlet 已落地；Traditional/Freeform shell renderer 均使用 `ShellRuntimeContext / ShellRuntimeActions / ShellRuntimeSurfaces`；Telegram/Discord 交互逻辑已下沉到 shell composables。 |
| 06 API Facade Split | Completed | 见 `steps/2026-04-26-06-api-facade-split.md`。已抽出 `DesktopSurfaceService`、`HostInteractionService`、`ConversationDomainService`、`GenerationDomainService`、`SettingsDomainService`，并通过 `LuminaWeaveAPI.services.*` 暴露；主要 UI 会话、生成、设置、surface 导航入口已改走 domain service。 |
| 07 Official Plugin Migration | Completed | 见 `steps/2026-04-26-07-official-plugin-migration.md`。所有官方插件已声明第一批 v2 surfaces；官方插件清单已收敛到 `src/plugins/officialPlugins.ts`；官方插件对象已移除旧 `slots` 声明，当前 Shell 导航分组由 primary surface 推导。 |

## 当前默认假设

- 项目处于早期阶段，本轮不维护旧插件 API、旧主题 API、旧设置 API 或 `activeThemePack` 兼容路径。
- 不改变会话真相源、ST 同步协议、事务协议、Prompt 构建链路本身。
- UI 组件不得直接写 Core 内部状态，只能通过 manifest 暴露的 intents 或 domain services。

## Verification Notes

- 2026-04-26 Step 05 完成时已通过 `npm run type-check`。
- 2026-04-26 Step 05 相关测试已通过：`npm run test -- DesktopModeRuntimeRegistry SurfaceRegistry dynamicTabResolver officialPluginManifests`。
- 2026-04-26 执行完整 `npm run test` 时仍有既有 Forge DSL / Prompt 文档断言失败，失败集中在 `ViewComponentRegistry.test.ts`、`ForgeDSL-Split.test.ts`、`LVParser.test.ts`、`ForgePromptContextService.test.ts`、`PromptBuilder.test.ts`，不属于 Step 05 Shell Refactor 修改面；后续应在 Forge / LVParser 专项步骤处理。
- 2026-04-26 Step 06 第一阶段已通过 `npm run type-check`。
- 2026-04-26 Step 06 新增服务测试已通过：`npm run test -- DesktopSurfaceService HostInteractionService`。
- 2026-04-26 Step 06 surface/plugin 回归已通过：`npm run test -- DesktopSurfaceService HostInteractionService dynamicTabResolver officialPluginManifests`。
- 2026-04-26 Step 06 conversation service 阶段已通过 `npm run type-check`。
- 2026-04-26 Step 06 conversation service 测试已通过：`npm run test -- ConversationDomainService DesktopSurfaceService HostInteractionService`。
- 2026-04-26 Step 06 generation service 阶段已通过 `npm run type-check`。
- 2026-04-26 Step 06 generation service 测试已通过：`npm run test -- ConversationDomainService DesktopSurfaceService HostInteractionService GenerationDomainService`。
- 2026-04-26 Step 06 当前组合回归已通过：`npm run test -- ConversationDomainService DesktopSurfaceService HostInteractionService GenerationDomainService dynamicTabResolver officialPluginManifests`。
- 2026-04-26 Step 06 settings service 阶段已通过 `npm run type-check`。
- 2026-04-26 Step 06 services 当前组合回归已通过：`npm run test -- SettingsDomainService ConversationDomainService DesktopSurfaceService HostInteractionService GenerationDomainService dynamicTabResolver officialPluginManifests`。
- 2026-04-26 Step 06 完成归档前通过 `npm run type-check`。
- 2026-04-26 Step 06 完成归档前组合回归通过：`npm run test -- SettingsDomainService ConversationDomainService DesktopSurfaceService HostInteractionService GenerationDomainService dynamicTabResolver officialPluginManifests`。
- 2026-04-26 Step 07 第一阶段已通过 `npm run type-check`。
- 2026-04-26 Step 07 manifest 清单测试已通过：`npm run test -- officialPluginManifests`。
- 2026-04-26 Step 07 官方插件 slot 移除后已通过 `npm run type-check`。
- 2026-04-26 Step 07 官方插件迁移回归已通过：`npm run test -- officialPluginManifests dynamicTabResolver useWidgetPanels`。
- 2026-04-26 Step 01-03 归档前集中回归通过：`npm run test -- SurfaceRegistry DesktopModeRuntimeRegistry officialPluginManifests dynamicTabResolver useWidgetPanels`。
- 2026-04-26 Step 04 完成归档前通过 `npm run type-check`。
- 2026-04-26 Step 04 设置控制模型回归通过：`npm run test -- settingControlModel officialPluginManifests SurfaceRegistry useWidgetPanels`。
- 2026-04-26 Step 00 完成归档前通过 `npm run type-check`。
- 2026-04-26 Step 00 边界检查通过：`src/api/core` 对 `theme/`、`shell/`、`plugins/` 路径导入无命中。
- 2026-04-26 Step 00 平台集中回归通过：`npm run test -- SurfaceRegistry DesktopModeRuntimeRegistry officialPluginManifests dynamicTabResolver useWidgetPanels settingControlModel ViewRenderRegistry ConversationService ForgeAgentController`。
