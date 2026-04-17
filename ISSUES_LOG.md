# LuminaWeave 单元测试失败修复日志 (ISSUES_LOG.md)

## 1. 复现情况 (2026-04-07)

共有 9 个测试用例失败，涉及 `ChatManager`, `STSyncService`, `VTagPersistence`, `XMLInterceptor`。

### 1.1 ChatManager (2 失败)
- **1.2.1 当遇到无法合并的冲突时，应通知用户**: 预期 `syncFromST` 不被调用，实际被调用了 1 次。
- **1.2.2 即使全局设置启用，也不应在分歧时自动强制覆盖**: 预期 `syncFromST` 不被调用，实际被调用了 1 次。
- **根本原因假设**: `ChatManager` 的响应式激活逻辑或 `syncFromST` 的触发门槛在最近的重构中变得过于宽松，导致在判定为分歧 (Divergence) 时仍触发了不该触发的拉取同步。

### 1.2 STSyncService (1 失败)
- **应在 ST 追加新节点时跟随最新的尾部**: 预期 `activeLeafId` 为 '3'，实际为 '2'。
- **根本原因假设**: `STSyncService` 的 `syncFromST` 在处理 `append` 到 ST 的增量节点时，未能正确更新本地的 `activeLeafId` 为新追加的叶子节点，或者存在竞态导致旧值覆盖。

### 1.3 VTagPersistence (3 失败)
- **deriveStreamState 应尊重 allowTopLevel 标志**: 丢弃了顶层文本。
- **应使用 backsplash 保护处理孤立的瞬态关闭标签**: 丢失了空格。
- **当 allowTopLevel 为 true 且无孤立瞬态标签时不应 backsplash**: 丢失了顶层文本。
- **根本原因假设**: `BaseXMLInterceptor` 中的 `deriveStreamState` 逻辑在处理 `allowTopLevel` 和标签截断时的正则/缓冲区拼接存在逻辑错误，或者是为了修复其他问题引入了过度过滤。

### 1.4 XMLInterceptor (3 失败)
- **当过滤器禁用时，应保持原始文本不被改动**: `displayText` 被过滤了。
- **应使用 PromptRegistry 自动解析标签别名**: 别名匹配漏掉了一部分内容。
- **应妥善处理嵌套的相同标签**: 嵌套标签解析返回空数组，说明栈式解析逻辑在处理同名嵌套时存在 bug。
- **根本原因假设**: `XMLInterceptor` 的 `deriveStreamState` 忽略了过滤开启/关闭的状态位。标签别名注册与提取逻辑不匹配。嵌套标签处理在遇到相同标签名时，入栈/出栈平衡逻辑有误。

---

## 5. 聊天区域空白修复 (2026-04-15)
- **错误消息**: 聊天区域为空白。控制台记录 `[ChatManager] 跳过同步: 无效的 ChatID`。
- **根本原因假设**: 系统的初始同步(`api.init()`)触发时，SillyTavern 的上下文或 ChatID 尚未就绪。由于缺乏对 `CHAT_LOADED` 或 `CHAT_CHANGED` 事件的监听，系统在环境最终准备好后没有再次触发同步，导致 UI 停留初始空状态。
- **验证手段**: 在 `LuminaWeaveAPI` 中增加事件监听。刷新页面后通过日志确认 `handleIncrementalSync` 是否被触发并成功拉取数据。

## 2. 验证修复计划

1. 研究 `BaseXMLInterceptor` 和 `XMLInterceptor` 的 `deriveStreamState` 逻辑。
2. 检查 `XMLInterceptor.extractTagContent` 及其对别名的支持。
3. 调整 `ChatManager` 的冲突检测与 `syncFromST` 调用链路。
4. 修正 `STSyncService` 的增量追加同步逻辑。
5. 每次修复后运行单项测试验证。

## 3. Forge 无法创建虚拟世界书条目修复 (2026-04-13)
- **错误发现**: 通过日志发现无明确报错，但 `<entry_update>` 内容没有被提取进 Staging Area 和虚拟世界书。
- **根本原因假设**: Planner / Conversation 等非直白重写阶段中，大模型生成的 `<entry_update>` 标签缺失 `id` 属性。在 `ForgeAgentController` 和 `ForgeRuntimeOrchestrator` 的解析中，如果没有有效的 `targetEntryId`，处理逻辑会静默返回并抛弃改动。
- **验证手段**: 修改 Parser，如果缺失 `id` 退回使用 `'new_forge_entry'`；修改 prompts，强制约束标签生成必须包含 `id`。修改后运行 `npm run test`，全部测试通过。
- **文档**: 更新成功，解析器获得了必要的鲁棒性兜底。
43: 
44: ## 4. Forge 时间线切换消息不同步修复 (2026-04-14)
45: - **错误消息**: 插卡的消息记录不跟随世界线的活跃节点设置切换。
46: - **根本原因假设**: `CardMakerStore.ts` 中的 `timelineFeed` 计算属性虽然有 `timelineRevision` 驱动反应性，但其过滤逻辑仅检查消息是否存在于 `nodePool` 中，而没有根据世界线当前的活跃路径（Active Path）进行过滤。这导致所有分支的消息都会被显示。
47: - **修复手段**:
48:   - 修改 `CardMakerStore.ts` 的 `timelineFeed`，使用 `worldlineStore.getTrace(activeLeafId)` 获取当前活跃路径，并据此过滤 `timelineItems`。
49:   - 增强操作 (Operations) 的过滤逻辑：如果操作关联了特定消息，且该消息不在当前路径上，则隐藏该操作。
50:   - 在 `LuminaTimeline.vue` 和 `HistoryNode.vue` 中引入“跳转 (Jump)”功能，支持无损切换到已有分支节点。
51: - **验证结果**: 经过代码检查和逻辑推导，该过滤逻辑可以确保 UI 只渲染当前世界线路径的内容。手动验证确认“从此分支”和新增的“跳转”动作均能正确触发 `activeLeafId` 变更并驱动消息列表更新。
52: - **文档**: 本次修改符合“各子世界线严格隔离”的设计原则。
