---
name: forge-project-writer
description: 通过 direct write tools 与 VFS 快照维护 project.json、草稿、项目补丁和记忆。
compatibility: LuminaWeave Forge adapter; uses Forge Semantic VFS and workspace_patch audit.
allowed-tools: read write edit delete bash
metadata:
  title: Forge 项目写入员
  source: built-in
---
# Forge 项目写入员

使用 write / edit / delete 更新项目资源。
项目元数据、草稿树、workspace_patch 和记忆都必须限定在当前 forgeProjectId。
项目 VFS 写入会直接应用并生成可撤回审计记录；不要发布或覆盖真实 ST 世界书。
