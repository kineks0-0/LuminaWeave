# Forge extension workflow 接入 AgentRuntimeExtensionHost

日期：2026-06-28

## 目标

把 Forge 当前 pi session 继续推进到通用 `AgentRuntime` API 下，让 Forge 可以显式传入 SDK extension、extension loader、resource scanner 和 SDK tool plugin，同时保持 Forge Prompt Preview 与真实生成同源。

## 已实现

- `AgentRuntime` 在创建 managed session 时把已 setup 的 `AgentRuntimeExtensionRunner` 和共享 `AgentToolRegistry` 传给 adapter session factory。
- `ForgePiCoreRuntimeDeps` 增加 SDK runtime 端口：`model`、`modelProvider`、`tools`、`extensions`、`extensionLoader`、`resourceScanner`、`workspace`、`approvals`、`permissions`。
- `ForgePiCoreRuntime.discoverResources()` 直接委托 `AgentRuntime.discoverResources()`，使 scanner 资源与 extension runtime `resources_discover` 结果通过同一 host 合并。
- `ForgePiAgentSession.preparePromptState()` 在同一个 `AgentPromptAssembler` prepared prompt 中先消费 Forge runner，再消费 SDK extension runner 的 `before_agent_start`，确保 hidden custom context 同时进入 Prompt Preview 和真实 run。
- SDK extension 注册到 `AgentToolRegistry` 的工具会被桥接为 Forge pi-agent 可见工具，并通过 `AgentToolRegistry.execute()` 执行，保留 SDK tool before/after hook 与 runtime tool event projection。
- SDK extension `agent_end` hook 在 Forge turn 正常结束、授权拒绝结束和授权恢复后结束路径触发。
- Forge session 对 SDK registered tool 的 pi-agent tool event 做 runtime event 去重，避免 `AgentToolRegistry` 与 Forge session 对同一工具调用重复写入 `tool_execution_*`。

## 边界

- Forge Semantic VFS、Forge `ForgePiToolBridge`、写入摘要、Git-backed 版本、ST 发布/导出边界仍在 Forge adapter 内。
- Forge built-in tools 仍由 `ForgePiExtensionRunner` / `ForgePiToolBridge` 提供；本次只把 SDK registered tools 追加为可见工具。
- SDK registered tool 的 approval resume 尚未接入 Forge Composer 授权面板；需要审批的 SDK tool 当前会终止本次工具调用并返回明确提示，不伪装成已完成审批链。
- 本次不启用自动目录扫描或本地 TS/JS 加载；scanner / loader 仍必须由接入方显式注入。

## 验证

```powershell
cd D:\LuminaWeave\luminaweave-extension
npm run test -- --run src/api/core/__tests__/forge/ForgePiCoreRuntime.test.ts
```

结果：1 个测试文件、5 个用例通过。

新增覆盖：

- SDK extension 的 `before_agent_start` hidden context 进入 Forge Prompt Preview。
- SDK extension 注册工具进入 `activeTools`。
- `ForgePiCoreRuntime.discoverResources()` 返回 extension resource discovery。
- SDK registered tool 可以通过 Forge pi-agent adapter 执行，并只产生一组 runtime tool events。

## 后续

- 补 SDK registered tool approval resume：接入 Forge Composer 授权面板、`resolveToolApproval()` 和 `AgentToolRegistry.resolveToolApproval()`。
- 补 loader / scanner 的真实接入样例：通过显式 adapter 启用 pi-compatible scanner / loader，不改变默认 runtime 不扫描、不加载的边界。
