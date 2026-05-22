# Stage Desktop Design

## Summary

Stage 是自由工作台桌面。它服务多窗口、多任务、拖拽调整和临时工作区组织，视觉目标是清晰的舞台感和窗口状态感。

## Personality

- Spatial workspace
- Focused composition
- Calm control
- Window-first interaction

## Information Architecture

Stage 把任务组织成可移动、可聚焦的 workspace windows。用户在一个舞台中安排多个工作面板，而不是沿单一导航树前进。

## Surface Model

- Stage surface 是主空间。
- Workspace windows 是主要承载单元。
- Dock、stage strip 或 launcher 作为进入和恢复任务的辅助结构。

## Typography

Stage 在全局 Typography token 上强化窗口标题和当前焦点：

- 当前窗口标题使用 `title-large` 或 `title-medium`。
- 窗口内 section 使用 `title-small`。
- 长文本、说明和表单仍使用 `body-medium / body-large`。
- Dock、window controls、状态标签使用 `label-medium`。

Display token 仅用于空舞台或启动台，不用于常规窗口标题。

## Color, Shape, Motion, Density

- Color: neutral workspace with slightly stronger focus accent.
- Shape: window surfaces may use larger radii than Classic, but avoid nested card stacks.
- Motion: window enter, focus and close transitions should describe spatial movement.
- Density: adaptable. Active work windows can be dense; launcher and empty states can breathe more.

## Component States

聚焦窗口、后台窗口和临时窗口必须有明确状态差异。状态表达优先通过 elevation、边框强度和 header treatment，而不是大量色彩。

## Mobile Adaptation

移动端 Stage 不保持自由覆盖窗口。窗口应退化为全幅任务卡或临时页，保留最近任务恢复能力。

## Relation To Core Design Spec

Stage 可扩展 motion 和 surface treatment，但 Typography 仍消费全局 token。任何窗口专属 token 必须使用 `--lw-stage-*` 作用域。
