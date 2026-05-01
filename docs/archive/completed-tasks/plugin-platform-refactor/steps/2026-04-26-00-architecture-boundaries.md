# 00 Architecture Boundaries

## 目标

确定插件平台重构后的职责边界，避免后续实现再次把业务逻辑、桌面模式和插件 UI 混在一起。

## 涉及模块

- `docs/index.md`
- `docs/PDR.md`
- `docs/system_design.md`
- `luminaweave-extension/src/api/core/`
- `luminaweave-extension/src/core/PluginManager.ts`
- `luminaweave-extension/src/theme/`
- `luminaweave-extension/src/shell/`
- `luminaweave-extension/src/plugins/`

## 具体改动

- Core Runtime 只负责会话、同步、存储、生成、Prompt、XML、事务、世界线等业务真相。
- Plugin Domain 只声明领域能力、状态选择器、intents、settings schema、surface contracts 和必要业务组件。
- Desktop Mode 主导 Shell、导航、布局、交互策略、surface renderer 和组件 override。
- Surface Runtime 负责解析当前桌面模式下应该渲染哪个组件。
- Host Shell 只挂载 active desktop mode 的 shell renderer，不再硬编码 Discord / Telegram / freeform / traditional 的大分支。

## 验收标准

- 全局文档明确上述四层边界。
- 后续 step 不再要求 UI 组件直接依赖 `LuminaWeaveAPI` 超大实例。
- 新增代码不得让 Core import `theme/`、`shell/` 或具体插件 Vue 页面。
- 2026-04-26 边界检查已通过：`src/api/core` 不再命中 `theme/`、`shell/`、`plugins/` 路径导入。
- 2026-04-26 `ViewRenderRegistry` 已迁到 `src/platform/view/`，Core 原路径仅保留 re-export。
- 2026-04-26 Forge 会话与隔离重写入口改为由 Forge 插件向 Core 注入 store provider / runner，Core 不再主动 import Forge 插件实现。
- 2026-04-26 已通过 `npm run type-check`。
- 2026-04-26 已通过 `npm run test -- SurfaceRegistry DesktopModeRuntimeRegistry officialPluginManifests dynamicTabResolver useWidgetPanels settingControlModel ViewRenderRegistry ConversationService ForgeAgentController`。

## 风险点

- 当前 `App.vue` 与 `LuminaWeaveAPI` 已经承担大量聚合职责，拆分需要分阶段进行。
- Discord / Telegram 当前存在较多 Shell 特例，迁移时必须先定义 navigation model 和 interaction policy。
- Core 仍保留少量兼容 re-export，例如 `api/core/ViewRenderRegistry.ts`；新代码应直接从 platform/domain 边界导入。
