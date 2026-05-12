# Director 模块文档

Director 负责剧情推演、记忆整理、上下文深度控制与提示词注入策略。它当前与记忆、DCC、后台分析和 XML 标签协议存在较强关联。

## 文档

- [PDR](./PDR.md)

## 维护提示

修改 Director 的注入频率、记忆整理、状态变更、后台生成或与 Chat/Forge 的共享协议时，应同步检查全局 PDR、全局 System Design 和相关测试。
