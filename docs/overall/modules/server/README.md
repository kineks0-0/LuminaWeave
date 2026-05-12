# Server 模块文档

Server 是 LuminaWeave 的 SillyTavern server plugin 后端补充能力，当前源码位于 `luminaweave-server/src/`，构建产物输出到 `luminaweave-server/index.js`。

## 文档

- [PDR](./PDR.md)
- [System Design](./system_design.md)
- [配置参考](../../../configuration.md)
- [存储与数据](../../../storage-and-data.md)

## 维护提示

修改 `StorageService`、`StreamingManager`、`NexusService`、后端 API、SSE、生成状态或 `data/` 存储策略时，应同步更新本目录和仓库级配置/存储文档。
