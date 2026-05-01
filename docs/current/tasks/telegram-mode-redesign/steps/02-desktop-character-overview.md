# Step 02: Desktop Character Overview

## 目标

实现桌面端角色概览页：用户点击左侧会话列表中的角色主行时，中间主区显示第 1 张图的角色概览，而不是直接进入聊天。

## 状态

已完成首轮实现与本轮回归修正。

## 输入与前置条件

- 桌面角色概览视觉基准为 `Desktop/Character Overview.png`。
- 左侧列表仍消费现有 `CharacterChannelState` 派生数据。
- 新聊天与打开历史会话继续走现有 Telegram shell / Discord character channel intents，不新增业务 API。

## 交互模型

- 点击左侧角色主行：
  - 记录 Telegram shell 的“当前选中角色概览”状态。
  - 中间主区切换到角色概览 surface。
  - 不自动打开最近聊天，不触发 ST 会话切换。
- 左侧角色主行选中态：
  - 选中角色以浅蓝整行圆角高亮呈现。
  - 行容器保留细边框，头像保留白色描边。
  - 选中态只表达当前概览角色，不代表已经打开具体聊天 session。
- 左侧筛选 tab：
  - 一级 tab 保持 `所有 / 角色 / 工具 / 筛选`。
  - 点击 `筛选` 打开二级菜单，不直接把列表切到单一过滤。
  - 二级菜单固定为 `全部会话 / 未读优先 / 收藏角色 / 最近更新`。
  - 筛选只作用于本地 `CharacterChannelState` 派生列表，不新增业务状态源。
- 点击左侧已展开的具体历史会话：
  - 直接进入对应聊天页。
- 点击概览页“新聊天”：
  - 调用现有 `createDiscordChatSession` / Telegram shell create intent。
  - 创建成功后进入新聊天页。
- 点击概览页最近聊天或所有聊天记录项：
  - 调用现有 open session intent。
  - 进入对应聊天页。

## 需要修改的子系统

- `luminaweave-extension/src/components/DiscordCharacterRail.vue`
- `luminaweave-extension/src/composables/shell/useTelegramShell.ts`
- `luminaweave-extension/src/shell/traditional/TraditionalShell.vue`
- 可能新增 Telegram 角色概览组件或 surface override，位置应靠近 Telegram shell 代码。

## 页面结构

角色概览页应包含：

- 角色 hero：头像 / 名称 / 星标 / 同步状态 / 在线状态 / 最近活跃时间。
- 主操作：`新聊天`。
- Tabs：`聊天 / 概览 / 设定 / 文件`。
- 最近聊天：展示最近 3 条上下文摘要。
- 所有聊天记录：展示当前角色的会话列表、标题和消息数。
- 右侧资料栏未展开时，中间页应保持完整可用；右栏展开后应显示角色资料侧栏或资料入口。

## 禁止事项

- 不在角色点击时直接调用会话打开逻辑。
- 不新增独立会话数据源。
- 不把角色概览做成通用主导航页；它只属于 Telegram shell 的聊天列表上下文。
- 不在概览页内嵌 Timeline、Director、Lorebook 等重型编辑器。

## 验收检查

- 左侧角色主行点击后，中间显示角色概览页。
- 左侧角色选中态接近概念稿：浅蓝整行圆角高亮、细边框、头像白描边。
- 点击 `筛选` 显示二级菜单，菜单项为 `全部会话 / 未读优先 / 收藏角色 / 最近更新`。
- 左侧具体历史会话点击后，仍直接进入聊天。
- 概览页“新聊天”创建成功后进入聊天。
- 无会话角色显示可行动空态。
- 长角色名、长摘要和大量历史会话不溢出。

## 实现记录

- 新增 `TelegramCharacterOverview.vue` 作为 Telegram shell 内部概览页。
- 新增 `telegramSelectedCharacterKey` shell 状态，只存在于 UI 层。
- `DiscordCharacterRail.vue` 的 Telegram variant 中，角色主行和头像点击改为选择概览；具体 session 仍直接打开聊天。
- `DiscordCharacterRail.vue` 已恢复 `筛选` 二级菜单，菜单项为 `全部会话 / 未读优先 / 收藏角色 / 最近更新`。
- Telegram 角色卡选中态已调整为浅蓝整行圆角高亮、细边框和头像白描边。
