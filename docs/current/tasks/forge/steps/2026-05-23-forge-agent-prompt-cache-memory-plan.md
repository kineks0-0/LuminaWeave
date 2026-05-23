# Forge Agent 提示词编排、缓存与记忆管理调整计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修正 Forge pi agent 提示词真实编排、缓存稳定性和对话/记忆注入边界，让 Prompt Preview、真实生成、模型请求 trace 与长期文档描述一致。

**架构：** 保持 `ForgePiAgentSession.preparePrompt()` 作为 Prompt Preview 与真实生成的唯一事实源；把 prompt 输入拆成稳定前缀、慢变项目上下文、动态运行上下文和 branch messages。当前协作线程和长期记忆继续通过 Forge Semantic VFS 可读，但默认不把完整对话历史塞进 system prompt。

**技术栈：** Vue 3 + TypeScript + Vite + Vitest；Forge pi runtime；`@earendil-works/pi-agent-core` / `@earendil-works/pi-ai`；Forge Semantic VFS。

---

## 背景与约束

- 当前代码事实源：`luminaweave-extension/src/api/core/forge/agent-app/session/ForgePiAgentSession.ts` 的 `preparePromptState()`。
- 当前资源加载：`luminaweave-extension/src/api/core/forge/agent-app/resources/ForgePiResourceLoader.ts` 会读取 `./AGENTS.md`、`./.forge/agent/SYSTEM.md`、mode prompt、`UI_DSL.md`、`REASONING.md`、能力/资源索引和 `./threads/目前/messages.md`。
- 当前对话事实源：`ForgePiSessionManager.getBranchMessages()` 已把当前 pi session branch 转成模型 transcript。
- 当前风险：`./threads/目前/messages.md` 被作为 context file 注入 system prompt，同时 branch messages 也进入模型，导致历史重复，并让 system prompt 每轮随对话变化。
- 缓存依据：[OpenAI Prompt Caching](https://platform.openai.com/docs/guides/prompt-caching) 依赖重复前缀并暴露 cached token usage；[Anthropic Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) 要求稳定内容放前、动态内容放后，cache breakpoint 之前内容变化会破坏复用。
- 成熟项目参考：[OpenAI Agents Sessions](https://openai.github.io/openai-agents-js/guides/running-agents/#sessions-automatic-conversation-history) 自动管理 conversation history；[LangGraph memory](https://docs.langchain.com/oss/python/langgraph/add-memory) 区分 thread-scoped short-term memory 与 store-backed long-term memory；[AutoGen memory](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/memory.html) 作为外部组件查询后按需注入。

## 目标文件职责

- 修改：`luminaweave-extension/src/types/PromptPresetTypes.ts`
  - 补齐 Forge Agent orchestration step：`ui_dsl`、`reasoning_boundary`。
- 修改：`luminaweave-extension/src/resources/presets/forge-main-default.json`
  - 让内置主预设的编排显式包含 UI DSL 与 Reasoning Boundary。
- 修改：`luminaweave-extension/src/resources/presets/forge-executor-default.json`
  - 与主预设保持一致，避免执行模型预设展示旧顺序。
- 修改：`luminaweave-extension/src/plugins/forge/store/forgePromptPresetPresentation.ts`
  - 展示新 step label，并让工作台的编排检查与真实 builder 顺序一致。
- 修改：`luminaweave-extension/src/plugins/forge/__tests__/forgePromptPresetPresentation.test.ts`
  - 覆盖 UI DSL / Reasoning Boundary 编排展示和计数。
- 修改：`luminaweave-extension/src/api/core/forge/agent-app/resources/ForgePiResourceLoader.ts`
  - 将 system prompt 组装拆成稳定前缀、慢变项目上下文、动态上下文区域。
  - 默认移除 `./threads/目前/messages.md` 的 system prompt 注入；保留它作为 semantic VFS 可读文件。
  - 把 active skills 摘要移动到 Contract/System/Mode/UI DSL/Reasoning 之后，或改为结构化 `skills` 区域。
- 修改：`luminaweave-extension/src/api/core/__tests__/forge/ForgePiResourceLoader.test.ts`
  - 覆盖新的 context bundle 顺序、system prompt 不含当前线程完整消息、稳定前缀不随新增消息变化。
- 修改：`luminaweave-extension/src/api/core/forge/agent-app/session/ForgePiAgentSession.ts`
  - 将稳定 `sessionId` 传给 `new Agent({ sessionId })`，使用现有构造参数中的 `sessionId`。
  - 在 Prompt Preview 返回值中保留足够的 region / context summary，供 Inspector 展示缓存边界。
- 创建：`luminaweave-extension/src/api/core/__tests__/forge/ForgePiAgentSession.test.ts`
  - 覆盖 Agent 创建时向 pi-agent-core 传递 `sessionId`。
- 修改：`luminaweave-extension/src/types/ForgeRuntimeTypes.ts`
  - 为 `ForgePiModelRequestTrace` 增加缓存观测字段，例如 `cache?: { sessionId?: string; staticPrefixHash?: string; dynamicContextHash?: string; cacheRead?: number; cacheWrite?: number }`。
- 修改：`luminaweave-extension/src/api/core/forge/agent-app/model/ForgePiNexusProvider.ts`
  - 从 `AssistantMessage.usage` 或 provider response 中提取 `cacheRead/cacheWrite`，写入 trace。
  - 保留 provider 原始 usage 摘要，便于 OpenAI `cached_tokens` 与 Anthropic `cache_read_input_tokens/cache_creation_input_tokens` 排查。
- 修改：`luminaweave-extension/src/api/core/__tests__/forge/ForgePiNexusProvider.test.ts`
  - 覆盖 cache usage 从 pi-ai final message 进入 `ForgePiModelRequestTrace`。
- 不修改：`luminaweave-extension/src/plugins/forge/inspector/`
  - 本计划先把缓存观测写入 trace model 和测试；Inspector UI 展示另起任务，避免扩大本轮 prompt/cache 边界修正范围。
- 修改：`docs/overall/modules/forge/index.md`
  - 同步当前任务完成后的真实编排顺序、缓存边界和记忆注入规则。
- 检查：`docs/overall/PDR.md`、`docs/overall/system_design.md`
  - 本计划默认不修改全局 PDR/System Design；若实现过程中发现全局长期承诺被改变，停止本计划并先补新的架构决策说明。

## 任务 1：补齐编排类型与预设展示

**文件：**
- 修改：`luminaweave-extension/src/types/PromptPresetTypes.ts`
- 修改：`luminaweave-extension/src/resources/presets/forge-main-default.json`
- 修改：`luminaweave-extension/src/resources/presets/forge-executor-default.json`
- 修改：`luminaweave-extension/src/plugins/forge/store/forgePromptPresetPresentation.ts`
- 测试：`luminaweave-extension/src/plugins/forge/__tests__/forgePromptPresetPresentation.test.ts`

- [x] **步骤 1：编写失败测试**

在 `forgePromptPresetPresentation.test.ts` 中让 orchestration rows 预期包含：

```ts
expect(rows.map(row => row.kind)).toEqual([
    'contract',
    'system',
    'mode_prompt',
    'ui_dsl',
    'reasoning_boundary',
    'skills',
    'capabilities',
    'context_files',
    'branch_messages'
]);
```

- [x] **步骤 2：运行测试确认失败**

运行：

```powershell
cd D:\LuminaWeave\luminaweave-extension
npx vitest run src/plugins/forge/__tests__/forgePromptPresetPresentation.test.ts --testTimeout=60000
```

预期：因类型或展示 label 缺失失败。

- [x] **步骤 3：实现类型与展示补齐**

在 `ForgeAgentPromptOrchestrationStepKind` 中加入：

```ts
| 'ui_dsl'
| 'reasoning_boundary'
```

在 `ORCHESTRATION_LABELS` 中加入：

```ts
ui_dsl: 'UI DSL',
reasoning_boundary: 'Reasoning Boundary',
```

在两个内置 Forge 预设 JSON 的 `forgeAgentOrchestration.steps` 中，于 `mode_prompt` 后插入：

```json
{ "kind": "ui_dsl", "enabled": true, "path": "./.forge/agent/UI_DSL.md", "title": "UI DSL" },
{ "kind": "reasoning_boundary", "enabled": true, "path": "./.forge/agent/REASONING.md", "title": "Reasoning Boundary" }
```

- [x] **步骤 4：运行测试确认通过**

运行：

```powershell
cd D:\LuminaWeave\luminaweave-extension
npx vitest run src/plugins/forge/__tests__/forgePromptPresetPresentation.test.ts --testTimeout=60000
```

预期：测试通过，workbench overview 的 orchestration count 从 7 更新为 9。

## 任务 2：修正 ResourceLoader 的 prompt 区域与对话注入边界

**文件：**
- 修改：`luminaweave-extension/src/api/core/forge/agent-app/resources/ForgePiResourceLoader.ts`
- 测试：`luminaweave-extension/src/api/core/__tests__/forge/ForgePiResourceLoader.test.ts`

- [x] **步骤 1：编写失败测试：当前线程消息不进入 system prompt**

在 `ForgePiResourceLoader.test.ts` 新增用例：

```ts
const context = createContext();
context.messages = [{ role: 'user', content: '这句话只能出现在 branch messages 或 VFS 文件里' }] as any;
const bundle = await loader.buildContextBundle(context);
const systemPrompt = loader.buildSystemPrompt({ systemFragments: [], contextBundle: bundle });

expect(systemPrompt).not.toContain('这句话只能出现在 branch messages 或 VFS 文件里');
expect(bundle.files.map(file => file.path)).not.toContain('./threads/目前/messages.md');
```

- [x] **步骤 2：编写失败测试：稳定前缀不随新增消息变化**

同一测试文件新增 helper，比较只改变 `context.messages` 后的 system prompt：

```ts
const first = await loader.buildContextBundle({ ...createContext(), messages: [] as any });
const second = await loader.buildContextBundle({
    ...createContext(),
    messages: [{ role: 'user', content: '新消息' }] as any
});

expect(loader.buildSystemPrompt({ systemFragments: [], contextBundle: first }))
    .toBe(loader.buildSystemPrompt({ systemFragments: [], contextBundle: second }));
```

- [x] **步骤 3：运行测试确认失败**

运行：

```powershell
cd D:\LuminaWeave\luminaweave-extension
npx vitest run src/api/core/__tests__/forge/ForgePiResourceLoader.test.ts --testTimeout=60000
```

预期：旧测试仍期待 `./threads/目前/messages.md` 在 bundle 中，新测试也会因 system prompt 包含当前消息失败。

- [x] **步骤 4：实现最小修正**

在 `buildContextBundle()` 中从默认 `files` 列表移除：

```ts
{ path: './threads/目前/messages.md', title: '当前协作线程', content: this.buildCurrentThreadFile(context) }
```

保留 `buildCurrentThreadFile()`，因为 `ForgeProjectSemanticVfsService` / `readFile("./threads/目前/messages.md")` 仍需要可读线程投影。

在 `buildSystemPrompt()` 中把 `skills` 放到稳定 prompt 文件之后，并保持顺序为：

```text
Contract -> System -> Mode Prompt -> UI DSL -> Reasoning Boundary -> Skills -> Capabilities -> Context Files
```

- [x] **步骤 5：更新旧断言并运行测试**

把旧测试中 `bundle.files.map(file => file.path)` 的预期移除 `./threads/目前/messages.md`。运行：

```powershell
cd D:\LuminaWeave\luminaweave-extension
npx vitest run src/api/core/__tests__/forge/ForgePiResourceLoader.test.ts src/api/core/__tests__/forge/ForgeProjectSemanticVfsService.test.ts src/api/core/__tests__/forge/ForgePiToolBridge.test.ts --testTimeout=60000
```

预期：ResourceLoader 不再默认注入完整线程消息；Semantic VFS 和 `readFile` 仍可读取 `./threads/目前/messages.md`。

## 任务 3：把 sessionId 传入 pi-agent-core 并稳定缓存键

**文件：**
- 修改：`luminaweave-extension/src/api/core/forge/agent-app/session/ForgePiAgentSession.ts`
- 创建：`luminaweave-extension/src/api/core/__tests__/forge/ForgePiAgentSession.test.ts`

- [x] **步骤 1：编写失败测试**

通过 mock `@earendil-works/pi-agent-core` 的 `Agent` 构造参数，断言 Forge 创建 Agent 时传入当前 `sessionId`：

```ts
expect(MockAgent).toHaveBeenCalledWith(expect.objectContaining({
    sessionId: 'forge-pi-session-alpha'
}));
```

- [x] **步骤 2：运行测试确认失败**

运行：

```powershell
cd D:\LuminaWeave\luminaweave-extension
npx vitest run src/api/core/__tests__/forge/ForgePiAgentSession.test.ts --testTimeout=60000
```

预期：当前 `new Agent()` 未传 `sessionId`，断言失败。

- [x] **步骤 3：实现 sessionId 透传**

在 `createAgent()` 的 `new Agent({ ... })` 参数中加入：

```ts
sessionId: this.sessionId,
```

不要新造随机 id；使用 `ForgePiAgentSession` 构造函数已有的 `sessionId`，确保同一 Forge 协作线程内稳定。

- [x] **步骤 4：运行测试确认通过**

运行：

```powershell
cd D:\LuminaWeave\luminaweave-extension
npx vitest run src/api/core/__tests__/forge/ForgePiAgentSession.test.ts src/api/core/__tests__/forge/ForgePiSessionManager.test.ts --testTimeout=60000
```

预期：Agent runtime 行为不变，provider options 可拿到稳定 session id。

## 任务 4：补缓存观测 trace

**文件：**
- 修改：`luminaweave-extension/src/types/ForgeRuntimeTypes.ts`
- 修改：`luminaweave-extension/src/api/core/forge/agent-app/model/ForgePiNexusProvider.ts`
- 测试：`luminaweave-extension/src/api/core/__tests__/forge/ForgePiNexusProvider.test.ts`

- [x] **步骤 1：编写失败测试**

在 `ForgePiNexusProvider.test.ts` 中构造一个 final assistant message，其 usage 包含：

```ts
usage: {
    input: 100,
    output: 20,
    cacheRead: 64,
    cacheWrite: 16,
    totalTokens: 200,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
}
```

断言 trace：

```ts
expect(provider.getTrace(request.requestId)?.cache).toMatchObject({
    cacheRead: 64,
    cacheWrite: 16
});
```

- [x] **步骤 2：运行测试确认失败**

运行：

```powershell
cd D:\LuminaWeave\luminaweave-extension
npx vitest run src/api/core/__tests__/forge/ForgePiNexusProvider.test.ts --testTimeout=60000
```

预期：`ForgePiModelRequestTrace` 目前没有缓存字段或未从 final message usage 写入。

- [x] **步骤 3：实现 trace 字段**

在 `ForgePiModelRequestTrace` 增加：

```ts
cache?: {
    sessionId?: string;
    cacheRead?: number;
    cacheWrite?: number;
    totalTokens?: number;
    providerUsage?: unknown;
};
```

在 `ForgePiNexusProvider` 捕获 final assistant message 后，从 `finalMessage.usage` 写入 `trace.cache`。如果 provider response 暴露 OpenAI `cached_tokens` 或 Anthropic `cache_read_input_tokens/cache_creation_input_tokens`，保留到 `providerUsage`。

- [x] **步骤 4：运行测试确认通过**

运行：

```powershell
cd D:\LuminaWeave\luminaweave-extension
npx vitest run src/api/core/__tests__/forge/ForgePiNexusProvider.test.ts --testTimeout=60000
```

预期：trace 中能看到 cache read/write，旧 provider payload / response 展示不回退。

## 任务 5：建立短期历史与长期记忆注入策略

**文件：**
- 修改：`luminaweave-extension/src/api/core/forge/agent-app/session/ForgePiSessionManager.ts`
- 修改：`luminaweave-extension/src/api/core/forge/agent-app/resources/ForgePiResourceLoader.ts`
- 测试：`luminaweave-extension/src/api/core/__tests__/forge/ForgePiSessionManager.test.ts`
- 测试：`luminaweave-extension/src/api/core/__tests__/forge/ForgePiResourceLoader.test.ts`

- [x] **步骤 1：补短期历史预算测试**

在 `ForgePiSessionManager.test.ts` 增加用例，确认 `getBranchMessages()` 保持 tool call / tool result 配对，不把 assistant tool call 裁掉后留下孤立 tool result。

- [x] **步骤 2：补长期记忆不默认全量注入测试**

在 `ForgePiResourceLoader.test.ts` 增加断言：

```ts
expect(systemPrompt).not.toContain('避免俗套');
expect(bundle.files.find(file => file.path === './.pi/agent/context/project-resources.md')?.content)
    .toContain('项目记忆');
```

含义：长期记忆作为 VFS 文件和资源索引存在，但不把每条 memory 正文默认灌进 system prompt。

- [x] **步骤 3：实现最小策略**

短期历史继续由 branch messages 承载，并新增显式 helper：

```ts
selectReplaySafeBranchMessages(messages, { maxMessages: 30, preserveToolPairs: true })
```

第一阶段只按消息数量裁剪，不实现 token counter。helper 必须保证 tool call / tool result 配对，避免留下孤立 tool result。

长期记忆保持 `./memory/**/*.md` 可读；默认 system prompt 只保留项目资源索引和必要摘要。本计划不自动注入完整 memory tree，也不新增向量检索。

- [x] **步骤 4：运行测试**

运行：

```powershell
cd D:\LuminaWeave\luminaweave-extension
npx vitest run src/api/core/__tests__/forge/ForgePiSessionManager.test.ts src/api/core/__tests__/forge/ForgePiResourceLoader.test.ts --testTimeout=60000
```

预期：短期 transcript 与长期 memory 边界明确，Prompt Preview 不重复展示完整对话历史。

## 任务 6：同步文档与验证矩阵

**文件：**
- 修改：`docs/overall/modules/forge/index.md`
- 修改：`docs/current/tasks/forge/README.md`
- 检查：`docs/overall/PDR.md`
- 检查：`docs/overall/system_design.md`

- [x] **步骤 1：更新 Forge 模块文档**

在 `docs/overall/modules/forge/index.md` 的当前代码状态或 Forge Runtime 分工处写清：

```text
Prompt Preview 与真实生成共享 ForgePiAgentSession.preparePrompt()。
默认 prompt 输入分为稳定前缀、慢变项目上下文、动态运行上下文和 branch messages。
./threads/目前/messages.md 与 ./memory/**/*.md 是 semantic VFS 可读资源，不默认作为完整正文注入 system prompt。
```

- [x] **步骤 2：更新当前任务 README**

把本计划完成状态写回 `docs/current/tasks/forge/README.md`，并说明真实宿主 walkthrough 仍独立保留。

- [x] **步骤 3：判断是否更新 PDR/System Design**

如果实现只是让代码符合现有长期设计，不更新全局 PDR/System Design；如果新增了公开的缓存策略或记忆注入承诺，则同步更新：

```text
docs/overall/PDR.md
docs/overall/system_design.md
```

- [x] **步骤 4：运行完整 Forge 相关验证**

运行：

```powershell
cd D:\LuminaWeave\luminaweave-extension
npx vitest run src/api/core/__tests__/forge src/plugins/forge/__tests__ --testTimeout=60000
npm run type-check -- --pretty false
```

预期：Forge core 与 Forge plugin tests 通过，TypeScript 无新增错误。

## 验收标准

- [x] Prompt Preview 与真实生成仍共用 `ForgePiAgentSession.preparePrompt()` / runtime prepared prompt。
- [x] `forgeAgentOrchestration` 类型、内置预设 JSON、预设工作台展示和真实 builder 顺序一致。
- [x] `UI_DSL.md` 与 `REASONING.md` 是显式 orchestration step。
- [x] `./threads/目前/messages.md` 仍可通过 Semantic VFS / `readFile` 读取，但不默认注入 system prompt。
- [x] 只新增一条用户消息时，system prompt 稳定前缀不变化。
- [x] `Agent` 创建时传入稳定 `sessionId`，pi-ai provider 能接收 prompt cache key / session affinity。
- [x] 模型请求 trace 能看到 cache read/write 或 provider usage 摘要。
- [x] 长期 memory 默认保持 VFS 可读和资源索引可见，不全量灌入 system prompt。
- [x] Forge 模块文档同步真实 prompt/cache/memory 边界。
