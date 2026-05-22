# LuminaWeave Design Specs

## Summary

`docs/overall/design/` 是 LuminaWeave 的长期设计规范层。它类似代码里的抽象接口：定义跨桌面模式必须共享的设计契约，但不要求所有桌面模式拥有同一种视觉性格。

该层服务于插件运行时的主题桌面体系。它约束 token 命名、组件可替换边界、可访问性底线与设计语言的共同语义；具体视觉表达由各桌面主题自己的完整设计文档决定。

## Layering

### Core Design Spec

全局设计规范，位于 `docs/overall/design/`。

它负责定义：

- 语义 token 契约。
- Typography、Color、Shape、Spacing、Motion、Surface 等设计基础的共同边界。
- 组件必须暴露哪些可主题化槽位。
- 可读性、触控尺寸、缩放、对比度等最低体验要求。

它不负责定义：

- 某个桌面模式的完整视觉风格。
- 某个主题的特定气质、动效性格或表层材质。
- 具体业务 Surface 的全部布局细节。

### Desktop Design Language

桌面主题完整设计文档，位于 `docs/overall/modules/desktop_modes/<mode>/design.md`。

每个桌面主题目录描述一套完整设计语言，包括主题定位、信息架构、导航、Surface 组织、Typography 策略、Color / Shape / Motion / Density 方向、移动端适配和组件状态表达方式。

这意味着 `classic / stage / discord / telegram / expressive` 都可以拥有强个性化的设计，而不是共享同一种视觉模板。

### Theme Implementation

代码实现层，主要由 `DesktopModeManifest / designTokens / surfaceSkins / rendererVariants / settingsManifest` 承载。

实现层应把桌面主题设计翻译成受控 token、surface skin 和 renderer variant。它不得绕过 `Surface Runtime` 直接修改核心业务链路。

## Extension Rules

- 全局规范是最低共同契约，不是视觉同质化模板。
- 桌面主题可以扩展自己的局部 token，但必须使用主题作用域命名，例如 `--lw-telegram-*` 或 `--lw-expressive-*`。
- 组件应消费语义 token，不使用 `--font-14`、`--blue-card-bg` 这类值名或样式结果名。
- 强个性化主题可以定义自己的 shape system、emphasis scale、motion personality、surface treatment、icon style 和 density model。
- 新的设计基础能力应先进入 `docs/overall/design/`，再由各桌面主题决定如何表达。

## Current Specs

- [Typography](./typography.md)
- [Tailwind Utility Layer](./tailwind-utility-layer.md)

Planned specs:

- `color.md`
- `shape.md`
- `spacing.md`
- `motion.md`
- `surface.md`
