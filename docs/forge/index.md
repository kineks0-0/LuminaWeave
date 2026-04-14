# Forge 文档索引

本目录用于集中维护 `Lumina Forge` 的专属文档，按“规划 / 实现 / 目前进度看板”分类，避免 Forge 相关说明继续散落在 `docs/` 根目录。

## 文档分类

- [规划文档](./planning.md)
  - 面向产品目标、交互方向、协议边界与后续演进路线。
- [实现与技术交接](./implementation.md)
  - 面向当前代码事实、提示词/上下文链路、库选型与技术改造判断。
- [架构重构设计](./refactoring.md)
  - 面向 CardMakerStore 拆分、三角色上下文隔离、世界线快照回滚的架构设计与实施计划。
- [进度看板](./progress-board.md)
  - 面向已完成事项、剩余待办、阶段性结论与短期推进顺序。

## 使用建议

- 需要了解 Forge 想做成什么：先看 `planning.md`
- 需要了解现在代码是怎么接起来的：看 `implementation.md`
- 需要了解架构重构方向和实施计划：看 `refactoring.md`
- 需要继续推进或盘点缺口：看 `progress-board.md`

## 当前代码状态（2026-04-13）

- Forge 前台阶段已改为按 `detailMode` 分流：`detailed` 使用 6 段可见阶段，`quick` 压缩为 `kickoff / build / finalize`。
- 自由工作台下，Forge 主窗支持 `内嵌右栏 / 拆出小窗` 双态切换，并按工作会话记住当前辅助区呈现模式；拆出态时 `虚拟世界书 / 记忆管理 / 审阅中心 / 导出发布 / 后置轨` 以独立 workspace window 打开。
- 传统桌面下，辅助能力不再漂浮到全局 Shell，而是在 Forge 前台内部切换单一辅助区。
- 拆出态下主聊天区会去掉内部 hero/topbar 与额外边距，原顶部动作迁移到 `WorkspaceWindow` 顶栏，低频操作收进二级菜单。
- 聊天与 Forge 共用思考折叠块，默认只在“有思考、无正文”时展开，正文或 `<V>` 一出现即自动收起。
