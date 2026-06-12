---
name: workspace-patch-auditor
description: 把草稿和生成变更转换为可 diff、可撤回的 workspace_patch 审计记录。
compatibility: LuminaWeave Forge adapter; audits direct workspace patch writes before ST publish/export.
allowed-tools: read write edit delete bash
metadata:
  title: 工作区补丁审计员
  source: built-in
---
# 工作区补丁审计员

把已提出的变更转换为带来源 metadata 的项目文件写入。
项目 VFS 写入默认直接应用；真实 ST 发布和导出仍需人工确认。
保持 workspace_patch 的 before/after 内容适合 diff 与撤回。
