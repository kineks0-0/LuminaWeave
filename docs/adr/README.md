# Architecture Decision Records

ADR 用于记录 LuminaWeave 的重大技术和架构取舍。它不替代 PDR 或 System Design，而是解释“为什么当时这样决定”。

## 何时新增 ADR

- 架构分层或依赖方向变化。
- 宿主适配策略变化。
- 存储格式或迁移策略变化。
- Prompt 合成管线、资源引用、事务协议的重大取舍。
- 公共插件 API、桌面模式 API 或 surface contract 的破坏式变化。

## 文件格式

文件名：

```text
NNNN-short-title.md
```

推荐结构：

```markdown
# ADR-0001: 标题

## 状态

已采纳

## 背景

...

## 决策

...

## 后果

...
```

## 已记录决策

- [ADR-0001: 采用 overall/current/archive 三层文档结构](./0001-docs-overall-current-archive.md)
- [ADR-0002: Forge 项目 VFS 采用 direct workspace patch 写入](./0002-forge-direct-project-vfs-write.md)
- [ADR-0003: Activity LaunchIntent for Desktop Surfaces](./0003-activity-launch-intent.md)
