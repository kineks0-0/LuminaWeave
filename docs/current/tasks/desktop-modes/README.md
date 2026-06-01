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

- 保留 `src/platform/desktop` 作为运行时层，后续可再改名为 `desktop-mode-runtime`，但本轮优先完成公开 API 与模式定义目录硬切。
- `src/desktop-modes/builtins/<mode>/` 已提供 per-mode 的 `manifest.ts`、`settings.ts`、`tokens.ts`、`skins.ts` 入口；共享实现仍集中在 `builtins/shared.ts`，后续若继续细拆，应从该文件向各模式目录搬迁具体实现。

## 下一步

阶段 5 已执行，详见 [05-hard-cut-desktop-mode-module](./steps/05-hard-cut-desktop-mode-module.md)。

后续可选任务：

- 将 `src/platform/desktop` 改名为 `src/platform/desktop-mode-runtime`，进一步降低 `desktop-modes` 定义层与 runtime 层的命名混淆。
- 把 `desktop-modes/builtins/shared.ts` 内的具体 tokens / skins 实现继续搬入各 `builtins/<mode>/` 目录，只保留跨模式 helper。

## 恢复入口

- [Steps](./steps/)
