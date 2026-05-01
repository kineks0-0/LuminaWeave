# Step 04: Mobile Character Overview

## 目标

按移动端 Character Overview 概念图重做 Telegram mobile 的角色概览临时页，让移动端不只是桌面三栏的压缩版。

## 状态

已完成首轮实现与本轮回归修正。

## 输入与前置条件

- 移动角色概览视觉基准为 `Mobile/Character Overview.png`。
- 侧栏角色页与移动端可参考 `D:/LuminaWeave/output/imagegen/telegram-mode-mockups/mobile-character-overview.png`；该路径只作为设计参考记录，不作为运行时资源。
- Telegram mobile 底栏仍固定为 `聊天 / 角色 / 设置 / 个人资料`。
- 上下文工具继续通过 `mobile-widget:*` 临时页打开。

## 需要修改的子系统

- `luminaweave-extension/src/shell/traditional/TelegramBottomNav.vue`
- `luminaweave-extension/src/shell/traditional/TelegramUserInfoPanel.vue`
- `luminaweave-extension/src/composables/shell/useTelegramShell.ts`
- 必要时调整 `TraditionalShell.vue` 的 Telegram mobile sheet 承载方式

## 页面结构

移动角色概览页应包含：

- 顶部导航：返回、当前角色名、同步状态、更多入口。
- 角色 hero：大头像、角色名、角色标签、简介、同步状态与最后同步时间。
- 快速操作：时间线、状态、导演、世界书。
- 最近聊天：3 条会话摘要，并提供查看全部入口。
- 所有聊天记录：全部对话、已收藏、归档等只读派生入口。
- 底部主操作：`开始新聊天`，需要避开安全区和底栏。

## 交互模型

- 底栏 `个人资料` 打开当前角色概览。
- 底栏 `角色` 打开角色列表 sheet。
- 在角色列表中点击角色主行时，移动端也进入角色概览，而不是直接进入聊天。
- 点击具体历史会话或概览页历史记录项时进入聊天。
- 点击上下文工具时打开对应 `mobile-widget:*` 临时页。
- 点击底部 `开始新聊天` 调用现有 create session intent，创建成功后进入聊天。

## 禁止事项

- 不隐藏移动端关键功能；只能改为单列、临时页或 sheet。
- 不让底栏增加 Timeline、Director、Lorebook 等主导航项。
- 不破坏现有安全区、IME 和 composer 可见性处理。

## 验收检查

- 移动端角色概览为单列，底栏不遮挡内容。
- 页面结构接近 `mobile-character-overview.png`：顶部返回/更多、角色 hero、快速操作、最近聊天、所有聊天记录、底部主按钮。
- 打开键盘时 composer 不被 Telegram mobile 导航遮挡。
- 长角色名、长摘要、无头像和无会话状态可读。
- 上下文工具入口能打开现有面板。

## 实现记录

- `telegram.infoPanel` 在移动端已改为角色资料页结构，包含顶部返回/更多、角色 hero、快速操作、最近聊天、所有聊天记录和底部 `开始新聊天`。
- 移动端角色列表中点击角色主行会关闭 sheet 并进入角色概览。
- 移动端上下文工具通过 `mobile-widget:*` 临时页打开现有 surface。
