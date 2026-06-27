# AgentRuntime 高层 API 与 pi 扩展兼容首轮实现记录

日期：2026-06-27

## 目标

将 Agent Runtime SDK 从低层 primitives 推进到可集成的高层 runtime API，并提供第一轮 pi 扩展兼容适配，使接入方可以显式替换工具、模型供应、扩展加载、资源扫描、工作区和权限实现。

## 已实现

- 新增 `AgentRuntime` façade：
  - 组合 `AgentRuntimeCore`、`AgentRuntimeEventBus`、`AgentToolRegistry` 与 `AgentRuntimeExtensionHost`。
  - 支持通过构造参数注入 `model`、`modelProvider`、`tools`、`extensions`、`extensionLoader`、`resourceScanner`、`workspace`、`approvals`、`permissions`、`sessionStore` 与 `eventSink`。
  - 默认不扫描目录、不加载本地 TS/JS、不注册任何工具。
- 新增 `AgentRuntimeExtensionHost`：
  - 将显式传入的 extension、资源扫描结果和 extension loader 结果统一交给 `AgentRuntimeExtensionRunner`。
  - 将 scanner 返回的 `skillPaths`、`promptPaths`、`themePaths` 与 extension runtime 的 `resources_discover` 结果合并。
- 新增 pi 兼容层：
  - `PiExtensionCompatHost` 支持 pi-style `ExtensionFactory(pi)`。
  - 首轮映射 `registerTool`、`registerProvider`、`resources_discover`、`before_agent_start`、`agent_end`、`tool_call`、`tool_result`。
  - `tool_call` 可改写参数或阻断工具调用；`tool_result` 可改写工具结果。
- 新增 `PiExtensionLoader`：
  - 支持 inline factory。
  - 本地模块加载通过 `PiExtensionModuleLoader` 注入；未注入 loader 时返回 diagnostics，不直接执行本地代码。
- 新增 `PiResourceScanner`：
  - 通过注入的 `AgentRuntimeResourceScanFileSystem` 扫描，不静态依赖 Node `fs/path`。
  - 支持 pi 目录规则：项目 `.pi/extensions|skills|prompts|themes`、用户 `~/.pi/agent/extensions|skills|prompts|themes`、用户 `~/.agents/skills`、项目祖先 `.agents/skills`。
  - 支持 `package.json` 的 `pi.extensions` manifest 入口、目录 `index.ts` / `index.js`、一层扩展发现、pi/agents skill 发现差异。

## 边界确认

- Core SDK 默认仍不扫描用户目录或项目目录。
- Core SDK 默认仍不自动加载 TS/JS 扩展代码。
- pi 兼容扫描、manifest 解析和本地模块加载都必须由接入方显式传入 adapter。
- Forge 的 Semantic VFS、项目写入、Git-backed 版本、真实 ST 发布边界不迁移到 SDK。

## 测试

新增覆盖：

- `AgentRuntime.test.ts`
  - 验证高层 runtime 组合 tool plugin、scanner、extension loader 和 managed session。
  - 验证默认 runtime 不扫描、不加载、不注册工具。
- `PiExtensionCompatHost.test.ts`
  - 验证 pi inline extension 注册工具、provider、资源发现、before-agent hidden context、tool call/result hook。
  - 验证 pi `tool_call` 可在原生 approval / execution 前阻断工具。
- `PiResourceScanner.test.ts`
  - 验证 pi-compatible 项目/用户目录、manifest extension、`.agents/skills` 与 project trust 行为。

首轮验证命令：

```powershell
cd D:\LuminaWeave\luminaweave-extension
npm run test -- --run src/api/core/__tests__/agent-runtime/AgentRuntime.test.ts src/api/core/__tests__/agent-runtime/PiExtensionCompatHost.test.ts src/api/core/__tests__/agent-runtime/PiResourceScanner.test.ts
```

结果：3 个测试文件、6 个测试通过。

## 后续

- 将 Forge 当前 pi session 集成迁移到 `AgentRuntime` façade 下，保持现有 `ForgePiToolBridge` 与 `ForgeWorkspaceWriteService` 写入链路。
- 扩展 pi 兼容面时按事件逐项补测试，不一次性开放 TUI、command、shortcut、session tree、compact/reload 全量语义。
- 若启用本地 TS/JS loader，必须先设计 host/Tauri/Node 侧权限和 diagnostics UI。
