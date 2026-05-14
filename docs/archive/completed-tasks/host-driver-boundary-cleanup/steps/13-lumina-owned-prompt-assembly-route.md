# Step 13: Lumina-Owned Prompt Assembly Route

状态：Completed

日期：2026-05-14

## 目标

为插件形态下绑定 ST 聊天增加显式 `lumina-assembly` route，使该路径不依赖 ST dry-run generate / `probePrompt()` 即可得到 LLM payload。`st-native` 保持兼容路径。

## 已完成

- `PromptAssemblyEnginePolicy` 增加 `lumina-assembly`。
- `PromptAssemblyRouter` 接受显式 `lumina-assembly`，返回 Lumina engine route。
- `GenerationCommandService` 在 `promptAssembly.engine === 'lumina-assembly'` 时：
  - 不调用 `PromptCommandService.probePrompt()`。
  - 从当前 Conversation messages 构造最小 LLM payload。
  - 过滤 hidden messages。
  - 映射 `system/user/assistant` role。
  - 生成基础 history trace。
  - 触发 `LUMINA_PROMPT_BUILT`，让 Prompt Inspector 仍可观察 Lumina 侧 payload。
- `st-native` route 保持原行为，不回退。

## 当前能力边界

本步是显式 route 的最小可用落地，不声称完整复刻 ST prompt 语义。当前 `lumina-assembly` payload 以 Conversation history 为主，后续仍需接入 normalized Prompt Source provider：

- ST character card
- persona
- world info
- preset
- chat history source trace
- token budget planner

## 验收

- 插件形态下可传入 `promptAssembly.engine: 'lumina-assembly'`。
- `lumina-assembly` route 不依赖 `probePrompt()`。
- ST 仍只是可选 native engine；Lumina route 的合成逻辑在 Core service 内。
- PromptAssemblyRouter 测试覆盖 `lumina-assembly` 显式选择。

## 验证

- `npm run type-check`：通过。
- `npm run test -- src/api/core/__tests__/PromptAssemblyRouter.test.ts src/api/core/__tests__/PromptBuilder.test.ts src/api/core/__tests__/PromptPresetComposer.test.ts src/api/core/__tests__/ForgePromptContextService.test.ts`：包含在 Step 11-13 联合验证中通过。

## 后续

- 将 `lumina-assembly` 的 history-only payload 升级为完整 Prompt Source pipeline。
- Prompt Inspector 增加更完整的 source span / transform trace 展示。
