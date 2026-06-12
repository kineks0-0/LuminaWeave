# Agent Runtime SDK 第一阶段实现记录

> 日期：2026-06-11
> 范围：落地 Core API 级 Agent Runtime SDK 骨架，并让 Forge 保持第一 adapter 边界。

## 已落地

- 新增 `luminaweave-extension/src/api/core/agent-runtime/`。
- `runtime/AgentRuntimeCore.ts` 提供 session 复用、`runTurn`、`previewPrompt`、`continue`、`abortActiveGeneration`、`resolveToolApproval`。
- `session/AgentSessionTree.ts` 提供 append-only entries、active node、branch checkout、branch messages、persist / hydrate。
- `prompt/AgentPromptAssembler.ts` 统一 preview 与真实运行的 prompt assembly 端口，并通过 adapter 提供的 cache key 复用 prepared prompt object；真实 turn 消费后可调用 `invalidate()` 清理缓存。
- `tools/AgentToolRegistry.ts` 只接收 adapter 显式注册的工具，不默认注册文件工具或 `bash`；可选 visibility filter 由接入方传入 phase/capability context。
- `skills/AgentSkillParser.ts` 解析标准 `SKILL.md` frontmatter，校验 `name`、`description`、`compatibility`、父目录匹配、`metadata` 与空格分隔的 `allowed-tools`，输出 diagnostics，并提供 pi-style catalog formatter。
- `openfs/OpenFsAgentMount.ts` 提供 OpenFS / just-bash 文件系统 wrapper 的 phase、mount policy、approval、audit、trace hook。
- `testing/AgentRuntimeTestHarness.ts` 提供 mock model、mock tool、mock session store、mock approval、mock VFS 与 tool registry 入口。

## Forge 接入

- `ForgePiCoreRuntime` 组合 `AgentRuntimeCore`，但仍由 Forge 创建 `ForgePiAgentSession`。
- `ForgePiAgentSession.preparePrompt()` 与 `prompt()` 调用 SDK `AgentPromptAssembler`；同一 `requestId` 的 dry-run 与真实 run 共用 prepared prompt object，真实 run 仍重新加载 Forge tool 实例以保留 effect sink。
- `ForgePiAgentSession.preparePromptState()` 在该 prepared prompt 内消费 `ForgePiExtensionRunner.emitBeforeAgentStart()`，把 extension hidden custom context、active tools summary、skill catalog、branch messages 与本轮 user message 同时投影到 Prompt Preview 和 `prompt_ready`；真实 pi-agent-core initial state 仍只包含 branch messages，本轮 user message 由 `agent.prompt()` 注入。
- `ForgePiSessionManager` 复用 `AgentSessionTree` 承载 flat entries 与 branch 行为；对外 `piSessionState.tree` 继续保持既有 flat projection，未迁移 `ForgePiTypes.ts` wire shape。
- `ForgePiResourceLoader` 的 skill catalog 行格式改为走 SDK formatter，仍由 Forge registry 负责 built-in / project / preset skill 来源。
- `ForgePiToolBridge` 新增 `createToolRegistry()`，把 Forge 已有工具适配到 SDK `AgentToolRegistry`；Forge 写入工具仍生成 `workspace_patch`。
- `ForgePiToolBridge` 的模型可见工具名已迁移为 `read`、`write`、`edit`、`delete`、`bash`；历史挂起审批和旧 trace 中的 `readFile`、`writeFile`、`editFile`、`deleteFile` 通过 adapter 映射到短名执行，返回记录保留原始输入名。
- Forge bundled skills 与默认主预设 reference skills 已规范化为标准 `SKILL.md` frontmatter；Forge registry / Semantic VFS 测试会用 SDK `AgentSkillParser` 校验所有默认暴露的 `./agent/skills/*/SKILL.md`。

## OpenFS 事实

- 依赖加入 `@open-fs/just-bash@0.1.0` 与 `@open-fs/core@0.1.0`。
- 当前安装包类型文件显示公开文件系统类为 `AxFs`。
- 当前 `createGrepCommand()` 返回 command name `axgrep`，不是普通 `grep`。
- SDK 不创建 `bash` tool；接入方仍需自行组合 just-bash `MountableFs`、custom commands 和模型工具注册。
- OpenFS wrapper 单测覆盖 read/write/append/delete/move/copy audit hook，并执行 `axgrep` / `search` custom commands 验证命令绑定到传入 VFS。

## 验证入口

- SDK 单测：`npm run test -- --run src/api/core/__tests__/agent-runtime`
- Forge 回归：`npm run test -- --run src/api/core/__tests__/forge/ForgePiAgentSession.test.ts src/api/core/__tests__/forge/ForgePiCoreRuntime.test.ts src/api/core/__tests__/forge/ForgePiResourceLoader.test.ts src/api/core/__tests__/forge/ForgePiToolBridge.test.ts src/api/core/__tests__/forge/ForgeSemanticVfsProvider.test.ts src/api/core/__tests__/forge/ForgeWorkspaceVersionManager.test.ts`
- 类型检查：`npm run type-check`

## 仍需后续验证

- 真实宿主 walkthrough。
- 文件版本恢复端到端手动验证。
- 非 Forge 插件接入样例。
