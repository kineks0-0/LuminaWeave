# Step 07: Stack Navigation and Mobile Tabs

## 目标

记录下一轮 Telegram Shell 导航重构任务：隐藏 Telegram 模式下的 `lw-panel-header`，并把桌面三栏与移动端四个 tab 都收敛为独立的 stack navigator。

本步骤已落地首轮实现，仍需真实宿主视觉走查。

## 输入与前置条件

- “隐藏底栏”在本轮语境中指隐藏 `lw-panel-header`，不是移除 Telegram mobile 底部四项 tab。
- Telegram mobile 仍保留一级底部 tab：`对话 / 角色 / 设置 / 个人资料`。
- 桌面左栏当前的会话列表、角色筛选、搜索、筛选菜单和工具入口属于同一个“会话列表页”。
- 桌面左栏需要新增另一个“角色列表页”，用于集中展示角色头像、名字、会话数与最近摘要。
- 会话列表需要同时支持当前角色聚合显示，以及按对话文件拆开的显示模式。

## 状态

已完成首轮代码实现与类型检查，待真实宿主视觉走查。

## 信息链路检查

- 输入：
  - `CharacterChannelState` 提供当前角色聚合、会话摘要、活跃会话与角色展开状态。
  - 现有会话摘要 / 目录能力提供对话文件模式需要的 session item。
  - Shell view-model 负责记录 Telegram 专属列表模式、页面栈与临时页面状态。
- 处理流程：
  - Telegram Shell 按桌面 / 移动分流。
  - 桌面端左栏、中栏、右栏分别维护自己的 stack。
  - 移动端 `对话 / 角色 / 设置 / 个人资料` 四个 tab 分别维护自己的 stack。
  - 页面 push / pop / replace 只影响当前 pane 或当前 tab，不清空其他栈。
- 状态变化：
  - `lw-panel-header` 在 Telegram desktop/mobile 下均不渲染。
  - 会话列表模式默认保持 `角色聚合`，用户切换到 `对话文件` 后只影响会话列表页展示。
  - 点击角色聚合 item 进入角色概览；点击对话文件 item 直接进入聊天页。
- 输出：
  - 桌面端保持三栏即时通讯结构，但每栏拥有独立返回历史。
  - 移动端保持底部四项一级 tab，但每个 tab 内容区拥有独立返回历史。
  - 用户个人资料页与角色 / 会话资料页分离。
- 上下游影响：
  - 只影响 Telegram Shell / Surface / theme variant / 局部 UI 状态。
  - 不改变核心会话状态机、同步、持久化、Prompt 或事务协议。

## 需要修改的子系统

- `src/composables/shell/useTelegramShell.ts`
  - 新增 Telegram desktop panes 与 mobile tabs 的 stack 状态。
  - 管理会话列表模式与 Telegram mobile 一级 tab 行为。
- `src/shell/traditional/TraditionalShell.vue`
  - 使用 Telegram stack route 渲染左栏、中栏、右栏与移动端 tab 内容区。
  - Telegram desktop/mobile 均不依赖 `lw-panel-header` 作为主导航。
- `src/components/DiscordCharacterRail.vue` 或新的 Telegram 会话列表组件
  - 抽出 Telegram 会话列表页。
  - 支持 `角色聚合 / 对话文件` 两种展示。
  - 保留现有搜索、筛选和工具入口。
- 新增 Telegram 页面组件
  - `TelegramRoleListPage`：角色列表页，顶部有搜索框与排序筛选。
  - `TelegramUserProfilePage`：用户个人资料页，显示用户头像、用户名和菜单按钮。
- Shell runtime 类型
  - 增加 Telegram pane id、mobile tab id、stack route 与会话列表模式类型。

## 桌面端导航模型

- 左栏 stack：
  - `会话列表页`
    - 包含当前会话列表、角色筛选、搜索、筛选菜单和工具入口。
    - 支持 `角色聚合 / 对话文件` 显示模式。
  - `角色列表页`
    - 顶部类似会话列表，包含搜索框和排序 / 筛选。
    - 列表显示角色头像、名字、会话数与最近摘要。
- 中栏 stack：
  - 欢迎态 / 角色概览 / 聊天页 / 工具主视图。
- 右栏 stack：
  - 角色资料 / 会话资料 / 上下文工具面板。

三栏 stack 互相独立：左栏切到角色列表页时，不应清空中栏聊天或右栏资料页；中栏打开聊天时，不应重置左栏当前页面。

## 移动端导航模型

- `对话` tab：
  - 会话列表 -> 角色概览或聊天 -> 工具视图。
- `角色` tab：
  - 角色列表 -> 角色概览 -> 聊天。
- `设置` tab：
  - 设置首页 -> 详细设置。
- `个人资料` tab：
  - 用户资料 -> 小窗面板入口 / 临时标签页入口。

切换底部 tab 时保留各自栈；返回动作只影响当前 tab 栈。

## 交互与验收检查

- Telegram desktop 和 Telegram mobile 均不显示 `lw-panel-header`。
- Telegram mobile 底部四项 tab 仍可见，并且能在 `对话 / 角色 / 设置 / 个人资料` 间切换。
- 会话列表页默认是 `角色聚合` 模式。
- 会话列表页可切换到 `对话文件` 模式。
- `角色聚合` 模式下：
  - 点击角色主 item 进入角色概览页。
  - 点击具体历史会话进入聊天页。
- `对话文件` 模式下：
  - 每个 item 对应一个对话文件 / session。
  - 点击 item 直接进入聊天页。
- 桌面端左栏可在 `会话列表页` 与 `角色列表页` 间切换。
- 桌面端左栏、中栏、右栏各自返回，不互相清空。
- 移动端四个 tab 各自恢复上次页面栈。
- 个人资料页显示用户本人资料。
- 角色 / 会话资料继续由 `TelegramUserInfoPanel` 或等价角色资料 surface 承载。

## 文档同步

本步骤改变 Telegram Shell 导航事实，已同步更新：

- `docs/overall/PDR.md`
- `docs/overall/system_design.md`
- `docs/overall/modules/desktop_modes/telegram-liquid-glass-mode.md`

## 验证记录

- `npm run type-check`：通过。

## 假设与未验证前提

- `对话文件` 模式可以复用现有 session summary / conversation directory，不需要新增后端 API。
- 对话文件模式缺失标题、头像或摘要时，仅在 UI 层做最小兜底。
- 用户个人资料页可复用现有 `LuminaWeave.getUserName()` 与 `LuminaWeave.getUserAvatar()`。
- 桌面菜单内容可从现有 `PanelHeader` 头像菜单抽取或复用，但实现前仍需确认组件拆分成本。

## 禁止事项

- 不改 `ConversationService`。
- 不改 `STAdapter` / `STSyncService`。
- 不改 `PersistenceService`。
- 不改 Prompt 构建、生成链路或事务协议。
- 不把 Timeline / Director / Lorebook / Stats 提升为 Telegram 主导航入口。
