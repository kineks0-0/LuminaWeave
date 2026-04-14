# Forge 制卡系统架构重构设计（2026-04-14）

> 分类：架构重构
> 状态：设计完成，待实施

本文档描述 Lumina Forge 制卡系统的架构重构方案，目标是将单体 CardMakerStore（2282 行）拆分为职责单一的服务模块，并引入三角色上下文隔离与世界线快照回滚能力。

---

## 1. 现状问题

### 1.1 CardMakerStore 膨胀

`src/plugins/forge/CardMakerStore.ts`：
- **2282 行**，74 个公共成员（30+ state refs + 8 computed + 44 methods）
- 承担 7 类职责：会话管理 / 结构化表单 / 记忆系统 / 世界书操作 / 时间线与世界线 / 运行时执行 / 预设管理
- 被 29 个文件导入（15 个 Forge Vue 组件 + 8 个 block 组件 + 3 个 store + composable + 外部组件 + AgentController）
- `applyRuntimeEffects()` 是一个 ~170 行的 switch 语句，处理 23+ 种 effect 类型
- `ensureRuntimeOrchestrator()` 通过 10 个回调函数桥接 ForgeRuntimePort

### 1.2 职责重叠

- **ForgeAgentController**（365 行）与 **ForgeRuntimeOrchestrator**（537 行）存在重复：
  - `resolveOriginalContent` 在两处独立实现（CardMakerStore:1205, AgentController:72）
  - 操作展示解析（`resolveRunningOperationPresentation` / `resolveCompletedOperationPresentation`）两处重复
  - `stageDraftEntry`（AgentController:262）与 orchestrator 的 `upsert_staging_entry` effect 功能重复
- ForgeAgentController 同时承担：事件监听、条目暂存、操作追踪、意图路由、隔离重写 —— 职责混杂

### 1.3 上下文无隔离

当前四个模型角色（planner / conversation / analyst / executor）共享同一个 `ForgeRuntimeContext`（23 个字段的平铺结构），无法按角色裁剪上下文：
- 主模型不需要世界书条目全文
- 执行者不需要完整对话历史
- 分析者不需要 UI 状态

### 1.4 世界线无快照

`worldlineNodes` 是消息图的主干，但**每个节点不存储工作区快照**：
- 无法回滚到某个历史节点的世界书 / 暂存区 / 表单状态
- 分支操作只影响消息树，不影响工作区内容

### 1.5 数据模型分裂

`StagingEntry` 与 `ForgeDraftNode` 是两套并行结构，分别追踪提议内容的不同生命周期阶段，增加了维护成本。

---

## 2. 目标架构

### 2.1 分层总览

```
┌─────────────────────────────────────────────────────────────┐
│  Vue UI Layer (38 个组件，零修改)                            │
│  useCardMakerStore() → facade，公共 API 不变                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  CardMakerStore (瘦协调层 ~900 行)                          │
│  Pinia state refs + computed + 命令分发 + 流处理             │
│  ┌──────────────────────────────────────────────┐           │
│  │ ForgeEffectReducer    ← applyRuntimeEffects  │           │
│  │ ForgeFormController   ← 表单 CRUD + 验证     │           │
│  │ ForgeSessionController← 会话生命周期         │           │
│  │ ForgeWorldlineManager ← 节点导航 + 快照回滚  │           │
│  │ ForgeContextBroker    ← 三角色上下文裁剪     │           │
│  └──────────────────────────────────────────────┘           │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  ForgeRuntimeOrchestrator (现有，简化 port 接口)            │
│  ForgeWorkflowGraph (现有，保持不变)                        │
│  ForgeExecutionGateway (现有，保持不变)                     │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 新增服务职责

| 服务 | 职责 | 来源 |
|------|------|------|
| **ForgeEffectReducer** | 纯函数，处理所有 23+ 种 ForgeRuntimeEffect | 从 CardMakerStore:1332-1508 提取 |
| **ForgeFormController** | 表单蓝图创建、字段绑定、校验、提交、XML 生成 | 从 CardMakerStore 提取 ~400 行 |
| **ForgeSessionController** | 会话 CRUD、序列化、恢复、重置 | 从 CardMakerStore 提取 ~250 行 |
| **ForgeWorldlineManager** | 节点切换、分支、回滚 + **新增**快照存储 | 从 CardMakerStore 提取 ~60 行 + 新增 ~200 行 |
| **ForgeContextBroker** | 三角色上下文视图生成 + 统一 `resolveOriginalContent` | 全新 ~200 行 |

### 2.3 ForgeAgentController 精简

365 行 → ~60 行，只保留流式传输期间的 UI 反馈事件桥接。重复逻辑移入对应服务。

---

## 3. 三角色上下文隔离

### 3.1 角色定义

| 角色 | promptMode 映射 | 上下文范围 |
|------|-----------------|------------|
| **Main** (主模型) | planner / conversation | 完整记忆 + 世界书概述（不含全文）+ 全部对话 |
| **Analyst** (分析者) | analyst | 完整记忆 + 最近 N 条对话 + 按需拉取条目 |
| **Executor** (执行者) | executor | 过滤记忆片段 + 任务指令 + 目标条目 |

### 3.2 类型定义

```typescript
// src/types/ForgeContextTypes.ts

export type ForgeModelRole = 'main' | 'analyst' | 'executor';

export interface ForgeMainModelContext {
    role: 'main';
    conversationMessages: CleanedMessage[];
    memoryTree: ForgeMemoryTree;
    workflowSnapshot: ForgeWorkflowSnapshot;
    structuredState: ForgeStructuredState;
    draftTree: ForgeDraftTree;
    lorebookOverview: string;          // 条目数 + 类型汇总，不含全文
    stagingEntries: StagingEntry[];
    commitReadyEntries: StagingEntry[];
}

export interface ForgeAnalystContext {
    role: 'analyst';
    memoryTree: ForgeMemoryTree;
    recentHistory: CleanedMessage[];   // 最近 N 条
    requestedEntries: ForgeVirtualLorebookEntry[];
    handoffTarget: string;
}

export interface ForgeExecutorContext {
    role: 'executor';
    task: ForgeExecutorTask;
    filteredMemory: ForgeMemoryEntry[];
}

export interface ForgeExecutorTask {
    instruction: string;
    targetEntryId: string;
    originalContent: string;
    entryType: string;
    description: string;
    layer: ForgeLayer;
}

export type ForgeRoleContext =
    | ForgeMainModelContext
    | ForgeAnalystContext
    | ForgeExecutorContext;
```

### 3.3 执行者记忆过滤

防止 Executor 丢失意图的关键：主模型每轮将意图写入 `session/intent` 记忆路径。

```typescript
// ForgeContextBroker 内部
const EXECUTOR_MEMORY_PATHS = [
    'AUTO/Checklist',       // 全局进度
    'session/intent',       // 主模型写入：当前用户意图
    'user/preferences',     // 用户偏好
];

function buildExecutorMemory(
    memoryTree: ForgeMemoryTree,
    activeLayer: ForgeLayer
): ForgeMemoryEntry[] {
    return memoryTree.entries.filter(e =>
        EXECUTOR_MEMORY_PATHS.some(p => e.path.startsWith(p)) ||
        e.path.startsWith(activeLayer + '/')
    );
}
```

---

## 4. 世界线快照与回滚

### 4.1 快照数据结构

```typescript
// 追加到 src/types/SessionTypes.ts

export interface ForgeWorldlineSnapshot {
    nodeId: string;
    createdAt: number;
    virtualLorebookEntries: ForgeVirtualLorebookEntry[];
    commitReadyEntries: StagingEntry[];
    stagingEntries: StagingEntry[];
    structuredState: ForgeStructuredState;
    draftTree: ForgeDraftTree;
    memoryTree: ForgeMemoryTree;
    workflowSnapshot: ForgeWorkflowSnapshot;
    activeLayer: ForgeLayer;
    completedLayers: ForgeLayer[];
}
```

### 4.2 ForgeWorldlineManager API

```typescript
interface ForgeWorldlineManager {
    /** 每次新消息节点创建时自动快照 */
    captureSnapshot(nodeId: string): void;
    /** 回滚到指定节点并恢复快照 */
    rollbackWithSnapshot(nodeId: string): Promise<boolean>;
    /** 从指定节点分支（保留快照） */
    branchFrom(nodeId: string): string;
    /** 获取快照（用于 UI 预览对比） */
    getSnapshot(nodeId: string): ForgeWorldlineSnapshot | null;
}
```

### 4.3 快照存储

- 内存：`Map<string, ForgeWorldlineSnapshot>`
- 持久化：随 `ForgeWorkspaceSession` 序列化/反序列化
- `ForgeWorkspaceSessionService.serialize/hydrate` 需要包含快照 Map

---

## 5. Codex 风格操作 UI

### 5.1 类型扩展

```typescript
// 追加到 src/types/ForgeTimelineTypes.ts

export interface ForgeOperationSubStep {
    id: string;
    label: string;
    status: ForgeTimelineOperationStatus;
    detail?: string;
    timestamp: number;
}

// ForgeTimelineOperationItem 追加：
role?: ForgeModelRole;
subSteps?: ForgeOperationSubStep[];
```

### 5.2 渲染逻辑

```
ForgeTimeline
├── ForgeTimelineMessageRow
└── ForgeTimelineOperationRow (扩展)
    ├── 角色 badge (main / analyst / executor)
    ├── 状态 spinner → checkmark / cross
    ├── 标题 + 摘要（完成后折叠）
    └── [展开] ForgeSubStepList
        ├── ○ 读取记忆 AUTO/Checklist
        ├── ✓ 分析完成
        └── ● 写入条目 aesthetic_program [running]
```

---

## 6. 服务设计模式

### 6.1 依赖注入（防循环导入）

所有新服务通过 `Deps` 接口接收依赖，**不导入 CardMakerStore**：

```typescript
interface FormControllerDeps {
    getStructuredState(): ForgeStructuredState;
    setStructuredState(state: ForgeStructuredState): void;
    getTransientSelections(): Map<string, string | string[]>;
    getActiveLayer(): ForgeLayer;
    setActiveLayer(layer: ForgeLayer): void;
    // ...
}

class ForgeFormController {
    constructor(private deps: FormControllerDeps) {}
}
```

### 6.2 响应性保护

Deps 使用 getter 函数而非直传 Vue ref，确保每次访问都读取当前响应式值：

```typescript
// CardMakerStore 中构造 deps
const formDeps: FormControllerDeps = {
    getStructuredState: () => structuredState.value,  // 每次调用读 .value
    setStructuredState: (s) => { structuredState.value = s; },
    // ...
};
```

### 6.3 Facade 模式（零破坏性变更）

CardMakerStore 的 `return` 语句保持不变，所有 Vue 组件继续使用 `useCardMakerStore()`，不需要任何修改。

---

## 7. 实施顺序

| 阶段 | 内容 | 风险 | 依赖 |
|------|------|------|------|
| Phase 1 | 新增类型定义 | 零 | 无 |
| Phase 2 | ForgeEffectReducer | 最低 | Phase 1 |
| Phase 3 | ForgeFormController | 中 | Phase 1, 2 |
| Phase 4 | ForgeSessionController | 中 | Phase 3 |
| Phase 5 | ForgeWorldlineManager + 快照 | 中高 | Phase 4 |
| Phase 6 | ForgeContextBroker | 低 | Phase 1 |
| Phase 7 | 精简 CardMakerStore | 高 | Phase 2-6 |
| Phase 8 | 整合 ForgeAgentController | 中 | Phase 7 |

每个阶段完成后必须通过 `npm run type-check && npm run test`。

---

## 8. 文件清单

### 新增文件

| 文件 | 职责 |
|------|------|
| `src/types/ForgeContextTypes.ts` | 三角色上下文类型 |
| `src/api/core/ForgeEffectReducer.ts` | Effect 处理纯函数 |
| `src/api/core/ForgeFormController.ts` | 表单逻辑控制器 |
| `src/api/core/ForgeSessionController.ts` | 会话生命周期控制器 |
| `src/api/core/ForgeWorldlineManager.ts` | 世界线管理 + 快照 |
| `src/api/core/ForgeContextBroker.ts` | 三角色上下文裁剪 |
| `src/api/core/forgeConstants.ts` | 共享常量 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/plugins/forge/CardMakerStore.ts` | 2282 → ~900 行 |
| `src/api/core/ForgeAgentController.ts` | 365 → ~60 行 |
| `src/api/core/ForgeRuntimeOrchestrator.ts` | 简化 port 接口 |
| `src/types/ForgeTimelineTypes.ts` | 追加 role / subSteps |
| `src/types/SessionTypes.ts` | 追加 ForgeWorldlineSnapshot |
| `src/api/core/ForgeWorkspaceSessionService.ts` | 序列化快照 |

### 不变文件

- 38 个 Vue 组件（facade 模式保持 store API 不变）
- `src/stores/useForgeStore.ts`（已足够聚焦）
- `src/api/core/ForgeExecutionGateway.ts`（已足够干净）
- `src/api/core/ForgePromptContextService.ts`（保持现状）
- `src/api/core/ForgeWorkflowGraph.ts`（保持现状）

---

## 9. 后续演进（本次不实施）

1. **ForgeRoleRouter** — 多角色 Turn 编排，支持 `analyst → main → executor` 链式执行
2. **StagingEntry / ForgeDraftNode 统一** — 合并为单一数据模型
3. **ForgeContextBroker 接入 PromptBuilder** — 让不同角色的 prompt 使用裁剪后的上下文
4. **快照增量存储** — 避免大量全量快照占用存储空间
