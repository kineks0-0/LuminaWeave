# Desktop Modes Current Task

## 目标

跟踪桌面模式相关的执行步骤。

## 当前状态

历史 `desktop_modes/tasks/` 下的任务步骤已移动到本目录的 `steps/`。

已完成阶段：

- 单轴模型：用户态主状态收敛为 `activeDesktopMode`。
- App Shell 与 Header：入口从布局切换收敛为桌面模式切换。
- Discord 模式归位：Discord 作为独立桌面模式，而不是传统桌面的皮肤。
- 自定义桌面标准化 API：`DesktopModeManifest` 成为公开注册协议，runtime / settings / surface / activity placement 从 manifest 派生。
- 无兼容硬切：删除 `ThemePack`、`activeThemePack`、`theme-pack-*`、`themePackId` 等旧主题包别名。
- 目录收敛：把 `src/theme` 拆到 `src/desktop-modes`，按 `builtins/<mode>` 组织 classic / stage / discord / telegram 的 manifest、settings、tokens、skins 与受控 policy。

当前状态：

- `src/platform/desktop-mode-runtime` 作为运行时层，负责 registry、descriptor 派生、初始化入口和运行时类型。
- `src/desktop-modes/builtins/<mode>/` 已提供 per-mode 的 `manifest.ts`、`settings.ts`、`tokens.ts`、`skins.ts` 入口。
- 阶段 6 已完成第一批 settings 下沉：classic / stage / discord / telegram 的 settings 常量由各自目录直接拥有，`builtins/shared.ts` 不再导出 per-mode settings。
- 阶段 6 已完成第二批 tokens 下沉：Discord / Telegram 的 design token resolver 由各自 `tokens.ts` 直接拥有。
- 阶段 6 已完成第三批 skins 下沉：Discord / Telegram 的 surface skin map 由各自 `skins.ts` 直接拥有。
- 阶段 6 已完成第四批 runtime 命名收敛：`src/platform/desktop` 已改为 `src/platform/desktop-mode-runtime`。
- 阶段 7 已完成 Lumina Shell Root 运行时边界收窄：`App.vue` 组装 `ShellRuntimeContext / ShellRuntimeSurfaces / ShellRuntimeActions / ShellRuntimeFrame`，`LuminaShellRoot.vue` 只负责 header、body、shell renderer 分发与 legacy global panel 挂载。
- 阶段 8 已完成 shell 模式目录收敛：Discord / Telegram 的模式专属 shell 组件从 `src/shell/traditional/` 移入 `src/shell/modes/<mode>/`，`desktop-modes/builtins/<mode>/` 继续只承载声明式 manifest / settings / tokens / skins。
- `builtins/shared.ts` 只保留跨模式 helper、基础 settings factory 与基础 skin factory。

## 下一步

阶段 8 已完成。后续建议进入 TraditionalShell 内部拆分：优先抽出 Telegram desktop pane、Telegram mobile stack 与 Telegram route view-model，降低 `TraditionalShell.vue` 的模式分支密度，同时保持现有 Telegram mobile stack、Discord mobile shell、traditional right panel 行为不变。

## 恢复入口

- [Steps](./steps/)
