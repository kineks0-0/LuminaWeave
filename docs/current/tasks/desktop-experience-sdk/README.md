# Desktop Experience SDK Current Task

## 目标

把当前由 Shell、Workspace 与 Chat 组件直接组合业务界面的桌面实现，收敛为可声明组合、可校验、可局部隔离的 Desktop Experience SDK。

最终结构由三层组成：

- `DesktopExperienceRuntime`：提供 conversation、generation、character、timeline、activity 五组强类型领域能力。
- Official Surface Kit：提供角色、会话、消息、输入和 Prompt Inspector 等可组合 surface。
- `DesktopModeManifest.composition`：作为桌面与移动端组合树的唯一公开事实源。

## 初始问题

- `DesktopModeManifest` 已是桌面模式唯一注册源，但尚未表达组件组合树。
- Shell 与 `useWorkspaceManager.ts` 仍直接组合业务组件或硬编码应用目录。
- 初始 `SurfaceRuntimeContext` 允许 `unknown`、开放字符串 contract 和任意容器属性。
- 初始 `ChatStream.vue` 同时承担消息展示、生成控制、会话命令、滚动、输入、编辑、分支和模式分支。
- 初始 `useChatStore` 与 `useConversationContextStore` 并存，消息与会话状态所有权不唯一。

## 已锁定决策

- 不引入 OpenAPI。进程内 SDK 使用 TypeScript 类型，外部 manifest 使用 Zod 运行时校验。
- 不新增与 `DesktopModeManifest` 平行的公开 manifest。
- 声明式桌面只能引用已注册 surface contract，不能引用 Vue 组件或任意 CSS。
- 受信任插件继续通过 `PluginManifestV2.businessRenderers` 注册 Vue/TypeScript renderer。
- 不保留旧 Surface context、旧 Chat store 或 Shell 业务硬编码的兼容层。
- 本任务不改变服务端 HTTP API、Semantic VFS、Git 工作区版本和 SillyTavern 宿主边界。
- 保留现有 runtime extension store 物理实现：普通 Tauri 继续使用 SQLite，浏览器与 standalone-local 的既有 IndexedDB 路径保持不变；本任务不迁移数据库、不修改 SQL capability 或数据路径。

## 实施顺序

1. 建立架构基线、ADR 与问题记录。
2. 建立 Headless Domain Runtime。
3. 收紧 Typed Surface Runtime。
4. 建立 Chat Application Controller。
5. 提取 Official Surface Kit。
6. 增加 Composition Runtime。
7. 迁移 Shell 与 Workspace。
8. 迁移 classic、stage、discord、telegram 四个内置模式。
9. 增加声明式模式与 trusted renderer 示例。
10. 删除旧入口并完成文档、浏览器验证与最终验收。

## 当前状态

已完成架构基线、Headless Domain Runtime、Typed Surface Runtime、Chat Application Controller 与 Official Surface Kit：

- `DesktopExperienceRuntime` 已统一暴露 conversation、generation、character、timeline、activity 五组领域能力。
- App scope 负责创建并提供 runtime，scope 销毁时统一释放角色会话订阅。
- Conversation 与 Generation 已提供显式订阅取消函数，Generation 已提供停止能力。
- Discord Shell 已改为消费 runtime-owned 角色会话服务，不再自行构造服务或使用 `any` 强转。
- `SurfaceContractMap` 已为官方 contract 固定 input、state 与 intents 类型，注册时通过严格 Zod schema 校验 input。
- Surface contract、plugin renderer 与 desktop override 改为批量预检后原子注册，失败不会留下部分注册状态。
- renderer context 只接收 typed input、runtime 与 disposer 注册；`ThemedSurfaceOutlet` 负责 skin 投影，`SurfaceOutlet` 负责 context theme 注入、等价输入复用、异常隔离和销毁。
- 插件主 Surface 只读取 `PluginManifestV2.primarySurface`，Shell 与 Workspace 不再从插件 ID 推断 contract。
- `ChatApplicationController` 已统一 conversation/generation 订阅和发送、停止、编辑、删除、重生成、分支、Prompt Inspector intents，并在销毁时取消订阅。
- Controller 启动失败会释放部分订阅并允许重试；生成期间修改型命令统一拒绝，stop 只在 live chat 正在生成时接受。
- `ChatRoot` 只挂载 `ChatMainSurface`；`createChatSurfaceContexts.ts` 通过引用计数 application scope 复用并销毁 Controller。
- 旧 `useChatStore` 与未使用的 `useConversationViewStore` 已删除；`useConversationContextStore` 只保留会话选择、session switch 与会话列表 presentation 状态。
- `ChatStream.vue` 已拆为角色、会话、transcript、message、streaming、composer、toolbar、header 与 Prompt Inspector 等单一职责 surface/presentation 组件。
- Chat presentation 只消费 typed Surface context，不导入 Pinia、`lwApi`、Shell、宿主全局对象或桌面模式判断；头像由 runtime character capability 解析，外观由 Surface theme 注入。
- Telegram 移动 chat route 通过 `chat.main` typed callback 恢复返回与页面栈导航；桌面 Telegram 通过同一 contract 打开角色资料与右侧面板；两端共用本地消息搜索、上下文工具和 Prompt Inspector，Chat 组件不读取 Shell 路由状态。
- 旧 `SCROLL_TO_BOTTOM` / `FOCUS_MAIN_INPUT` 由 runtime activity capability 适配为 typed presentation command；Controller 用 revisioned snapshot 驱动 transcript 滚动与 composer 填入/聚焦，销毁后取消订阅。
- Shell、Workspace 业务窗口与设置预览统一通过 `ThemedSurfaceOutlet` 注入受控 skin；消息形态、头像位置、用户名和 streaming effect 由纯 presentation 消费，只有 `typewriter` 显示输入光标；shared application 对首次启动失败只做一次有界重试。
- Choice block 只提交选项文本；`fill` 模式写入 Controller 共享 composer draft，`generate` 模式调用 `sendMessage` intent，独立 transcript/composer surface 不再通过全局事件协作。
- 用户消息只经过 Markdown `TextBlock`，assistant 消息才进入 LuminaView `MessageRenderer`，用户输入不会生成 Choices 交互块。
- Chat 设置预览通过 `settingsPreviewSurface` 元数据进入 `ThemedSurfaceOutlet -> SurfaceOutlet`；其他插件仍可使用既有 `settingsPreviewComponent`。
- Prompt Inspector 在 surface 卸载时清理延时探针，不再跨面板实例残留副作用。

Composition Runtime 已完成当前阶段实现：

- `DesktopModeManifest.composition` 已增加 version 1 公共类型，desktop/mobile 根节点只允许 `group`、`surface`、`activity-slot`。
- 布局枚举固定为 `row | column`、`content | fill`、`visible | hidden`，strict Zod schema 拒绝任意 CSS、Vue component、attrs 与额外字段。
- runtime preflight 在任何 registry 写入前校验版本、全树节点 ID、Surface contract、contract input 和 desktop overrides，公开 `registerDesktopMode()` 失败后不残留核心模式或 runtime 状态。
- resolver 按显式 viewport 返回独立树，不读取 Shell、插件 ID 或宿主对象；特殊 contract input 实例保持其原型，不被转换为普通对象。
- 四个内置模式完成迁移前 `composition` 暂时可选；未声明时不生成默认组合树，声明后必须经过完整校验。

Shell 与 Workspace 迁移已完成当前阶段实现：

- `LuminaShellRoot` 始终保留当前 concrete Shell，并在其 Activity 区域注入 `DesktopCompositionOutlet`；`surface` 节点进入 `ThemedSurfaceOutlet`，`activity-slot` 只委托 Shell 自有的主 Activity、Telegram 移动页面栈或自由工作台窗口容器。
- Desktop navigation surface 列表在 composition 完成校验后直接遍历 desktop/mobile 根节点派生，不再维护平行的业务 Surface 清单。
- Workspace 使用完整启用插件目录，并从 `PluginManifestV2.primarySurface`、`navigationSlots` 和 `ActivityDescriptor` 派生应用；只有 Activity metadata 的插件也能进入目录，动态 Activity 继续作为临时窗口来源，目录不再硬编码 Forge、Launcher、Settings 或 context switcher 身份。
- Freeform Shell 只管理舞台、窗口、焦点、导航显隐和 Dock；Launcher overlay、Forge 窗口 action 与 Settings 详情特判已删除，新建舞台不再隐式打开某个业务插件。
- `ShellRuntimeContext` 已删除重复 `layoutMode` 和 launchpad 状态；classic、stage 已声明显式 desktop/mobile Activity composition，discord、telegram 仍暂时走旧 Shell 业务组合路径。
- composition renderer 的实例身份包含 desktop mode、viewport、node kind 与 Surface contract；`ThemedSurfaceOutlet` 对 contract 变化响应式重算 skin，避免模式或节点切换复用旧主题状态。

任务 2 定向验证：4 个测试文件、15 个测试通过；任务 3 定向验证：19 个测试文件、89 个用例通过；任务 4 审查收敛后定向验证：7 个测试文件、30 个用例通过；任务 5 定向验证：27 个测试文件、120 个用例通过。任务 6 定向验证通过 4 个测试文件、38 个用例；extension 全量 `npm run test` 通过 184 个测试文件、921 个用例，2 个用例跳过，`npm run type-check` 与 `npm run build` 均通过。任务 7 审查收敛后的 Shell、Workspace、Activity 与 Desktop Runtime 定向验证通过 15 个测试文件、77 个用例；最终 extension 全量 `npm run test` 通过 184 个测试文件、930 个用例，2 个用例跳过，`npm run type-check` 与 `npm run build` 均通过。任务 8 第一批已将 classic、stage 的 desktop/mobile Activity 纳入同一 Composition Runtime，定向测试 2 个文件、15 个用例与 `npm run type-check` 通过。下一步迁移 discord、telegram，并删除对应旧 Shell 业务组合路径。

## 恢复入口

- [完整实施计划](./steps/2026-07-29-desktop-experience-sdk-implementation-plan.md)
- [ADR-0004](../../../adr/0004-desktop-experience-sdk-and-composable-surfaces.md)
