# ADR-0004: Desktop Experience SDK 与可组合 Surface

## 状态

已采纳

## 背景

`DesktopModeManifest` 已经统一桌面模式注册、外观 token、surface skin 与 renderer variant，但不能声明业务组件的组合关系。当前 Shell、Workspace 和 Chat 仍分别持有业务组件、会话状态与生成控制，导致桌面模式只能调整外观和窗口位置，不能可靠地自由组合角色列表、会话列表、消息流与输入区。

现有 Surface Runtime 同时允许开放 contract、`unknown` state、任意属性透传和全局运行时读取，无法为官方组件与第三方 renderer 提供稳定隔离边界。

## 参考项目对标

| 项目 | 采用的原则 | 不复制的内容 |
| --- | --- | --- |
| OpenFic | transport mapping、领域 store、Shell context 与 tool renderer registry 分离 | 项目专属 store 和传输字段 |
| pi-rp | 通过受控 context 注入能力，renderer 拥有 invalidate 与 dispose 生命周期 | 具体 UI API 和运行环境假设 |
| oh-my-pi | capability、extension、custom tool、theme 分层，renderer 异常局部回退 | 终端 renderer 和扩展命名 |
| TavernHeadless | 角色、会话、消息、时间线采用 headless typed API，流式生命周期显式分段 | 其 HTTP/流式传输协议 |

对标结果只用于确定职责和生命周期。LuminaWeave 的字段、类型和数据流继续以当前代码、共享契约和测试为事实源。

## 决策

1. 建立 `DesktopExperienceRuntime`，统一提供 conversation、generation、character、timeline、activity 五组强类型领域能力。
2. 建立可扩展 `SurfaceContractMap` 与 typed `SurfaceRuntimeContext<K>`，官方 surface 和受信任 renderer 使用同一 runtime。
3. `DesktopModeManifest` 保持唯一桌面模式事实源，并增加版本化 desktop/mobile composition。
4. Composition 节点只允许 group、surface、activity-slot，且只能引用已注册 contract。
5. 声明式组合与受信任代码扩展并存；受信任代码通过 `PluginManifestV2.businessRenderers` 注册。
6. Shell 只拥有安全区、窗口、焦点、移动导航和 Activity 容器，不拥有 conversation、generation 或具体业务组件。
7. 单个 manifest、renderer 或订阅失败必须局部隔离，并输出稳定低基数日志。
8. 不保留旧 Surface context、旧 Chat store 或内置模式业务分支的兼容层。

## OpenAPI 取舍

Desktop Experience SDK、Surface contract 和 renderer 注册是浏览器进程内 TypeScript API，不是 HTTP 协议。它们使用 TypeScript 表达编译期契约，使用 Zod 校验外部 manifest，不引入 OpenAPI。

`luminaweave-server` 的 Express 路由属于独立传输边界。只有后续明确治理服务端公开 HTTP API 时，才单独评估 OpenAPI，不与本次桌面架构迁移绑定。

## 后果

- `DesktopModeManifest` 与 Surface 公共类型会发生破坏式变化，所有内置模式和官方 renderer 必须在同一任务中迁移。
- Chat presentation 不再直接访问 Pinia、API、宿主全局对象或具体桌面模式。
- Workspace 应由插件注册信息与 Activity descriptor 派生，不再维护 Forge、Launcher 等硬编码应用目录。
- 本决策不改变微内核、Semantic VFS、Git 工作区版本、SillyTavern 宿主适配或服务端 HTTP 协议。
