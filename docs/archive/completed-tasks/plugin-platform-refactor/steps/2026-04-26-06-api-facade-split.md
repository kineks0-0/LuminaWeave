# 06 API Facade Split

## 目标

拆分 `LuminaWeaveAPI` 超大 Facade，让 UI 依赖稳定 domain services，而不是直接调用聚合实例内部方法。

## 涉及模块

- `luminaweave-extension/src/api/index.ts`
- `luminaweave-extension/src/api/core/`
- `luminaweave-extension/src/platform/`

## 具体改动

- 按领域拆分 `conversation / generation / settings / desktop / surface / host` services。
- `LuminaWeaveAPI` 保留为组合入口和调试入口。
- Surface renderer 只接收 domain runtime context，不直接访问超大 API。
- 当前迁移桥接：
  - `openTab` 已可接收 `surfaceContractId`，供 Shell Refactor 期间先把动态 tab 渲染入口从组件实例迁到 surface contract。
  - `openPanel(..., { mode: 'tab' })` 会优先把已映射的 registered panel 转为 surface tab。
- 当前已拆出的领域服务：
  - `DesktopSurfaceService` 承接 registered panel registry、desktop mode registry bridge、`openPanel/openTab` surface 导航。
  - `LuminaWeaveAPI.services.desktopSurface` 是当前服务组合入口；Shell bootstrap 的 legacy panel 注册与 widget 临时 tab 打开已改走该 service。
  - `HostInteractionService` 承接宿主 toast 与跨环境 async confirm；`LuminaWeaveAPI.showToast/confirm` 仍作为 facade 委托入口。
  - `ConversationDomainService` 承接会话来源/会话列表/上下文读取/世界线切换命令，并统一包含 `waitForReady()` gate；会话上下文 store、timeline store 与轻量 UI 查询/命令已改走 `LuminaWeaveAPI.services.conversation`。
  - `GenerationDomainService` 当前承接聊天发送、重生成、PromptInspector 自定义提示词运行、生成/同步状态读取；实现仍通过 runtime port 调用既有生成链路，不改变 `LuminaGenerationTask / StreamHandler / Nexus` 内部生命周期。
  - `SettingsDomainService` 承接设置读写、canonical/legacy key 映射、全局设置导入导出、存储变更监听；`useSettings`、`SettingsUnified` 与 `NexusPresetManager` 的主要设置读写已改走该 service。
  - `LuminaWeaveAPI` 仍暴露同名方法，但只作为 facade 委托入口，避免旧调用继续扩张到超大 API 内部。
- 下一阶段迁移方向：
  - Shell / composable 应优先注入或导入明确 domain service，而不是新增 `LuminaWeaveAPI` 字段依赖。
  - 后续继续把零散 toast/confirm 与少量 raw `lwStorage` 调用迁移到 host/settings service；不要在本步骤触碰生成流、同步事务或 Prompt 构建链路。

## 验收标准

- [x] 新 UI 组件不新增对 `LuminaWeaveAPI` 内部字段的依赖。
- [x] 核心生成、同步、事务、Prompt 行为保持不变。
- [x] 旧调用逐步迁移到 domain service。
- [x] `DesktopSurfaceService` 的 tab、modal 与 official surface contract 映射行为有单测覆盖。
- [x] `HostInteractionService` 的 toast host bridge 行为有单测覆盖。
- [x] `ConversationDomainService` 的 ready gate、会话查询/切换委托与世界线命令委托有单测覆盖。
- [x] `GenerationDomainService` 的发送、重生成、PromptInspector 自定义提示词运行与生成状态读取有单测覆盖。
- [x] `SettingsDomainService` 的 canonical/legacy alias 读取、写入、监听有单测覆盖。

## 完成记录

- 已新增 `src/api/services/` 下的 domain services：`DesktopSurfaceService`、`HostInteractionService`、`ConversationDomainService`、`GenerationDomainService`、`SettingsDomainService`。
- `LuminaWeaveAPI.services.*` 成为 UI/runtime 的主要组合入口；原 facade 方法保留为过渡委托和调试入口。
- `useConversationContextStore`、`useTimelineStore`、Chat/Timeline/Settings/Launcher/Forge 相关轻量调用点已迁移到 domain services。
- `PromptInspector` 不再直接操作 `_currentTask / generateAbortController / streamHandler`，改由 `GenerationDomainService.runEditedPrompt()` 收口。
- 验证通过：
  - `npm run type-check`
  - `npm run test -- SettingsDomainService ConversationDomainService DesktopSurfaceService HostInteractionService GenerationDomainService dynamicTabResolver officialPluginManifests`

## 风险点

- API 拆分会影响测试和插件初始化顺序，需要每个领域单独迁移。
- 不要把 `openTab(surfaceContractId)` 继续扩展成新的长期巨型 facade；它只是 Shell 迁移阶段的过渡口。
- `registeredPanels` 已经由 Shell 侧迁移到 `services.desktopSurface.registeredPanels`，但 facade 字段仍暂时保留给旧插件调试入口。
- `ConversationDomainService` 当前不拥有会话真相或事务逻辑，只做 domain service boundary；不要把 `ConversationService` 内部状态迁到 UI service。
- `GenerationDomainService` 当前仍是 thin port；它收口 UI 访问点，但不改变生成任务生命周期。
- 仍存在少量历史组件直接使用 `window.confirm` 或全局 `LuminaWeave.showToast`，后续 host polish 阶段继续迁移。
