# Forge Agent Runtime 前端 pi-agent-core 适配计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 Forge Agent Runtime 从“服务端 pi-coding-agent SDK runtime”规划切换为“前端内嵌 `pi-agent-core` + Forge browser adapters”。

**架构：** `pi-agent-core` 只承担 agent loop、session tree、context、skill/tool runtime 的核心语义。Forge 继续拥有 ST 宿主边界、Vue UI、VFS、Review Gate、模型请求、中文技能/能力资源和发布边界。

**技术栈：** Vue 3、Pinia、TypeScript、Forge Core Runtime、VFS、Review Gate、`@earendil-works/pi-agent-core`。

---

## 1. 当前判断

本计划不表示“自己实现完整 `pi-coding-agent`”。更准确的边界是：

- 不引入 `@earendil-works/pi-coding-agent` 到前端。
- 不引入 `@earendil-works/pi-agent-core/node`。
- 使用 `@earendil-works/pi-agent-core` 根入口作为 agent kernel 候选。
- 自实现 Forge browser adapters，替代 `pi-coding-agent` 在 Node runtime 中负责的文件系统、shell、session manager、资源加载和工具执行适配层。

服务端 pi runtime 方案暂停；此前服务端 `/forge/pi/*`、`ForgePiRuntimeService`、server JSONL session tree 与 `@earendil-works/pi-coding-agent` 依赖已经按用户要求还原，不作为当前主路径继续推进。

## 2. 目标结构

```text
Forge Vue UI
  -> ForgeRuntimeOrchestrator
  -> ForgePiCoreRuntime
  -> @earendil-works/pi-agent-core
  -> Forge adapters
      -> Nexus/HAL model adapter
      -> Forge VFS adapter
      -> Review Gate adapter
      -> 中文技能/能力 resource loader
      -> ForgeToolRegistry / typed effects
      -> timeline/staging/session tree persistence
```

保留现有边界：

- Graph 只负责阶段、状态、上下文边界、能力索引、Review Gate 状态。
- pi core 负责本轮 agent loop、技能/能力按需加载、tool calling、tree history。
- 写入工具只能生成 reviewable proposal 或 staging effect，不能静默写真实 ST 世界书。
- `timelineItems` 继续作为 Forge UI 展示层；pi session tree 作为后续 Agent 执行历史事实源候选。

## 3. 文件职责规划

- 修改：`luminaweave-extension/package.json`
  - 增加 `@earendil-works/pi-agent-core`，不得增加 `@earendil-works/pi-coding-agent`。
- 创建：`luminaweave-extension/src/api/core/forge/pi/ForgePiCoreRuntime.ts`
  - 封装 pi core turn 执行、事件转译、session tree 更新。
- 创建：`luminaweave-extension/src/api/core/forge/pi/ForgePiModelAdapter.ts`
  - 将现有 Nexus/HAL generation 适配为 pi core 使用的模型接口。
- 创建：`luminaweave-extension/src/api/core/forge/pi/ForgePiResourceLoader.ts`
  - 从 Forge capability / skill registry、prompt resources、project snapshot 生成 context files 和中文技能资源。
- 创建：`luminaweave-extension/src/api/core/forge/pi/ForgePiToolBridge.ts`
  - 将 pi tool call 映射到 `ForgeToolRegistry`、VFS、Review Gate 和 typed effects。
- 创建：`luminaweave-extension/src/api/core/forge/pi/ForgePiSessionStore.ts`
  - 在 Forge workspace/session 内保存 tree history、active node、loaded skills、tool events。
- 修改：`luminaweave-extension/src/api/core/forge/ForgeRuntimeOrchestrator.ts`
  - 新增或重命名 feature flag 为 `lumina-forge.piCoreRuntimeEnabled`，开启后转发到前端 pi core runtime。
- 修改：`luminaweave-extension/src/plugins/forge/ForgeModelRequestDebugPanel.vue`
  - 显示 pi context bundle、session tree selected node、tool trace、approval trace。
- 修改：`luminaweave-extension/src/stores/useForgeStore.ts`
  - 保存 `piSessionTree / activePiNodeId / piContextBundleSummary / piLoadedSkills / piToolEvents` 等持久化或派生状态。

## 4. 任务步骤

### 任务 1：依赖与 bundling guard

- [x] 添加 `@earendil-works/pi-agent-core` 到 extension 依赖。
- [x] 新增测试，验证前端 bundle 不包含：
  - `@earendil-works/pi-coding-agent`
  - `@earendil-works/pi-agent-core/node`
  - `node:fs`
  - `node:child_process`
  - `node:path`
- [x] 验证 `npm run type-check` 不因依赖引入 Node 类型泄漏。

### 任务 2：实现 ForgePiCoreRuntime 外壳

- [x] 创建 `ForgePiCoreRuntime`，只负责调用 pi core、收集事件、输出 Forge runtime events。
- [x] 输入包含 Forge request、workflow snapshot、project snapshot、review state、active node。
- [x] 输出包含 assistant text、tool events、approval requests、session tree delta、context bundle summary。
- [x] 不在 runtime 内直接解释 Forge 业务写入；写入统一交给 tool bridge。

### 任务 3：实现模型适配

- [x] 创建 `ForgePiModelAdapter`，复用现有 Nexus preset / HAL generation。
- [x] 不在浏览器暴露新的 provider API key 策略。
- [x] 将模型请求 trace 派生到现有 `modelRequestTraces`，保持其瞬态调试定位。

### 任务 4：实现资源与中文技能加载

- [x] 创建 `ForgePiResourceLoader`。
- [x] 将 Forge 阶段状态、写入边界、Review Gate 状态、能力索引、项目资源索引输出为 context files。
- [x] 将 `ForgeCapabilityRegistry`、`ForgeSkillRegistry` 的中文内容作为 skill/resource 暴露。
- [x] 保持 tool id 和 capability id 的英文稳定标识，显示文案使用中文。

### 任务 5：实现工具桥接和 Review Gate

- [x] 创建 `ForgePiToolBridge`。
- [x] 只读工具可直接返回结果：能力搜索、技能列表、读取项目 VFS、只读 shell。
- [x] 写入工具统一生成 `tool_approval_needed` 或 reviewable effect。
- [x] approve 后进入现有 staging -> commit-ready -> freeze 流程。
- [x] reject 后写入 rejected operation，不写项目 VFS，不写真实 ST 世界书。

### 任务 6：接入 Orchestrator 与 Store

- [x] 新增 `lumina-forge.piCoreRuntimeEnabled`，默认关闭。
- [x] flag 开启后 Forge conversation / planner / analyst / executor 走 `ForgePiCoreRuntime`。
- [x] flag 关闭继续走现有 AI SDK tool calling / 旧兼容路径。
- [x] Store 保存 pi session tree、active node、context summary、loaded skills、tool event 派生状态。

### 任务 7：调试面板与 Prompt Preview

- [x] 模型请求调试面板显示 pi context bundle、tool call/result、approval、session node。
- [x] Prompt Preview 显示 Graph guidance 与 pi 实际加载的 skill / capability 差异。
- [ ] Inline trace 从 pi tool events 派生 operation item。

## 5. 测试计划

```powershell
cd D:\LuminaWeave\luminaweave-extension
npm run type-check
npx vitest run src/api/core/__tests__/ForgePiCoreRuntime.test.ts
npx vitest run src/api/core/__tests__/ForgePiResourceLoader.test.ts
npx vitest run src/api/core/__tests__/ForgePiToolBridge.test.ts
npx vitest run src/api/core/__tests__/ForgeRuntimeOrchestrator.pi-core.test.ts
npx vitest run src/stores/__tests__/useForgeStore.test.ts
```

新增测试重点：

- `pi-agent-core` 根入口可打包，Node-only 子路径不可进入 bundle。
- session tree 的 `id / parentId / activeNodeId` 分支关系正确。
- context files 包含阶段状态、写入边界、Review Gate 状态、能力索引。
- skill/resource 加载使用中文展示文案，但稳定 id 不变。
- 写入工具只进入 Review Gate，不直接写 ST 世界书。
- reject 不产生 staging 写入；approve 进入现有 staging 流程。
- flag 关闭不影响现有 tool calling 路径。

## 6. 验收标准

- `README.md` 与进度看板不再把服务端 pi runtime 当作当前主路径。
- 后端不新增 pi 依赖、路由、JSONL session 服务或 `ForgePiRuntimeService`。
- 前端未引入 `@earendil-works/pi-coding-agent`。
- 打开 `lumina-forge.piCoreRuntimeEnabled` 后，Forge Agent 请求可以通过前端 pi core runtime 产生 tool trace 和 Review Gate proposal。
- 真实 ST 世界书不会被未确认工具调用静默写入。

## 7. 假设与未验证前提

- `@earendil-works/pi-agent-core` 根入口继续保持浏览器可打包。
- pi core 暴露的 harness / loop 接口足以由 Forge 提供自定义模型、资源和工具适配。
- 现有 Forge VFS、Review Gate、timeline、staging、Prompt Preview 可以承接 pi event 派生状态。
- 官方 pi 文档未来可能调整，本地调研快照仅作为 2026-05-20 的决策依据，不替代官方文档。

## 8. 当前实现备注

- `ForgePiModelAdapter` 已接入现有 Nexus preset 解析、API 配置读取、`globalNexusOrchestrator.getModelForNode()` 和 AI SDK `streamText()`。
- pi context files 会作为模型 system prompt 的结构化上下文片段注入；这属于 Forge browser adapter 的临时桥接形态，后续可替换为更贴近 pi core resource loader 的上下文接口。
- 默认 runtime 在可解析 Nexus 节点时走真实模型适配；无节点时保留占位 fallback，用于配置缺失时的诊断文本。
- `ForgePiToolBridge` 已缓存 pending approval tool call；approve 后执行原工具并收集 reviewable effects，reject 后只发 `tool_approval_resolved`，不执行工具、不产生 staging 写入。
- `ForgePiCoreRuntime.resolveToolApproval()` 会把 approval resolution 和 approved tool result 追加到 pi session tree；`ForgeRuntimeOrchestrator.resolveToolApproval()` 已优先兼容旧 AI SDK approval resume，再转发 pi-core approval resolution。
- `ForgeModelRequestDebugPanel` 已新增 pi-core 页签，展示 context files、active session node、tree rows、loaded skills 和 extensions。
- `ForgePromptPreview` 的 Agent 页已新增 pi-core 实际加载区，展示 Graph 建议 skill 与 pi 实际加载 skill 的共同项和差异项。
