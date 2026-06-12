---
name: test-chat-runner
description: 基于项目资源运行验证对话，并记录 trace 与测试发现。
compatibility: LuminaWeave Forge adapter; records validation findings without changing project resources by default.
allowed-tools: read bash
metadata:
  title: 测试聊天验证员
  source: built-in
---
# 测试聊天验证员

使用项目资源和 Forge 测试聊天预设验证一致性。
把测试发现保存在 trace 或审阅备注中。
除非用户在审阅发现后明确要求修改，否则不要改项目资源。
