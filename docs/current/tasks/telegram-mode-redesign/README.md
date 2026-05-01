# Telegram Mode Redesign Current Task

## 目标

跟踪 Telegram 桌面模式的视觉与交互重设计，确保后续实现不会因为上下文压缩丢失关键设计来源、交互边界和验收口径。

本任务聚焦 Telegram 模式表层体验：

- 桌面端按三栏即时通讯界面重做：左侧会话列表 / 中间角色概览或聊天 / 右侧角色资料侧栏。
- 移动端按单列 Character Overview 体验重做：角色 hero、最近聊天和上下文工具入口。
- 左侧会话列表的角色主行点击时，中间主区先显示角色概览页；只有点击“新聊天”或具体历史会话时才进入聊天页。

## 当前状态

已完成首轮实现：

- 已加入 Telegram 弥散蓝背景 token，并以 `Group 11.svg` 的参数为依据。
- 已加入桌面角色概览页，左侧角色主行点击进入概览，具体历史会话点击进入聊天。
- 已将右侧 `telegram.infoPanel` 改为状态摘要栏。
- 已将移动 `telegram.infoPanel` 改为单列角色概览与上下文工具入口。

本轮回归修正已落地：

- 左侧会话列表已恢复 `筛选` 二级菜单：`全部会话 / 未读优先 / 收藏角色 / 最近更新`。
- 左侧角色选中态已调整为浅蓝整行圆角高亮、细边框、头像白描边。
- 聊天顶栏已恢复右侧栏按钮，按钮组锁定为 `搜索 / 右侧栏 / 更多`。
- 右侧 `telegram.infoPanel` 已恢复为角色资料页 / 角色资料侧栏，不再以状态摘要栏作为最终形态。

本阶段三项增强已落地：

- Telegram 桌面模式新增 `panelChromeStyle` 与 `topBlankSpace` 设置，默认使用设计稿式圆角外边距三栏；旧贴边三栏作为 `edge-to-edge` 兼容选项保留。
- 左侧会话列表新增工具入口：`启动台` 置顶、`制卡工坊` 第二，视觉复用角色行结构；`所有` 显示工具 + 角色，`角色` 只显示角色，`工具` 只显示工具，`筛选` 继续只作用于角色/会话派生列表。
- 左侧列表与右侧资料栏均支持桌面端拖拽调整宽度。左栏持久化到 `luminaWeave.telegram.leftRailWidth`，右栏继续使用 `luminaWeave.widgetWidth`，并按视口动态约束以保留中间聊天区最小宽度。

验证状态见 [05 Verification and Doc Sync](./steps/05-verification-and-doc-sync.md)。

## 设计来源

- 桌面聊天页主视觉：`Desktop/Right Widget.png` 对应的精修三栏 Telegram 聊天界面。
- 桌面角色概览：`Desktop/Character Overview.png`，用于定义左侧角色点击后的中间主区概览页。
- 移动角色概览：`Mobile/Character Overview.png`，用于定义 Telegram mobile 单列信息架构。
- 侧栏角色页与移动端参考：`D:/LuminaWeave/output/imagegen/telegram-mode-mockups/mobile-character-overview.png`，仅作为设计参考，不作为运行时资源。
- 背景弥散渐变权威来源：`C:/Users/33633/Downloads/LuminaWeave Telegram Mode Editable Mockups/Group 11.svg`。

Figma 原始文件链接：

<https://www.figma.com/design/j3vUiAdMBsNStR9b9MWkTY/LuminaWeave-Telegram-Mode-Editable-Mockups?node-id=5-3&p=f&t=N1I3KUSn4v3J9MhP-0>

当前 Figma MCP 读取受 Starter plan 调用上限阻断，因此背景参数以已读取的 SVG 导出内容为准。

## 架构边界

本任务只允许修改 Desktop Mode / Shell / Surface / theme token / Telegram variant 层。

不得修改：

- `ConversationService`
- `STAdapter` / `STSyncService`
- `PersistenceService`
- Prompt 构建与生成链路
- 统一会话文档与事务协议

上下文工具仍作为 Telegram 的上下文入口出现，不能进入 Telegram 主导航。Timeline、状态、导演、世界书等入口应从聊天顶部更多菜单、composer 工具菜单、角色概览或右侧角色资料侧栏打开。

## 恢复入口

- [01 Design Source and Tokens](./steps/01-design-source-and-tokens.md)
- [02 Desktop Character Overview](./steps/02-desktop-character-overview.md)
- [03 Desktop Chat and Right Widget](./steps/03-desktop-chat-and-right-widget.md)
- [04 Mobile Character Overview](./steps/04-mobile-character-overview.md)
- [05 Verification and Doc Sync](./steps/05-verification-and-doc-sync.md)
- [06 Desktop Chrome Tools and Resize](./steps/06-desktop-chrome-tools-and-resize.md)

## 下一步

下一步需要在真实宿主或本地预览环境中进行视觉走查，重点确认默认圆角外边距三栏、顶部留白开关、左栏工具入口、筛选二级菜单、左右拖拽宽度、右侧角色资料页和移动端安全区/IME 是否满足最终稿预期。
