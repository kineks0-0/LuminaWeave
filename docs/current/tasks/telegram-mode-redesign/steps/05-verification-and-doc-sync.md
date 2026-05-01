# Step 05: Verification and Doc Sync

## 目标

定义 Telegram 模式重设计的验证流程和文档同步规则，确保实现完成后可恢复、可验收、不会让 PDR/System Design 继续漂移。

## 输入与前置条件

- Step 01 至 Step 04 已完成或阶段性完成。
- 实现没有越权修改核心会话、同步、持久化和 Prompt 链路。

## 状态

已完成首轮验证与本轮回归修正验证，仍需真实宿主视觉走查。

## 需要修改的子系统

- 本步骤默认只更新任务文档中的验证记录。
- 若实现新增 surface contract、desktop mode setting 或改变上下文工具承载规则，则同步更新 `docs/overall/PDR.md` 与 `docs/overall/system_design.md`。
- 不修改产品源码来完成本步骤；产品源码验证结果只记录在本文档中。

## 验证命令

在 extension 子项目执行：

```powershell
cd D:\LuminaWeave\luminaweave-extension
npm run type-check
npm run test
npm run build
```

`npm run build` 可在纯文档阶段跳过；进入产品源码实现阶段后，至少应运行 `type-check`，影响聊天 UI 或 shell 行为时应运行相关测试。

## 手动验收

- 桌面宽屏：
  - 弥散蓝背景接近 `Group 11.svg` 与精修稿。
  - 左栏角色主行点击进入角色概览。
  - 左栏角色选中态接近概念稿：浅蓝整行圆角高亮、细边框、头像白描边。
  - 点击左栏 `筛选` 显示二级菜单：`全部会话 / 未读优先 / 收藏角色 / 最近更新`。
  - 左栏具体历史会话点击进入聊天。
  - 概览页“新聊天”创建成功后进入聊天。
  - 聊天顶栏按钮为 `搜索 / 右侧栏 / 更多`。
  - 点击聊天顶栏右侧栏按钮打开或聚焦 `telegram-profile`。
  - 右侧栏显示角色资料页 / 角色资料侧栏，不显示状态摘要卡片页。
  - 默认三栏为圆角外边距样式，顶部存在设计稿式呼吸空间。
  - 关闭顶部留白后，三栏顶部贴近容器但仍保持当前 `panelChromeStyle` 的面板逻辑。
  - `所有` tab 中 `启动台` 置顶、`制卡工坊` 第二，视觉与角色行一致。
  - `角色` tab 只显示角色，`工具` tab 只显示工具。
  - 点击工具入口只切换主区 surface，不创建聊天、不打开会话。
  - 左右拖拽调整宽度时，中间聊天区不小于最小可用宽度；刷新后宽度保持。
- 桌面窄宽：
  - 1180px 附近左栏 compact 后不挤压聊天区。
  - 右栏按 `rightInfoPanel` 设置正常收起或显示。
- 移动端：
  - 角色概览为单列布局。
  - 移动资料页参考 `D:/LuminaWeave/output/imagegen/telegram-mode-mockups/mobile-character-overview.png` 的顶部返回/更多、角色 hero、快速操作、最近聊天、所有聊天记录、底部“开始新聊天”结构。
  - 底栏不遮挡内容。
  - IME 弹出时 composer 可见。
- 数据边界：
  - 无角色、无会话、无头像、长角色名、长摘要、多会话均不溢出。

## 文档同步规则

如果实现只改变 Telegram shell、surface skin、CSS token 和表层交互，不改变核心数据流，则只需更新本任务文档并在最终回复声明：

> 本次修改未改变核心系统设计。

如果实现引入以下任一变化，必须同步更新 `docs/overall/PDR.md` 与 `docs/overall/system_design.md`：

- 新增 surface contract。
- 新增 desktop mode setting。
- 改变角色频道或会话打开的数据流。
- 改变上下文工具承载规则。
- 新增业务数据源或状态派生服务。

## 完成条件

- 所有步骤文档状态更新为完成。
- 验证命令与手动验收结果记录在本文件末尾。
- 若发生架构级变化，PDR/System Design 已同步。
- 完成后将整个任务目录移动到 `docs/archive/completed-tasks/telegram-mode-redesign/`，并修复相关链接。

## 验收检查

- 本文件记录了实际执行的验证命令与结果。
- README、Step 02、Step 03、Step 04 均已记录本轮回归修正项。
- 手动验收项均已确认或明确标注未验证原因。
- PDR/System Design 是否需要同步已有明确结论。
- 任务完成归档前，README 和所有 steps 的状态均已更新。

## 验证记录

- `npm run type-check`：通过。
- `npm run test -- src/theme/__tests__/themeRegistry.test.ts src/platform/desktop/__tests__/DesktopModeRuntimeRegistry.test.ts src/shell/__tests__/dynamicTabResolver.test.ts`：通过，3 个测试文件 / 21 个测试。
- 2026-04-30 本轮回归修正后复跑 `npm run type-check`：通过。
- 2026-04-30 本轮回归修正后复跑 `npm run test -- src/theme/__tests__/themeRegistry.test.ts src/platform/desktop/__tests__/DesktopModeRuntimeRegistry.test.ts src/shell/__tests__/dynamicTabResolver.test.ts`：通过，3 个测试文件 / 21 个测试。
- 2026-04-30 补充 `rightInfoPanel: hidden/auto` 下顶栏按钮显式打开资料栏后复跑 `npm run type-check`：通过。
- 2026-04-30 补充 `rightInfoPanel: hidden/auto` 下顶栏按钮显式打开资料栏后复跑定向测试：通过，3 个测试文件 / 21 个测试。
- 2026-04-30 Telegram 桌面三项增强后复跑 `npm run type-check`：通过。
- 2026-04-30 Telegram 桌面三项增强后复跑 `npm run test -- src/theme/__tests__/themeRegistry.test.ts src/platform/desktop/__tests__/DesktopModeRuntimeRegistry.test.ts src/shell/__tests__/dynamicTabResolver.test.ts src/composables/__tests__/useWidgetPanels.test.ts`：通过，4 个测试文件 / 26 个测试。
- 2026-04-30 运行 `npm run build`：通过。Vite 仅提示插件耗时统计，未出现构建错误。
- `npm run test`：未通过，失败集中在既有 Forge DSL / Prompt 文档相关测试：
  - `src/api/core/__tests__/ViewComponentRegistry.test.ts`
  - `src/api/core/__tests__/LVParser.test.ts`
  - `src/api/core/__tests__/ForgeDSL-Split.test.ts`
  - `src/api/core/__tests__/ForgePromptContextService.test.ts`
  - `src/api/core/__tests__/PromptBuilder.test.ts`

上述失败不在本次 Telegram Shell / Surface / theme token 修改范围内。

## 文档同步结论

本次新增了 Telegram desktop mode settings，并调整 Telegram shell 的左栏工具入口与左右栏宽度 view-model。该改动仍未改变核心会话、同步、持久化、Prompt 或 ST adapter 设计，但需要同步全局文档。`docs/overall/PDR.md` 与 `docs/overall/system_design.md` 已更新 Telegram 三栏样式设置、工具入口和可调宽度边界。
