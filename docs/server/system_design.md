# LuminaWeave Server - 系统架构与组件流转

## 一、 架构鸟瞰 (Architectural Overview)
`luminaweave-server` 完全遵循 SillyTavern 的内置加载器约定 (`plugin-loader.js`)。
加载器会自动侦测 `plugins/[plugin-folder]` 下的 `package.json` 或 `index.js`，并赋予 Express `Router` 的注册权。

### 1.1 隔离特性
后端插件没有自身的“渲染界面（Frontend UI）”。它唯一的职责是作为一个 Headless Server API Provider：
- 不依赖 `express` (ST 主线已绑定)
- 不负责跨域，因为 ST 加载时共享同一个域内上下文与凭证。
- ST 自动代理路由映射至：`/api/plugins/luminaweave/`。

## 二、 核心数据交互流转

### 2.1 鉴权与生命周期 (CSRF & Auth Lifecycle)
SillyTavern 拥有针对 POST 请求的 `csrf-sync` 同步检查器。
LuminaWeave Frontend 扩展发起写入时：
1. `GET /csrf-token` -> 获取最新合法的 `token` 散列值。
2. 构造 `X-CSRF-Token: [hash]` 加载入 `fetch` 标头。
3. POST 发出向 `/api/plugins/luminaweave/settings/save`。

### 2.2 落盘体系 (Persistent Layer)

`index.js` 通过 `__dirname` 计算出专属的数据存储槽 `d:\LuminaWeave\luminaweave-server\data\`。
- **存储格式**: 采用 **JSONL (JSON Lines)** 格式，提升大文件读写效率。
- **内存缓存与定期同步**: 后端插件在内存中维护聊天记录（`chatCache`）与事务日志（`transactionCache`）。写入操作优先更新内存，通过 `syncTimer` 定期（默认 5 秒）批量同步至磁盘文件，以降低频繁读写的 I/O 消耗。
- **事务状态感知**: 提供 `/chat/:chatId/sync-status` 端点供前端查询，只有当特定 `chatId` 的所有事务（`pending`、`running`）均完成后，前端才执行拉取或更新操作，保证数据一致性。

## 三、 接口规范 (End-Points)

- 获取配置： `GET /settings` 
  - 返回解析成功的 JSON 或 `{}` 空对象。
- 覆写配置： `POST /settings/save`
  - 接受 payload 完整覆盖 `LuminaWeave.json` 文件。
- 事务同步状态： `GET /chat/:chatId/sync-status`
  - 返回 `{ isTransactionsCompleted: boolean }` 判定当前所有写操作是否落定。
- 获取当前聊天记录： `GET /chat/:chatId`
  - 从内存缓存中读取或自动将底层 `.jsonl` 行序列反序列化为数组返回。
- 覆盖式保存聊天记录 (Snapshot)： `POST /chat/save/:chatId`
  - 将接收到的全量数组存入内存缓存，标记脏数据。
- 增量修补数据 (Patch)： `PATCH /chat/:chatId`
  - 支持事务幂等性与序列验证的差异更新。
