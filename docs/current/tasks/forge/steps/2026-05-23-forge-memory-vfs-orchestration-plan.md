# Forge Memory VFS 提示词编排增强计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让 `./memory/**/*.md` 作为 Forge 项目长期记忆在 Agent 提示词编排中可见、可发现、可按需读取，同时避免把长期记忆全文默认灌入 system prompt 破坏缓存。

**架构：** 记忆 VFS 分三层进入 Agent 上下文：稳定核心 prompt 之后放 `Memory Index`，列出每条长期记忆的路径、标题、来源、更新时间和摘要；正文仍保留为 Semantic VFS 文件，通过 `readFile('./memory/...')` 按需读取；后续如引入检索，只把本轮相关摘要或片段放入动态运行层，不进入稳定前缀。

**技术栈：** TypeScript + Vitest；Forge pi runtime；Forge Semantic VFS；Forge Agent Prompt Orchestration preset。

---

## 判断结论

- `./memory/**/*.md` 应该进入 Forge Agent 的提示词编排，但第一阶段进入的是 **索引/manifest**，不是完整正文。
- 每条长期记忆都应在 `Memory Index` 中可发现，至少包含语义 VFS 路径、标题、来源、更新时间和摘要。
- 记忆正文继续作为 Semantic VFS 文件暴露给 `readFile`、Forge shell 和项目 VFS 面板。
- 不默认全量注入正文，原因是长期记忆会不断增长和改写，若放入 system prompt，会持续扩大 token、降低可控性，并频繁破坏 prompt cache。
- 如果后续做检索增强，检索结果属于动态运行层，位置应在慢变项目上下文之后、branch messages 之前。

## 目标编排顺序

```text
稳定核心前缀：
1. Contract / AGENTS
2. System
3. Mode Prompt
4. UI DSL
5. Reasoning Boundary

慢变项目上下文：
6. Skills
7. Project Context
8. Workflow / Write Boundary
9. Capabilities
10. Memory Index
11. Project Resources

动态运行层：
12. Retrieved Memory Excerpts（后续可选，不在本阶段引入向量检索）
13. Branch Messages
```

## 目标文件职责

- 修改：`luminaweave-extension/src/types/PromptPresetTypes.ts`
  - 为 `ForgeAgentPromptOrchestrationStepKind` 增加 `memory_index`。
- 修改：`luminaweave-extension/src/resources/presets/forge-main-default.json`
  - 在默认主预设编排中显式加入 `memory_index`。
- 修改：`luminaweave-extension/src/resources/presets/forge-executor-default.json`
  - 与主预设保持一致，避免执行预设展示旧编排。
- 修改：`luminaweave-extension/src/plugins/forge/store/forgePromptPresetPresentation.ts`
  - 为 `memory_index` 提供中文展示 label。
- 修改：`luminaweave-extension/src/plugins/forge/__tests__/forgePromptPresetPresentation.test.ts`
  - 覆盖默认 preset 的编排顺序和计数。
- 修改：`luminaweave-extension/src/api/core/forge/agent-app/resources/ForgePiResourceLoader.ts`
  - 新增 `./.pi/agent/context/memory-index.md` context file。
  - 实现 `buildMemoryIndexFile(context)`，只输出路径、标题、来源、更新时间和摘要，不输出 `content` 全文。
- 修改：`luminaweave-extension/src/api/core/__tests__/forge/ForgePiResourceLoader.test.ts`
  - 覆盖 memory index 存在、包含路径/摘要、不包含完整正文。
- 检查：`luminaweave-extension/src/api/core/forge/project/ForgeProjectSemanticVfsService.ts`
  - 确认 `./memory/**/*.md` 的真实正文仍可通过 Semantic VFS 读取；若已有测试覆盖，不重复改实现。
- 修改：`docs/overall/modules/forge/index.md`
  - 同步 `Memory Index` 属于提示词编排的一等上下文，正文仍按需读取。
- 修改：`docs/current/tasks/forge/README.md`
  - 将本计划挂到 Forge 当前任务下一步。

## 任务 1：补齐 memory_index 编排 schema 与 preset 展示

**文件：**
- 修改：`luminaweave-extension/src/types/PromptPresetTypes.ts`
- 修改：`luminaweave-extension/src/resources/presets/forge-main-default.json`
- 修改：`luminaweave-extension/src/resources/presets/forge-executor-default.json`
- 修改：`luminaweave-extension/src/plugins/forge/store/forgePromptPresetPresentation.ts`
- 测试：`luminaweave-extension/src/plugins/forge/__tests__/forgePromptPresetPresentation.test.ts`

- [x] **步骤 1：编写失败测试**

在 `forgePromptPresetPresentation.test.ts` 中让默认内置 preset 的编排预期包含 `memory_index`：

```ts
expect(rows.map(row => row.kind)).toEqual([
    'contract',
    'system',
    'mode_prompt',
    'ui_dsl',
    'reasoning_boundary',
    'skills',
    'capabilities',
    'memory_index',
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

预期：当前类型、preset 或 label 未包含 `memory_index`，测试失败。

- [x] **步骤 3：实现 schema 与展示补齐**

在 `ForgeAgentPromptOrchestrationStepKind` 中加入：

```ts
| 'memory_index'
```

在 `ORCHESTRATION_LABELS` 中加入：

```ts
memory_index: 'Memory Index',
```

在两个内置 Forge 预设 JSON 的 `forgeAgentOrchestration.steps` 中，于 `capabilities` 后插入：

```json
{ "kind": "memory_index", "enabled": true, "path": "./.pi/agent/context/memory-index.md", "title": "Memory Index" }
```

- [x] **步骤 4：运行测试确认通过**

运行：

```powershell
cd D:\LuminaWeave\luminaweave-extension
npx vitest run src/plugins/forge/__tests__/forgePromptPresetPresentation.test.ts --testTimeout=60000
```

预期：预设展示顺序变为 10 个 step，新增 `memory_index`。

## 任务 2：新增 Memory Index context file

**文件：**
- 修改：`luminaweave-extension/src/api/core/forge/agent-app/resources/ForgePiResourceLoader.ts`
- 测试：`luminaweave-extension/src/api/core/__tests__/forge/ForgePiResourceLoader.test.ts`

- [x] **步骤 1：编写失败测试：memory index 可见但不含全文**

在 `ForgePiResourceLoader.test.ts` 中新增用例：

```ts
const bundle = await loader.buildContextBundle(createContext());
const memoryIndex = bundle.files.find(file => file.path === './.pi/agent/context/memory-index.md');
const systemPrompt = loader.buildSystemPrompt({ systemFragments: [], contextBundle: bundle });

expect(memoryIndex?.content).toContain('# 项目长期记忆索引');
expect(memoryIndex?.content).toContain('./memory/偏好/禁忌.md');
expect(memoryIndex?.content).toContain('避免俗套');
expect(systemPrompt).toContain('./.pi/agent/context/memory-index.md');
expect(systemPrompt).not.toContain('完整正文中才会出现的长句');
```

测试数据中把 `ForgeMemoryEntry` 设为：

```ts
{
    path: '偏好/禁忌',
    title: '禁忌',
    content: '完整正文中才会出现的长句',
    summary: '避免俗套',
    updatedAt: 1,
    source: 'user'
}
```

- [x] **步骤 2：运行测试确认失败**

运行：

```powershell
cd D:\LuminaWeave\luminaweave-extension
npx vitest run src/api/core/__tests__/forge/ForgePiResourceLoader.test.ts --testTimeout=60000
```

预期：当前 bundle 只有 `project-resources.md` 中的记忆数量，没有独立 memory index。

- [x] **步骤 3：实现 Memory Index builder**

在 `buildContextBundle()` 的 `capability-index` 后、`project-resources` 前插入：

```ts
{ path: './.pi/agent/context/memory-index.md', title: '项目长期记忆索引', content: this.buildMemoryIndexFile(context) },
```

新增 helper：

```ts
private buildMemoryIndexFile(context: ForgeRuntimeContext): string {
    const entries = context.forgeMemoryTree.entries.slice(0, 80);
    const rows = entries.map(entry => {
        const path = this.formatMemoryPath(entry.path);
        return [
            `## ${entry.title || path}`,
            `- Path：${path}`,
            `- Source：${entry.source}`,
            `- Updated：${entry.updatedAt}`,
            `- Summary：${entry.summary || '无摘要'}`
        ].join('\n');
    });

    return [
        '# 项目长期记忆索引',
        '',
        '这些是 Forge 项目的长期记忆索引。需要正文时读取对应 ./memory/**/*.md 文件，不要假设索引包含完整内容。',
        '',
        `- 总数：${context.forgeMemoryTree.entries.length}`,
        entries.length < context.forgeMemoryTree.entries.length ? `- 已显示：${entries.length}` : '',
        '',
        ...rows
    ].filter(Boolean).join('\n\n');
}
```

路径格式化保持最小实现：

```ts
private formatMemoryPath(path: string): string {
    const normalized = path.replace(/^\.?\/*/, '').replace(/\.md$/i, '');
    return `./memory/${normalized}.md`;
}
```

- [x] **步骤 4：运行测试确认通过**

运行：

```powershell
cd D:\LuminaWeave\luminaweave-extension
npx vitest run src/api/core/__tests__/forge/ForgePiResourceLoader.test.ts --testTimeout=60000
```

预期：`memory-index.md` 出现在 context bundle 和 system prompt 中，正文仍不默认注入。

## 任务 3：确认 Semantic VFS 正文读取边界

**文件：**
- 检查：`luminaweave-extension/src/api/core/forge/project/ForgeProjectSemanticVfsService.ts`
- 测试：`luminaweave-extension/src/api/core/__tests__/forge/ForgeProjectSemanticVfsService.test.ts`
- 测试：`luminaweave-extension/src/api/core/__tests__/forge/ForgePiToolBridge.test.ts`

- [x] **步骤 1：补或确认正文读取测试**

若现有测试未覆盖，通过 `readFile('./memory/偏好/禁忌.md')` 断言能读取 `ForgeMemoryEntry.content`：

```ts
expect(await semanticVfs.readFile(context, './memory/偏好/禁忌.md')).toContain('完整正文中才会出现的长句');
```

如果 `ForgePiToolBridge.test.ts` 已覆盖工具侧读取，补充断言工具返回同一正文。

- [x] **步骤 2：运行测试**

运行：

```powershell
cd D:\LuminaWeave\luminaweave-extension
npx vitest run src/api/core/__tests__/forge/ForgeProjectSemanticVfsService.test.ts src/api/core/__tests__/forge/ForgePiToolBridge.test.ts --testTimeout=60000
```

预期：memory index 只负责发现性，正文读取仍由 Semantic VFS / `readFile` 负责。

## 任务 4：同步文档与任务状态

**文件：**
- 修改：`docs/overall/modules/forge/index.md`
- 修改：`docs/current/tasks/forge/README.md`

- [x] **步骤 1：更新 Forge 模块文档**

在 Forge 当前状态中写清：

```text
./memory/**/*.md 是长期项目记忆。默认 prompt 编排会包含 ./.pi/agent/context/memory-index.md，列出长期记忆的路径、标题、来源、更新时间和摘要；记忆正文仍通过 Semantic VFS / readFile 按需读取，不默认全量注入 system prompt。
```

- [x] **步骤 2：更新当前任务 README**

把本计划作为第 31 项挂到 `docs/current/tasks/forge/README.md`，并说明第 30 项已完成，真实宿主 walkthrough 仍由第 29 项跟踪。

## 验收标准

- [x] `forgeAgentOrchestration` 类型、内置预设 JSON、预设工作台展示都包含 `memory_index`。
- [x] `ForgePiResourceLoader.buildContextBundle()` 输出 `./.pi/agent/context/memory-index.md`。
- [x] Memory Index 包含每条长期记忆的语义路径、标题、来源、更新时间和摘要。
- [x] Memory Index 不包含 `ForgeMemoryEntry.content` 全文。
- [x] `./memory/**/*.md` 正文仍可通过 Semantic VFS / `readFile` 读取。
- [x] 只修改记忆正文时，不会把完整正文默认注入 system prompt；缓存破坏面限定在索引摘要变化范围。
- [x] Forge 模块文档同步长期记忆的编排边界。

## 验证命令

```powershell
cd D:\LuminaWeave\luminaweave-extension
npx vitest run src/plugins/forge/__tests__/forgePromptPresetPresentation.test.ts src/api/core/__tests__/forge/ForgePiResourceLoader.test.ts src/api/core/__tests__/forge/ForgeProjectSemanticVfsService.test.ts src/api/core/__tests__/forge/ForgePiToolBridge.test.ts --testTimeout=60000
npm run type-check -- --pretty false
```
