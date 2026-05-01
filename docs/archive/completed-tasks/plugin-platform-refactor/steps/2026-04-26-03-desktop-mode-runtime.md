# 03 Desktop Mode Runtime

## 目标

把桌面模式升级为 UI 主导层，允许不同主题桌面拥有高度不同的交互逻辑。

## 涉及模块

- `luminaweave-extension/src/theme/types.ts`
- `luminaweave-extension/src/theme/themeRegistry.ts`
- `luminaweave-extension/src/theme/builtinThemePacks.ts`
- `luminaweave-extension/src/shell/`

## 具体改动

- 桌面模式 manifest v2 声明 `shellRenderer`、`navigationModel`、`surfaceMap`、`componentOverrides`、`interactionPolicy`、`tokens`、`settingsSchema`。
- `DesktopModeRuntimeRegistry` 负责注册 v2 manifest，并把 `componentOverrides` 写入 Surface Runtime。
- 当前已通过 `initializeDesktopModeRuntime()` 把现有内置桌面模式桥接为 v2 manifest；`traditional / telegram / discord` 指向 traditional shell renderer，`stage` 指向 freeform shell renderer，后续再逐步替换 navigation model 的实现来源。
- Discord、Telegram、传统桌面、自由工作台都通过同一 desktop mode runtime 注册。
- 主题只通过 selectors / intents 操作业务，不直接改 core 状态。
- Telegram 桌面模式通过 `componentOverrides` 注册 `telegram.infoPanel` renderer，并进入 Surface Runtime 的 desktop override 优先级。

## 验收标准

- 每个内置桌面都能解析 shell、navigation 和 surface map。
- Telegram / Discord 特例从 App 层逐步迁入对应 desktop mode。
- 不再描述或实现 `activeThemePack` 兼容路径。
- 2026-04-26 已通过 `npm run type-check`。
- 2026-04-26 已通过 `npm run test -- SurfaceRegistry DesktopModeRuntimeRegistry officialPluginManifests dynamicTabResolver useWidgetPanels`。

## 风险点

- Shell 迁移会影响大量交互，需要保持每次迁移范围可回滚。
- `LuminaShellRoot` 已开始通过 runtime manifest 的 `shellRenderer` 做动态 outlet，并建立显式 `ShellRuntimeContext / ShellRuntimeActions / ShellRuntimeSurfaces` 契约；Traditional/Freeform shell renderer 均已消费该正式 runtime API。
