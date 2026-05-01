# Telegram Liquid Glass 桌面模式规划

## 1. Summary

`telegram` 是新增的独立内置桌面模式，不是 `discord` 的皮肤，也不替换 `classic / stage / discord`。它以聊天为中心，参考 Telegram 式三栏信息架构与 Liquid Glass 视觉：浅色与深色双配色、柔和蓝色氛围、玻璃质感角色列表、气泡聊天、会话/角色资料页与移动端底栏。

本模式只扩展桌面模式、Shell 导航、主题变体和组件皮肤，不改变 `ConversationService / STAdapter / PersistenceService / PromptBuilder` 等核心运行时。

## 2. Product Shape

- 桌面宽屏：内嵌圆角桌面窗口，顶部仅保留 Telegram 风格窗口栏；窗口内部为左侧聊天列表、中间会话、右侧个人资料/会话详情三栏。
- 左侧聊天列表不再显示 Discord/Lumina 的 `Direct Messages / 角色频道` 解释头，而是使用品牌/状态行、`+` 二级菜单、本地搜索框、`全部 / 角色 / 收藏 / 最近` 轻量筛选 tab 与紧凑会话行。搜索范围限定在当前 `CharacterChannelState` 已提供的角色名、会话标题和最近预览，不会自动创建会话。
- 中间会话区默认显示 Telegram 风格会话头、浅蓝图案背景、左右气泡与一行 composer。未打开聊天时显示欢迎态、最近会话、最近角色、`选择角色开始` 与设置入口，不把 Timeline/Director 等高级工具塞进空态主入口。Prompt 预览、分支、编辑、删除等 Lumina 高级能力默认收起到 hover / 更多入口。
- 右侧资料栏默认绑定当前角色/会话数据，展示头像、名称、同步状态、角色摘要、当前会话摘要、最近历史与上下文工具摘要；它不再使用真实 IM 的 Call/Video/Block/媒体文件模型，也不通过强行改造 `LuminaStats` 来伪装资料页。
- 移动/窄屏：底栏固定为 `聊天 / 角色 / 设置 / 个人资料`。
- `Timeline / Lorebook / Memory` 等依赖聊天上下文的数据型组件不再作为 Telegram 桌面的独立主入口；它们收敛到聊天顶部图标区，或放入点击聊天顶部角色后打开的个人资料/会话详情页。
- `个人资料` 在 Telegram 模式中表示当前角色/当前会话详情页，只承载时间线、状态、导演、世界书等上下文工具的轻量摘要与入口；重型编辑器继续由既有插件面板承载。

## 3. Architecture Boundaries

- `telegram` 通过 `DesktopModeManifest` 注册，`shell.kind = traditional`。
- 视觉差异必须通过 `designTokens / surfaceSkins / rendererVariants / settingsManifest` 下发，避免在业务组件中硬编码 Telegram 专属数据逻辑。
- Telegram 专用结构性 surface contract 为 `telegram.frame / telegram.chatList / telegram.conversation / telegram.infoPanel / telegram.composer`。这些 contract 只描述壳层、列表、会话、资料与输入器的表层变量，不拥有会话状态或存储权限。
- 角色频道能力复用现有 `CharacterChannelService` 与统一会话上下文；视图只发起打开、新建、重命名、删除等意图。
- Telegram shell 允许新增搜索 query、当前过滤 tab、`+` 菜单展开态与工具菜单展开态等 UI 层状态；这些状态不得写入 `CharacterChannelService`、`ConversationService` 或持久化层。
- 设置页、聊天、角色栏、右侧面板、Timeline、Lorebook、Director、Stats 等官方上下文组件通过 `useComponentSkin()` 与 `data-skin-variant='telegram'` 适配。新增上下文插件 skin key 为 `stats.panel` 与 `director.panel`；它们只描述 Telegram 表层变量，不承载插件业务状态。
- 不新增独立聊天数据源，不绕过统一会话 API，不修改同步、持久化、Prompt 合成链路。

## 4. Implementation Checklist

- 新增 `telegramThemeSettings`、`resolveTelegramDesignTokens()`、`createTelegramSurfaceSkinMap()`。
- 扩展 `ThemeHeaderVariant / ThemeSurfaceVariant` 与 `themeComponentRegistry` 支持 `telegram`。
- 新增 Telegram 移动底栏组件，只处理 `聊天 / 角色 / 设置 / 个人资料` 四个导航意图。
- Traditional Shell 在桌面 Telegram 模式下隐藏全局 `PanelHeader`，改由 shell 内部窗口栏承载关闭与设置入口。
- `ChatStream` 增加 `telegram` 结构 variant，输出参考图式聊天头、背景、气泡与输入胶囊；不直接持有 Timeline/Lorebook/Memory 面板状态。
- `SettingsRoot / SettingsUnified / SettingsDetailed / SettingControl` 增加 `telegram` variant，并把设置项压回 Telegram 式列表行与胶囊控件。
- `LuminaStats / DirectorPanel / LuminaTimeline / LorebookWorkspace / LorebookEditor` 在 `telegram` variant 下呈现浅雾蓝、轻玻璃分区、圆角列表行和触控友好的单列移动布局。
- `WidgetPanelHost` 使用 `telegram-profile` 作为 Telegram 资料页伪面板；`lumina-stats` 保留为真实状态工具面板，避免资料页入口与状态插件互相占用。
- `ChatStream` 和 `TelegramUserInfoPanel` 通过 `TELEGRAM_CONTEXT_TOOL` 或 `switchRightPanel` 意图打开既有 `lumina-timeline / lumina-lorebook / lumina-director / lumina-stats / lumina-settings` 面板，不直接内嵌插件重操作。
- 更新 `docs/index.md`、`docs/overall/PDR.md`、`docs/overall/system_design.md` 中的桌面模式说明。

## 5. Mobile Adaptation Roadmap

- 桌面实现不得写死三栏为唯一信息架构：窄屏隐藏右栏，中等宽度压缩聊天列表，移动端切换为单列页面栈。
- 移动端底栏固定为 `聊天 / 角色 / 设置 / 个人资料`，不新增 Timeline/Director/世界书/状态主入口。
- `Timeline / Director / Lorebook / Stats / Settings` 在移动端通过 `mobile-widget:*` 临时页进入，使用单列、全宽、触控优先布局；复杂时间线画布在 Telegram 移动端默认收敛为纵向节点列表。
- 移动端继续复用同一套 Telegram theme token、角色频道读模型和资料页数据绑定；只替换 Shell 编排、页面导航与触控交互。

## 6. Acceptance

- `listDesktopModes()` 返回 `telegram`，且 `getDesktopModeShell('telegram').kind === 'traditional'`。
- 浅色/深色下 Telegram tokens 均正确分发到 Shell、聊天、角色栏、设置页和右侧面板。
- `resolveComponentSkin('telegram', 'telegram.frame' | 'telegram.chatList' | 'telegram.conversation' | 'telegram.infoPanel' | 'telegram.composer' | 'stats.panel' | 'director.panel')` 均返回 `telegram` variant 与可覆盖 CSS 变量。
- 移动端底栏四项可用：聊天切回主聊天，角色打开角色频道，设置打开设置，个人资料打开右侧信息面板/临时面板。
- `Timeline / Lorebook / Memory` 在 Telegram 模式中作为聊天上下文工具入口，而不是独立主导航目标。
- `classic / stage / discord` 行为不回归。
- `npm run type-check` 通过。
