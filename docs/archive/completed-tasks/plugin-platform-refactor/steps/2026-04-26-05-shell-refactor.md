# 05 Shell Refactor

## 目标

让 `App.vue` 降级为 runtime host，Shell 由当前桌面模式实现。

## 涉及模块

- `luminaweave-extension/src/App.vue`
- `luminaweave-extension/src/shell/`
- `luminaweave-extension/src/composables/shell/`
- `luminaweave-extension/src/theme/`

## 具体改动

- `App.vue` 只负责初始化 settings、API、desktop runtime 和根容器。
- traditional/freeform/discord/telegram 的大分支迁入 desktop mode shell renderer。
- navigation model 决定 Header、Dock、Stage Strip、角色轨、移动端底栏等入口。
- 已完成的中间迁移：
  - traditional 主内容插件入口改由 `SurfaceOutlet` 按 primary surface 渲染。
  - traditional 右侧 widget 插件入口改由 `SurfaceOutlet` 渲染；`card_maker` 注册面板映射到 `forge.workspace`，其它动态工具 panel 暂保留旧组件路径。
  - freeform workspace 静态启动台、Forge 主窗、插件主窗和 widget 窗口改由 `SurfaceOutlet` 渲染。
  - freeform launchpad overlay 改由 `launcher.root` surface 渲染。
  - 移动端临时 widget tab 的插件入口改由 `SurfaceOutlet` 渲染；`card_maker` panel 映射到 `forge.workspace`。
  - Launcher 中的 Forge 入口改为直接打开 `forge.workspace` surface tab，不再走旧 `openPanel('card_maker')`。
  - `DynamicTabConfig` 新增 `surfaceContractId`，traditional dynamic tab 与 freeform dynamic workspace app 可直接渲染 surface。
  - App 层 `tabComponentRegistry` 已移除 `SettingsRoot / LauncherRoot` 两个已 surface 化的硬编码项，仅保留冲突/同步报告等 legacy 工具组件。
  - dynamic tab 中未命中 legacy 组件注册表的字符串 component 会被视为 surface contract，而不是回退到 Launcher。
  - dynamic tab 的解析规则已抽到 `shell/dynamicTabResolver.ts`，traditional shell 与 freeform workspace 共享同一套 surface / legacy component 判定，并由单测覆盖。
  - legacy dynamic tab 组件表已下沉到 `shell/legacyTabComponents.ts`；App 不再直接 import 冲突/同步报告 tab 组件，也不再向 workspace manager 传 component map。
  - `tabComponentRegistry` 已从 App / LuminaShellRoot props 链中移除；traditional shell 与 freeform workspace 直接使用 Shell 层 legacy registry。
  - dynamic tab 渲染已抽到 `shell/DynamicTabOutlet.vue`；traditional shell 与 freeform workspace 都通过该 outlet 渲染 dynamic tab，不再各自分支处理 surface / legacy component。
  - 全局冲突查看与同步报告弹窗已封装到 `shell/LegacyGlobalPanels.vue`；`LuminaShellRoot` 只保留 legacy host 引用，不再直接 import 具体工具面板。
  - legacy 工具面板注册信息已集中到 `shell/legacyPanelRegistry.ts`；bootstrap 注册、legacy tab component registry、freeform 会话切换窗口共享同一来源。
  - `LuminaWeaveAPI.openPanel(..., { mode: 'tab' })` 会优先通过 registered panel surface 映射打开 surface tab；未映射的 panel 继续走 legacy component tab。
  - Telegram 资料页已注册为桌面模式自有 `telegram.infoPanel` surface override；App 移动端个人资料 tab 与 traditional 右侧资料栏都只打开 surface contract，不再直接 import 该主题组件。
  - 内置桌面模式 v2 manifest 已声明 `shellRenderer`，`LuminaShellRoot` 已开始从 `DesktopModeRuntimeRegistry` 解析当前桌面模式 shell renderer，并用 fallback 保留 traditional/freeform 现有行为。
  - `LuminaShellRoot` 内部已建立 `shellContext` / `shellActions` 中间分组，traditional/freeform renderer props 先从该分组派生，作为后续收束正式 shell API 的过渡层。
  - `shell/types.ts` 已新增显式 `ShellRuntimeContext` / `ShellRuntimeActions` 类型，避免后续迁移依赖匿名对象形状。
  - `FreeformShell` 已正式改为接收 `runtimeContext` / `runtimeActions`，内部通过 computed alias 适配现有模板；`LuminaShellRoot` 对 freeform renderer 只传这两个 runtime 入参。
  - `TraditionalShell` 已正式改为接收 `runtimeContext` / `runtimeActions`，内部通过 computed alias 适配现有 Discord / Telegram / widget 模板；`LuminaShellRoot` 对 traditional renderer 也只传这两个 runtime 入参。
  - `shell/types.ts` 已新增 `ShellRuntimeSurfaces`，并把插件列表、动态 tab、surface variant/style、workspace window/dock/strip 等承载信息从 context 拆出；Traditional/Freeform shell renderer 现在都接收 `runtimeContext` / `runtimeActions` / `runtimeSurfaces`。
  - Telegram 右栏策略、个人资料 surface tab、移动端底栏选择和桌面右栏自动切换已下沉到 `useTelegramShell`，App 只传入运行时依赖。
  - Discord guild rail 设置切换已下沉到 `useDiscordShell`，App 不再直接拼 Discord 桌面模式设置键。

## 验收标准

- [x] App 层不再硬编码 Telegram / Discord 的交互分支；对应逻辑下沉到 shell composables。
- [x] 切换桌面模式只替换 shell renderer 与 surface map，不触碰业务状态。
- [x] 移动端和桌面端 shell 均由 desktop mode runtime 解析。
- [x] 插件组件不再作为 Shell 主入口直接渲染，Shell 只解析 surface contract。

## 风险点

- App 仍是 runtime host，负责组装 shell context/actions/surfaces；后续 API Facade Split 应继续拆成 desktop/surface services。
- `registeredPanels` 仍是 legacy 动态面板通道，冲突查看、同步报告、Forge 辅助面板等需在后续步骤继续迁入 Surface Runtime。
- `openTab` 支持 `surfaceContractId` 仍属于迁移桥接；最终应在 API Facade Split 中下沉为 `surface.open()` / `desktop.openSurface()` 之类的 domain service。
- `legacyPanelRegistry.ts` / `LegacyGlobalPanels.vue` 仍保留冲突查看、同步报告、会话切换等尚未迁移到 Surface Runtime 的工具入口。
- Discord / Telegram 的具体视图仍复用 existing shell renderer 与 character channel 组件；后续可继续拆为更细的 desktop-specific shell renderer，但 Step 05 的 runtime shell outlet 与 surface 主入口已完成。
