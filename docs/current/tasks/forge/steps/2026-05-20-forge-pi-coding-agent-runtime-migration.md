# Forge Runtime pi-coding-agent 化迁移记录

## Summary

Forge Agent Runtime 已从旧 ForgeExecutionGateway / ForgeAgentLoop / XML Action 路径切到前端内嵌版 pi runtime。实现参考 `D:\Program\pi\packages\coding-agent` 的核心结构，但只使用浏览器可打包的 `@earendil-works/pi-agent-core` 根入口。

## 实现边界

- 不保留旧 Forge Agent runtime 向后兼容。
- 不引入 `@earendil-works/pi-coding-agent`、`pi-agent-core/node`、`node:fs`、`node:child_process`。
- 不再通过 `<entry_update>`、`<forge_skill>`、`<analysis_handoff>` 驱动 Forge Agent effects。
- 全局 XML/LuminaView 展示协议继续保留；它不再是 Forge Agent 工具调用协议。

## 当前结构

- `ForgePiAgentSession`：对标 pi `AgentSession`，拥有 agent、session manager、resource loader、extension runner、model registry 和 tool bridge。
- `ForgePiSessionManager`：维护 append-only session tree、`id / parentId`、active leaf 和 branch context replay。
- `ForgePiResourceLoader`：加载中文 skills、能力索引、阶段状态、Review Gate 和项目资源 context files。
- `ForgePiExtensionRunner`：加载浏览器内 Forge tools。
- `ForgePiToolBridge`：暴露 pi `AgentTool[]`，写入工具进入 Review Gate。
- `ForgePiModelRegistry`：将 Nexus preset 映射为 pi-ai `Model<Api>`，并返回 `streamSimple()` 兼容 `streamFn`。
- `ForgePiNexusProvider`：注册 `lumina-nexus` pi-ai provider。Forge runtime 内部保持 pi `Context / Message / AssistantMessageEventStream`，provider 内部再桥接现有 Nexus/HAL AI SDK `LanguageModel`。
- `ForgeRuntimeOrchestrator`：只作为薄调度入口转发到 pi runtime client。

## 2026-05-20 补充：pi-ai 浏览器模型协议层

`D:\Program\pi\packages\ai` 的 README 明确声明 `@earendil-works/pi-ai` 支持浏览器环境；源码也通过动态 Node import 避免破坏 Vite/browser build。因此 Forge 模型协议层应对齐 pi-ai，而不是让 Forge runtime 直接持有 AI SDK `ModelMessage[]`。

当前边界：

- Forge Agent Session / pi-agent-core 只消费 pi-ai `Context`、`Message`、`ToolCall`、`ToolResultMessage` 与 `AssistantMessageEventStream`。
- `ForgePiModelRegistry` 只负责创建 `api: "lumina-nexus"` 的 pi-ai model，并把 `streamFn` 指向 pi-ai `streamSimple()`。
- `ForgePiNexusProvider` 是唯一允许把 pi messages 转换到 AI SDK payload 的 Forge runtime 文件。
- `ForgePiNexusProvider` 同步生成模型请求调试 trace，模型请求面板必须从该 trace 展示：
  - pi 原始 messages；
  - provider 转换后的 pi messages；
  - 最终 AI SDK payload messages；
  - active tools；
  - provider lifecycle；
  - final text / error message。
- 浏览器限制仍保留：不走 Bedrock / OAuth 浏览器主路径；API key 安全边界继续由 Nexus/HAL 或宿主配置负责。

## 验证

- `npx vitest run src/api/core/__tests__/ForgePiDependencyGuard.test.ts`
- `npx vitest run src/api/core/__tests__/ForgePiToolBridge.test.ts src/api/core/__tests__/ForgePiResourceLoader.test.ts src/api/core/__tests__/ForgePiCoreRuntime.test.ts src/api/core/__tests__/ForgeRuntimeOrchestrator.pi-core.test.ts --testTimeout=20000`
- `npm run type-check -- --pretty false`
