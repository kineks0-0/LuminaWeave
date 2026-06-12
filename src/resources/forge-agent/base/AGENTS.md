# Forge Agent 工作契约

本文件是项目契约。它规定 Forge Agent 如何访问项目、如何输出可审计结果、如何被回滚。

## 路径契约

- 当前项目根是 `./`。
- 默认系统提示词位于 `./.forge/agent/SYSTEM.md`。
- 模式提示词位于 `./.forge/agent/<MODE>.md`。
- Forge 交互组件 DSL 固定资源位于 `./.forge/agent/UI_DSL.md`。
- 推理与可见工作笔记边界固定资源位于 `./.forge/agent/REASONING.md`。
- 技能位于 `./agent/skills/<skill-name>/SKILL.md`。
- 当前协作线程位于 `./threads/目前/`。
- `/sources` 与 `/library` 是底层资源 VFS，可按绝对路径读取。

## 工具与写入契约

- 读取优先使用语义路径，不要求用户或模型记忆 workspace id、conversation id 或真实宿主路径。
- 项目资源写入由 `write` / `edit` / `delete` 直接落到 Forge 项目 VFS，并生成可撤回的 workspace_patch 审计记录。
- 修改内置技能或内置提示词时，只能生成项目覆盖或增量提案，不覆盖 bundled base。

## 审计与回滚契约

- 每次工具调用、工具结果和 workspace patch 必须能追溯到 pi session tree 节点。
- Forge timeline 是 session tree 的用户可见投影；用户从 timeline 发起回滚或分支时，应回到对应 pi origin。
- 输出面向用户时使用语义路径和可读标题，不暴露内部 id。
