# Desktop Modes 模块文档

Desktop Modes 定义 LuminaWeave 的平台级桌面模式。桌面模式不是局部皮肤，而是由 shell、navigation、surface preset、renderer variant、tokens、interaction policy 与 versioned composition 共同决定的工作方式。

桌面模式采用单注册源：`DesktopModeManifest` 是公开事实源，`registerDesktopMode()` 会同时进入模式列表、设置详情和 Desktop Mode Runtime。运行时内部只派生 `DesktopModeRuntimeDescriptor`，用于解析 shell renderer、`shellKind`、navigation model、interaction policy 与受控 desktop overrides。

插件主 Surface 只由 `PluginManifestV2.primarySurface` 声明。Shell、Workspace 和移动路由不得根据插件 ID 推断 contract。Surface contract、plugin renderer 与 desktop override 在写入 registry 前必须完成整批校验；任一条目失败时不得留下部分注册状态。

## Composition Runtime

`DesktopModeManifest.composition` 固定使用 `version: 1`，并分别提供 `desktop`、`mobile` 根节点。两棵树共享同一节点 ID 命名空间，重复 ID 会使整个模式注册失败。

- `group`：声明 `direction: row | column` 与子节点。
- `surface`：声明已注册的 `contractId` 与对应的 typed `input`。
- `activity-slot`：为 Shell 拥有的 Activity 容器保留挂载位置。
- 所有节点都显式声明 `size: content | fill` 与 `visibility: visible | hidden`。

节点 schema 为 strict object，不接受任意 CSS、Vue component、attrs 或宿主对象引用。注册时先执行无副作用 runtime preflight，依次校验 version、布局、desktop/mobile 全树节点 ID、Surface contract 和 contract input，再校验 desktop overrides；全部通过后才写入核心模式列表和 runtime registry。`resolveComposition(desktopModeId, viewport)` 只选择已校验根节点并返回独立副本。

classic、stage、discord、telegram 已全部声明 composition，并通过相同的 version、节点 ID、Surface contract 与 input 预检。字段目前只为最终清理保留可选类型；任务 10 将把 composition 收紧为必填并删除无 composition fallback。

## Shell 与 Workspace 投影

声明 composition 的模式仍由 `LuminaShellRoot` 挂载 concrete Shell，再把 `DesktopCompositionOutlet` 注入其 Activity 区域。`surface` 节点进入 `ThemedSurfaceOutlet`，`activity-slot` 只接收 Shell 自有容器：traditional 使用通用主 Activity outlet 并保留 Telegram 移动页面栈，freeform 使用舞台与窗口工作台。Shell 不根据 contract 或插件 ID 判断 Chat、Forge、Launcher、Settings 等业务含义。

Desktop navigation descriptor 的 desktop/mobile Surface 列表在 composition 校验后直接从对应树收集。Workspace 应用目录遍历完整启用插件集合，再从 `primarySurface`、`navigationSlots` 和可选 `ActivityDescriptor` 派生；Activity-only 插件也可进入目录，main/widget 仅决定受控的默认 Activity 尺寸，动态 Activity 继续通过通用窗口入口提供。Freeform Shell 只负责舞台、窗口、焦点、导航显隐和 Dock，新建舞台为空容器，不自动打开 Launcher 或其他业务插件。

组合根和递归节点的 renderer identity 覆盖 desktop mode、viewport、node kind 与 contract，主题 skin 跟随响应式 contract id 更新，避免切换模式或节点时复用旧 renderer 状态。

classic、stage 与 telegram 的 desktop/mobile 根节点以 Activity slot 保留各自 Shell 容器；Discord desktop 使用 `character.roster + activity-slot` 横向组合，mobile 根节点保留 Activity slot。Discord 角色 overlay、Telegram 左栏 tabs 和移动页面栈通过 `ThemedSurfaceOutlet` 挂载 `character.roster`、`conversation.sessionList` 与 `chat.main`，模式 Shell 不再直接挂载旧角色/会话业务组件。

## 第三方扩展示例

`luminaweave-extension/src/examples/desktop-experience/` 提供一个不自动注册的 `example.characterFocus` 示例。它演示两层扩展模型：

- 纯声明式 `DesktopModeManifest.composition` 只组合已注册的 `example.characterFocus` surface 与 `activity-slot`。
- trusted plugin 通过 `SurfaceContractMap` module augmentation、strict Zod schema 和 `PluginManifestV2.businessRenderers` 注册 Vue renderer，并只调用 `DesktopExperienceRuntime` 的 typed 能力。

示例 context factory 跟随当前角色与会话，订阅 conversation/generation 并投影消息和时间线；销毁时取消 watcher 和所有订阅，迟到异步结果不得更新已卸载 surface。示例目录不属于正式插件 bootstrap、内置模式或远程代码加载机制。

当前项目仍处于早期阶段，桌面模式不保留旧 Theme Pack 兼容层。代码和 storage 统一使用 `activeDesktopMode` 与 `desktop-mode-*`；`ThemePack`、`activeThemePack`、`theme-pack-*`、`themePackId`、`useThemePack()` 和 `getThemePack*` 不再作为公开或内部入口。

代码目录边界：

- `luminaweave-extension/src/desktop-modes/core/`：公开 manifest 类型、注册中心、桌面模式 composable 与 surface skin 契约。
- `luminaweave-extension/src/desktop-modes/builtins/<mode>/`：classic / stage / discord / telegram 的 manifest、settings、tokens、skins 与受控模式 policy。每个模式的 settings、design token resolver 和 surface skin map 必须由自己的目录直接拥有。
- `luminaweave-extension/src/desktop-modes/builtins/shared.ts`：跨模式共享 helper、基础 settings factory 与基础 skin factory；新增模式不应把专属逻辑继续塞入该文件。
- `luminaweave-extension/src/platform/desktop-mode-runtime/`：运行时 descriptor 派生、composition 校验/解析与 registry，不承载具体模式主题值。
- `luminaweave-extension/src/platform/surface/`：`SurfaceContractMap`、Zod input schema、renderer 解析、typed context、局部错误边界与 disposer 生命周期。
- `luminaweave-extension/src/composables/shell/useShellRuntimePayload.ts`：把 `App.vue` 拥有的 refs、computed 与 actions 组装为 `ShellRuntimeContext / ShellRuntimeSurfaces / ShellRuntimeActions / ShellRuntimeFrame`；`App.vue` 仍负责状态、生命周期、bootstrap、host layout 与 activity launch。
- `luminaweave-extension/src/shell/`：traditional / freeform 通用壳层渲染、root shell 分发与 legacy global panel 挂载。
- `luminaweave-extension/src/shell/modes/<mode>/`：Discord / Telegram 等模式专属 shell UI 组件；这些组件属于壳层实现，不放入 `desktop-modes/builtins/<mode>/`。

## Activity 与启动意图

组件页面统一用 Activity metadata 描述，不再把“大窗口/小窗口”当作业务层容器决策。业务层通过 LaunchIntent 声明目标、角色、默认/小窗偏好、嵌套/独立页面，以及状态栏、标题栏和二级菜单 metadata。

Desktop Mode Runtime 负责解析 LaunchIntent：

- Traditional 桌面端：主 Activity 进入主区，support / auxiliary 小窗进入右侧栏或内嵌右栏。
- Traditional 移动端：support / auxiliary 小窗进入临时移动页。
- Telegram 移动端：standalone Activity 进入 Telegram 移动页面栈，可声明状态栏区域。
- Freeform：support / auxiliary / standalone Activity 进入自由工作台窗口。

旧 `mode: large | small` 仅作为迁移期兼容输入，映射到 `Activity.size = default | small`。

状态栏 metadata 由 shell 统一解析，不由普通插件组件直接操作宿主。`statusBar.iconColor` 支持 `auto`、`light` 和 `dark`：`auto` 按当前外观解析，深色外观对应白色系统图标，浅色外观对应黑色系统图标。`statusBar.background` 由 root shell 的 edge-to-edge Web 层通过 `--lw-activity-statusbar-bg` 渲染，不交给 native Android 解析。`statusBar.safeArea` 默认为 `shell`，由 root shell 消费顶部 safe-area；独立移动页面可以声明 `manual`，自行消费 `--lw-content-safe-top` 适配状态栏区域。普通 Tauri Android 通过 WebView JS bridge 应用解析后的图标颜色；TauriTavern 不新增宿主 ABI，图标颜色保持 no-op。

## 文档

- [桌面模式架构计划](./desktop-mode-architecture-plan.md)
- [Telegram Liquid Glass Mode](./telegram-liquid-glass-mode.md)
- [Classic Design](./classic/design.md)
- [Discord Design](./discord/design.md)
- [Stage Design](./stage/design.md)
- [Telegram Design](./telegram/design.md)

## 维护提示

修改桌面模式 manifest、surface override、导航结构、移动端壳层或设计 token 时，应同步更新本目录和 `docs/overall/design/`。

Desktop Experience SDK 重构不改变 runtime extension store 的物理实现。普通 Tauri 保留 SQLite，浏览器与 standalone-local 的既有 IndexedDB 路径保持不变。
