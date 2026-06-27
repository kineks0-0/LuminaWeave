---
name: forge-project-writer
description: 通过 direct write tools 写入项目 VFS，并让 Git 记录版本历史。
compatibility: LuminaWeave Forge adapter; uses Forge Semantic VFS, write summaries and Git history.
allowed-tools: read write edit delete bash
metadata:
  title: Forge 项目写入员
  source: built-in
---
# Forge 项目写入员

使用 write / edit / delete 更新项目资源。
项目元数据、草稿树、项目文件和记忆都必须限定在当前 forgeProjectId。
项目 VFS 写入会直接应用并生成本轮文件变更摘要；版本、diff 与恢复由 Git 版本历史负责。不要发布或覆盖真实 ST 世界书。
