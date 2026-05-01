# Step 03: Desktop Chat and Right Widget

## 目标

按第 4 张精修稿重做 Telegram 桌面聊天页和右侧角色资料侧栏，使聊天体验接近 Telegram，同时保留 LuminaWeave 的上下文工具入口。

## 状态

已完成首轮实现与本轮回归修正。

## 输入与前置条件

- 桌面聊天页视觉基准为 `Desktop/Right Widget.png`。
- 背景 token 应先按 Step 01 落地。
- 角色概览页的角色/会话选择行为应先按 Step 02 明确。

## 需要修改的子系统

- `luminaweave-extension/src/plugins/chat/ChatStream.vue`
- `luminaweave-extension/src/shell/traditional/TelegramUserInfoPanel.vue`
- `luminaweave-extension/src/shell/traditional/WidgetPanelHost.vue`
- `luminaweave-extension/src/theme/builtinThemePacks.ts`

## 聊天页要求

- 顶部栏：
  - 返回按钮、角色名、星标、在线状态。
  - 顶栏右侧按钮锁定为 `搜索 / 右侧栏 / 更多`。
  - `右侧栏`按钮打开或聚焦 `telegram-profile`，桌面端显示右侧角色资料页。
  - 不保留电话/视频占位按钮，避免与当前概念稿冲突。
- 聊天流：
  - 浅蓝纹理或轻量图案背景。
  - 对方消息为白色气泡，用户消息为浅绿色气泡。
  - 消息时间与发送状态靠近气泡末尾。
  - 高级操作如编辑、删除、分支、Prompt 预览默认收纳在 hover 或更多菜单中。
- Composer：
  - 底部圆角输入条。
  - 附件、表情、语音/发送图标按 Telegram 习惯排列。
  - IME 与移动安全区逻辑不得被破坏。

## 右侧角色资料页要求

右栏 `telegram.infoPanel` 在桌面聊天页中应恢复为角色资料页 / 角色资料侧栏，而不是状态摘要卡片页。信息架构可参考 `D:/LuminaWeave/output/imagegen/telegram-mode-mockups/mobile-character-overview.png`，但桌面端需要适配窄栏。

- 顶部：返回按钮、角色资料标题、关闭按钮。
- 角色 hero：
  - 头像、角色名、角色标签、简介。
  - 同步状态与最后同步时间。
- 快速操作：
  - 时间线
  - 状态
  - 导演
  - 世界书
- 最近聊天：
  - 展示当前角色最近 3 条会话摘要。
- 所有聊天记录：
  - `全部对话 / 已收藏 / 归档` 等入口可作为只读派生分组。
- 工具入口：
  - 时间线
  - 状态
  - 导演
  - 世界书

资料内容优先从现有 `CharacterChannelState`、当前 session summary、recent preview、message count 派生；缺失时显示中性空态，不新增业务数据源。

## 禁止事项

- 不把右栏变成 Timeline、Director 或 Lorebook 的内嵌重编辑器；右栏只提供摘要和入口。
- 不新增聊天同步或持久化逻辑。
- 不改变 PromptInspector、分支、删除等核心能力，只改变 Telegram 表层入口与默认显隐。

## 验收检查

- 桌面宽屏下左栏、中栏、右栏比例接近概念图。
- 右栏关闭后聊天区仍完整可用。
- 聊天顶栏按钮为 `搜索 / 右侧栏 / 更多`，点击右侧栏按钮打开或聚焦 `telegram-profile`。
- 右栏显示角色资料页，而不是状态摘要卡片页。
- `rightInfoPanel` 设置为 `hidden / auto / always` 时行为符合现有规则。
- 生成中、切换会话中、错误状态在 Telegram 气泡样式下可读。

## 实现记录

- `TelegramUserInfoPanel.vue` 已恢复为角色资料侧栏，包含角色 hero、同步信息、快速操作、最近聊天和所有聊天记录入口。
- `ChatStream.vue` 顶部工具已改为 `搜索 / 右侧栏 / 更多`，右侧栏按钮打开或聚焦 `telegram-profile`。
- `useTelegramShell.ts` 已补充右侧栏显式打开状态：`rightInfoPanel: hidden/auto` 不会阻断用户从聊天顶栏手动打开角色资料页，关闭或切换面板后复位。
- 右栏资料内容继续从 `CharacterChannelState` 和当前 session 派生。
