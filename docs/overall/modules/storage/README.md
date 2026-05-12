# Storage 模块文档

Storage 负责 LuminaWeave 的独立持久化、会话文档、事务日志、extensionStore/local fallback、Resource/VFS 写入策略与迁移边界。

## 文档

- [PDR](./PDR.md)
- [System Design](./system_design.md)
- [仓库级存储与数据说明](../../../storage-and-data.md)

## 维护提示

修改 ConversationDocument、事务日志、Resource Ref、VFS、迁移策略或 server data 目录时，应同步更新本目录、仓库级存储文档和必要 ADR。
