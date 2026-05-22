# Forge 模型请求调试面板 tool calling trace 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 `subagent-driven-development`（推荐）或 `executing-plans` 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让 Forge“模型请求调试”辅助面板完整显示 tool calling 请求中的工具清单、工具调用、工具结果与 Review Gate 授权记录。

**架构：** `ForgeExecutionGateway.runWithTools()` 继续作为 request lifecycle 与 tool event 的唯一事件源；`ForgeRuntimeOrchestrator` 将 tool event 追加到当前 `ForgeModelRequestTrace`；`ForgeModelRequestDebugPanel` 新增“工具调用”视图。timeline operation 仍用于用户侧可追溯记录，model request trace 只承担开发调试视图。

**技术栈：** Vue 3 + Pinia + TypeScript + Vitest，沿用 `ForgeRuntimeTypes.ts`、`useForgeStore.ts`、`ForgeRuntimeOrchestrator.ts` 与现有 Forge Dev panel。

---

## 计划创建时判断

计划创建时，“模型请求调试”面板已经能显示 tool calling 请求的 prompt、context 和文本 response，但还不显示工具层细节：

- `ForgeModelRequestTrace` 没有 tool events 字段。
- `ForgeModelRequestDebugPanel` 没有“工具调用”tab。
- `tool_call / tool_result / tool_approval_needed / tool_approval_resolved` 只进入 timeline operation 与 Review Gate，不进入 model request trace。
- `modelRequestTraces` 仍是前端会话内瞬态调试记录，不作为长期信息记录；长期操作记录继续由 `timelineItems` 序列化保存。

本计划只补齐调试面板，不改变 tool calling 执行链路，不改变 Review Gate 权限边界。

## 文件职责

- 修改：`luminaweave-extension/src/types/ForgeRuntimeTypes.ts`
  - 为 `ForgeModelRequestTrace` 增加 tool calling 调试字段。
  - 新增 `ForgeModelRequestToolEvent` 类型，统一表达 call/result/approval。
- 修改：`luminaweave-extension/src/stores/useForgeStore.ts`
  - 新增 `appendModelRequestToolEvent(requestId, event)` action。
  - 保持 trace 更新不可变替换模式，避免 UI 不刷新。
- 修改：`luminaweave-extension/src/api/core/forge/ForgeRuntimeOrchestrator.ts`
  - 在 `buildEventEffects()` 中把 tool events 转成 `append_model_request_tool_event` effect。
  - 保留现有 timeline operation effects。
- 修改：`luminaweave-extension/src/types/ForgeRuntimeTypes.ts`
  - 为 `ForgeRuntimeEffect` 增加 `append_model_request_tool_event`。
- 修改：`luminaweave-extension/src/api/core/forge/ForgeEffectReducer.ts`
  - 让纯 reducer 路径识别新 effect，便于单测覆盖。
- 修改：`luminaweave-extension/src/plugins/forge/CardMakerStore.ts`
  - 在 `applyRuntimeEffects()` 中处理 `append_model_request_tool_event`，写入 Pinia trace。
- 修改：`luminaweave-extension/src/plugins/forge/ForgeModelRequestDebugPanel.vue`
  - 新增“工具调用”tab。
  - 展示 tool set 摘要、调用时间线、参数、结果、approval 状态。
- 测试：`luminaweave-extension/src/stores/__tests__/useForgeStore.test.ts`
  - 覆盖工具事件追加、排序与清空行为。
- 测试：`luminaweave-extension/src/api/core/__tests__/ForgeRuntimeOrchestrator.tool-calling.test.ts`
  - 覆盖 tool events 同时生成 timeline operation 与 model request trace effect。
- 测试：`luminaweave-extension/src/plugins/forge/__tests__/forgeModelRequestToolTracePresentation.test.ts`
  - 当前仓库没有引入新的 Vue 挂载测试依赖，因此先抽出展示 presenter 纯函数，覆盖 tool set、tool call/result/approval 的展示模型。

## 任务 1：扩展 trace 类型与 store

- [x] **步骤 1：编写失败的 store 测试**

在 `luminaweave-extension/src/stores/__tests__/useForgeStore.test.ts` 增加：

```ts
it('appends tool calling events to a model request trace', () => {
    const store = useForgeStore();
    store.createModelRequestTrace(createTrace({ id: 'req_1' }));

    store.appendModelRequestToolEvent('req_1', {
        id: 'tool_event_1',
        type: 'tool_call',
        toolCallId: 'call_1',
        toolName: 'capabilitySearch',
        payload: { query: '世界书' },
        createdAt: 100
    });

    expect(store.modelRequestTraces[0].toolEvents).toEqual([
        expect.objectContaining({
            type: 'tool_call',
            toolName: 'capabilitySearch'
        })
    ]);
});
```

- [x] **步骤 2：运行测试验证失败**

运行：

```powershell
cd D:\LuminaWeave\luminaweave-extension
npx vitest run src/stores/__tests__/useForgeStore.test.ts
```

预期：失败，提示 `appendModelRequestToolEvent` 或 `toolEvents` 不存在。

- [x] **步骤 3：实现最小类型与 store action**

在 `ForgeRuntimeTypes.ts` 增加：

```ts
export type ForgeModelRequestToolEventType =
    | 'tool_call'
    | 'tool_result'
    | 'tool_approval_needed'
    | 'tool_approval_resolved';

export interface ForgeModelRequestToolEvent {
    id: string;
    type: ForgeModelRequestToolEventType;
    toolCallId: string;
    toolName: string;
    payload: unknown;
    createdAt: number;
}
```

并为 `ForgeModelRequestTrace` 增加：

```ts
toolEvents: ForgeModelRequestToolEvent[];
```

在所有创建 trace 的地方初始化 `toolEvents: []`。

在 `useForgeStore.ts` 增加：

```ts
appendModelRequestToolEvent(requestId: string, event: ForgeModelRequestToolEvent) {
    const index = this.modelRequestTraces.findIndex(item => item.id === requestId);
    if (index < 0) return;
    const existing = this.modelRequestTraces[index];
    const existingEvents = existing.toolEvents ?? [];
    this.replaceTrace({
        ...existing,
        toolEvents: [...existingEvents, event].sort((left, right) => left.createdAt - right.createdAt)
    });
}
```

- [x] **步骤 4：运行测试验证通过**

运行：

```powershell
npx vitest run src/stores/__tests__/useForgeStore.test.ts
```

预期：通过。

## 任务 2：把 runtime tool events 写入 request trace

- [x] **步骤 1：编写失败的 orchestrator 测试**

在 `ForgeRuntimeOrchestrator.tool-calling.test.ts` 增加断言：当 gateway 发出 `tool_call` 和 `tool_result` 时，`applyRuntimeEffects` 收到 `append_model_request_tool_event`。

示例断言：

```ts
expect(appliedEffects).toEqual(expect.arrayContaining([
    expect.objectContaining({
        type: 'append_model_request_tool_event',
        requestId: 'req_tool_1',
        event: expect.objectContaining({
            type: 'tool_call',
            toolCallId: 'call_1',
            toolName: 'capabilitySearch'
        })
    }),
    expect.objectContaining({
        type: 'append_model_request_tool_event',
        requestId: 'req_tool_1',
        event: expect.objectContaining({
            type: 'tool_result',
            toolCallId: 'call_1',
            toolName: 'capabilitySearch'
        })
    })
]));
```

- [x] **步骤 2：运行测试验证失败**

```powershell
npx vitest run src/api/core/__tests__/ForgeRuntimeOrchestrator.tool-calling.test.ts
```

预期：失败，缺少 `append_model_request_tool_event`。

- [x] **步骤 3：实现 effect 映射**

在 `ForgeRuntimeTypes.ts` 的 `ForgeRuntimeEffect` 中增加：

```ts
| {
    type: 'append_model_request_tool_event';
    requestId: string;
    event: ForgeModelRequestToolEvent;
}
```

在 `ForgeRuntimeOrchestrator.buildEventEffects()` 中，保留现有 operation effect，并为 tool event 追加 trace effect：

```ts
{
    type: 'append_model_request_tool_event',
    requestId: event.requestId,
    event: {
        id: `${event.requestId}:${event.toolCallId}:call`,
        type: 'tool_call',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        payload: event.args,
        createdAt: Date.now()
    }
}
```

`tool_result / tool_approval_needed / tool_approval_resolved` 同理，`payload` 分别放 result、approval args/reason、resolved result。

- [x] **步骤 4：接入 CardMakerStore effect 应用**

在 `CardMakerStore.applyRuntimeEffects()` 的 switch 中处理：

```ts
case 'append_model_request_tool_event':
    forgeStore.appendModelRequestToolEvent(effect.requestId, effect.event);
    break;
```

- [x] **步骤 5：运行测试验证通过**

```powershell
npx vitest run src/api/core/__tests__/ForgeRuntimeOrchestrator.tool-calling.test.ts src/stores/__tests__/useForgeStore.test.ts
```

预期：通过。

## 任务 3：调试面板新增“工具调用”tab

- [x] **步骤 1：编写失败的 UI / presenter 测试**

原计划创建 `ForgeModelRequestDebugPanel.tool-calling.test.ts` 挂载 Vue 组件。实际执行时为避免临时引入新的 Vue 测试依赖，按“未验证前提”中的 fallback 抽出 `forgeModelRequestToolTracePresentation.ts`，创建 `forgeModelRequestToolTracePresentation.test.ts` 覆盖展示模型：

```ts
expect(wrapper.text()).toContain('工具调用');
expect(wrapper.text()).toContain('capabilitySearch');
expect(wrapper.text()).toContain('tool_call');
expect(wrapper.text()).toContain('tool_result');
expect(wrapper.text()).toContain('tool_approval_needed');
```

- [x] **步骤 2：运行测试验证失败**

```powershell
npx vitest run src/plugins/forge/__tests__/forgeModelRequestToolTracePresentation.test.ts
```

预期：失败，面板没有“工具调用”tab。

- [x] **步骤 3：实现 UI 最小视图**

在 `ForgeModelRequestDebugPanel.vue`：

- 将 `detailTab` 扩展为 `'prompt' | 'context' | 'tools' | 'response'`。
- 在 tab 区新增按钮“工具调用”。
- 新增 computed：

```ts
const toolEvents = computed(() => selectedTrace.value?.toolEvents ?? []);
```

- 新增 tools section：

```vue
<div v-else-if="detailTab === 'tools'" class="detail-section">
  <div v-if="toolEvents.length === 0" class="empty-detail">
    <strong>暂无工具调用</strong>
    <p>非 tool calling 请求，或本次请求尚未产生工具事件。</p>
  </div>
  <article v-for="event in toolEvents" :key="event.id" class="message-card">
    <div class="message-head">
      <span class="message-role">{{ event.type }}</span>
      <span class="message-name">{{ event.toolName }} · {{ event.toolCallId }}</span>
    </div>
    <pre class="code-block">{{ JSON.stringify(event.payload, null, 2) }}</pre>
  </article>
</div>
```

- [x] **步骤 4：运行 UI / presenter 测试验证通过**

```powershell
npx vitest run src/plugins/forge/__tests__/forgeModelRequestToolTracePresentation.test.ts
```

预期：通过。

## 任务 4：补齐工具清单摘要

- [x] **步骤 1：编写失败的 trace 初始化测试**

在 runtime trace 创建测试中要求 `ForgeModelRequestTrace` 可携带 `toolSetSummary`：

```ts
expect(trace.toolSetSummary).toEqual(expect.arrayContaining([
    expect.objectContaining({
        name: 'capabilitySearch',
        needsApproval: false
    }),
    expect.objectContaining({
        name: 'stageEntry',
        needsApproval: true
    })
]));
```

- [x] **步骤 2：实现 `toolSetSummary` 类型**

在 `ForgeRuntimeTypes.ts` 增加：

```ts
export interface ForgeModelRequestToolSummary {
    name: string;
    description?: string | null;
    needsApproval: boolean | 'dynamic';
}
```

并为 `ForgeModelRequestTrace` 增加：

```ts
toolSetSummary?: ForgeModelRequestToolSummary[];
```

- [x] **步骤 3：在 tool calling 请求注册时填充摘要**

在 `ForgeRuntimeOrchestrator` 或 `CardMakerStore` 创建 tool set 后，从 `Object.entries(tools)` 生成摘要：

```ts
const summarizeToolSet = (tools: ToolSet): ForgeModelRequestToolSummary[] =>
    Object.entries(tools).map(([name, tool]) => ({
        name,
        description: typeof tool.description === 'string' ? tool.description : null,
        needsApproval: typeof tool.needsApproval === 'function'
            ? 'dynamic'
            : Boolean(tool.needsApproval)
    }));
```

优先把摘要写进同一个 `ForgeModelRequestTrace`，避免 UI 二次推断。

- [x] **步骤 4：在工具调用 tab 顶部显示工具清单**

显示工具名、approval 类型和描述摘要。默认折叠完整 JSON，避免面板过长。

- [x] **步骤 5：运行相关测试**

```powershell
npx vitest run src/plugins/forge/__tests__/forgeModelRequestToolTracePresentation.test.ts src/stores/__tests__/useForgeStore.test.ts src/api/core/__tests__/ForgeRuntimeOrchestrator.tool-calling.test.ts
```

预期：通过。

## 任务 5：验证与文档

- [x] **步骤 1：运行类型检查**

```powershell
cd D:\LuminaWeave\luminaweave-extension
npm run type-check -- --pretty false
```

预期：exit 0。

- [x] **步骤 2：运行 focused regression**

```powershell
npx vitest run src/plugins/forge/__tests__/forgeModelRequestToolTracePresentation.test.ts src/plugins/forge/__tests__/forgeToolApprovalPresentation.test.ts src/api/core/__tests__/ForgeAgentLoop.test.ts src/api/core/__tests__/ForgeExecutionGateway.test.ts src/api/core/__tests__/ForgeRuntimeOrchestrator.tool-calling.test.ts src/api/core/__tests__/ForgeToolRegistry.test.ts src/api/core/__tests__/ForgeEffectReducer.test.ts src/stores/__tests__/useForgeStore.test.ts
```

预期：全部通过。

- [x] **步骤 3：更新任务文档**

更新：

- `docs/current/tasks/forge/README.md`
- `docs/current/tasks/forge/steps/progress-board.md`
- `docs/current/tasks/forge/steps/2026-05-19-forge-pi-capability-migration-plan.md`

记录：

- 模型请求调试面板已支持 tool calling trace。
- `modelRequestTraces` 仍是前端会话瞬态调试记录。
- 长期操作记录仍由 `timelineItems` 持久化。

## 实现记录

2026-05-19 已完成：

- `ForgeModelRequestTrace` 新增 `toolEvents` 与 `toolSetSummary`。
- `ForgeRuntimeOrchestrator` 会在 tool calling 请求开始后记录工具清单摘要，并把 `tool_call / tool_result / tool_approval_needed / tool_approval_resolved` 同步追加到当前 request trace。
- `ForgeEffectReducer` 与 `CardMakerStore` 已识别 `append_model_request_tool_event` 和 `set_model_request_tool_set_summary`。
- `ForgeModelRequestDebugPanel` 新增“工具调用”tab，显示工具清单、approval 类型、事件类型、工具名、call id 与 payload JSON。
- UI 展示逻辑抽为 `forgeModelRequestToolTracePresentation.ts`，当前以纯函数测试覆盖；没有引入新的 Vue 挂载测试依赖。

已验证：

```powershell
cd D:\LuminaWeave\luminaweave-extension
npx vitest run src/stores/__tests__/useForgeStore.test.ts
npx vitest run src/api/core/__tests__/ForgeRuntimeOrchestrator.tool-calling.test.ts src/api/core/__tests__/ForgeEffectReducer.test.ts src/stores/__tests__/useForgeStore.test.ts
npx vitest run src/plugins/forge/__tests__/forgeModelRequestToolTracePresentation.test.ts
npx vitest run src/plugins/forge/__tests__/forgeModelRequestToolTracePresentation.test.ts src/stores/__tests__/useForgeStore.test.ts src/api/core/__tests__/ForgeRuntimeOrchestrator.tool-calling.test.ts
```

结果：上述聚焦测试均通过。

最终收口验证：

```powershell
cd D:\LuminaWeave\luminaweave-extension
npm run type-check -- --pretty false
npx vitest run src/plugins/forge/__tests__/forgeModelRequestToolTracePresentation.test.ts src/plugins/forge/__tests__/forgeToolApprovalPresentation.test.ts src/api/core/__tests__/ForgeAgentLoop.test.ts src/api/core/__tests__/ForgeExecutionGateway.test.ts src/api/core/__tests__/ForgeRuntimeOrchestrator.tool-calling.test.ts src/api/core/__tests__/ForgeToolRegistry.test.ts src/api/core/__tests__/ForgeEffectReducer.test.ts src/stores/__tests__/useForgeStore.test.ts
```

结果：type-check 通过；focused regression 8 个测试文件、33 个测试通过。

## 验收标准

- 模型请求调试面板能在同一请求下显示 prompt、context、response、tool events。
- tool call/result/approval 的参数与结果可复制查看。
- 没有把 transient debug trace 误写入 Forge session 持久化结构。
- timeline operation 的持久记录行为不变。
- Review Gate 授权流程不受调试面板影响。
- feature flag 关闭时旧 XML fallback 请求仍能正常显示 prompt/context/response，工具 tab 显示“暂无工具调用”。

## 链路检查

- 输入：`ForgeExecutionGateway.runWithTools()` 产生 request lifecycle 与 tool events。
- 处理流程：`ForgeRuntimeOrchestrator.buildEventEffects()` 同时生成 timeline operation effect 与 model request trace effect。
- 状态变化：`useForgeStore.modelRequestTraces[].toolEvents` 追加瞬态调试记录；`timelineItems` 继续保存可追溯操作。
- 输出：`ForgeModelRequestDebugPanel` 在“工具调用”tab 中展示 tool set、call/result/approval。
- 上游影响：不改变 AI SDK tool loop、Review Gate、VFS 写入或旧 XML fallback。
- 下游影响：开发者可从同一模型请求中复盘 prompt、上下文、工具参数、工具结果和授权状态。

## 未验证前提

- 当前 UI 测试环境可直接挂载 `ForgeModelRequestDebugPanel.vue` 并注入 Pinia 状态；若挂载依赖过多，可改为先抽出 `forgeModelRequestToolTracePresentation.ts` 做纯函数测试。
- AI SDK tool schema 中 `description` 和 `needsApproval` 字段可安全读取；如果具体 Tool 类型收窄困难，先以运行时 duck typing 生成摘要。
