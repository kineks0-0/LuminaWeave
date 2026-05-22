# Telegram Desktop Design

## Summary

Telegram 是 Liquid Glass 即时通讯桌面。它服务会话列表、角色资料、气泡聊天和移动端四 tab 栈导航，视觉目标是轻玻璃层级、即时通讯熟悉感和长文本阅读舒适度。

## Personality

- Liquid glass messenger
- Calm roleplay reading
- Mobile-first stack navigation
- Context tools behind profile surfaces

## Information Architecture

桌面端使用会话列表、聊天、资料页三栏。移动端使用 `对话 / 角色 / 设置 / 个人资料` 四个一级 tab，每个 tab 有独立 stack。

Telegram 的主导航不暴露 Timeline、Lorebook、Director、Stats 等重型工具。它们作为聊天顶部、composer 或资料页里的上下文入口出现。

## Surface Model

- `telegram.frame` 承载整体桌面壳层。
- `telegram.chatList` 承载会话列表、角色聚合和工具入口。
- `telegram.conversation` 承载聊天 surface 和 composer。
- `telegram.infoPanel` 承载角色/会话资料和上下文工具摘要。
- 移动端每个 tab 内容区是单列 stack surface。

## Typography

Telegram 可以比 Classic 更强调身份和聊天上下文：

- 移动端一级页标题使用 `title-large`。
- 角色名、用户本人资料名可使用 `headline-small` 或 `title-large`。
- 列表行角色名使用 `title-small`。
- 最近摘要和状态使用 `body-small / body-medium`。
- 底部 tab、筛选、菜单项使用 `label-medium`。
- 聊天正文使用 `body-large` 或桌面模式聊天排版设置，保持中文长文可读。AI 回复与用户输入默认跟随统一聊天排版，但允许在 Telegram 桌面模式设置中分别覆盖字号、行高和字距；用户覆盖同时作用于已发送用户消息和 composer 输入框。

## Color, Shape, Motion, Density

- Color: soft blue-tinted neutrals with sparse active accent.
- Shape: rounded messenger surfaces and capsule controls.
- Motion: stack push/pop and menu reveal can be slightly more tactile than Classic.
- Density: mobile lists touch-friendly, desktop lists compact but not cramped.

## Component States

Telegram 需要清楚区分一级 tab、二级详情页、当前聊天、当前资料页。二级页不应显示底部一级 tab。聊天页顶栏由聊天 Surface 自己承载，避免重复导航栏。

## Mobile Adaptation

移动端是 Telegram 设计的核心约束。四个一级 tab 保留各自 stack；进入 `chat / characterOverview / tool` 等二级页时隐藏底部 tab。

## Relation To Core Design Spec

Telegram 消费全局 Typography token，并可扩展 `--lw-telegram-*` 局部 token 来表达玻璃层级、消息气泡和移动导航。它不得绕过核心会话、同步、持久化或 Prompt 链路。
