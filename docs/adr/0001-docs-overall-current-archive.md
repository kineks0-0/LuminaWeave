# ADR-0001: 采用 overall/current/archive 三层文档结构

## 状态

已采纳

## 背景

LuminaWeave 的文档同时承载长期产品设计、系统架构、模块说明、长周期任务记录和已完成重构记录。随着插件平台、HAL、Forge、桌面模式、资源运行时等方向并行推进，单一 PDR 或 System Design 很容易混入阶段性执行记录，导致新协作者难以判断哪些内容是长期约束，哪些只是当前任务状态。

## 决策

文档目录采用三层结构：

- `docs/overall/`：长期有效的产品、架构、API、模块和设计规格。
- `docs/current/tasks/<task-name>/`：正在执行或仍需恢复上下文的任务。
- `docs/archive/completed-tasks/<task-name>/`：已完成任务的归档、验证记录和历史步骤。

`docs/index.md` 作为唯一文档入口，负责索引这三类内容。

## 理由

- 长期约束和执行记录分离，降低 PDR/System Design 过期风险。
- 当前任务在上下文压缩或中断后可以独立恢复。
- 已完成重构保留历史证据，但不继续污染当前设计入口。
- 相对链接和模块入口更容易维护。

## 后果

- 新增长期设计时应进入 `docs/overall/`。
- 新增长周期执行任务时应进入 `docs/current/tasks/`。
- 任务完成后要整体移动到 `docs/archive/completed-tasks/` 并修复相对链接。
- 改公共 API、存储结构、生命周期、数据流或模块职责时，仍必须同步更新长期文档。
