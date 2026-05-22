# Forge 技能/能力 pi 风格迁移计划

## 背景

本轮决策是：Forge 制卡 Agent 不全面切换到 pi-mono，也不引入 `pi-agent-core`。迁移目标是吸收 pi 风格的原生 tool calling 执行方式，让 Graph 从“替 Agent 预判技能/能力”收敛为“提供状态、阶段、边界与能力索引”。

当前代码事实：

- `ForgeAgentLoop` 已作为 Vercel AI SDK `streamText()` tool loop。
- `ForgeToolRegistry` 已承接 Forge 专属工具面。
- `ForgeCapabilityRegistry` 与 `ForgeSkillRegistry` 继续作为可审计事实源。
- `ForgeAgentGraphRuntime` 保留阶段/状态/Prompt source unit 输出，但不再预加载完整 skill。
- `ForgeRuntimeOrchestrator` 在 `lumina-forge.agentToolCalling.enabled` 为 `true` 时，让 `conversation / planner / analyst / executor` runtime 请求优先走 tool calling。
- 旧 XML 路径仍保留为 fallback。

## 目标

- Graph 只负责状态、阶段、写入边界、review 状态和能力索引。
- Agent 在 tool loop 中按需调用 `capabilitySearch / capabilityLoad / skillList / skillLoad`。
- 写工具只产生 reviewable staging/proposal，不静默写真实 ST 世界书。
- runtime event 能表达 tool call、tool result 与 approval gate。
- 在真实宿主 walkthrough 通过前保留旧 XML tool 模拟路径。

## 当前落地状态

- [x] 新增能力/技能工具面：
  - `capabilitySearch`
  - `capabilityLoad`
  - `skillList`
  - `skillLoad`
  - `readFile`
  - `bash`
  - `writeFile`
  - `editFile`
  - `stageEntry`
- [x] `writeFile / editFile` 改为生成 `stage_from_shell_write` effects，不直接写 VFS 文件。
- [x] `stageEntry` 改为生成 `upsert_staging_entry` effect。
- [x] `bash` 默认 `project-readonly`，只有显式参数才进入 `project-write-request`。
- [x] `ForgeAgentGraphRuntime` 不再运行 `skill_selector / capability_loader` 预加载节点。
- [x] `ForgeExecutionGateway.runWithTools()` 改为接收 `ForgeExecutionRequest`，由 gateway 统一发出 request lifecycle。
- [x] `ForgeAgentLoop` 不再发 `request_started / stream_done`，只负责 AI SDK tool loop。
- [x] 新增 runtime event：
  - `tool_call`
  - `tool_result`
  - `tool_approval_needed`
  - `tool_approval_resolved`
- [x] `ForgeRuntimeOrchestrator` 增加全模式 feature flag 分支。
- [x] tool calling 失败时回退旧 XML 路径。
- [x] `tool_approval_needed / tool_approval_resolved` 已进入 transient Review Gate 队列：
  - `useForgeStore.toolApprovals`
  - `upsert_tool_approval / resolve_tool_approval`
  - `ForgeReviewPanel` 待授权工具卡片
- [x] 写入类工具已接入 AI SDK 原生 `needsApproval`：
  - `writeFile / editFile / stageEntry` 固定需要 approval。
  - `bash` 仅在 `accessMode = project-write-request` 时需要 approval。
  - `ForgeAgentLoop` 会从 `tool-approval-request` step content 发出 `tool_approval_needed`。
- [x] approve/resume 下层闭环已接入：
  - `ForgeAgentLoop` 可追加 AI SDK `tool-approval-response` 消息恢复工具执行。
  - `ForgeRuntimeOrchestrator` 会缓存 pending approval 的 request/toolset 上下文。
  - `ForgeReviewPanel` 的批准/拒绝按钮会优先触发 Orchestrator 续跑。

## 后续步骤

- [~] 将 `tool_approval_needed / tool_approval_resolved` 接入 Review 面板真实 UI 交互。
  - 已显示 pending 工具授权并可标记批准/拒绝。
  - 已能接收 AI SDK 原生 approval request。
  - 已能把用户批准/拒绝回注为下一轮 `tool-approval-response`，恢复 tool loop。
  - 仍需真实宿主 walkthrough 验证完整 user approval -> staged proposal -> freeze 流。
- [~] 让 Review 面板显示工具名、参数摘要、目标路径、原内容、新内容。
  - 当前授权卡片显示工具名、来源、原因、目标路径/目标条目、写入摘要和完整参数。
  - `editFile` 显示原片段/新片段；`stageEntry` 显示新内容和原内容合成提示。
  - `writeFile` 在 approval 阶段尚未执行工具，只能显示新内容；原内容会在批准执行后由 staging proposal 读取并展示完整对比。
- [x] 将 tool calling 从 conversation 扩展到 planner / analyst / executor runtime 请求。
  - `lumina-forge.agentToolCalling.enabled` 开启后，conversation / planner / analyst / executor 请求都优先走 `runWithTools()`。
  - analyst tool calling 完成后仍继续进入 planner。
  - executor rewrite 在总开关开启时不再优先 isolated subagent，而是进入 tool calling；总开关关闭时保留 isolated subagent 优先路径。
  - 旧 XML 路径仍保留为总开关关闭或 tool calling 失败时的 fallback。
- [x] Forge 主提示词改为原生 tool calling 优先。
  - conversation / planner / analyst / executor prompt 不再要求输出旧 XML 模拟工具标签。
  - `ForgePromptContextService` 的写入格式提示与 A.U.T.O checklist 指令已改为 `stageEntry` / `writeFile` / `editFile` 与 Review Gate 语义。
  - Forge <V> DSL 协议说明只保留 `<thinking>` 与 `<V>` 容器边界，工具执行交给原生 tool calling。
- [x] 技能/能力中文化。
  - `ForgeCapabilityRegistry` 的 title / summary 已中文化。
  - `ForgeSkillRegistry` 的 title / description / SKILL.md 内置说明已中文化。
  - tool function id 保持英文稳定标识，避免破坏 schema 与既有调用链路。
- [~] review / staging / export prepare 已复用 Review Gate 与 staging 链路；仍需真实宿主 walkthrough 验证。
- [x] analyst 已在总开关开启时走 tool calling，并保持偏只读工具使用约束。
- [x] executor rewrite 已在总开关开启时走 tool calling；总开关关闭时仍保留 isolated subagent 优先 fallback。
- [x] 补齐模型请求调试面板的 tool calling trace 视图。
  - 专项计划：[Forge 模型请求调试面板 tool calling trace 实现计划](./2026-05-19-forge-model-request-tool-calling-debug-plan.md)
  - 当前面板已显示 prompt / context / response / 工具调用。
  - 工具调用视图展示 tool set 摘要、tool call/result、approval needed/resolved 与 payload JSON。
  - `modelRequestTraces` 只保存前端会话内瞬态调试信息；会话级长期操作记录仍由 `timelineItems` 序列化保存。
- [ ] 运行真实宿主 walkthrough：
  - 新建 Forge 项目。
  - 开启 `lumina-forge.agentToolCalling.enabled`。
  - Agent 搜索并加载 `virtual-lorebook-editor`。
  - Agent 读取项目文件。
  - Agent 生成 staging proposal。
  - 用户 approve。
  - 刷新宿主后检查项目 VFS。
  - 确认真实 ST 世界书未被静默写入。

## 验证记录

2026-05-19 已运行：

```powershell
cd D:\LuminaWeave\luminaweave-extension
npx vitest run src/api/core/__tests__/ForgeToolRegistry.test.ts src/api/core/__tests__/ForgeAgentGraphRuntime.test.ts src/api/core/__tests__/ForgeExecutionGateway.test.ts src/api/core/__tests__/ForgeRuntimeOrchestrator.tool-calling.test.ts
```

结果：4 个测试文件、11 个测试通过。

最终完成前仍需运行：

```powershell
npm run type-check
npx vitest run src/api/core/__tests__/ForgeAgentGraphRuntime.test.ts src/api/core/__tests__/ForgeWorkspaceSearchShell.test.ts src/api/core/__tests__/ForgeEffectReducer.test.ts
```

追加验证：

```powershell
npm run type-check -- --pretty false
npx vitest run src/stores/__tests__/useForgeStore.test.ts src/api/core/__tests__/ForgeEffectReducer.test.ts src/api/core/__tests__/ForgeRuntimeOrchestrator.tool-calling.test.ts
```

结果：type-check 通过；3 个测试文件、9 个测试通过。

原生 approval request 接线验证：

```powershell
npm run type-check -- --pretty false
npx vitest run src/api/core/__tests__/ForgeAgentLoop.test.ts src/api/core/__tests__/ForgeExecutionGateway.test.ts src/api/core/__tests__/ForgeToolRegistry.test.ts
```

结果：type-check 通过；3 个测试文件、9 个测试通过。

approve/resume 闭环验证：

```powershell
npm run type-check -- --pretty false
npx vitest run src/api/core/__tests__/ForgeAgentLoop.test.ts src/api/core/__tests__/ForgeExecutionGateway.test.ts src/api/core/__tests__/ForgeRuntimeOrchestrator.tool-calling.test.ts src/api/core/__tests__/ForgeToolRegistry.test.ts src/stores/__tests__/useForgeStore.test.ts
```

结果：type-check 通过；5 个测试文件、18 个测试通过。

Review Gate 写入细节展示验证：

```powershell
npm run type-check -- --pretty false
npx vitest run src/plugins/forge/__tests__/forgeToolApprovalPresentation.test.ts
```

结果：type-check 通过；1 个测试文件、3 个测试通过。

全模式 tool calling 路由验证：

```powershell
npm run type-check -- --pretty false
npx vitest run src/api/core/__tests__/ForgeRuntimeOrchestrator.tool-calling.test.ts
```

结果：type-check 通过；1 个测试文件、7 个测试通过。

提示词与中文化验证：

```powershell
npm run type-check -- --pretty false
npx vitest run src/api/core/__tests__/ForgeProtocolBoundary.test.ts src/api/core/__tests__/PromptBuilder.test.ts src/api/core/__tests__/ForgePromptContextService.test.ts src/api/core/__tests__/ForgeCapabilityRegistry.test.ts src/api/core/__tests__/ForgeSkillRegistry.test.ts src/api/core/__tests__/ForgeToolRegistry.test.ts
npx vitest run src/plugins/forge/__tests__/forgeToolApprovalPresentation.test.ts src/api/core/__tests__/ForgeAgentLoop.test.ts src/api/core/__tests__/ForgeAgentGraphRuntime.test.ts src/api/core/__tests__/ForgeWorkspaceSearchShell.test.ts src/api/core/__tests__/ForgeEffectReducer.test.ts src/api/core/__tests__/ForgeToolRegistry.test.ts src/api/core/__tests__/ForgeExecutionGateway.test.ts src/api/core/__tests__/ForgeRuntimeOrchestrator.tool-calling.test.ts src/stores/__tests__/useForgeStore.test.ts src/api/core/__tests__/ForgeProtocolBoundary.test.ts src/api/core/__tests__/PromptBuilder.test.ts src/api/core/__tests__/ForgePromptContextService.test.ts src/api/core/__tests__/ForgeCapabilityRegistry.test.ts src/api/core/__tests__/ForgeSkillRegistry.test.ts
```

结果：type-check 通过；第一组 6 个测试文件、31 个测试通过；第二组 14 个测试文件、62 个测试通过。

显示与记录说明：

- `tool_call / tool_result / tool_approval_needed / tool_approval_resolved` 会被 Orchestrator 转成 Forge timeline operation。
- Forge inline trace 会显示这些 operation，可展开查看参数、结果或 gate 详情。
- `timelineItems` 属于 `ForgeWorkspaceSession` 序列化字段，会随 Forge session 保存与 hydrate；因此 tool calling 操作记录会进入会话级信息记录。
- 模型请求调试面板也会显示 tool calling trace，但 `modelRequestTraces` 本身保持瞬态调试用途，不写入 Forge session 持久化结构。

模型请求调试面板 tool calling trace 验证：

```powershell
npm run type-check -- --pretty false
npx vitest run src/plugins/forge/__tests__/forgeModelRequestToolTracePresentation.test.ts src/plugins/forge/__tests__/forgeToolApprovalPresentation.test.ts src/api/core/__tests__/ForgeAgentLoop.test.ts src/api/core/__tests__/ForgeExecutionGateway.test.ts src/api/core/__tests__/ForgeRuntimeOrchestrator.tool-calling.test.ts src/api/core/__tests__/ForgeToolRegistry.test.ts src/api/core/__tests__/ForgeEffectReducer.test.ts src/stores/__tests__/useForgeStore.test.ts
```

结果：type-check 通过；8 个测试文件、33 个测试通过。
