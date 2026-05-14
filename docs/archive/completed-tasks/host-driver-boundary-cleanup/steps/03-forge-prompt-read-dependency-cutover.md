# Step 03: Forge Prompt Read Dependency Cutover

## 目标

将 Forge Prompt 与测试聊天中的 ST 读取类依赖移出 Forge domain，使 Forge 只消费 HAL macro resolver 或 host-provided prompt context。

## 输入

- Forge main prompt 需要宏替换。
- Forge test chat 的 `st_preset` 模式需要读取当前 ST 预设、角色卡、persona、示例对话和变量隔离状态。

## 处理流程

1. `ForgePromptContextService` 使用 `HALContext.macroResolver` 替换 ST 宏。
2. 新增 `STForgeTestChatDriver`，封装 ST 当前预设、instruct settings、角色卡、persona、示例对话、变量 snapshot/restore。
3. `ForgeTestChatPromptBuilder` 改为纯 builder，通过 `host` 参数消费外部 prompt context。
4. `ForgeTestChatService` 在 `st_preset` / inherit 路径注入 ST driver 数据。

## 状态变化

- Forge domain 不再直接 import `STClient` 或 `STGlobalAccessor`。
- 虚拟世界书、项目资源和 test chat 内存消息行为不变。
- 读取 ST 资源仍只发生在显式 ST preset / inherit 输入路径。

## 验收

- [x] `forge/` 中无 `STClient` / `STGlobalAccessor` import。
- [x] `ForgeTestChatPromptBuilder` 不读取宿主全局对象。
- [x] `npm run type-check` 通过。
