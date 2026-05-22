# ADR-0002: Forge 项目 VFS 采用 direct workspace patch 写入

## 状态

已采纳

## 背景

Forge pi agent 已收敛到原生 tool calling 和 tree-structured pi session。旧链路把 AI 项目写入先转成 `writeProposal`、`editProposal`、`stageEntry` 或 XML/伪 XML action，再进入 Review Gate / staging，导致 Prompt Preview、实际生成、项目 VFS、文件版本恢复和真实 ST 发布边界混在一起。

新的目标是让 Forge 项目工作区像 Agent workspace 一样可直接编辑，同时保留可审计、可撤回、不会静默覆盖真实宿主数据的边界。

## 决策

- Forge 项目 VFS 内部写入默认直接应用到项目 workspace。
- 模型可见写入工具使用直接语义：`writeFile(path, content)`、`editFile(path, old_string, new_string)`、`deleteFile(path)`；`bash` 的项目写入也进入同一套 direct patch reducer。
- Forge `<V>` 组件 DSL 与可见推理边界是 pi prompt 固定资源：`./.forge/agent/UI_DSL.md` 与 `./.forge/agent/REASONING.md`。旧 `PromptBuilder` / `PromptType.CONSTRAINTS` 不再注入 Forge Agent prompt。
- 每次直接写入必须追加 `workspace_patch` pi session entry，记录 before/after inline content refs、tool call id、source node id 和可撤回状态。
- `./memory/**/*.md` 与 `./lorebook/entries/*.md` 是一等 Forge 域文件：direct write 必须同步 runtime state，再持久化项目数据。
- 对话内“AI 更改文件”列表和“文件版本”面板通过反向或重放 `workspace_patch` 撤回/恢复；撤回本身也追加新的 `workspace_patch`。
- Resource VFS、运行时 prompt、内置 skill、线程消息投影和内部 raw storage 是受保护目标，写入必须失败且不得产生部分写入。
- 真实 SillyTavern 世界书发布、导出或覆盖宿主数据仍需要用户显式确认。

## 后果

- Prompt Preview 与真实生成必须共享 `ForgePiAgentSession.preparePrompt()` / runtime prompt preparation 的 prepared prompt、source trace 和 tool summary。
- `ForgePromptContextService` 可保留 legacy preview / inspector trace 辅助，但不得再向 pi runtime 追加最终 system prompt fragments；`PromptBuilder.buildForgePrompt()` 不再是 Forge 主路径 API。
- 新 prompt、tool summary 和主写入链路不得再暴露 `writeProposal`、`editProposal`、`stageEntry` 或 `<entry_update>` / `<memory_update>` 等旧 XML action 协议。
- Review/Staging 可以作为历史记录或真实发布/导出边界存在，但不再是 AI 写入 Forge 项目 VFS 的必经路径。
- 文件版本恢复不再生成 Review/Staging 条目，而是直接生成新的可审计 `workspace_patch`。
- 后续新增 Forge 写入目标时，必须先归类为项目 workspace 可写、Forge 域文件可写、或受保护只读目标。
