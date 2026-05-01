# 01 Surface Contract Runtime

## 目标

建立 Surface Contract 的最小运行时，让插件逻辑和主题 UI 之间有稳定连接层。

## 涉及模块

- `luminaweave-extension/src/platform/surface/`
- `luminaweave-extension/src/platform/plugin/`
- `luminaweave-extension/src/platform/desktop/`
- 后续接入 `src/plugins/*`、`src/theme/*`、`src/shell/*`

## 具体改动

- 新增 `SurfaceContract`、`SurfaceRendererDefinition`、`SurfaceResolutionContext` 类型。
- 新增 `SurfaceRegistry`，负责注册插件业务 renderer、桌面模式 override 和核心默认 renderer。
- 新增 `SurfaceOutlet`，作为 Vue 侧统一 surface 挂载点。
- 新增空态 renderer，避免缺失 surface 时直接崩溃。
- `initializeSurfaceRuntime()` 已接入 `registerLuminaPlugins()`，会在官方插件注册前注册官方 surface contracts 与空态 renderer。
- 新增 resolver，解析顺序固定为：
  1. 当前桌面模式 override
  2. 插件 business renderer
  3. 核心默认 renderer
  4. 空态 renderer
- 定义第一批官方 surface id：
  - `chat.main`
  - `chat.preview`
  - `chat.composer`
  - `settings.root`
  - `settings.control`
  - `forge.workspace`
  - `timeline.navigator`

## 验收标准

- TypeScript 类型检查通过。
- resolver 单测覆盖 override、business renderer、default renderer 和 missing renderer。
- 现有 UI 暂不强制接入，但新注册表可以独立使用。
- 2026-04-26 已通过 `npm run type-check`。
- 2026-04-26 已通过 `npm run test -- SurfaceRegistry DesktopModeRuntimeRegistry officialPluginManifests dynamicTabResolver useWidgetPanels`。

## 风险点

- Surface id 必须稳定，否则后续桌面模式 override 会失效。
- 不能让 resolver 直接读取具体 store 或 core service；状态必须由调用方注入。
