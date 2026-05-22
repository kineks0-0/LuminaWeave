# Forge 项目 / 协作线程边界重塑

## 背景

项目中心已经在 UI 上区分“Forge 项目”和“协作线程”，但底层 `ForgeWorkspaceSession` 仍同时承担项目索引、项目资源和线程会话职责，导致新建、删除、切换时容易把项目资源与单条对话混在一起。

## 本轮目标

- 项目作为长期共享资源容器，持有 `forgeProjectId`、workspace path、VFS 项目资源、草稿树、记忆树、评审区和虚拟世界书。
- 协作线程作为项目内的会话分支，持有独立 `id`、`conversationId`、消息世界线和线程级标题。
- 项目标题和线程标题分离：`projectTitle` 随项目资源走，`title` 表示当前协作线程标题；项目中心左列显示 `projectTitle`，右列显示线程 `title`。
- 项目中心页面支持：
  - 删除项目：删除该项目下所有协作线程，并删除项目 VFS。
  - 删除线程：只删除该协作线程，不删除同项目资源和其他线程。
  - 新建线程：在选中项目下创建新的协作线程，并继承项目资源。

## 链路检查

- 输入：项目中心按钮或 store action 提供 `projectId` / `threadId` / 新线程标题。
- 处理流程：UI 只发出意图，`useSessionIndexStore` 统一刷新索引，`ForgeSessionRepository` 负责会话删除、新线程创建与项目资源删除。
- 状态变化：localStorage 只保留线程索引存根；ConversationDocument 仍按线程保存；项目共享资源继续保存在 `/forge/<projectId>`。
- 输出：项目列表和线程列表刷新；当前线程被删除时选中剩余线程或清空；项目删除后不再显示其线程；线程 VFS 路径为 `/workspaces/forge/<projectId>/chat/<conversationId>`，项目中心显示为 `chat/<conversationId>`；线程目录投影 `thread.json` 与 `messages.json`，并在 `/workspaces/chat/<conversationId>` 保持同一份会话快照视图。
- 上下游影响：Forge Agent / VFS / Skill Registry 继续使用 `forgeProjectId` 作为项目资源 owner；生成和 Prompt 语义不改变。

## 验收

- Repository 测试覆盖新建线程、删除线程、删除项目。
- Repository 测试覆盖线程 VFS 投影写入与删除清理。
- Store 测试覆盖项目中心通过索引边界创建/删除线程。
- 项目中心 UI 不直接操作 HAL 或宿主会话，只调用 store / repository 层。
