# Typography Design Spec

## Summary

Typography 是 LuminaWeave 设计系统的第一组全局契约。它参考 Material Design 3 的类型层级，但面向产品 UI 做本地化收敛：固定 `rem` 尺度、中文长文本优先、信息密度可控、不同桌面主题可在同一语义接口上表达不同个性。

该规范定义最低共同接口。它不禁止 Telegram、Discord、Stage 或未来 M3 Expressive 桌面主题拥有不同排版气质。

## Token Contract

代码层统一暴露以下 CSS token 族：

- `--lw-type-display-*`
- `--lw-type-headline-*`
- `--lw-type-title-*`
- `--lw-type-body-*`
- `--lw-type-label-*`

每个层级至少包含：

- `size`
- `line-height`
- `weight`
- `tracking`

命名示例：

- `--lw-type-title-medium-size`
- `--lw-type-title-medium-line-height`
- `--lw-type-title-medium-weight`
- `--lw-type-title-medium-tracking`

## Default Scale

| Role | Size | Line height | Weight | Tracking | Primary use |
|---|---:|---:|---:|---:|---|
| display-large | 3.5625rem | 4rem | 500 | 0 | Rare hero or empty-state display |
| display-medium | 2.8125rem | 3.25rem | 500 | 0 | Large product moments |
| display-small | 2.25rem | 2.75rem | 500 | 0 | Expressive overview headers |
| headline-large | 2rem | 2.5rem | 650 | 0 | Full-page titles |
| headline-medium | 1.75rem | 2.25rem | 650 | 0 | Major section titles |
| headline-small | 1.5rem | 2rem | 650 | 0 | Compact page titles |
| title-large | 1.375rem | 1.75rem | 700 | 0 | Shell titles, profile names |
| title-medium | 1rem | 1.5rem | 700 | 0.009em | Panel titles, list item titles |
| title-small | 0.875rem | 1.25rem | 700 | 0.007em | Dense item titles |
| body-large | 1rem | 1.625rem | 400 | 0 | Chat prose and long text |
| body-medium | 0.875rem | 1.375rem | 400 | 0 | Settings copy and previews |
| body-small | 0.75rem | 1rem | 400 | 0.01em | Metadata and secondary copy |
| label-large | 0.875rem | 1.25rem | 700 | 0.006em | Buttons, tabs, chips |
| label-medium | 0.75rem | 1rem | 700 | 0.02em | Compact controls and menus |
| label-small | 0.6875rem | 1rem | 700 | 0.025em | Badges, counts, small captions |

## Semantic Mapping

- 页面标题使用 `headline-small` 或 `title-large`。
- 面板标题、资料页用户名使用 `title-medium` 或 `title-large`。
- 列表主标题使用 `title-small`。
- 聊天长正文使用 `body-large`，并继续允许桌面模式聊天设置覆盖正文尺寸。桌面模式可在统一聊天排版之上提供 `assistant / user` 角色级覆盖，但必须保留“跟随统一值”作为默认路径。
- 设置说明、预览文本使用 `body-medium`。
- 元信息、计数、状态使用 `body-small`。
- tab、按钮、chip、菜单项使用 `label-large` 或 `label-medium`。
- 细小 badge、kicker、短计数使用 `label-small`。

## Desktop Theme Freedom

桌面主题可以调整 token 的表达强度，但必须保留语义接口：

- `classic` 保持安静、稳定、轻层级。
- `stage` 可强化工作区标题和窗口标题，保持正文中性。
- `discord` 可压缩列表与频道文字密度，强调快速扫描。
- `telegram` 可放大移动端资料页和即时通讯标题，保持聊天正文舒适。
- `expressive` 可使用更强标题对比、更鲜明状态表达和更活跃动效，但仍必须满足可读性与组件契约。

## Rules

- 产品 UI 使用固定 `rem` 尺度，不使用 viewport 流式字号。
- 正文不得低于 `1rem`，除非是明确的元信息、badge 或紧凑控件。
- 中文长文本行高不得低于 `1.5` 的等效体验。
- 允许小标签使用正字距，不把负字距作为常规层级手段。
- 不为局部组件新增平行命名体系，例如 `--font-13` 或 `--panel-title-size`。
- 可主题化组件应使用全局语义 token，主题差异通过 `DesktopModeManifest.designTokens` 或主题作用域 token 覆盖。
