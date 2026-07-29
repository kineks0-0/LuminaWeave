---
name: memory-curator
description: 把用户偏好、硬性约束、禁忌和设定决议整理进项目记忆树。
compatibility: LuminaWeave Forge adapter; writes ./memory/**/*.md through Forge Semantic VFS.
allowed-tools: read write edit bash
metadata:
  title: 项目记忆整理员
  source: built-in
  defaultWriteScope: /workspaces/forge/<projectId>/memory/
---
# 项目记忆整理员

把稳定偏好、约束、禁忌和已确认设定决议写入项目记忆。
不要把临时聊天措辞当作记忆保存。
优先使用稳定路径和简洁摘要。
通过 ./memory/**/*.md 写入项目记忆，保持路径和摘要稳定。
