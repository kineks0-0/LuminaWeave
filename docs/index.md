# LuminaWeave 文档入口

本目录按“整体规划 / 当前步骤 / 已完成归档”组织。发生上下文压缩或中断时，先读本文件，再进入对应任务的 `README.md` 和 `steps/`。

## 仓库级文档

这些文档用于理解项目、协作规则、验证方式和数据边界。

- [短版架构入口](./architecture.md)
- [文档规范](./documentation-standards.md)
- [协作指南](./contributing.md)
- [测试与 CI](./testing-and-ci.md)
- [配置参考](./configuration.md)
- [存储与数据](./storage-and-data.md)
- [ADR](./adr/)

> 仓库级协作规则中历史上曾提到 `docs/PDR.md` 与 `docs/system_design.md`。当前实际长期文档路径为 `docs/overall/PDR.md` 与 `docs/overall/system_design.md`，后续引用应使用实际路径。

## 整体规划

长期有效的产品、架构、API 与模块设计放在 `overall/`。

- [全局 PDR](./overall/PDR.md)
- [全局 System Design](./overall/system_design.md)
- [Design Specs](./overall/design/)
- [API 参考](./overall/api/luminaweave_api.md)
- [架构与行为文档](./overall/architecture/)
- [模块文档](./overall/modules/)

常用模块入口：

- [Chat](./overall/modules/chat/)
- [Desktop Modes](./overall/modules/desktop_modes/)
- [Director](./overall/modules/director/)
- [Forge](./overall/modules/forge/)
- [Server](./overall/modules/server/)
- [Settings](./overall/modules/settings/)
- [Stats](./overall/modules/stats/)
- [Storage](./overall/modules/storage/)
- [Timeline](./overall/modules/timeline/)

## 当前步骤

仍在执行或持续跟踪的任务放在 `current/tasks/<task-name>/`。每个任务必须包含：

- `README.md`：目标、当前状态、下一步、恢复方式。
- `steps/`：当前未完成或持续跟踪的步骤文档。

当前任务入口：

- [Current Tasks](./current/README.md)
- [General](./current/tasks/general/)
- [Desktop Modes](./current/tasks/desktop-modes/)
- [Forge](./current/tasks/forge/)
- [Standalone Resource Runtime](./current/tasks/standalone-resource-runtime/)
- [Tailwind System Migration](./current/tasks/tailwind-system-migration/)

## 已完成归档

完成后的任务整体移动到 `archive/completed-tasks/<task-name>/`。归档任务保留：

- `README.md`：最终状态和验证记录。
- `steps/`：已完成步骤，文件名保留日期前缀。

已完成任务入口：

- [Archive](./archive/README.md)
- [Plugin Platform Refactor](./archive/completed-tasks/plugin-platform-refactor/)

## 维护规则

- 新的长期规划进入 `overall/`。
- 新的执行任务进入 `current/tasks/<task-name>/`。
- 任务完成后，整个任务目录移动到 `archive/completed-tasks/<task-name>/`。
- 移动 Markdown 文件后必须修复仓库内相对链接。
