# Desktop Experience SDK Current Task

## 目标

把当前由 Shell、Workspace 与 Chat 组件直接组合业务界面的桌面实现，收敛为可声明组合、可校验、可局部隔离的 Desktop Experience SDK。

最终结构由三层组成：

- `DesktopExperienceRuntime`：提供 conversation、generation、character、timeline、activity 五组强类型领域能力。
- Official Surface Kit：提供角色、会话、消息、输入和 Prompt Inspector 等可组合 surface。
- `DesktopModeManifest.composition`：作为桌面与移动端组合树的唯一公开事实源。

## 当前事实

- `DesktopModeManifest` 已是桌面模式唯一注册源，但尚未表达组件组合树。
- Shell 与 `useWorkspaceManager.ts` 仍直接组合业务组件或硬编码应用目录。
- `SurfaceRuntimeContext` 仍允许 `unknown`、开放字符串 contract 和任意容器属性。
- `ChatStream.vue` 同时承担消息展示、生成控制、会话命令、滚动、输入、编辑、分支和模式分支。
- `useChatStore` 与 `useConversationContextStore` 并存，消息与会话状态所有权不唯一。

## 已锁定决策

- 不引入 OpenAPI。进程内 SDK 使用 TypeScript 类型，外部 manifest 使用 Zod 运行时校验。
- 不新增与 `DesktopModeManifest` 平行的公开 manifest。
- 声明式桌面只能引用已注册 surface contract，不能引用 Vue 组件或任意 CSS。
- 受信任插件继续通过 `PluginManifestV2.businessRenderers` 注册 Vue/TypeScript renderer。
- 不保留旧 Surface context、旧 Chat store 或 Shell 业务硬编码的兼容层。
- 本任务不改变服务端 HTTP API、Semantic VFS、Git 工作区版本和 SillyTavern 宿主边界。
- 保留现有 runtime extension store 物理实现：普通 Tauri 继续使用 SQLite，浏览器与 standalone-local 的既有 IndexedDB 路径保持不变；本任务不迁移数据库、不修改 SQL capability 或数据路径。

## 实施顺序

1. 建立 Headless Domain Runtime。
2. 收紧 Typed Surface Runtime。
3. 建立 Chat Application Controller 和 Official Surface Kit。
4. 增加 Composition Runtime。
5. 迁移 Shell、Workspace 和四个内置桌面模式。
6. 增加第三方协议示例，删除旧入口并完成文档与验证。

## 当前状态

已完成架构基线、Headless Domain Runtime 与 Typed Surface Runtime 实现：

- `DesktopExperienceRuntime` 已统一暴露 conversation、generation、character、timeline、activity 五组领域能力。
- App scope 负责创建并提供 runtime，scope 销毁时统一释放角色会话订阅。
- Conversation 与 Generation 已提供显式订阅取消函数，Generation 已提供停止能力。
- Discord Shell 已改为消费 runtime-owned 角色会话服务，不再自行构造服务或使用 `any` 强转。
- `SurfaceContractMap` 已为官方 contract 固定 input、state 与 intents 类型，注册时通过严格 Zod schema 校验 input。
- Surface contract、plugin renderer 与 desktop override 改为批量预检后原子注册，失败不会留下部分注册状态。
- renderer context 只接收 typed input、runtime 与 disposer 注册；`SurfaceOutlet` 负责 theme 注入、等价输入复用、异常隔离和销毁。
- 插件主 Surface 只读取 `PluginManifestV2.primarySurface`，Shell 与 Workspace 不再从插件 ID 推断 contract。

任务 2 定向验证：4 个测试文件、15 个测试通过；`npm run type-check` 通过。任务 3 定向验证：19 个测试文件、89 个测试通过；`npm run type-check` 通过。下一步是提交 Typed Surface Runtime，再进入 Chat Application Controller。

## 恢复入口

- [完整实施计划](./steps/2026-07-29-desktop-experience-sdk-implementation-plan.md)
- [ADR-0004](../../../adr/0004-desktop-experience-sdk-and-composable-surfaces.md)
