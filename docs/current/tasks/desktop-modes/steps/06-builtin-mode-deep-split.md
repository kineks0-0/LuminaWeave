# 阶段 6：内置桌面模式深拆与维护性收敛

## 目标

让维护者能直接从 `desktop-modes/builtins/<mode>/` 理解 classic / stage / discord / telegram 的模式定义，不需要先阅读一个巨大的共享文件。阶段 6 继续拆分 `builtins/shared.ts`，但不改变桌面模式公开 API、不改变 shell 行为、不开放第三方任意 renderer 代码注册。

## 输入与前置条件

- 阶段 5 已完成：旧 `src/theme` 和 Theme Pack 兼容入口已删除。
- `DesktopModeManifest` 是唯一公开事实源。
- `src/desktop-modes/builtins/<mode>/` 已存在 `manifest.ts`、`settings.ts`、`tokens.ts`、`skins.ts` 入口。
- 本阶段不修改 Core、HAL、Conversation、Prompt、Storage 或同步语义。

## 推荐顺序

1. **Settings 下沉**：把 `classicDesktopModeSettings`、`stageDesktopModeSettings`、`discordDesktopModeSettings`、`telegramDesktopModeSettings` 从 `shared.ts` 搬到各自 `settings.ts`。
2. **Tokens 下沉**：把 `resolveDiscordDesignTokens`、`resolveTelegramDesignTokens` 和 simple classic / stage tokens 放到各自 `tokens.ts`。
3. **Skins 下沉**：把 Discord / Telegram 专属 `create*SurfaceSkinMap()` 放到各自 `skins.ts`；`shared.ts` 只保留跨模式基础 skin helper。
4. **Runtime 命名**：评估是否将 `src/platform/desktop` 改名为 `src/platform/desktop-mode-runtime`，避免与 `src/desktop-modes` 定义层混淆。

## 目录边界

- `desktop-modes/core/`：公开类型、注册中心、composable、surface skin contract。
- `desktop-modes/builtins/<mode>/`：该模式自己的 manifest、settings、tokens、skins 和受控 policy。
- `desktop-modes/builtins/shared.ts`：只保留跨模式通用 helper、基础 settings factory 和基础 skin factory。
- `platform/desktop/`：runtime descriptor 派生和 registry，不承载具体模式视觉值。

## 本轮执行范围

本轮执行第 1 项 settings 下沉和第 2 项 tokens 下沉：

- `classic/settings.ts` 拥有 `classicDesktopModeSettings`。
- `stage/settings.ts` 拥有 `stageDesktopModeSettings`。
- `discord/settings.ts` 拥有 `discordDesktopModeSettings`。
- `telegram/settings.ts` 拥有 `telegramDesktopModeSettings`。
- `shared.ts` 不再 export 任何 `*DesktopModeSettings` 常量。
- `discord/tokens.ts` 拥有 `resolveDiscordDesignTokens`。
- `telegram/tokens.ts` 拥有 `resolveTelegramDesignTokens`。
- `shared.ts` 不再 export Discord / Telegram 的 design token resolver。

## 测试策略

- 新增结构测试，检查 `builtins/shared.ts` 不再导出 per-mode settings 常量。
- 同一测试检查四个 `builtins/<mode>/settings.ts` 直接拥有各自 settings 定义，而不是从 shared re-export。
- 同一结构测试检查 Discord / Telegram 的 tokens resolver 由各自 `tokens.ts` 直接拥有，而不是从 shared re-export。
- 保留 desktop registry、runtime registry、activity placement、surface registry 和 settings service targeted Vitest。

## 验收检查

- `npm run test -- --run src/desktop-modes/builtins/__tests__/builtinModeStructure.test.ts src/desktop-modes/core/__tests__/desktopModeRegistry.test.ts src/platform/desktop/__tests__/DesktopModeRuntimeRegistry.test.ts src/platform/activity/__tests__/activityLaunchResolver.test.ts src/platform/surface/__tests__/SurfaceRegistry.test.ts src/api/services/__tests__/SettingsDomainService.test.ts src/api/services/__tests__/DesktopSurfaceService.test.ts`
- `npm run type-check`
- `git diff --check`

## 后续未完成内容

- skins 下沉。
- `platform/desktop` runtime 目录改名评估与执行。

## 执行记录

2026-06-03 已完成第一批 settings 下沉：

- 新增 `src/desktop-modes/builtins/__tests__/builtinModeStructure.test.ts`，约束 per-mode settings 不能从 `shared.ts` re-export。
- `classic/settings.ts`、`stage/settings.ts`、`discord/settings.ts`、`telegram/settings.ts` 已直接拥有各自 settings 常量。
- `shared.ts` 不再导出 `classicDesktopModeSettings`、`stageDesktopModeSettings`、`discordDesktopModeSettings`、`telegramDesktopModeSettings`。
- 已通过 targeted Vitest 与 `npm run type-check`。

2026-06-03 已完成第二批 tokens 下沉：

- `discord/tokens.ts` 已直接拥有 `resolveDiscordDesignTokens`。
- `telegram/tokens.ts` 已直接拥有 `resolveTelegramDesignTokens`。
- `shared.ts` 不再导出 Discord / Telegram design token resolver。
- 结构测试已扩展到 tokens 归属约束。
