# LuminaWeave 存储与数据说明

LuminaWeave 当前不是统一 SQLite schema 项目。数据分布在 SillyTavern 宿主、extension store/local fallback、后端本地数据目录、ConversationDocument、事务日志、Resource/VFS 与 Forge workspace 中。

本文记录每类数据的事实源、写入者、读取者和 Git 策略。

## 1. 总览

| 数据 | 事实源 | 写入者 | 读取者 | Git 策略 |
| ---- | ---- | ---- | ---- | ---- |
| ST 原生聊天与资源 | SillyTavern 宿主 | ST / adapter 写回 | host driver / HAL | 不由本仓提交 |
| `ConversationDocument` | Lumina 独立存储 | Conversation / Persistence / Bridge | Chat、Timeline、Forge、同步服务 | 用户数据不提交 |
| 事务日志 `.tx.jsonl` | Lumina 独立存储 | Transaction/Persistence 链路 | 重连、对账、回滚 | 用户数据不提交 |
| Runtime extension store | IndexedDB / Tauri SQLite / 宿主 KV | HAL runtime store / storage service | extension runtime | 用户数据不提交 |
| `localStorage` fallback | 浏览器本地轻量索引 | Local/HTTP bridge fallback | 本地运行路径 | 不由 Git 管理 |
| server `data/` | `luminaweave-server/data/` | server services | server services | 禁止提交 |
| Resource Ref / VFS | Resource Domain 的路径化视图 | ResourceService / VFS / shell | HAL、Prompt、Forge、Terminal | 视底层资源而定 |
| Forge VFS 当前文件树 | lightning-fs `/forge/<projectId>/...` | ForgeWorkspaceWriteService / shell workspace | Forge UI、Agent、Prompt | 用户数据不提交，历史交给工作区 Git |
| Forge Git 历史 | lightning-fs `/forge/<projectId>/.git` | ForgeWorkspaceGitService / just-git | 文件版本面板、restore、diff | 用户数据不提交 |
| Forge `piSession` | Runtime extension store `lumina.forge / pi-sessions` | ForgeSessionRepository / Forge runtime | Forge UI、Prompt Preview、Debug 面板 | 用户数据不提交 |

## 2. ConversationDocument

`ConversationDocument` 是统一会话文件契约，用于承载主聊天和 Forge 会话的消息树、活跃叶子、插件数据和事务游标。

- 事实源：Lumina 独立存储中的会话文档。
- 写入者：Conversation/Persistence/Bridge 相关服务。
- 读取者：Chat、Timeline、Forge、ConversationDomainService、同步服务。
- 迁移策略：legacy `chat_*.jsonl` 与 Forge 旧会话结构在读取时迁移为统一 DTO，首次写入后落新格式。
- 边界：ST 当前活跃聊天仍可能参与物理同步；非当前 ST 活跃聊天默认读取 Lumina 独立存储视图。

## 3. 事务日志

事务日志用于幂等、序列对账、重连补偿与回滚。

- 状态机：`pending -> running -> committed | aborted | rolled_back`。
- 关键字段：事务 ID、序列、scope、payload digest、错误信息、last committed seq。
- 写入时机：生成收口、保存、patch、回滚等事务边界。
- 恢复方式：重连后按序列拉取未确认事务，必要时回滚悬挂事务并按新序列重试。

## 4. Runtime extension store 与 localStorage fallback

HAL runtime 对外提供 extension store 能力。不同宿主映射到不同物理实现：

- 浏览器 / standalone-local 使用 IndexedDB backed store。
- 普通 Tauri runtime 使用 SQLite backed runtime store。
- SillyTavern / TavernHelper 路径由对应 adapter 封装；不具备新 runtime store 能力时才走宿主 KV fallback。

业务层不应直接散落访问物理 KV；应通过 HAL runtime store 或领域 service 进入。`localStorage` 只保留启动前必需的轻量索引和 Forge 会话存根，不保存完整 Forge 会话树、tool result 或 VFS 文件内容。

## 5. Resource Ref 与 VFS

Resource Domain 使用稳定 `ResourceRef` 描述资源来源：

- `sourceId`
- `resourceType`
- `resourceId`
- `revision`
- `path`
- `writable`
- `origin`
- `forkedFrom`

VFS 是 Resource Domain 的路径化视图，不是第二份事实源。典型路径：

```text
/sources/<sourceId>/...
/library/...
/workspaces/forge/<projectId>/...
/workspaces/chat/<conversationId>/...
```

外部资源写入必须经过 Resource Write Policy。ST 或订阅源等外部资源不得被静默改写；需要写回或 fork 时必须显式选择策略。

## 6. Forge workspace

Forge 项目以 `forgeProjectId` 为长期容器，`conversationId` 只是项目内的一条协作线程。

Forge VFS 持久化只保存当前文件树，行为等同普通文件系统。版本历史、diff 和恢复由同一 lightning-fs 文件树内的 Git 仓库负责。

典型语义路径：

```text
/workspaces/forge/<projectId>/project.json
/workspaces/forge/<projectId>/lorebook/entries/*.md
/workspaces/forge/<projectId>/memory/**/*.md
/workspaces/forge/<projectId>/.forge/agent/SYSTEM.md
/workspaces/forge/<projectId>/.git/...
```

Forge 生成、审阅和冻结默认落在虚拟工作区；发布到真实 ST 世界书或导出是后置动作。

关键边界：

- `ShellWorkspaceService` 只维护项目绑定和工作区入口，不生成包含所有文件内容的 JSON 版本快照。
- `ForgeWorkspaceWriteService` 是工具写入、bash 写入和手动 VFS 编辑的统一入口：先写当前 VFS，再在有文件变化时提交 Git commit。
- `ForgeWorkspaceGitService` 负责 init、status、commit、log、diff、restore；文件版本面板只读取 Git log/diff。
- 对话内“AI 更改文件”只读取本轮工具执行产生的 `ForgeTurnWorkspaceWriteSummary.changedFiles`，不从 Git log 推断。
- Forge Agent `bash` 的 `network-request` 缺少 network grant 时在 `beforeToolCall` 阶段生成 `tool_approval_needed`，通过 Composer 覆盖态等待用户批准；等待授权不作为非失败 `tool_result` 返回给 Agent。pending 网络授权必须绑定 `forgeProjectId / conversationId / sessionId`，Composer 只展示当前协作线程的授权项。用户选择“允许此域名”时保留同域名 `urlPrefix` grant，使同一协作线程后续同域名请求自动通过；选择“后续都允许”时保留 `allNetwork` grant，使同一协作线程后续所有符合网络策略的请求自动通过。点击批准或拒绝后 Composer 立即关闭授权覆盖态；批准后执行原始 `curl`，`curl -o/-O/-c/-T/-F` 文件输入输出停留在 Forge 语义 VFS，写入结果仍由 `ForgeWorkspaceWriteService` 记录为当前文件树变化。
- `./memory/**/*.md` 与 `./lorebook/entries/*.md` 写入后通过领域投影更新 Forge memory tree 与 virtual lorebook entries。

## 7. Forge `piSession`

Forge 会话索引和完整 Agent 会话树分离：

- `localStorage` 只保留 Forge 会话索引、标题、`projectId`、`conversationId`、`workspacePath` 和更新时间。
- 完整 `piSession` 保存在 runtime extension store 的 `lumina.forge / pi-sessions` 表。
- `piSession.entries` 保留 user、assistant、process、tool_call、tool_result、approval、context_bundle、checkout 等 Agent 过程；`tool_result` payload 不瘦身。
- 文件写入版本信息不进入 `piSession` 版本快照；写入摘要只作为当前轮 tool result payload 的一部分保存。

## 8. 存储占用管理

设置面板的“存储”分组按来源展示占用：

- 设置项目。
- Forge VFS 当前文件。
- Forge Git 历史。
- Forge Agent 会话。
- Resource Runtime。
- 其他 runtime 内容。

每项展示后端、来源、估算占用和记录数，并提供导入、导出、重置入口。早期开发阶段不迁移旧 Forge 快照或旧审计数据；旧数据通过对应存储项重置清理。

## 9. server data

`luminaweave-server/data/` 是本地数据目录，可能包含用户配置、生成状态、缓存或会话数据。

- 禁止提交该目录下的用户数据。
- 后端真实源码在 `luminaweave-server/src/`。
- 根级 `luminaweave-server/index.js` 是构建产物。

## 10. 文档更新要求

以下变化必须同步更新本文：

- 新增持久化格式。
- 变更 `ConversationDocument`、事务日志或迁移策略。
- 新增 VFS 路径或 Resource Ref 字段。
- 修改外部资源写入策略。
- 改变 server data 目录或构建产物策略。
