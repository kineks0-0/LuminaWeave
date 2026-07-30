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

## 13. Forge VFS/Git 持久化测试收尾修复 (2026-06-19)
- **错误消息**: `npm run test` 中 `ForgeWorkspaceVersionManager.test.ts` 引用已移除的 `ForgeWorkspaceVersionManager`；`ForgeSkillRegistry.test.ts` 发现 `forge-project-writer` 注册描述和 `SKILL.md` frontmatter 描述不一致；`ResourceRuntime.test.ts` 中 `/workspaces` 写入、cwd 保持、补全相关用例返回非零退出码。
- **根本原因假设**: 版本事实源迁移到 Git 后旧版本管理测试未删除；`forge-project-writer` 的资源 frontmatter 未同步为新描述；`just-bash` 的 `MountableFs` 会把 `/workspaces/forge/...` 转成挂载内 `/forge/...` 调用子文件系统，`WorkspaceBashFs` 在权限检查和底层 FS 路径传递时没有统一处理挂载内路径与完整挂载路径。
- **验证手段**: 删除旧版本管理测试、同步 `SKILL.md` 描述、让 `WorkspaceBashFs` 先归一化挂载内路径再执行权限检查和文件操作，然后运行 focused 测试与完整验证命令。
- **什么起作用了**: 补齐 `binary` encoding 支持、测试隔离文件系统名、Git 版本展示类型收窄和 runtime store 类型收窄后，`npm run test` 通过 159 个测试文件、786 个用例，2 个用例跳过；`npm run type-check` 通过；`cargo check` 通过。
- **失败尝试**: 首次 focused 测试暴露 `unsupported encoding: binary`；改用 lightning-fs `wipe` 做测试隔离会触发 Web Locks 的异步 `AbortError`，随后改为给测试分配独立文件系统名。

## 14. Tauri dev 存储占用 SQL 权限修复 (2026-06-19)
- **错误消息**: `tauri run dev` 中加载存储占用时出现 `sql.load not allowed. Permissions associated with this command: sql:allow-load, sql:default`，并导致 `Failed to save independent JSON`。
- **根本原因假设**: Tauri SQL 插件已经注册，但 `src-tauri/capabilities/default.json` 未给主窗口授予 SQL capability；`TauriSqliteExtensionStore` 首次访问会执行 `Database.load`、建表、建索引和写入，因此至少需要 `sql:default` 与 `sql:allow-execute`。
- **验证手段**: 新增 `TauriSqliteCapability.test.ts` 直接读取默认 capability 并断言 SQL runtime store 所需权限，先运行 focused 测试复现失败。
- **什么起作用了**: 在默认 capability 中加入 `sql:default` 和 `sql:allow-execute`，让 Tauri dev 环境允许 SQLite runtime store 加载和写入；`npm run test -- --run src/api/core/__tests__/hal/TauriSqliteCapability.test.ts`、`npm run test`、`npm run type-check`、`cargo check` 均通过。
- **失败尝试**: 首次 focused 测试确认默认权限仅包含 `core:default` 与 `opener:default`。

## 15. Forge Agent bash 网络授权与 curl 本地 I/O 修复 (2026-06-19)
- **错误消息**: Forge Agent 的 `bash` 联网命令需要模型先手动调用 `lw-permission request network`，缺少 grant 时会直接把授权失败作为工具失败返回；`network-request` 模式还会拒绝 `curl -o`、`curl -T` 等本地文件输入输出参数。
- **根本原因假设**: Forge pi 工具桥接层只复用了 shell 内部权限命令，没有在 Agent runtime 与 Forge UI 之间建立即时授权事件；同时 `ForgeWorkspaceSearchShell` 把 `curl` 的本地文件 I/O 当作绕过写入服务的风险统一拦截，未考虑 semantic bash fs 的 `writeLog` 已能回流到 `ForgeWorkspaceWriteService`。
- **验证手段**: 先新增 focused 测试，覆盖 `curl -o` 写入、无 grant 时返回 pending approval、Composer surface 与 Review surface 分流，再实施单一修复。
- **什么起作用了**: 新增 Composer surface 授权投影、`ShellPermissionRequest` 绑定、批准后恢复执行原始 `bash` 命令、拒绝后不执行网络请求，并移除 `network-request` 下对 `curl` 本地文件 I/O 参数的拒绝逻辑；`npm run test -- --run src/api/core/__tests__/forge/ForgeWorkspaceSearchShell.test.ts src/api/core/__tests__/forge/ForgePiToolBridge.test.ts src/api/core/__tests__/forge/ForgePiAgentSession.test.ts src/stores/__tests__/useForgeStore.test.ts` 通过 4 个测试文件、48 个用例；完整 `npm run test` 通过 160 个测试文件、795 个用例，2 个用例跳过；`npm run type-check` 通过。
- **失败尝试**: 首次 focused 测试复现了旧行为：`curl -o` 仍被 `curl local file input/output is blocked` 拦截，`useForgeStore` 缺少 Composer/Review surface 分流，`ForgePiToolBridge` 未返回 pending network approval；后续将直接调用 bridge approval 的测试修正为先注册 pending approval，保持 pending 投影由 `ForgePiAgentSession` 负责。

## 16. Forge Composer 网络授权域名记忆与线程错位修复 (2026-06-19)
- **错误消息**: Forge Agent 网络授权批准后缺少“后续请求都允许”的明确动作；切换到新协作线程后，旧线程 pending 网络授权仍可能被 Composer 取为第一个授权项，点击同意会把 UI 投影恢复到旧线程；`curl ... 2>&1` 在 `network-request` 模式下被误报为 `redirection is blocked in network-request shell`。
- **根本原因假设**: Composer 授权队列只按 `displaySurface: 'composer'` 过滤，没有绑定当前 `forgeProjectId / conversationId / sessionId`；`ForgePiToolBridge.resolveToolApproval()` 批准 shell permission 时没有区分单次授权和持久同域名 grant；`ForgeWorkspaceSearchShell` 的重定向检测把文件描述符复制 `2>&1` 与文件写重定向混为一类。
- **验证手段**: 先新增 focused 测试，覆盖 `2>&1` 诊断重定向、`single_use` grant 过期、`domain` grant 复用、Composer pending approval 按当前协作线程过滤。
- **什么起作用了**: `ShellPermissionService.expireGrant()` 支持单次授权执行后失效；Composer 授权按钮拆分为“允许一次”和“后续都允许”；pending approval 带上 `forgeProjectId / conversationId / sessionId` 并由 `composerToolApprovalsForSession()` 过滤当前线程；重定向解析允许 `2>&1` 这类文件描述符复制但继续拦截文件写重定向。`npm run test -- --run src/api/core/__tests__/forge/ForgeWorkspaceSearchShell.test.ts src/api/core/__tests__/forge/ForgePiToolBridge.test.ts src/stores/__tests__/useForgeStore.test.ts` 通过 3 个测试文件、44 个用例；approval/runtime 邻近回归 6 个测试文件、24 个用例通过；完整 `npm run test` 通过 160 个测试文件、798 个用例，2 个用例跳过；`npm run type-check` 通过。
- **失败尝试**: 首次 focused 测试复现了预期旧行为：`composerToolApprovalsForSession` 不存在，`2>&1` 被误判为写重定向，`single_use` 批准后 grant 仍保留；域名 grant 用例首次断言了不存在的 `AgentToolResult.text` 字段，随后按真实 `content[].text` 结构修正测试。

## 17. Forge 项目中心项目菜单缺少新建对话与菜单裁剪修复 (2026-06-19)
- **错误消息**: 对话管理 / 项目中心中项目右键菜单缺少“新建对话”；增加菜单项后菜单仍可能被项目树滚动容器裁剪。
- **根本原因假设**: `buildForgeProjectCenterMenu('project')` 没有暴露项目级 `create-thread` 动作，`ForgeSessionBrowser.vue` 也没有把该动作转发到现有 `createWorkspaceThread(projectId)` 创建链路；同时 `.project-tree` 使用 `overflow: auto`，绝对定位的 `.project-menu` 会被该滚动容器裁切。
- **验证手段**: 先扩展 `forgeProjectCenterPresentation.test.ts`，断言项目菜单必须包含 `create-thread / 新建对话`，并断言项目树菜单容器不再使用 `overflow: auto` 裁剪菜单。
- **什么起作用了**: 在项目菜单模型中加入 `create-thread`，在 `ForgeSessionBrowser.vue` 中映射 `Plus` 图标并调用 `store.createWorkspaceThread(row.projectId)` 后刷新 / 选中新线程；将 `.project-tree` 调整为 `overflow: visible`，由外层项目中心滚动区域承接滚动。`npm run test -- --run src/plugins/forge/__tests__/forgeProjectCenterPresentation.test.ts` 通过 1 个测试文件、3 个用例；`npm run test -- --run src/stores/__tests__/useSessionIndexStore.test.ts` 通过 1 个测试文件、6 个用例；`npm run type-check` 通过。
- **失败尝试**: 首次扩展后的 focused 测试复现了旧行为：项目菜单数组缺少 `create-thread`，`.project-tree` 样式仍包含 `overflow: auto`。

## 18. Forge 网络授权批准后 tool result 孤立消息修复 (2026-06-19)
- **错误消息**: 联网授权点击同意后，模型请求返回 `400 Messages with role 'tool' must be a response to a preceding message with 'tool_calls'`。
- **根本原因假设**: `ForgePiAgentSession` 在 pending approval 阶段只把 `approval_needed` 写入会话树，tool-only assistant 消息因为没有最终文本没有进入 `piSession`；批准后如果 in-memory agent state 中找不到原始 assistant `toolCall`，`replacePendingApprovalWithToolResult()` 会直接追加 `toolResult`，形成 OpenAI 不接受的孤立 tool 消息。即使当轮未失败，后续从 `piSession` 重放也可能只有 `toolResult` 而没有前置 assistant `toolCall`。
- **验证手段**: 扩展 `ForgePiAgentSession.test.ts`，模拟 bash 网络请求返回 pending approval、用户批准后继续，并断言继续前的 agent messages 与后续 Prompt Preview 的 branch messages 都保持 `assistant toolCall -> toolResult` 配对。
- **什么起作用了**: 在 `tool_execution_start` 时为 tool call 写入可重放的 assistant tool-call message；批准恢复时若 in-memory agent state 缺少匹配 tool call，则从会话树取回该 assistant tool-call message 并插入到真实 `toolResult` 前；找不到配对时停止自动续写，避免继续发出非法 provider 请求。`npm run test -- --run src/api/core/__tests__/forge/ForgePiAgentSession.test.ts` 通过 1 个测试文件、8 个用例；`npm run type-check` 通过。
- **失败尝试**: 首次新增 focused 测试复现了旧行为：批准后继续前 `toolResult` 位于消息列表第 0 条，没有任何前置 assistant tool call；首次类型检查还发现新增测试 fixture 缺少完整 `ForgeExecutionRequest` 字段，随后按真实 request 结构补齐。

## 19. Forge 网络授权等待不再作为非失败工具结果返回 (2026-06-24)
- **错误消息**: Forge Agent `bash(network-request)` 缺少 network grant 时，等待用户批准被编码为非失败的 `approval_pending` 工具结果；用户批准后应当执行原始工具并继续 Agent，而不是把“等待授权”作为模型可见工具结果语义。
- **根本原因假设**: 授权等待属于 tool-call 前置策略控制流，但旧实现把它放在 `bash.execute()` 的返回值里，再由 `ForgePiAgentSession` 从 `tool_execution_end` 反解析为 `tool_approval_needed`。这会让权限等待、工具结果和模型消息配对三种语义耦合。
- **验证手段**: 先改 focused 测试，断言 `ForgePiToolBridge.requestToolApproval()` 在工具执行前创建 Composer 网络授权请求；`ForgePiAgentSession` 通过 Agent `beforeToolCall` 投影 `tool_approval_needed`，并且不会产出对话侧 `tool_result`。
- **什么起作用了**: 将网络授权预检移到 `beforeToolCall`：Bridge 负责创建 `ShellPermissionRequest` 并缓存原始 tool call，Session 负责投影 `tool_approval_needed`，等待授权期间吞掉 pi-agent-core 因 block 生成的临时 toolResult；批准后 `resolveToolApproval()` 继续执行原始 `bash` 并把真实 `toolResult` 接回对应 assistant tool call。`npm run test -- --run src/api/core/__tests__/forge/ForgePiToolBridge.test.ts src/api/core/__tests__/forge/ForgePiAgentSession.test.ts` 通过 2 个测试文件、26 个用例；完整 `npm run test` 通过 160 个测试文件、800 个用例，2 个用例跳过；`npm run type-check` 通过。
- **失败尝试**: 首次红灯测试确认旧实现没有 `requestToolApproval()`，且 Session 没有 `beforeToolCall` 授权入口；首次类型检查暴露 hook 返回类型、授权事件联合类型收窄和 `execute` 入参类型不匹配，随后按真实 pi-agent-core API 修正。

## 20. Forge 网络授权等待期间提前完成回复修复 (2026-06-24)
- **错误消息**: Forge Agent 发起 `bash(network-request)` 后，Composer 已显示网络授权卡片，但 Agent 仍提前结束本轮并回复“网络请求正在等待你的授权”等文本，表现为跳过联网结果继续 loop。
- **根本原因假设**: `beforeToolCall` block 只让 pi-agent-core 的工具循环以 `terminate` 结束，但 `ForgePiAgentSession.prompt()` 在 `agent.prompt()` 返回后仍按普通完成路径解析最后一个 assistant message，并发出空 `stream_done / turn_end / agent_end`；随后 `ForgeRuntimeActionController.dispatchWorkspaceCommand()` 在 finally 中看到 `isGenerating` 仍为 true，又强制回收生成态和 running operation。
- **验证手段**: 扩展 `ForgePiAgentSession.test.ts`，断言 pending network approval 后不会产生 `stream_done`；扩展 `ForgeRuntimeActionController.test.ts`，断言 Composer 授权待处理时 dispatch 返回后保留生成态和运行中操作，拒绝授权时再清理生成态。
- **什么起作用了**: `ForgePiAgentSession` 增加 pending approval wait 记录，授权待处理时只返回 session snapshot，不投影最终 assistant 回复、不发 `stream_done`；`ForgeRuntimeActionController` 增加 Composer pending 检查，dispatch 收尾时保留 `isGenerating` 和 running operation，拒绝授权时显式清理。`npm run test -- --run src/api/core/__tests__/forge/ForgePiToolBridge.test.ts src/api/core/__tests__/forge/ForgePiAgentSession.test.ts src/api/core/__tests__/forge/ForgeRuntimeOrchestrator.pi-core.test.ts src/api/core/__tests__/forge/ForgePiRuntimeClient.test.ts src/plugins/forge/__tests__/ForgeRuntimeActionController.test.ts src/stores/__tests__/useForgeStore.test.ts` 通过 6 个测试文件、50 个用例。
- **失败尝试**: 首次 focused 测试复现了 pending approval 后仍然出现空 `stream_done`，以及 dispatch finally 强制把 `isGenerating` 设为 false；随后补充测试发现 finally 中直接 `return` 会吞掉原始 dispatch 返回值，改为条件分支后通过。

## 21. Forge Composer 网络授权范围与关闭时机修复 (2026-06-24)
- **错误消息**: 用户点击“同意”后 Composer 授权面板仍停留到真实 curl 执行完成；“允许一次”不符合期望，实际需要批准一次后同域名自动通过，并提供“后续都允许”批准所有后续网络请求。
- **根本原因假设**: `ForgeToolApprovalGrantMode` 只表达 `single_use / domain`，`ShellPermissionScope` 也只能表达 `urlPrefix`；Composer 调用 `resolveToolApproval()` 时等待 runtime resume 完成后才更新本地 approval 状态。
- **验证手段**: 扩展 `ForgePiToolBridge.test.ts`，断言 `grantMode: 'all_network'` 会保留 `allNetwork` network grant，并允许不同域名后续请求通过；扩展 `ForgeRuntimeActionController.test.ts`，断言本地 approval resolution 发生在等待 runtime resume 之前。
- **什么起作用了**: 为 `ShellPermissionScope` 增加 `allNetwork`，让 `ShellPermissionService` 与 `ShellNetworkPolicyService` 识别全局 network grant；将 Composer 主批准按钮改为“允许此域名”，第二按钮改为 `grantMode: 'all_network'`；`ForgeRuntimeActionController` 在 await runtime 前先调用 store 本地 resolve，点击批准或拒绝后立即关闭授权覆盖态。`npm run test -- --run src/api/core/__tests__/forge/ForgePiToolBridge.test.ts src/plugins/forge/__tests__/ForgeRuntimeActionController.test.ts` 通过 2 个测试文件、25 个用例；授权邻近回归 `npm run test -- --run src/api/core/__tests__/forge/ForgePiToolBridge.test.ts src/api/core/__tests__/forge/ForgePiAgentSession.test.ts src/api/core/__tests__/forge/ForgeRuntimeOrchestrator.pi-core.test.ts src/api/core/__tests__/forge/ForgePiRuntimeClient.test.ts src/plugins/forge/__tests__/ForgeRuntimeActionController.test.ts src/stores/__tests__/useForgeStore.test.ts` 通过 6 个测试文件、52 个用例；`npm run type-check` 通过；完整 `npm run test` 通过 160 个测试文件、804 个用例，2 个用例跳过。
- **失败尝试**: 首次 focused 测试复现了旧行为：`all_network` 批准后 grant scope 仍为同域名 `urlPrefix`，ActionController 没有在等待 runtime promise 前调用本地 resolve。

## 22. Forge 网络授权批准后续跑流式输出阻塞问题记录 (2026-06-27)
- **错误消息**: Forge Agent 发起联网搜索并等待 Composer 授权时，点击同意后授权卡片会关闭，但后续模型回复没有边生成边更新 UI，而是等 `curl` 和 `agent.continue()` 整体完成后才一次性更新。
- **根本原因假设**: 普通 `runTurn` 路径通过 `ForgeRuntimeOrchestrator.runPiRequest()` 给 `runPiTurn` 传入 `onRuntimeEvent`，`stream_chunk` 会实时进入 `handleRuntimeEvent()` 和 `applyRuntimeEffects()`；授权批准路径通过 `ForgeRuntimeOrchestrator.resolveToolApproval()` 直接 await `resolvePiToolApproval()`，没有为 approval continuation 传入实时事件回调。`ForgePiAgentSession.resolveToolApproval()` 在 `agent.continue()` 中会产生 `stream_chunk`，但续跑时 `eventSink.onRuntimeEvent` 为空，事件只进入返回数组，等续跑完成后才由 Orchestrator 批量 apply。
- **验证手段**: 代码审计确认 `ForgePiRuntimeClientTurnInput` / `ForgePiCoreRuntimeTurnInput` 有 `onRuntimeEvent`，但 approval result 接口没有对应 live event 通道；`ForgePiAgentSession.handleAgentEvent()` 会在 message update 时生成 `stream_chunk` 并调用 `input.onRuntimeEvent?.()`，而 approval continuation 设置的 `eventSink` 没有该回调。
- **什么起作用了**: 暂未修复。本条先记录问题与断裂点，后续应补 approval continuation 的 live event pipeline，并增加回归测试断言批准后 `stream_chunk` 在 `resolveToolApproval()` promise settle 前已到达 UI/store。
- **失败尝试**: 未尝试代码修复；本次仅完成根因分析和文档记录。
- **2026-07-29 复现**: 在公共 Agent Runtime 事件身份字段改为必填并移除 Forge 旧 stream/tool transport 事件后，`npm run type-check` 稳定失败。错误集中在 Orchestrator、CardMakerStore、Forge inspector、旧 stream presentation 测试和 approval 调用仍引用 `stream_chunk` / `stream_done` / `tool_call` / `tool_result` 或旧参数顺序；Agent Runtime 测试 fixture 同时缺少新增的 `sessionId` / `turnId`。
- **2026-07-29 根本原因假设**: 实时数据流仍有两条所有权路径：普通生成依赖 Forge transport 事件，授权续跑依赖完成返回值。公共 `AgentRuntimeEventBus` 已具备 session/turn scoped 实时事件，但 Forge 尚未建立唯一 presentation 订阅，因此旧 transport 消费者无法直接删除。
- **2026-07-29 验证计划**: 先用失败测试固定 `AgentRuntimeEvent + AgentRuntimeSnapshot -> ForgeRuntimeEffect[]` 的纯映射，再让 CardMakerStore 在 Pinia scope 内订阅并串行应用 effect；最后删除旧 transport 分支，并断言 approval Promise 完成前聊天气泡已经收到 `message_update`。
- **2026-07-29 最终根因**: 普通执行和授权续跑由两条不同的 Forge transport 消费路径驱动；续跑的 `agent.continue()` 事件只积存在 Promise 返回值，且共享 runtime snapshot 没有按 session/turn 隔离，导致 UI 只能在续跑完成后批量应用。另有一个无 EventBus 的 AgentSession 分支在 `message_end` 找不到 runtime message ID 时提前返回，遗漏 assistant session entry。
- **2026-07-29 有效修复**: 建立按 `sessionId` 分仓的 `AgentRuntimeEventBus` 和 scoped subscription；Forge 在每个 pi `message_start` 生成稳定消息 ID，普通执行与授权续跑统一通过 runtime message/tool lifecycle presentation 投影。批准续跑复用原 session/turn、等待授权期间不结束 turn，pending tool 在批准/拒绝/失败后严格发出对应 `tool_execution_end` 并清理。`message_end` 不再因缺少 EventBus message ID 而跳过 assistant 持久化；订阅 listener 异常被隔离并记录稳定日志。
- **2026-07-29 失败尝试**: 首轮 focused 测试暴露 plain provider-native text 未写入 assistant entry，根因是 runtime message ID 的早退分支；按旧 `requestId` 断言消息 ID 的 Core Runtime 测试也不再符合新协议。修正生产早退逻辑和测试断言后，新增 listener 异常回归测试通过。
- **2026-07-29 验证结果**: Agent Runtime、Forge core/session/runtime client、Forge presentation/orchestrator/action controller、CardMakerStore 和 Forge store 定向测试通过（78 个测试文件、338 个用例）；EventBus listener 隔离回归通过（6 个用例）。随后重新执行 extension `npm run type-check`（退出码 0）、`npm run test`（166 个测试文件、826 个用例通过，2 个跳过）和 `npm run build`（退出码 0；仅保留既有 chunk 体积 warning）。

## 23. pi-ai 0.80.2 类型导出兼容修复 (2026-06-27)
- **错误消息**: `npm run type-check` 失败：`src/api/core/agent-runtime/model/PiAiBrowserNexusProvider.ts` 中 `Provider<Api>` 与字符串 provider id 互不兼容；`src/api/core/forge/agent-app/model/ForgePiNexusProvider.ts` 从 `@earendil-works/pi-ai` 导入 `streamSimple` 失败，报 `Module '"@earendil-works/pi-ai"' has no exported member 'streamSimple'.`
- **根本原因假设**: `@earendil-works/pi-ai@0.80.2` 根入口不再导出旧全局 `streamSimple`，该函数位于 `@earendil-works/pi-ai/compat`；同时根入口的 `Provider` 已不是旧的 provider id 字符串类型，当前 Nexus adapter 应按 `Model<Api>['provider']` 对齐公开模型结构。
- **验证手段**: 修改前已运行 `npm run type-check` 复现；修复后重新运行 type-check、pi 依赖守卫和 agent-runtime / Forge pi 相关 focused 测试。
- **什么起作用了**: `PiAiBrowserNexusProvider.ts` 改用 `Model<Api>['provider']` 表达 Nexus provider id；`ForgePiNexusProvider.ts` 从 `@earendil-works/pi-ai/compat` 导入旧 `streamSimple`。`npm run type-check` 通过；`npm run test -- --run src/api/core/__tests__/forge/ForgePiDependencyGuard.test.ts` 通过 1 个测试文件、5 个用例；`npm run test -- --run src/api/core/__tests__/agent-runtime src/api/core/__tests__/forge/ForgePiAgentSession.test.ts src/api/core/__tests__/forge/ForgePiToolBridge.test.ts src/api/core/__tests__/forge/ForgePiNexusProvider.test.ts src/api/core/__tests__/forge/ForgePiModelRegistry.test.ts` 通过 17 个测试文件、86 个用例；`npm run build` 通过。
- **失败尝试**: 首次 `npm run type-check` 暴露上述 7 个 TypeScript 错误；未尝试修改运行时数据流。

## 24. 主题桌面组合能力被 Shell 与 Chat 耦合阻断 (2026-07-29)

- **错误表现**: `DesktopModeManifest` 只能描述 shell、preset、skin 和 renderer variant，无法声明角色列表、会话列表、消息流、输入区与 Activity slot 的组合。Traditional/Freeform Shell、Workspace 和 `ChatStream.vue` 仍直接持有业务组件与模式分支，第三方桌面模式不能在稳定契约下自由组合官方组件。
- **根本原因假设**: 已通过代码与结构测试确认三条结构性根因：桌面模式、Surface Runtime 和 Chat presentation 缺少共同的 headless domain runtime；旧 `SurfaceRuntimeContext` 使用开放 contract、`unknown` state 和任意属性透传；`useChatStore` 与 `useConversationContextStore` 并存，使状态和命令所有权无法收敛。
- **验证手段**: 先以结构测试固定 typed runtime、surface contract、composition schema、订阅销毁和错误隔离行为，再逐层迁移 Chat、Shell、Workspace 与四个内置模式；每层迁移后运行定向测试与 type-check。
- **任务 3 验证中发现的错误消息**: `npm run type-check` 在 `src/App.vue(946,7)` 报 `TS2322`：`WorkspaceSurfaceOutletProps<SurfaceContractId>` 不能赋给 `WorkspaceWindowEntry.props` 的 `Record<string, unknown>`，因为封闭的强类型 props 没有任意字符串索引签名。
- **任务 3 类型错误根本原因假设**: `WorkspaceWindowEntry` 沿用旧 Surface 任意 attrs 时期的 `Record<string, unknown>`，但该容器只把 props 整体交给 Vue `v-bind`，不读取任意键；Typed Surface Runtime 返回封闭 props 后，旧容器约束反而要求开放索引签名。
- **任务 4 验证中发现的错误消息**: 首轮定向测试因 `ChatApplicationController` 和 `ConversationDomainService.editMessage()` 不存在而失败，确认 Chat 命令与状态仍分散。迁移 UI 后首次 `npm run type-check` 报 `ChatRoot.vue(9,8) TS2322` 与 `ChatStream.vue(522,84) TS2551`，原因是 `chatSessions`/`forgeSessions` 在 store 中仍声明为未收窄的 `ConversationSessionRef[]` 联合类型。
- **任务 4 类型错误根本原因假设**: 旧 ChatStream 依靠本地 `sourceId === 'chat'` filter 收窄会话类型，掩盖了 store 对两组 session 使用同一联合类型的事实；Controller 改为显式 props 后该错误边界被 TypeScript 正确暴露。
- **任务 4 审查回归错误消息**: Controller 与 presentation 边界测试首轮出现 5 个失败：第二个订阅抛错或初始 context 加载失败后取消函数未执行且无法重试；生成期间 edit 返回 `true`；`useConversationViewStore.ts` 仍存在；Prompt Inspector 缺少具名 `off()` 与 `clearTimeout(probeTimer)`。
- **任务 4 审查根本原因假设**: `start()` 在同一个 `Array.push()` 调用中求值两个订阅，后一个抛错时前一个 disposer 尚未入栈，同时 `started` 未复位；只有 send 检查实时生成状态；selection store 仍保留完整 `ConversationViewContext`；Prompt Inspector 在 setup 阶段注册匿名全局监听并丢弃定时器句柄。
- **什么起作用了**: 规划阶段采纳 ADR-0004，锁定 `DesktopExperienceRuntime + Official Surface Kit + DesktopModeManifest.composition` 三层结构，并明确不在进程内 SDK 引入 OpenAPI。任务 2 已落地五组 headless 领域能力和统一销毁生命周期。任务 3 已以 `SurfaceContractMap`、严格 Zod input schema、显式 `primarySurface`、批量原子注册、局部 renderer 错误边界和 disposer 隔离替换旧开放 Surface context；Shell 与 Workspace 已停止从插件 ID 推断主 contract。将 `WorkspaceWindowEntry.props` 收窄为容器实际需要的 `object` 后，封闭 Surface props 不再被迫声明任意索引签名；19 个定向测试文件、89 个用例通过，`npm run type-check` 通过。任务 4 新增 `ChatApplicationController` 统一 conversation/generation snapshot 与 Chat intents，`ChatRoot` 负责 scope，`ChatStream` 删除 generation 事件和 Domain Service 直连，旧 `useChatStore` 与未使用的 `useConversationViewStore` 删除；store 在状态源处按 `sourceId` 精确收窄 chat/forge session，并只保存 source/session/active leaf/meta 选择投影。Controller 启动失败会原子释放已建立订阅并允许重试；生成期间拒绝发送、编辑、删除、重生成、分支与自定义 Prompt，stop 只在 live chat 正在生成时接受；Prompt Inspector 在卸载时清理两个监听和延时探针。7 个定向测试文件、30 个用例通过，`npm run type-check` 通过。现有 runtime extension store 保持不变，普通 Tauri 继续使用 SQLite，本任务不迁移为 IndexedDB。
- **失败尝试**: 既有桌面模式重构已经收敛单注册源、目录和 shell payload，但只解决模式归属与外观分发，没有建立组件组合树和强类型业务能力边界，因此没有消除 Chat/Shell/Workspace 耦合。
  任务 3 首次 `npm run type-check` 暴露旧 `Record<string, unknown>` 容器约束与封闭 Surface props 不兼容；未向 Surface props 添加开放索引签名，而是修正 Shell 容器的真实类型边界。
  任务 4 未在 ChatStream 增加新的局部 store 或兼容事件分支；首次类型检查失败后未在 props 上使用强转，而是修正 store 的判别联合所有权。
  任务 4 首版 Controller 将两个 subscribe 放进同一次 `push()`，既没有失败原子性，也没有覆盖生成期间除 send 外的命令互斥；审查回归测试复现后改为逐项入栈、统一清理和统一生成态守卫。
- **任务 5 复现的错误消息**: `OfficialSurfaceKit.test.ts` 的设置预览用例失败，期望 Chat 插件声明 `settingsPreviewSurface: { contractId: 'chat.preview', input: {} }`，实际仍声明 `settingsPreviewComponent: ChatPreview`。代码检查同时确认会话组首次点击前后均显示展开：展示条件使用 `expandedSessionGroups[groupKey] !== false`，而 runtime 首次切换把未记录值从 `undefined` 写为 `true`。
- **任务 5 根本原因假设**: `ChatPreview` 已改为消费 typed Surface context，但 Settings 仍绕过 Surface Runtime 直接挂载 Vue component，导致 context、input 校验、theme 和局部错误边界全部缺失。会话列表则把“没有显式折叠记录”解释为展开，与 runtime 的布尔切换语义不一致。
- **任务 5 审查回归错误消息**: `TelegramMobileStack.vue` 继续向 `chat.main` 传入 `onTelegramBack` 与 `onTelegramOpenRoleProfile`，但新的 `ChatMainSurface.vue` 没有消费这两个字段；同时 Telegram chat route 明确隐藏 Shell stack bar，导致移动聊天页失去返回与角色资料入口。旧 `ChatStream.vue` 中的本地消息搜索和上下文工具菜单也随拆分被静默删除。
- **任务 5 审查根本原因假设**: Official Surface Kit 首版只验证了 typed context 与组件拆分，没有逐项核对旧 `ChatStream` 的公开 input 和模式路由责任；保留在 contract 中的 callback 因没有展示组件消费而成为无效 API。
- **任务 5 二次审查错误消息**: 全目录 presentation 边界扫描发现 `ChoiceBlock.vue` 仍注入 `lwApi`、调用 `useSettings()` 并直接执行 `generation.sendMessage()` 或发送 `FOCUS_MAIN_INPUT`；独立 transcript/composer surface 也没有共享输入草稿，无法用 typed intent 实现 `fill` 模式。
- **任务 5 二次审查根本原因假设**: 首版边界测试只列出一级组件，没有递归覆盖 MessageRenderer 的 block renderer；输入草稿仍是 `ChatComposer` 局部状态，导致消息 block 无法在不借助全局事件的情况下与 composer 协作。
- **任务 5 三次审查错误消息**: `MessageRenderer.vue` 仍直接导入 `api/storage.js` 并读取思维链显示与 Chat Reply 过滤设置，违反 presentation 只消费 typed surface context 的边界。
- **任务 5 三次审查根本原因假设**: `MessageRenderer` 从旧 `ChatStream` 拆出时只移除了 `any` 与 Choice 全局调用，遗留的设置读取没有进入 `ChatApplicationSurfaceState`，导致 presentation 仍穿透到存储层。
- **任务 5 四次审查回归错误消息**: `App.vue` 与 Timeline 仍分别发送 `SCROLL_TO_BOTTOM`、`FOCUS_MAIN_INPUT`，但删除 `ChatStream.vue` 后没有 typed 接收方；`chat.stream` skin 没有进入新的 `chat.main` Surface context，消息形态、头像位置与用户名设置失效；`lumina-chat.streamingEffect` 只保留设置声明，新的 streaming 组件没有消费；Controller 首次启动失败后 shared application 只记录日志，已挂载 Surface 保持空 snapshot。
- **任务 5 四次审查根本原因假设**: Official Surface Kit 迁移时只迁移了 conversation/generation 领域事件，没有把现有宿主 UI 命令适配为 `DesktopExperienceRuntime.activity` 的 typed command；桌面 skin 仍使用已删除组件的 `chat.stream` 标识，`SurfaceOutlet` 调用方又没有传入该 theme；消息 presentation 没有显式消费旧 skin 中已经存在的外观字段；shared application 没有为 Controller 已支持的失败重试建立启动生命周期。
- **任务 5 最终审查错误消息**: `useWorkspaceManager.ts` 与 Chat 设置预览仍使用裸 `SurfaceOutlet`，无法把 stage/current desktop skin 注入业务 surface；`ChatMessageRenderPreferences.ts` 直接依赖 `desktop-modes` 类型；`instant` 与 `typewriter` 都显示同一个无条件光标；用户消息也进入 `MessageRenderer`，会把用户输入中的 `<V>Choices(...)</V>` 解析为交互块。
- **任务 5 最终审查根本原因假设**: themed wrapper 迁移只覆盖了 Shell template，没有覆盖 Workspace 的程序化 component descriptor 和 Settings 预览；消息外观的中立值类型放在桌面模式层，迫使 Chat presentation 反向依赖具体模式模块；streaming 组件把光标与 effect 选择分开实现；消息组件没有保留旧实现中 user 只渲染 Markdown、assistant 才进入 LuminaView parser 的角色边界。
- **任务 5 提交前完整测试错误消息**: `npm run test` 的 `src/composables/__tests__/useWidgetPanels.test.ts > useWidgetPanels > should open temporary widget tabs on mobile` 失败，`openTab` 期望调用 1 次、实际调用 0 次；日志同时输出 `[SurfaceRuntime] Plugin primary surface unavailable`，完整结果为 1 个测试文件失败、182 个通过，1 个用例失败、911 个通过、2 个跳过。
- **任务 5 提交前完整测试根本原因假设**: 任务 3 已删除官方插件 ID 到 Surface contract 的硬编码映射，并要求 `getPrimarySurfaceContractIdForPlugin()` 只读取 `plugin.platformManifest.primarySurface`；生产 `lumina-settings` 明确声明 `primarySurface: 'settings.root'`，但 `useWidgetPanels.test.ts` 的插件 fixture 仍只提供 `id`、`name`、`icon` 和 `component`，测试数据没有同步到 manifest 单一事实源。
- **任务 5 有效修复**: Chat 插件通过 `settingsPreviewSurface` 让设置预览进入 `ThemedSurfaceOutlet -> SurfaceOutlet`；会话组只在 `expandedSessionGroups[groupKey] === true` 时展开；`ChatStream.vue` 拆为角色、会话、transcript、message、streaming、composer、toolbar、header 和 Prompt Inspector 等 typed presentation/surface。`ChatHeader.vue` 通过 `chat.main` input 消费返回、角色资料和 `onOpenPanel`：Telegram 移动端恢复返回与页面栈导航，桌面端恢复角色资料与右侧面板入口，两端均保留本地消息搜索、既有上下文工具与 Prompt Inspector，且 Chat presentation 不读取 Shell、Pinia、`lwApi` 或桌面模式 ID。旧 `SCROLL_TO_BOTTOM` / `FOCUS_MAIN_INPUT` 由 `ChatPresentationCommandService` 精确适配为封闭 typed command，经 `DesktopExperienceRuntime.activity` 和 Controller revisioned snapshot 投影给 transcript/composer；Surface 销毁后取消订阅。Choice block 只提交选项文本，renderer context factory 监听精确设置键 `lumina-chat.dialogueUIInteraction`，`fill` 写入 Controller 共享 `composerDraft`，`generate` 通过 `sendMessage` intent 提交；独立 transcript 与 composer surface 因此复用同一草稿状态。思维链显示、Chat Reply 过滤、消息形态、头像位置、用户名和 streaming effect 通过 typed state/theme 投影到 message/streaming renderer；Shell、Workspace 业务窗口和设置预览均用 `ThemedSurfaceOutlet` 注入 skin。`ThemeMessageShape` 与 `ThemeAvatarPlacement` 下沉到 Surface 中立类型并由 Desktop Mode 重导出；纯 `ChatStreamingPresentation` 映射保证只有 `typewriter` 显示光标；用户消息只经过 Markdown `TextBlock`，assistant 消息才进入 `MessageRenderer`。shared application 首次启动失败后只进行一次有界重试，释放后不再启动或更新。
- **任务 5 失败尝试**: 首轮设置预览测试复现了直接挂载 component 导致的 context 缺失；边界测试随后发现 `MessageRenderer.vue` 残留 `as any`。两处修复转绿后，审查才发现 Telegram callback 虽通过 Zod 校验却没有消费点，说明只验证 contract 声明不足以证明路由行为闭合。消息渲染设置测试首次绿灯验证使用了依赖单行格式的完整调用字符串，生产代码按多行格式化后未匹配；将断言收窄为 typed getter 与精确设置键后通过。首次运行 27 文件定向套件时 `telegramShellSplitStructure.test.ts` 的动态 import 在并行冷转换下超过 5 秒；该文件单独运行 3/3 通过，同一完整命令复跑 120/120 通过，因此没有修改产品逻辑或测试超时阈值。
- **任务 5 提交前完整测试有效修复**: 保持运行时只读取 manifest 的单一事实源，在 `useWidgetPanels.test.ts` 的 `lumina-settings` fixture 中补齐与生产插件一致的 `platformManifest.primarySurface: 'settings.root'`；没有恢复插件 ID 映射，也没有改变缺少主 Surface 时拒绝打开临时窗口的运行时行为。
- **任务 5 提交前完整测试验证结果**: 单文件复跑通过 1 个测试文件、5 个用例；随后 `npm run test` 通过 183 个测试文件、912 个用例，2 个用例跳过；`npm run type-check` 退出码 0。
- **任务 5 验证结果**: Official Surface Kit、Chat Controller/application scope、presentation command、CharacterChannelService、DesktopExperienceRuntime、GenerationDomainService、Surface Runtime、Desktop Mode、官方插件 manifest、Traditional/Freeform Shell、Workspace 投影与 Telegram Shell 结构定向测试通过（27 个测试文件、120 个用例）；`npm run type-check` 通过，`git diff --check` 无 whitespace error。Composition Runtime、内置模式迁移和真实桌面/移动浏览器验证仍属于后续任务。

## 2026-06-27 AgentRuntime pi compat review fixes

- 错误消息：
  - `PiExtensionLoader.load()` 中单个扩展 `importModule()` 抛错时会中断整个加载流程。
  - pi `tool_call` 兼容事件暴露 `args`，而真实 pi API 暴露可原地修改的 `input`。
  - `AgentRuntime.setup()` 在 extension setup 失败后重试会重复注册工具。
  - `AgentRuntime.setup({ reason: 'reload' })` 已公开 reload 参数，但不会重新扫描资源。
- 根本原因假设：
  - 首轮实现只覆盖 happy path 测试，缺少 extension load failure、pi API 原地 mutation、失败重试、reload lifecycle 的回归测试。
- 验证计划：
  - 先补失败测试，再逐项修复；修复后运行新增测试、agent-runtime 测试和 type-check。
- 什么起作用了：
  - `AgentRuntime` 将工具注册缓存为一次性初始化 promise，extension setup 失败后重试不再重复注册工具，仍保留首次扩展错误。
  - `AgentRuntimeExtensionHost` 在 `setup({ reason: 'reload' })` 时重新扫描静态资源，并把 scanner diagnostics 与 loader diagnostics 分开保存。
  - `PiExtensionLoader` 捕获单个模块导入失败并返回 diagnostics，后续扩展继续加载。
  - `PiExtensionCompatHost` 按 pi 源码兼容 `tool_call` / `tool_result` 的 `event.input`，支持原地修改参数，同时保留现有 `args` 返回兼容层；单个 pi factory 抛错会记录 diagnostics 并允许后续扩展继续 setup。
  - `npm run test -- --run src/api/core/__tests__/agent-runtime/AgentRuntime.test.ts src/api/core/__tests__/agent-runtime/PiExtensionCompatHost.test.ts src/api/core/__tests__/agent-runtime/PiExtensionLoader.test.ts` 通过 3 个测试文件、9 个用例。
  - `npm run test -- --run src/api/core/__tests__/agent-runtime` 通过 17 个测试文件、64 个用例。
  - `npm run test -- --run src/api/core/__tests__/agent-runtime src/api/core/__tests__/forge/ForgePiAgentSession.test.ts src/api/core/__tests__/forge/ForgePiToolBridge.test.ts src/api/core/__tests__/forge/ForgePiNexusProvider.test.ts src/api/core/__tests__/forge/ForgePiModelRegistry.test.ts` 通过 21 个测试文件、97 个用例。
  - `npm run type-check` 通过；`npm run build` 通过。
- 失败尝试：
  - 首次红测复现旧行为：setup 重试报 `Agent tool already registered: echo`，reload 扫描只执行 1 次，`event.input` 为 `undefined`，loader 的 `importModule()` 抛错会直接 reject。
