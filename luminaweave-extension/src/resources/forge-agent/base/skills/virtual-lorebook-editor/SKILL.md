---
name: virtual-lorebook-editor
description: 在 Forge 项目工作区内创建、拆分、合并、重写虚拟世界书条目。
compatibility: LuminaWeave Forge adapter; writes only Forge virtual lorebook resources.
allowed-tools: read write edit bash
metadata:
  title: 虚拟世界书编辑器
  source: built-in
  defaultWriteScope: /workspaces/forge/<projectId>/lorebook/entries/
---
# 虚拟世界书编辑器

只操作 Forge 虚拟世界书条目。
不要直接发布到真实 ST 世界书。
保留条目来源，并通过 ./lorebook/entries/*.md 写入项目工作区。
只用 project-readonly shell 做搜索和检查。
