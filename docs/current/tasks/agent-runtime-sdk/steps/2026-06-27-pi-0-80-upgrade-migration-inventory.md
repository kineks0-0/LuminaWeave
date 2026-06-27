# pi 0.80.2 依赖升级与迁移清单

> 日期：2026-06-27
> 范围：`@earendil-works/pi-agent-core` / `@earendil-works/pi-ai` 升级，以及继续从 `pi-coding-agent` 吸收结构时的迁移边界。

## 1. 本次依赖基线

`luminaweave-extension` 的 pi 相关依赖升级为：

- `@earendil-works/pi-agent-core`: `^0.80.2`
- `@earendil-works/pi-ai`: `^0.80.2`

`@earendil-works/pi-coding-agent` 仍不得进入前端依赖。Forge 前端 runtime 继续只允许使用 `pi-agent-core` 根入口与浏览器可用的 `pi-ai` 根入口 / provider 入口。

## 2. 当前 LuminaWeave 直接依赖面

当前直接 import pi 包的源码集中在以下边界：

- `src/api/core/agent-runtime/session/AgentSessionTree.ts`
  - 使用 `AgentMessage` 作为 SDK session tree 的 provider replay message 类型。
- `src/api/core/agent-runtime/workspace-tools/AgentWorkspaceTools.ts`
  - 使用 `Type` 定义 `read` / `write` / `edit` / `delete` / `bash` / `grep` / `find` / `ls` / `search` 的模型可见参数。
- `src/api/core/agent-runtime/research/AgentResearchProvider.ts`
  - 使用 `Type` 定义 `webResearch` 参数。
- `src/api/core/agent-runtime/model/PiAiBrowserNexusProvider.ts`
  - 使用 `Api` / `Model` / `SimpleStreamOptions`，把 Nexus preset 与 API 配置解析为 pi-ai model；provider id 对齐 `Model<Api>['provider']`。
- `src/api/core/forge/agent-app/ForgePiCoreDependency.ts`
  - 依赖守卫用最小入口，验证 `pi-agent-core` 根入口可被浏览器构建。
- `src/api/core/forge/agent-app/session/ForgePiAgentSession.ts`
  - 使用 `Agent` / `AgentMessage` / `AgentTool` / `AgentToolResult` / `AssistantMessage` / `ToolResultMessage`。
- `src/api/core/forge/agent-app/model/ForgePiModelRegistry.ts`
  - 使用 `Api` / `Model` / `Context` / `SimpleStreamOptions` / `AssistantMessageEventStream` / `StreamFn`。
- `src/api/core/forge/agent-app/model/ForgePiNexusProvider.ts`
  - 使用 pi-ai provider / stream 类型，并生成 Forge model request trace。
- `src/api/core/forge/agent-app/tools/ForgePiToolBridge.ts`
  - 使用 `AgentTool` / `AgentToolResult` 与 `Type`，把 Forge 工具、Semantic VFS、写入摘要和网络授权适配到 pi tool calling。

## 3. 明确不迁移的部分

以下 `pi-coding-agent` 能力不进入 LuminaWeave 前端 runtime：

- CLI / TUI / `@earendil-works/pi-tui` 交互层。
- `@earendil-works/pi-agent-core/node`。
- Node 文件系统、锁、spawn、readline、path 直接实现。
- `jiti` 加载本地 TypeScript / JavaScript 扩展的执行机制。
- 自动扫描用户目录、项目目录、全局扩展目录、全局技能目录。
- `proper-lockfile` / `cross-spawn` / `glob` / `photon-node` 相关运行能力。
- `pi-coding-agent` 自带本地工作区写入语义。
- 任何绕过 Forge Semantic VFS、ForgeWorkspaceWriteService、ShellPermissionService 或真实 ST 发布确认边界的写入路径。

## 4. 需要继续迁移或对齐的部分

### 4.1 pi 0.80.2 API 兼容检查

目标是确认现有 adapter 仍精确匹配 `0.80.2` 的公开类型与运行行为。

需要检查：

- `Agent` 构造参数、`prompt()`、`continue()`、`abort()`、tool hook 事件。
- `StreamFn`、`AssistantMessageEventStream` 和 provider-native structured block 的字段。
- `AgentMessage` / `AssistantMessage` / `ToolResultMessage` 的 replay-safe 字段。
- `AgentTool` / `AgentToolResult` 的 content 与 details 结构。
- 根入口不再导出旧全局 `streamSimple`；保留旧调用语义时必须从 `@earendil-works/pi-ai/compat` 导入，后续新实现再迁移到 `createModels()` 与 provider factories。
- 根入口的 `Provider` 不再可作为 Nexus provider id 字符串使用；Nexus adapter 应继续以 `Model<Api>['provider']` 为精确类型边界。

落点：

- `ForgePiAgentSession.ts`
- `ForgePiModelRegistry.ts`
- `ForgePiNexusProvider.ts`
- `ForgePiToolBridge.ts`
- `AgentSessionTree.ts`

### 4.2 provider-native structured message 细化

当前主路径已经从 `<process>` / `<final>` 切到 provider-native message。后续需要继续收紧：

- 多个 `text` / `thinking` / reasoning block 的稳定增量更新。
- tool call 与 tool result 的配对顺序。
- pending approval 后恢复续写时的 replay message 完整性。
- provider raw message 与 replay-safe message 的分离。
- thinking / reasoning 不进入 Forge memory、项目文件、虚拟世界书或普通长期历史。

落点：

- `AgentRuntimeEventBus.ts`
- `ForgePiAgentSession.ts`
- `ForgePiMessageSanitizer.ts`
- `ForgePiSessionManager.ts`
- `forgeAgentProcessPresentation.ts`
- `forgeStoreHelpers.ts`

### 4.3 Workspace Tools Kit 与 pi 内置工具行为对齐

当前 SDK 已提供显式注册的 `read` / `write` / `edit` / `delete` / `bash` / `grep` / `find` / `ls` / `search`。后续需要从 `pi-coding-agent` 吸收的是工具行为协议，而不是 Node I/O 实现。

需要对齐：

- `read` 的输出截断、文本 / 非文本结果表达、路径显示口径。
- `edit` 的精确替换、同文件串行修改、diff / patch 结果。
- `write` / `delete` 的审计 payload。
- `grep` / `find` / `ls` 的 limit、ignore、glob 语义在 OpenFS / just-bash adapter 下的等价表达。
- `bash` 的 partial output event、exit code、stdout/stderr、写入摘要和权限等待表达。

落点：

- `AgentWorkspaceTools.ts`
- `JustBashWorkspaceAdapter.ts`
- `OpenFsAgentMount.ts`
- `ForgePiToolBridge.ts`
- `ForgeWorkspaceSearchShell.ts`
- `ForgeWorkspaceWriteService.ts`

### 4.4 Extension workflow 与 resource discovery

`pi-coding-agent` 的 extension / package / resource loader 结构可以继续转译为 Lumina 的显式配置模型。

需要迁移的概念：

- extension factories 显式注册。
- `beforeAgentStart` hidden context。
- agent / turn end hook。
- custom message append。
- status / widget projection。
- continuation trigger。
- tool before / after hook。
- resource discovery hook。

不得迁移：

- VFS 中 TypeScript / JavaScript 的自动执行加载。
- 用户目录或全局目录自动扫描。
- 通过本地真实路径泄露 Forge project id / conversation id 的资源路径。

落点：

- `AgentRuntimeExtensionRunner.ts`
- `ForgePiExtensionRunner.ts`
- `AgentPromptAssembler.ts`
- `ForgePiResourceLoader.ts`
- `ForgeProjectSemanticVfsService.ts`

### 4.5 Session tree、compaction 与 branch summary

`pi-agent-core` 已暴露 compaction 相关能力。Lumina 后续需要评估哪些可以进入 SDK，哪些仍由 Forge adapter 控制。

需要迁移或评估：

- branch summarization 的 SDK 端口。
- compaction 输入输出的 replay-safe message 边界。
- branch checkout 后 prompt preview 与真实生成复用 prepared prompt object。
- compaction 产生的摘要是否作为 custom session entry，而不是普通用户可见消息。

落点：

- `AgentSessionTree.ts`
- `AgentPromptAssembler.ts`
- `AgentRuntimeTestHarness.ts`
- `ForgePiSessionManager.ts`
- `ForgePiTimelineProjector.ts`

### 4.6 非 Forge 插件接入样例

当前 SDK 已有 test harness 与 workspace tools，但还缺少一个非 Forge 插件接入样例来验证 Core SDK 边界。

需要验证：

- 手动注册 tool。
- 显式 VFS mount。
- 不默认暴露文件写入工具。
- 不默认注册 `bash`。
- extension workflow hook 只通过代码配置进入。
- runtime snapshot 可被插件 UI adapter 单向消费。

落点：

- `src/api/core/__tests__/agent-runtime/`
- 可新增一个无 UI 的 adapter-level test，不需要新增真实插件页面。

## 5. 建议执行顺序

1. 完成 `0.80.2` 依赖守卫、focused Forge runtime tests 和 type-check。
2. 修正 `0.80.2` 暴露出的类型或运行行为差异。
3. 增加 provider-native message 的 tool call / approval resume / branch replay 回归覆盖。
4. 对齐 Workspace Tools Kit 的输出截断、diff、glob / ignore / limit 语义。
5. 为 extension workflow 增加 resource discovery 与 continuation 的非 Forge harness 覆盖。
6. 评估 branch summarization / compaction 是否进入 SDK 端口。
7. 补一个非 Forge adapter test，验证 SDK 不默认暴露文件工具或 `bash`。

## 6. 验证入口

升级依赖后至少运行：

```powershell
cd D:\LuminaWeave\luminaweave-extension
npm run test -- --run src/api/core/__tests__/forge/ForgePiDependencyGuard.test.ts
npm run test -- --run src/api/core/__tests__/agent-runtime src/api/core/__tests__/forge/ForgePiAgentSession.test.ts src/api/core/__tests__/forge/ForgePiToolBridge.test.ts src/api/core/__tests__/forge/ForgePiNexusProvider.test.ts src/api/core/__tests__/forge/ForgePiModelRegistry.test.ts
npm run type-check
npm run build
```

若 `ForgePiDependencyGuard.test.ts` 失败，必须先恢复浏览器依赖边界，再继续迁移。
