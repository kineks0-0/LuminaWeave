# 阶段 5：无兼容硬切与桌面模式目录拆分

## 目标

把桌面模式代码从旧 `theme` 命名中彻底移出，删除未上线阶段不再需要的 `ThemePack` / `activeThemePack` / `theme-pack-*` 兼容层，让维护者能从目录结构上直接看出“桌面模式是完整工作方式，不是皮肤包”。

## 输入与前置条件

- 项目仍处于早期阶段，不需要向后兼容旧本地配置。
- `DesktopModeManifest` 已是唯一公开注册协议。
- `activeDesktopMode` 已是用户态主状态，`layoutMode` 只保留为派生的 DOM / 旧 CSS 兼容属性。
- 本阶段不修改 Core、HAL、Conversation、Prompt、Storage 或同步语义。

## 目录边界

目标目录结构：

```text
luminaweave-extension/src/desktop-modes/
  core/
    types.ts
    registry.ts
    useDesktopMode.ts
    useSurfaceSkin.ts
    surfaceSkinContracts.ts
  builtins/
    classic/
      manifest.ts
      settings.ts
      skins.ts
      tokens.ts
    stage/
      manifest.ts
      settings.ts
      skins.ts
      tokens.ts
    discord/
      manifest.ts
      settings.ts
      skins.ts
      tokens.ts
      policy.ts
    telegram/
      manifest.ts
      settings.ts
      skins.ts
      tokens.ts
      policy.ts
      overrides.ts
    index.ts
```

保留边界：

- `src/desktop-modes/*` 只描述桌面模式定义：manifest、settings、tokens、surface skins、renderer variants、受控模式 policy。
- `src/platform/desktop-mode-runtime/*` 负责运行时 registry / descriptor 派生 / activity environment，不承载具体模式主题值。
- `src/shell/*` 仍负责通用 traditional / freeform 壳层渲染。Telegram / Discord 专属组件迁移可以后续进行，本阶段只迁移模式定义与命名。
- `src/platform/surface/*` 仍负责 surface contract 与 renderer resolution。

## 需要修改的子系统

- `luminaweave-extension/src/theme/*`：迁移到 `src/desktop-modes/core` 与 `src/desktop-modes/builtins`，删除旧命名入口。
- `luminaweave-extension/src/platform/desktop-mode-runtime/*`：从 `desktop-modes/core` 读取公开 manifest 和 registry。
- `luminaweave-extension/src/App.vue`、`src/shell/*`、`src/composables/shell/*`、`src/plugins/settings/*`、`src/platform/surface/*`、`src/api/services/*`：更新 import 和 API 命名。
- 测试：移除 legacy alias 断言，新增“旧 ThemePack API 不再存在”的约束。
- 文档：同步 `docs/overall/modules/desktop_modes/README.md` 与 `desktop-mode-architecture-plan.md`，明确无兼容策略。

## 明确输出

- 删除 `ThemePack`、`ThemePackAppearance`、`themePackId`、`themePack`、`getThemePack*`、`useThemePack()`。
- 删除 `activeThemePack` 与 `theme-pack-*` 兼容读取、双写和 canonical / legacy key 映射。
- 新代码统一使用：
  - `DesktopModeManifest`
  - `DesktopModeAppearance`
  - `activeDesktopMode`
  - `desktop-mode-*`
  - `useDesktopMode()`
  - `useSurfaceSkin()`
  - `surfaceSkinContracts`
- `builtinThemePacks.ts` 拆分为 `desktop-modes/builtins/<mode>/...`，每个模式目录提供 `manifest.ts`、`settings.ts`、`tokens.ts`、`skins.ts` 入口。
- 第三方注册 `registerDesktopMode()` 后仍能进入模式列表、设置详情和 Desktop Mode Runtime。

## 禁止事项

- 不保留旧 API re-export。
- 不保留 runtime fallback 到 `activeThemePack`。
- 不双写 `theme-pack-*` storage key。
- 不把 `desktop-modes/builtins/<mode>` 变成通用 shell renderer 目录。
- 不在本阶段开放任意第三方 shell renderer 代码注册。

## 执行步骤

1. 文档先行：更新当前任务 README、本步骤文档和长期桌面模式规划。
2. 测试先行：更新 `themeRegistry` 相关测试为 `desktopModeRegistry` 语义，移除兼容读取/双写预期，并增加旧 key 不生效的负向约束。
3. 迁移核心类型与 registry：`theme/types.ts`、`theme/themeRegistry.ts`、`useThemePack.ts`、`useComponentSkin.ts`、`themeComponentRegistry.ts` 迁移到 `desktop-modes/core`。
4. 拆分内置模式：从 `builtinThemePacks.ts` 拆出 classic / stage / discord / telegram 的 manifest、settings、tokens、skins。
5. 更新所有 import 与公开 API：App、shell、settings、surface、runtime、api service 全部改为 desktop mode 命名。
6. 删除旧 theme 目录文件，确保仓库内无 `ThemePack`、`activeThemePack`、`theme-pack-` 生产代码引用。
7. 运行 targeted Vitest、`npm run type-check`、`git diff --check`。

## 验收检查

- `Select-String` 全仓生产代码中没有 `ThemePack`、`activeThemePack`、`theme-pack-`。
- `desktop-mode-*` 是桌面模式设置唯一 storage key 前缀。
- `registerDesktopMode()` 仍拒绝重复 id。
- 自定义 desktop mode 注册后仍进入 `listDesktopModes()`、设置选项和 runtime descriptor。
- `stage` 仍解析为 `freeform` shell，`classic / discord / telegram` 仍解析为 `traditional` shell。
- Activity placement 保持现有行为：freeform 进入 workspace window，traditional desktop support 进入 right panel，traditional mobile support 进入 temporary tab，Telegram mobile standalone 进入 Telegram stack。
- 验证命令通过：
  - `npm run test -- --run src/desktop-modes/core/__tests__/desktopModeRegistry.test.ts src/platform/desktop-mode-runtime/__tests__/DesktopModeRuntimeRegistry.test.ts src/platform/activity/__tests__/activityLaunchResolver.test.ts src/platform/surface/__tests__/SurfaceRegistry.test.ts src/api/services/__tests__/SettingsDomainService.test.ts src/api/services/__tests__/DesktopSurfaceService.test.ts`
  - `npm run type-check`
  - `git diff --check`

## 执行记录

2026-06-02 已完成：

- `src/theme/*` 已迁移到 `src/desktop-modes/core` 与 `src/desktop-modes/builtins`。
- 旧 `ThemePack`、`activeThemePack`、`theme-pack-*`、`themePackId`、`useThemePack()`、`useComponentSkin()` 生产代码入口已删除。
- `SettingsDomainService` 不再做桌面模式 legacy storage fallback 或双写。
- `DesktopModeManifestV2` 兼容别名已删除；runtime 只消费派生的 `DesktopModeRuntimeDescriptor`。
- 已通过 targeted Vitest 与 `npm run type-check`。
