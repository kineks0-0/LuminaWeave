# pi agent 工作流与 UI 状态整理

> 日期：2026-06-11
> 范围：整理 `D:\Program\pi\packages\agent` 与 `D:\Program\pi\packages\coding-agent` 中从规划、执行、思考到最终汇报，以及状态显示到 UI 的链路。
> 结论：Core SDK 应吸收 pi 的事件驱动 runtime 与 extension workflow 边界，不把 Plan Mode 固化为 Core 内置状态机。

## 1. 源码事实

pi 的底层 agent loop 不内置“规划阶段 / 执行阶段 / 汇报阶段”业务状态机。`packages/agent/src/agent-loop.ts` 的主循环负责：

- 注入 steering / follow-up messages。
- 调用模型 stream，产生 assistant message。
- 发现 tool call 后执行工具，回填 tool result message。
- 每轮发出 `turn_end`，满足停止条件后发出 `agent_end`。

`packages/agent/src/agent.ts` 只维护通用运行状态：

- `isStreaming`
- `streamingMessage`
- `pendingToolCalls`
- `errorMessage`
- `messages`
- `tools`
- `thinkingLevel`

`packages/coding-agent/src/core/agent-session.ts` 把底层 Agent event 映射为更高层 session event，并承担：

- extension event 分发。
- UI listener 分发。
- `message_end` 后持久化 user / assistant / toolResult / custom message。
- run 后 retry、compaction、queued message continuation。

`packages/coding-agent/src/modes/interactive/interactive-mode.ts` 订阅 session event，并把事件投影到 TUI component：

- `message_start/update/end` 更新 chat message 与 streaming assistant component。
- assistant message 内的 `toolCall` block 创建或更新 tool execution component。
- `tool_execution_start/update/end` 更新工具执行状态、partial result 和 final result。
- `agent_start/agent_end` 控制进度、loader、pending tool 清理。
- `queue_update` 更新流式期间排队的 user message 显示。

## 2. 规划与执行

pi 的 Plan Mode 是 extension 示例，而不是 core runtime 默认能力。`packages/coding-agent/examples/extensions/plan-mode/index.ts` 通过 extension state 记录：

- `planModeEnabled`
- `executionMode`
- `todoItems`

Plan Mode 使用的机制：

- 通过 `pi.setActiveTools()` 在规划模式和执行模式切换工具集合。
- 通过 `before_agent_start` 注入 hidden custom context，告知模型当前是 read-only plan 还是 executing plan。
- 通过 `turn_end` 扫描 assistant message 中的 `[DONE:n]` 标记更新步骤状态。
- 通过 `agent_end` 展示计划、询问用户是否执行，并用 `pi.sendMessage(..., { triggerTurn: true })` 触发下一轮。
- 通过 custom session entry 持久化 plan mode state，session 恢复时重建执行进度。

这条链路说明：规划/执行是 workflow extension，而不是 Agent loop 的固定流程。

## 3. 思考与最终汇报

pi 的 thinking 由模型 stream 的 `thinking_start` / `thinking_delta` / `thinking_end` 事件更新 assistant message content block。UI 层决定展示、隐藏或替换 thinking label。

因此 Core SDK 不应把 thinking 当作可写业务状态。它应保留为 assistant message 的 stream block / trace / UI projection 输入。长期记忆、workspace patch、虚拟世界书和 ST 写回都不能默认消费 raw thinking。

最终汇报不是独立协议。agent 在没有更多 tool call、steering、follow-up、retry 或 compaction continuation 后发出 `agent_end`；用户看到的最终结果是最后一个 assistant message 加上工具执行组件和 extension 额外 message。

## 4. 扩展加载与扩展 API

pi 的扩展加载是代码路径驱动，不是模型通过 VFS 动态加载可执行扩展。

`packages/coding-agent/src/core/extensions/loader.ts` 的事实：

- `loadExtensions(paths, cwd, eventBus, runtime)` 逐个加载显式路径，并复用同一个 `ExtensionRuntime`。
- `discoverAndLoadExtensions(configuredPaths, cwd, agentDir, eventBus)` 按顺序加入项目本地扩展、全局扩展和显式配置路径。
- 项目本地扩展目录是 `cwd/${CONFIG_DIR_NAME}/extensions`。
- 全局扩展目录是 `agentDir/extensions`。
- 目录入口解析顺序是 `package.json` 的 `pi.extensions`、`index.ts`、`index.js`。
- 目录发现只看一层；复杂包必须用 `package.json` 声明入口。
- 扩展模块通过 `jiti` 加载，默认导出必须是 `ExtensionFactory`。

`packages/coding-agent/src/core/extensions/runner.ts` 的事实：

- `ExtensionRunner.bindCore()` 把 `sendMessage`、`sendUserMessage`、`appendEntry`、`setActiveTools`、`refreshTools`、`getAllTools`、`setModel`、`setThinkingLevel` 等 action 绑定到共享 runtime。
- 扩展加载期间注册的 provider 会先进入 `pendingProviderRegistrations`，`bindCore()` 后统一刷新；后续注册立即生效。
- `getAllRegisteredTools()` 合并所有扩展注册的 tool，同名工具使用先注册的定义。
- `emitToolCall()` 允许扩展阻止工具执行；`emitToolResult()` 允许扩展改写工具结果的 `content`、`details` 或 `isError`。
- `emitBeforeAgentStart()` 支持扩展追加 hidden custom message 或替换 system prompt。
- `emitResourcesDiscover()` 支持扩展提供 `skillPaths`、`promptPaths`、`themePaths`，由 `AgentSession.extendResourcesFromExtensions()` 合并进 ResourceLoader 并重建 system prompt。

对 LuminaWeave 的规划含义：

- Core SDK 可以提供 extension workflow API，但第一阶段不自动扫描用户目录或项目目录。
- 扩展加载路径应由 adapter / 代码配置显式传入。
- VFS 中的 prompt、skill、context 文件是 agent 可读资源；VFS 中的 TS/JS 扩展代码只有在 adapter 明确加载时才成为可执行扩展。
- 扩展注册 tool 后仍必须进入 SDK tool registry、visibility filter、approval/audit/trace 边界。
- `resources_discover` 这类资源扩展可以作为 Prompt Resource Kit / VFS Skill Source 的可选 hook，但不能绕过 Prompt Preview 事实源。

## 5. Workspace Tools 参考

pi 的 workspace tools 是工具包，不是 Agent loop 的硬编码能力。`packages/coding-agent/src/core/tools/index.ts` 暴露的内置工具名是：

- `read`
- `bash`
- `edit`
- `write`
- `grep`
- `find`
- `ls`

工具包提供：

- `createToolDefinition(toolName, cwd, options)`
- `createTool(toolName, cwd, options)`
- `createCodingToolDefinitions(cwd, options)`
- `createReadOnlyToolDefinitions(cwd, options)`
- `createAllToolDefinitions(cwd, options)`
- `createCodingTools(cwd, options)`
- `createReadOnlyTools(cwd, options)`
- `createAllTools(cwd, options)`

`AgentSession._buildRuntime()` 默认用 `createAllToolDefinitions()` 生成 base tools，并默认激活 `read`、`bash`、`edit`、`write`。`AgentSession._refreshToolRegistry()` 再把 base tools、extension tools、`customTools` 合并成 registry，并按 active tool names 写回 `agent.state.tools`。

pi 的工具实现都采用可插拔 operations：

- `read`：`ReadOperations` 包含 `readFile`、`access`、可选 `detectImageMimeType`。
- `write`：`WriteOperations` 包含 `writeFile`、`mkdir`。
- `edit`：`EditOperations` 包含 `readFile`、`writeFile`、`access`。
- `bash`：`BashOperations` 包含 `exec(command, cwd, options)`，并支持 `commandPrefix`、`shellPath`、`spawnHook`。

写入类工具的共同点：

- `write` 和 `edit` 都通过 `withFileMutationQueue()` 串行化同一文件的并发修改。
- `write` 负责创建父目录并整文件写入。
- `edit` 使用 `edits[]` 精确文本替换，`prepareArguments()` 兼容部分模型传入的 legacy `oldText` / `newText`。
- `edit` 会生成 display diff 和 unified patch，供 UI 展示。
- `bash` 通过 `onUpdate` 持续推送 partial output，并在截断时保存完整输出路径。

对 LuminaWeave 的规划含义：

- `workspace-tools` 应是可选 SDK 工具包，不进入 `runtime-core` 默认工具集合。
- `workspace-tools` 默认采用 pi-style 短名：`read`、`write`、`edit`、`delete`、`bash`；`grep`、`find`、`ls`、`search` 可作为只读扩展工具。
- Forge 模型可见工具名迁移为 `read`、`write`、`edit`、`delete`、`bash`；旧会话回放和 trace 展示中的历史工具名由 Forge adapter 处理兼容。
- `read`、`write`、`edit`、`delete`、`bash` 的底层 I/O 应通过 OpenFS / just-bash 或 adapter operations 注入，不直接绑定本地 `fs`。
- `write`、`edit`、`delete`、可写 `bash` 只在写入阶段显式注册。
- 同一文件写入串行化应进入 `workspace-tools`，避免并行 tool call 产生交错写入。
- `edit` 工具应保留“精确匹配、最小替换、可展示 diff / patch”的能力；Forge 的 `workspace_patch` 仍由 Forge write adapter 生成。
- `bash` 工具由接入方自行组装；Core SDK 只消费注册后的 tool schema、execute、partial result、final result、approval 和 trace。

## 6. 对 Agent Runtime SDK 的规划更新

Core SDK 应提供稳定的事件与 snapshot 边界：

- 生命周期事件：`agent_start`、`turn_start`、`message_start`、`message_update`、`message_end`、`tool_execution_start`、`tool_execution_update`、`tool_execution_end`、`turn_end`、`agent_end`。
- 队列事件：`queue_update`，用于显示 streaming 期间的 steering / follow-up user message。
- 运行 snapshot：`isStreaming`、`streamingMessage`、`pendingToolCalls`、`messages`、`errorMessage`、active tools summary。
- extension hook：`before_agent_start`、`turn_end`、`agent_end`、tool call before/after、context transform。
- UI projection payload：status、widget、working indicator、hidden thinking label、custom display message。

Core SDK 不应内置 Plan Mode。SDK 只提供 extension workflow 所需端口：

- active tool set / visibility filter。
- hidden custom context 注入。
- custom message append 与 session 持久化。
- status / widget / trace event 输出。
- continuation trigger。

Forge、Dev、Director 或其他插件可以基于这些端口实现自己的“规划、执行、审阅、汇报”工作流。

Core SDK 应提供扩展工作流边界，但不默认加载扩展代码：

- adapter 通过代码配置传入 extension factories 或 resolved extension paths。
- SDK extension runner 负责注册 event handlers、custom tools、custom messages、status/widget projection 和 resource discovery hook。
- SDK tool registry 负责把 extension tools 与 built-in tool kit 统一进入 active tool set。
- Prompt Preview 必须消费 extension workflow 产生的 hidden context、resource discovery 结果和 active tools summary。

## 7. 对 Forge 的规划更新

Forge 可以参考 pi 的 extension workflow，但需要保持现有 Forge 边界：

- Forge Planner / Analyst / Executor 仍由 Forge adapter 定义，不进入 Core SDK。
- Forge 的写入工具可见性由 Forge run 阶段控制；非写入阶段不注册 `write`、`edit`、`delete` 和可写 `bash`。
- Forge 的工作进度可通过 runtime event + store projection 显示到 Vue UI，而不是把 UI 状态写入 SDK。
- Forge 的 Prompt Preview 必须包含 extension workflow 注入的 hidden context，否则 preview 与真实生成会分叉。
- Forge 的最终汇报应来自 assistant message、workspace patch summary、tool trace 和文件版本面板的投影，不新增单独事实源。
- Forge adapter 继续决定是否加载项目级或预设级扩展；Core SDK 不扫描 Forge 项目 VFS 中的可执行扩展代码。
- Forge adapter 在迁移工具短名时必须让 Prompt Preview、真实生成、tool trace、文件版本面板和旧会话回放保持一致。

## 8. 下一阶段验收场景

- 同一输入下，Prompt Preview 与真实生成包含同一组 workflow-injected custom context。
- 规划模式只展示只读工具，执行模式才展示写入工具。
- thinking block 能被 UI 折叠或替换 label，但不进入 workspace patch、Forge memory 或真实 ST 写回。
- tool call partial result 能实时显示，final result 能稳定归档到 runtime trace。
- `agent_end` 后 UI 能清理 pending tool、loader 和 streaming message，并保留最终 assistant message。
- session 恢复后，extension workflow state 能通过 custom entry 或 adapter 自有状态重建。
- extension 注册的新工具必须进入同一 tool registry、active tool set、Prompt Preview active tools summary 和真实生成工具集合。
- `resources_discover` 追加的 skill / prompt 路径必须触发 prompt 重建，并被 Prompt Preview 与真实生成共同消费。
- `workspace-tools` 的 `write` / `edit` / `delete` 并发写同一文件时必须串行化。
- `edit` 的 diff / patch、Forge `workspace_patch` 和 UI 文件变更列表必须能对齐同一次工具调用。
