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
## 6. Forge 主预设资源测试断言修复 (2026-06-16)
- **错误消息**: `npm run test` 中 `src/api/core/__tests__/prompt/PromptPresetRegistry.test.ts` 的“Forge 主预设应暴露 agent 资源包和提示词编排，而不是依赖 slot 列表”失败；断言期望 `reference-xp-capture` 的 `content` 包含 `XP 捕捉附加条目`，实际 raw `SKILL.md` 内容包含 `性癖捕捉附加条目`。
- **根本原因假设**: 测试同时校验 JSON 资源标题和 raw `SKILL.md` 正文，但该技能的 JSON display title 是 `XP 捕捉附加条目`，`SKILL.md` frontmatter/body 的真实标题是 `性癖捕捉附加条目`；测试没有按两个事实源分别断言。
- **验证手段**: 修改测试只将 raw content 断言对齐到 `SKILL.md` 的精确正文标题，然后重新运行目标测试与完整验证命令。
- **什么起作用了**: `npm run test -- src/api/core/__tests__/prompt/PromptPresetRegistry.test.ts` 通过 11 个用例；随后完整 `npm run test` 通过 151 个测试文件、771 个用例，2 个用例跳过。
- **失败尝试**: 首次完整 `npm run test` 复现了该断言失败；未尝试其他代码修复路径。

## 7. Forge 项目中心嵌套项目行 Vue 结构修复 (2026-06-16)
- **错误消息**: `npm run test -- --run src/plugins/forge/__tests__/forgeProjectCenterPresentation.test.ts src/stores/__tests__/useSessionIndexStore.test.ts` 中 “builds a Codex-style tree with only the selected Forge project expanded” 失败；测试期望同级 `thread:*` row，实际展示模型只返回项目 row。
- **根本原因假设**: 项目中心被改成“项目 row 内嵌 `threads`”后，测试仍按旧的同级 row 契约断言；同时 Vue 模板里线程菜单仍引用外层 `row`，导致线程菜单和项目菜单变量绑定混用。
- **验证手段**: 将展示模型测试调整为“顶层只包含项目，选中项目的 `threads` 包含对话”；同步整理 `ForgeSessionBrowser.vue` 模板，使项目组负责背景包裹，线程菜单绑定 `thread`。
- **什么起作用了**: `npm run test -- --run src/plugins/forge/__tests__/forgeProjectCenterPresentation.test.ts src/stores/__tests__/useSessionIndexStore.test.ts` 通过 2 个测试文件、8 个用例；`npm run type-check` 通过。
- **失败尝试**: 首次 focused 测试复现了旧同级 row 断言失败；未继续保留同级 row 渲染路径。

## 8. Workspace Stage Strip 夜间模式高亮变白修复 (2026-06-16)
- **错误消息**: `.stage-card.is-active` 使用 `background: color-mix(in srgb, var(--lw-primary) 8%, white);`，夜间模式下激活舞台卡片背景变成浅白色。
- **根本原因假设**: `WorkspaceStageStrip.vue` 的舞台按钮 hover / active 背景把 `--lw-primary` 与硬编码 `white` 混合，没有使用 `--lw-bg-elevated`、`--lw-bg-surface` 等主题 surface token；夜间模式切换只更新 `--lw-*` token，无法改变该硬编码浅色端点。
- **验证手段**: 新增 `WorkspaceStageStripStyles.test.ts`，先断言该组件 scoped style 不应包含 `color-mix(... white)` 的舞台 hover / active 背景，再运行 focused 测试复现失败。
- **什么起作用了**: 将舞台创建按钮 hover 与激活舞台卡片背景的混色端点从 `white` 改为 `var(--lw-bg-elevated)`；`npm run test -- --run src/components/__tests__/WorkspaceStageStripStyles.test.ts` 通过 1 个测试文件、1 个用例。
- **失败尝试**: 首次 focused 测试复现了 `WorkspaceStageStrip.vue` scoped style 中仍包含 `color-mix(in srgb, var(--lw-primary) 8%, white)`；未尝试其他修复路径。

## 9. Freeform Controls 夜间模式背景变浅修复 (2026-06-16)
- **错误消息**: `.lw-freeform-controls` 使用 `linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(245, 249, 255, 0.76))`，并且 `.lw-freeform-control:hover, .lw-freeform-control.active` 也使用白色渐变端点，夜间模式下控件背景仍偏浅。
- **根本原因假设**: `FreeformShell.vue` 的自由工作台右上角控件组使用硬编码白色和浅色 RGB，而不是使用 `--lw-bg-elevated`、`--lw-bg-surface` 等主题 surface token；夜间模式只更新 `--lw-*` token，无法改变这些硬编码浅色背景。
- **验证手段**: 新增 `freeformShellThemeStyles.test.ts`，先断言 `.lw-freeform-controls` 与 `.lw-freeform-control:hover/.active` 样式块不应包含 `white` 或 `rgba(255, 255, 255...)`，再运行 focused 测试复现失败。
- **什么起作用了**: 将 `.lw-freeform-controls` 的 border、背景渐变和 inset highlight，以及 `.lw-freeform-control:hover/.active` 的背景渐变和 inset highlight 改为基于 `--lw-bg-elevated` / `--lw-bg-surface` / `--lw-primary` 的主题 token；`npm run test -- --run src/shell/__tests__/freeformShellThemeStyles.test.ts` 通过 1 个测试文件、1 个用例。
- **失败尝试**: 首次 focused 测试失败在测试选择器提取逻辑，未命中实际样式断言；修正测试提取后，focused 测试复现了 `.lw-freeform-controls` 中仍包含 `white` 和 `rgba(255, 255, 255...)`。

## 10. 自由工作台菜单与传统桌面夜间模式浅色背景修复 (2026-06-18)
- **错误消息**: `.lw-workspace-menu.is-freeform`、传统桌面的 `.profile-trigger`、`.profile-menu`、`.launcher-btn`、`.lw-tabs`、`.lw-main-wrapper` 等规则仍包含 `white`、`#ffffff`、`#f8fafc`、`rgba(255, 255, 255...)` 或浅色 RGB fallback，夜间模式下显示为浅白背景；`.lw-main-wrapper` 在夜间模式下出现上白下黑的上下渐变。
- **根本原因假设**: 这些桌面壳层样式把默认 fallback 写成固定浅色端点，而不是统一使用 `--lw-bg-elevated`、`--lw-bg-surface`、`--lw-bg-subtle`、`--lw-bg-hover`、`--lw-border-base`、`--lw-text-secondary` 等主题 token；夜间模式只更新主题 token，无法覆盖硬编码浅色背景。
- **验证手段**: 扩展 `freeformShellThemeStyles.test.ts` 覆盖 `.lw-workspace-menu` 与菜单项；新增 `PanelHeaderThemeStyles.test.ts` 覆盖传统桌面 launcher、tabs、profile 菜单；新增 `traditionalShellThemeStyles.test.ts` 覆盖 `.lw-main-wrapper`，先运行 focused 测试复现硬编码浅色 fallback。
- **什么起作用了**: 将 `.lw-workspace-menu`、菜单项、传统桌面 launcher/tabs/profile 菜单、同一 header 面板里的 widget/浮动控件背景，以及 `.lw-main-wrapper` 的背景、边框和渐变端点改为基于主题 token；`npm run test -- --run src/components/__tests__/WorkspaceStageStripStyles.test.ts src/shell/__tests__/freeformShellThemeStyles.test.ts src/components/__tests__/PanelHeaderThemeStyles.test.ts src/shell/__tests__/traditionalShellThemeStyles.test.ts` 通过 4 个测试文件、6 个用例；`npm run type-check` 通过。
- **失败尝试**: 首次 expanded focused 测试复现了新增目标规则仍包含硬编码浅色 fallback；第二次测试发现 `PanelHeaderThemeStyles.test.ts` 将 `white-space` 误判为颜色词，同时 `.profile-trigger` border 仍有 `white` 端点；修正断言和残留样式后 focused 测试通过。

## 11. Desktop Mode Surface Skin 夜间变量覆盖修复 (2026-06-18)
- **错误消息**: `--lw-shell-main-bg` 仍解析为 `linear-gradient(180deg, rgba(255, 255, 255, 0.92), color-mix(in srgb, var(--lw-bg-elevated) 96%, white))`；自由工作台的 `.lw-workspace-menu.is-freeform` 仍被 `--lw-shell-workspace-menu-bg`、`--lw-shell-workspace-menu-border`、`--lw-shell-workspace-menu-item-bg` 和 `--lw-shell-workspace-menu-item-active-bg` 的浅色 surface skin 变量覆盖。
- **根本原因假设**: `App.vue` 通过 `useSurfaceSkin('shell.mainSurface')` 和 `useSurfaceSkin('shell.workspaceMenu')` 把 `desktop-modes/builtins/shared.ts` 与 `stage/skins.ts` 的变量作为 inline style 注入，优先级高于 Vue 组件内已修复的 fallback；因此只修组件 CSS 不能改变真实生效背景。
- **验证手段**: 在 `desktopModeRegistry.test.ts` 中新增 dark appearance 下的 `resolveSurfaceSkin` 断言，直接覆盖 `classic` 的 `shell.mainSurface`、`stage` 的 `shell.mainSurface` 和 `shell.workspaceMenu` 解析变量，先运行 focused 测试复现失败。
- **什么起作用了**: 将 `desktop-modes/builtins/shared.ts` 中 `shell.mainSurface` 的 `--lw-shell-main-bg` / `--lw-shell-main-border` 和 `shell.workspaceMenu` 的四个 workspace menu 变量改为主题 surface/border token；同步修正 `stage/skins.ts` 对 `--lw-shell-main-bg` 的覆盖值。`npm run test -- --run src/desktop-modes/core/__tests__/desktopModeRegistry.test.ts src/components/__tests__/WorkspaceStageStripStyles.test.ts src/shell/__tests__/freeformShellThemeStyles.test.ts src/components/__tests__/PanelHeaderThemeStyles.test.ts src/shell/__tests__/traditionalShellThemeStyles.test.ts` 通过 5 个测试文件、13 个用例；`npm run type-check` 通过。
- **失败尝试**: 首次 `desktopModeRegistry.test.ts` focused 测试复现了 `--lw-shell-main-bg` 解析值仍包含 `rgba(255, 255, 255, 0.92)` 和 `white`；前一轮只修改 Vue 组件 fallback，没有覆盖 inline style 注入变量。

## 12. Widget Container 夜间模式浅色渐变修复 (2026-06-18)
- **错误消息**: `.lw-widget-container` 的 `background` fallback 和 `shell.widget` surface skin 变量仍包含 `linear-gradient(180deg, rgba(255, 255, 255, 0.92), color-mix(in srgb, var(--lw-bg-elevated) 96%, white))`，夜间模式下继续出现白黑渐变。
- **根本原因假设**: `WidgetPanelHost.vue` 消费 `widgetStyle`，而 `widgetStyle` 来自 `useSurfaceSkin('shell.widget')`；`desktop-modes/builtins/shared.ts` 和 `stage/skins.ts` 中的 `--lw-shell-widget-bg` 仍覆盖为浅色端点，组件自身 fallback 也保留同样浅色端点。
- **验证手段**: 扩展 `desktopModeRegistry.test.ts`，在 dark appearance 下断言 `classic` 与 `stage` 的 `shell.widget` 解析变量不包含浅色端点；扩展 `traditionalShellThemeStyles.test.ts`，断言 `.lw-widget-container` fallback 不包含浅色端点，先运行 focused 测试复现失败。
- **什么起作用了**: 将 `desktop-modes/builtins/shared.ts` 的 `--lw-shell-widget-bg` / `--lw-shell-widget-border`、`stage/skins.ts` 的 `--lw-shell-widget-bg` 覆盖值，以及 `WidgetPanelHost.vue` 的 `.lw-widget-container` fallback 都改为基于 `--lw-bg-elevated` / `--lw-bg-surface` / `--lw-border-base` 的主题 token。`npm run test -- --run src/desktop-modes/core/__tests__/desktopModeRegistry.test.ts src/components/__tests__/WorkspaceStageStripStyles.test.ts src/shell/__tests__/freeformShellThemeStyles.test.ts src/components/__tests__/PanelHeaderThemeStyles.test.ts src/shell/__tests__/traditionalShellThemeStyles.test.ts` 通过 5 个测试文件、14 个用例；`npm run type-check` 通过。
- **失败尝试**: 首次 focused 测试复现了 `shell.widget` 解析值和 `.lw-widget-container` fallback 同时包含 `rgba(255, 255, 255, 0.92)` 与 `white`；未继续只修组件 fallback，而是同步修正 surface skin 变量源。
