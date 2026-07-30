# LuminaWeave Chat 子插件 - 系统设计文档 (System Design)

**版本:** v1.2
**所属系统:** LuminaWeave V2

## 一、 组件架构
1. **ChatRoot.vue（renderer 入口）**
   该文件只挂载 `ChatMainSurface`，不创建 Controller、不读取 store，也不持有宿主能力。
2. **createChatSurfaceContexts.ts / ChatSurfaceApplicationScope.ts（Surface 装配）**
   renderer context factory 从 `DesktopExperienceRuntime` 获取领域能力；同一 runtime 下的 `chat.main`、`chat.transcript`、`chat.composer` 与 `chat.promptInspector` 通过引用计数 lease 共享 Controller。最后一个 lease 释放时取消 snapshot 监听并销毁 Controller。
3. **ChatApplicationController.ts（应用控制器）**
   订阅 conversation、generation lifecycle、Prompt inspection 与 activity presentation command 四个事件源，统一投影当前会话、消息、生成、Prompt Inspector 和滚动/聚焦请求；负责发送、停止、编辑、删除、重生成、分支和 Prompt Inspector intents。Controller 使用显式取消函数闭合生命周期，并隔离单个 listener/disposer 异常。
4. **Official Surface Kit（展示组件）**
   `CharacterRosterSurface`、`ConversationSessionListSurface`、`ChatTranscriptSurface`、`ChatComposerSurface`、`ChatPromptInspectorSurface` 与 `ChatMainSurface` 是公开组合节点；`ChatHeader`、`ChatTranscript`、`ChatMessage`、`ChatStreamingMessage`、`ChatComposer` 和 `ChatToolbar` 是纯 presentation。它们只消费 typed input/context，不导入 Pinia、API Facade、Shell 或桌面模式实现。

## 二、 核心依赖与数据源
- `ConversationDomainService.getContext()` 和 conversation event 是 Controller 的消息事实源。
- `GenerationDomainService.subscribe()` 输出 started/updated/ended/failed 生命周期；`subscribePromptInspection()` 独立输出 Prompt probe 与自定义生成检查状态。
- `ChatPresentationCommandService` 将精确旧事件 `SCROLL_TO_BOTTOM` / `FOCUS_MAIN_INPUT` 适配为封闭 command，经 `DesktopExperienceRuntime.activity` 进入 Controller；presentation 不直接订阅事件源。
- `DesktopExperienceRuntime.character` 暴露角色会话状态、默认头像与 `resolveMessageAvatar()`；presentation 不读取宿主头像 API。
- `SurfaceRuntimeContext.theme` 提供 renderer variant 与 CSS tokens；renderer context factory 通过 `SettingsDomainService` 将思维链显示和 Chat Reply 过滤设置投影为 `messageRenderPreferences` readonly ref，presentation 不读取 Settings store、`lwStorage` 或桌面模式设置；surface 销毁时取消设置订阅。
- `ThemeMessageShape` 与 `ThemeAvatarPlacement` 属于 Surface 中立值类型；Desktop Mode 只负责产生这些值，不成为 Chat presentation 的依赖方向。
- `useConversationContextStore` 只保留 Shell 使用的会话选择与 presentation 状态，不参与 Official Surface Kit 的消息事实源。

## 三、数据流

```text
ConversationDomainService ─┐
                           ├─> ChatApplicationController ─> ChatApplicationSnapshot ─> Chat presentation
GenerationDomainService ───┤                            └─> ChatApplicationIntents ────> Domain Services
Prompt inspection events ──┘
Presentation commands ────────────────────────────────────────────────> scroll/focus revisions
CharacterChannelService ───────────────────────────────────────────────> avatar/channel state
```

- conversation 事件更新 context 与 messages。
- generation 事件只更新 generation snapshot；结束时由正式 conversation 消息替换流式气泡。
- 所有修改型 intent 先检查当前 context 是否为 live chat 且不存在活动生成；删除确认返回后会再次检查生成态。停止命令只在 live chat 存在活动生成时调用 Domain Service，分支命令显式使用 `sourceId: 'chat'`。
- `start()` 逐项记录领域订阅；任一订阅或初始 context 加载失败时释放已建立订阅并复位启动态，允许同一 Controller 重试。
- `dispose()` 取消四条事件订阅并清空 presentation listeners，销毁后事件不得继续更新 UI。
- `ChatApplicationSnapshot.composerDraft` 是独立 transcript/composer surface 共享的输入草稿；Choice block 只回传选项文本，context factory 从精确设置键 `lumina-chat.dialogueUIInteraction` 投影 `fill | generate`，再分别调用 `setComposerDraft` 或 `sendMessage` intent。
- 用户消息只通过 Markdown `TextBlock` 展示，assistant 消息才进入 LuminaView `MessageRenderer`；`ChatStreamingPresentation` 将四种 effect 映射为稳定 class/cursor 状态，只有 `typewriter` 显示光标。
- Telegram 移动 chat route 不显示 Shell stack bar，因此 Shell 通过 `chat.main` input 注入返回、角色资料与页面栈导航 callback；桌面 Telegram 通过同一 input 注入角色资料与右侧面板 callback。`ChatHeader` 只调用这些 typed callback，不读取路由状态或桌面模式 ID。
- Chat 设置预览通过 `LuminaPlugin.settingsPreviewSurface` 声明 `{ contractId, input }`，`SettingsDetailed` 通过 `ThemedSurfaceOutlet` 解析 skin，再由 `SurfaceOutlet` 完成校验、theme context 注入、renderer 解析与局部错误隔离。
