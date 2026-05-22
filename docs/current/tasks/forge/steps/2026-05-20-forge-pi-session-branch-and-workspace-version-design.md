# Forge pi session 分支与工作区版本设计

## Summary

Forge 协作线程内的 fork / 回滚 / 切换不创建新的 Forge thread，也不复制新的 workspace session。它们基于同一个 pi-style session tree 的 `id / parentId` 分支完成。

最终边界：

```text
Forge 协作线程 = 一个 pi session
pi session tree = 持久化与恢复事实源
Forge timeline = 面向用户的 UI 投影
Forge workspace version manager = 文件 / VFS / staging / 虚拟世界书版本管理
```

用户在 timeline 上发起回滚或分支时，timeline 只负责把被点击节点映射回 pi node，并向 runtime 发送 checkout / branch 意图。文件状态是否恢复由 Forge workspace version manager 询问用户，不自动强制恢复。

## Core Semantics

### 1. Fork 是当前线程内分支

Forge 插件中的 fork 语义对标 pi 的 tree navigation / branch，不对标 pi 的 `/fork` 新 session 文件。

```text
错误语义：
fork -> 新 Forge 协作线程
fork -> 新 workspace session

目标语义：
fork -> 当前 pi session tree 内，从某个 node 继续生成一个 sibling branch
```

### 2. 回滚 / 分支优先基于用户请求节点

最稳定的用户可操作分支点是 `user` entry。用户选择一条历史请求时：

```text
选中 user node
-> activeNodeId = user.parentId
-> user.content 放回输入框
-> 用户可修改后重新发送
-> 新 user message 作为 sibling branch 写入同一 pi session tree
```

如果用户选择 assistant / tool / staging proposal 节点，可以执行 checkout 查看该节点所在分支；若要“从这里重新生成”，UI 应定位到最近的 user node 或该 user 的 parent。

### 3. pi session tree 是持久化事实源

持久化应使用 flat append-only entries，而不是保存嵌套 children。

```ts
interface ForgePiSessionEntry {
  id: string;
  parentId: string | null;
  sessionId: string;
  type:
    | 'message'
    | 'context_bundle'
    | 'tool_call'
    | 'tool_result'
    | 'approval'
    | 'staging_proposal'
    | 'workspace_patch'
    | 'workspace_checkpoint'
    | 'branch_summary'
    | 'label'
    | 'session_info';
  createdAt: number;
  payload: ForgePiSessionEntryPayload;
}
```

`children`、timeline rows、console messages、review state 和 debug summary 都是 projection。

### 4. Forge timeline 是 UI 投影

Forge timeline 基于 pi session tree 转换生成，允许丢弃、合并或重组部分节点。

可以重组：

- 多个 `tool_result` 合并为“读取了 N 个项目文件”。
- `assistant text + tool events` 合并为一条执行摘要。
- `context_bundle` 默认不出现在主 timeline，只进入调试面板。

必须保留可操作节点：

- `user` input node。
- `approval` node。
- `staging_proposal` node。
- `workspace_patch / workspace_checkpoint` node。
- `branch_summary / label` node。

timeline item 必须保留 pi origin：

```ts
interface ForgeTimelinePiOrigin {
  runtime: 'forge-pi';
  sessionId: string;
  nodeId: string;
  parentNodeId: string | null;
  entryType: ForgePiSessionEntry['type'];
  toolCallId?: string;
}
```

### 5. 文件版本由 Forge 扩展层负责

pi 官方 coding-agent 的 session tree 不自动还原文件；官方示例通过 `git-checkpoint` extension 在 `turn_start` 创建 stash，并在 `session_before_fork` 询问是否恢复代码。

Forge 不使用 git 作为主路径，应实现等价的 browser workspace version manager：

```text
workspace_patch entry
  -> 记录路径、操作类型、before/after hash、blob ref

workspace_checkpoint entry
  -> 记录 nodeId、fileTreeHash、stateSnapshotRef
```

切换分支时默认不强制恢复文件，应询问用户：

```text
已切换到该对话分支。是否同时恢复项目文件到当时状态？

[仅切换对话] [恢复文件版本] [查看差异]
```

## Data Flow Check

### 输入

- 用户发送 Forge 消息。
- pi runtime 产生 user / assistant / tool / approval / staging / workspace patch entries。
- 用户在 Forge timeline 或 session tree 上选择节点。
- 用户选择是否恢复文件版本。

### 处理流程

```text
run turn
  -> append pi session entries
  -> append workspace patch/checkpoint entries when tools propose or apply workspace changes
  -> project current branch into timeline / console / review / inspector
  -> persist ForgeWorkspaceSession

checkout / branch
  -> resolve timeline origin.nodeId
  -> runtime checkout activeNodeId
  -> rebuild active branch
  -> project UI state
  -> ask whether to restore workspace files
  -> if accepted, materialize workspace from checkpoint + patches
```

### 状态变化

- `piSession.activeNodeId` 切换到目标节点或目标 user 的 parent。
- `piSession.entries` 只追加，不删除旧分支。
- `timelineItems` 从 active branch projection 重建或刷新。
- `review/staging/virtualLorebook` 从 active branch + workspace version projection 派生。
- `modelRequestTraces` 保持瞬态调试状态，不参与长期恢复。

### 输出

- 用户看到当前 active branch 的 Forge 聊天记录。
- timeline 展示用户可理解的操作历史，并保留可回溯的 pi origin。
- Review Panel 只显示当前 branch 相关的 approval / staging。
- 文件版本面板展示当前 branch 对应的 VFS / staging / 虚拟世界书版本和 diff。

### 上游影响

- `ForgePiSessionManager` 需要持久化 flat entries，而不是只返回瞬态 tree snapshot。
- `ForgeWorkspaceSession` 需要保存 pi session entries、active node、labels 和 workspace version refs。
- `ForgeRuntimeActionController` 需要把 timeline action 转成 runtime checkout / branch intent。

### 下游影响

- `ForgeModelRequestDebugPanel` 可以继续显示完整 pi tree 和 provider trace，但不作为事实源。
- `ForgeInlineTrace` 和 timeline projection 需要使用 `origin.nodeId` 保留可操作映射。
- `ForgeReviewPanel` 需要按 active branch 过滤 approval / staging。
- 文件版本辅助面板需要独立展示 patch/checkpoint history，并提供单文件或整分支恢复。

## Implementation Plan

### 任务 1：类型与持久化格式

- [ ] 在 shared/types 中定义 `ForgePiSessionEntry` union。
- [ ] 在 `ForgeWorkspaceSession` 中新增 `piSession` 持久化字段。
- [ ] 保持 `ForgePiTreeNode` 为 UI projection，不作为持久化格式。
- [ ] 增加 session version / migration，旧会话无 `piSession` 时创建 bootstrap entries。

### 任务 2：Session Manager 持久化化

- [ ] `ForgePiSessionManager` 从 in-memory nodes 改为 flat append-only entries。
- [ ] 实现 `getBranch(nodeId)`、`getTree()`、`buildAgentMessages(nodeId)`。
- [ ] 实现 `checkout(nodeId)`。
- [ ] 实现 `createBranchFromUserNode(userNodeId)`，返回可编辑 input。

### 任务 3：Timeline projection

- [ ] 新增 `ForgePiTimelineProjector`。
- [ ] 将 pi entries 转为 `ForgeTimelineItem[]`。
- [ ] timeline item 增加 `origin: ForgeTimelinePiOrigin`。
- [ ] 保证 `user`、approval、staging、workspace patch/checkpoint 节点可操作且不被投影丢弃。

### 任务 4：Workspace version manager

- [ ] 定义 `workspace_patch` 和 `workspace_checkpoint` payload。
- [ ] 写入工具产生 patch/checkpoint entry。
- [ ] 实现从 checkpoint + patch replay 物化当前 branch workspace。
- [ ] 切换分支时询问用户是否恢复文件版本。
- [ ] 辅助面板展示文件版本树、单文件历史和 branch diff。

### 任务 5：UI action 接入

- [ ] timeline 节点增加“切换到此处”、“从这里分支”、“查看文件版本”动作。
- [ ] `ForgeRuntimeActionController` 根据 timeline origin 调用 runtime。
- [ ] Chat console 从 active branch projection 显示。
- [ ] Review Panel 从 active branch projection 显示。

### 任务 6：恢复与迁移验证

- [ ] 刷新后恢复 active branch。
- [ ] 切换 branch 后聊天、timeline、review、virtual lorebook 一致。
- [ ] 选择“不恢复文件”时只切对话分支。
- [ ] 选择“恢复文件版本”时 VFS/staging/virtual lorebook 物化到目标分支。

## Test Plan

- `ForgePiSessionManager.test.ts`
  - append flat entries。
  - getTree 根据 parentId 重建 children。
  - getBranch 只返回 root 到 active node。
  - checkout 不删除旧分支。
  - user node branch 返回可编辑 input。

- `ForgePiTimelineProjector.test.ts`
  - tool/result 可以合并展示。
  - user / approval / staging / workspace patch 节点保留 origin。
  - timeline action 可解析回 pi nodeId。

- `ForgeWorkspaceVersionManager.test.ts`
  - patch/checkpoint 写入。
  - 从最近 checkpoint replay。
  - checkout 时不自动恢复文件。
  - 用户选择恢复后物化 VFS 状态。

- `ForgeWorkspaceSessionService.test.ts`
  - serialize / hydrate 保留 pi session entries 和 active node。
  - 旧 session migration 创建 bootstrap pi session。

- UI / integration:
  - 同一协作线程内从历史 user 请求分支。
  - 切回旧分支。
  - Review Panel 不显示其他分支 pending approval。
  - 文件版本面板能展示 branch-local diff。

## Assumptions

- “fork” 在 Forge UI 中指同一协作线程内的 session tree 分支，不创建新线程。
- `timelineItems` 可以作为 projection/cache 保存，但恢复时应优先从 `piSession.entries` 重建。
- 文件版本恢复不自动执行，必须询问用户。
- `modelRequestTraces` 保持前端瞬态调试用途，不进入长期事实源。
- 真实 ST 世界书仍不被静默写入；发布/导出继续是用户确认后的后置动作。
