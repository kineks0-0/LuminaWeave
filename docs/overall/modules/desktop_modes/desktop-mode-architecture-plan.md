# 桌面模式重构与自定义桌面 API 标准化总规划

## 1. Summary

本规划用于把当前前端“桌面模式”体系收敛为可执行、可扩展、可文档化的正式架构，并为后续逐步实现提供统一约束。

本轮规划只处理桌面模式相关抽象，不扩展其他业务目标。

## 2. 背景修正

当前最关键的认知修正如下：

- `Discord` 与 `传统桌面`、`自由工作台` 是同级的桌面模式。
- `Discord` 不是某个当前桌面的皮肤。
- `Discord` 也不是“传统桌面锁定某种样式”的特殊子变体。
- 这里的“主题”指整套桌面模式与壳层组织方式，而不是局部组件换肤。

这意味着后续设计不能再以“先选桌面，再在桌面里换 Discord 风格”作为主模型，而应改为“直接切换桌面模式”。

## 3. 最终模型

### 3.1 单轴模型

正式用户态只保留一个主状态：

- `activeDesktopMode`

用户只切换桌面模式，不再单独切换一个并列的 `layoutMode`。

### 3.2 内部壳层种类

`traditional` 与 `freeform` 继续存在，但它们降级为桌面模式内部的壳层种类，只用于运行时渲染分支和样式判断：

- `traditional`
- `freeform`

它们不再作为用户直接切换的第二主状态。

### 3.3 内置桌面模式定义

- `classic = 传统桌面`
- `stage = 自由工作台`
- `discord = Discord 桌面`

三者是同级模式，均直接声明自身 `shell.kind`。

## 4. 标准化 API

后续正式 API 统一围绕桌面模式而不是主题皮肤组织。

### 4.1 正式状态入口

- `activeDesktopMode`

### 4.2 核心类型

- `DesktopModeManifest`

建议最小字段：

- `id`
- `name`
- `description?`
- `icon?`
- `shell.kind`
- `navigation`
- `surfaces`
- `designTokens?`
- `surfaceSkins?`
- `rendererVariants?`
- `settingsManifest?`

### 4.3 注册与查询入口

- `registerDesktopMode()`
- `listDesktopModes()`
- `getDesktopMode()`

目标是让内置模式和第三方自定义模式共享同一套注册和解析协议。

## 5. 开放边界

允许第三方桌面模式自定义的内容：

- shell
- navigation
- surfaces
- surface skins / CSS vars
- settings
- 受控 renderer variants

禁止越权修改的内容：

- 核心会话模型
- ST 同步链路
- 持久化协议
- 核心事务与存储运行时

自定义桌面必须是“壳层与视图组织”的扩展点，而不是核心运行时替换入口。

桌面模式也是表层视觉 token 的归属层。组件可以暴露语义化 CSS 变量并提供结构性 variant，但不得在组件内按 `activeDesktopMode`、`data-desktop-mode` 或具体模式名手写颜色、边框、阴影等主题值。Discord、Telegram 等模式的视觉差异应集中写入对应 `DesktopModeManifest.surfaceSkins`，由 `useComponentSkin()` / `resolveComponentSkin()` 分发给组件消费。

设计文档分为两层：全局设计规范位于 [`docs/overall/design/`](../../design/)，只定义最低共同契约和 token 接口；每个桌面模式在自己的模块目录下维护完整设计语言，例如 `classic/design.md`、`stage/design.md`、`discord/design.md` 与 `telegram/design.md`。强个性化主题（如未来的 M3 Expressive）应作为完整桌面设计语言接入，而不是污染全局规范层。

## 6. 兼容策略

项目仍处于早期阶段，本专项不保留旧 Theme Pack 兼容层。正式命名：

- `activeDesktopMode`
- `desktop-mode-*`

删除旧命名：

- `activeThemePack`
- `theme-pack-*`
- `ThemePack`
- `themePackId`
- `useThemePack()`
- `getThemePack*`

不做 runtime fallback、不双写 storage key、不导出兼容别名。旧本地配置可直接失效。

## 7. 架构边界与实现要求

### 7.1 App Shell

- `App.vue` 直接由 `activeDesktopMode` 决定当前壳层
- `data-layout-mode` 可以保留，但只能是派生只读属性
- 不能再把 `layoutMode` 作为用户主状态持久化入口

### 7.2 Header 与设置入口

- `PanelHeader.vue` 和 workspace menu 统一改成“切桌面模式”
- 设置系统按桌面模式展示详情，不再展示“桌面模式里再切布局”的二级入口

### 7.3 Discord 桌面

- `Discord` 必须作为独立桌面模式归位
- 本次固定为频道式传统桌面
- 不扩展 Discord 风格自由工作台

## 8. 分阶段执行

执行顺序固定如下：

1. 单轴模型重建
2. App Shell 与 Header 收敛
3. Discord 模式归位
4. 自定义桌面标准化 API
5. 无兼容硬切与桌面模式目录拆分
   - 状态：2026-06-02 已完成首轮硬切。
   - 输出：旧 `src/theme` 入口删除；新增 `src/desktop-modes/core` 和 `src/desktop-modes/builtins/<mode>`；不保留 Theme Pack API / storage fallback。

各阶段的可执行任务文档位于：

- [01-single-axis-model](../../../current/tasks/desktop-modes/steps/01-single-axis-model.md)
- [02-app-shell-refactor](../../../current/tasks/desktop-modes/steps/02-app-shell-refactor.md)
- [03-discord-mode-normalization](../../../current/tasks/desktop-modes/steps/03-discord-mode-normalization.md)
- [04-desktop-mode-extension-api](../../../current/tasks/desktop-modes/steps/04-desktop-mode-extension-api.md)
- [05-hard-cut-desktop-mode-module](../../../current/tasks/desktop-modes/steps/05-hard-cut-desktop-mode-module.md)

## 9. 验收标准

本专项完成时，至少满足以下验收条件：

- 模式切换以 `activeDesktopMode` 为唯一主状态
- `Discord` 明确作为独立桌面模式，而不是皮肤或锁定变体
- 第三方可通过标准化入口注册一个自定义桌面模式
- 注册后的自定义模式可自动进入桌面模式选择列表
- 注册后的自定义模式可自动进入设置详情区
- 运行时能够解析 `classic`、`stage`、`discord` 与至少一个自定义模式
- 旧 `activeThemePack` / `theme-pack-*` / `ThemePack` 兼容入口被删除
- `npm run type-check` 通过

## 10. 阶段通用验证

每个阶段都至少执行以下验证：

- `npm run type-check`
- 无旧 Theme Pack API / storage fallback 验证
- `classic` / `stage` / `discord` 模式切换验证
- 至少 1 个自定义模式的注册与显示验证
- 设置面板中桌面模式列表与详情区验证

## 11. Assumptions

- 长期规划文档落点固定在 `docs/overall/modules/desktop_modes/`
- 执行任务文档落点固定在 `docs/current/tasks/desktop-modes/steps/`
- `Discord` 本次固定为独立频道式桌面模式
- 自定义桌面接口优先面向本地开发者，不先覆盖插件市场分发协议
- 本文是专项规划文档，不直接替代 `docs/overall/PDR.md` 与 `docs/overall/system_design.md` 的全局职责
