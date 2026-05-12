# LuminaWeave 存储与数据说明

LuminaWeave 当前不是统一 SQLite schema 项目。数据分布在 SillyTavern 宿主、extension store/local fallback、后端本地数据目录、ConversationDocument、事务日志、Resource/VFS 与 Forge workspace 中。

本文记录每类数据的事实源、写入者、读取者和 Git 策略。

## 1. 总览

| 数据 | 事实源 | 写入者 | 读取者 | Git 策略 |
| ---- | ---- | ---- | ---- | ---- |
| ST 原生聊天与资源 | SillyTavern 宿主 | ST / adapter 写回 | host driver / HAL | 不由本仓提交 |
| `ConversationDocument` | Lumina 独立存储 | Conversation / Persistence / Bridge | Chat、Timeline、Forge、同步服务 | 用户数据不提交 |
| 事务日志 `.tx.jsonl` | Lumina 独立存储 | Transaction/Persistence 链路 | 重连、对账、回滚 | 用户数据不提交 |
| `extensionStore` | 宿主或 bridge 提供的 KV | bridge / storage service | extension runtime | 用户数据不提交 |
| `localStorage` fallback | 浏览器本地存储 | Local/HTTP bridge fallback | 本地运行路径 | 不由 Git 管理 |
| server `data/` | `luminaweave-server/data/` | server services | server services | 禁止提交 |
| Resource Ref / VFS | Resource Domain 的路径化视图 | ResourceService / VFS / shell | HAL、Prompt、Forge、Terminal | 视底层资源而定 |
| Forge workspace | `/workspaces/forge/<projectId>/...` | Forge service / shell workspace | Forge UI、Agent、Prompt | 用户数据不提交 |

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

## 4. extensionStore 与 localStorage fallback

bridge 层对外提供 extension store 能力。不同宿主可能映射到不同物理实现：

- HTTP / Local fallback 可使用 `localStorage`。
- TauriTavern 优先使用 `window.__TAURITAVERN__.api.extension.store`。
- SillyTavern / TavernHelper 路径由对应 adapter 封装。

业务层不应直接散落访问物理 KV；应通过 bridge、HAL storage 或领域 service 进入。

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

典型路径：

```text
/workspaces/forge/<projectId>/project.json
/workspaces/forge/<projectId>/lorebook/entries/*.json
/workspaces/forge/<projectId>/memory/tree.json
/workspaces/forge/<projectId>/drafts/tree.json
/workspaces/forge/<projectId>/review/staging.json
```

Forge 生成、审阅和冻结默认落在虚拟工作区；发布到真实 ST 世界书或导出是后置动作。

## 7. server data

`luminaweave-server/data/` 是本地数据目录，可能包含用户配置、生成状态、缓存或会话数据。

- 禁止提交该目录下的用户数据。
- 后端真实源码在 `luminaweave-server/src/`。
- 根级 `luminaweave-server/index.js` 是构建产物。

## 8. 文档更新要求

以下变化必须同步更新本文：

- 新增持久化格式。
- 变更 `ConversationDocument`、事务日志或迁移策略。
- 新增 VFS 路径或 Resource Ref 字段。
- 修改外部资源写入策略。
- 改变 server data 目录或构建产物策略。
