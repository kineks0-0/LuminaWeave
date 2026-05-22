# Tailwind System Migration Plan

## 决策

- 使用 Tailwind CSS v4。
- 使用 `@tailwindcss/vite` 接入 Vite。
- Tailwind class 统一使用 `tw:` 前缀。
- Tailwind v4 `prefix(tw)` 需要把前缀放在 variant 链最前面，例如 `tw:hover:bg-*`、`tw:focus:border-*`、`tw:max-[600px]:fixed`；不要使用 `hover:tw:*` 这类不会生成 utility 的旧写法。
- 禁用 Preflight，只导入 Tailwind theme/utilities。
- 新增 Lumina UI primitives，业务组件优先消费 UI 原语。
- `--lw-*`、Desktop Mode manifest、surface skin 继续作为主题真相源。

## 实施范围

第一轮需要覆盖：

- [x] Tailwind 构建接入。
- [x] `cn()` class 合并工具。
- [x] 第一批 UI 原语：
  - Button
  - IconButton
  - Input
  - Select
  - Textarea
  - Toggle
  - SegmentedControl
  - Slider
  - Panel
  - EmptyState
  - ModalShell
- 低风险组件迁移：
  - [x] EmptySurface
  - [x] GlobalConfirmationModal
  - [x] ToastNotification
  - [x] Launcher 简单面板：LauncherRoot
  - [x] Forge 简单 blocks：ForgeSummaryCardBlock、ForgeChecklistBlock、ForgeAuxPanelShell、ForgeInputBlock、ForgeSelectBlock、ForgeTextareaBlock、ForgeChoiceBlock、ForgeChoiceGroupBlock、ForgeFacetChecklistBlock、ForgeModePickerBlock、ForgeMissingFieldsBlock、ForgeMessageSubmitBlock、ForgeFormAssistBlock、ForgeLayerNavigatorBlock、ForgeAutoListBlock、ForgeEntryProposalBlock、ForgeMemoryProposalBlock、ForgeFormBlock
- Settings 控件迁移：
  - [x] SettingControl：通用 select/input/toggle/slider 入口接入 Lumina primitives；复杂分段控件与 skin CSS 暂保留。
  - [x] LuminaStepper
  - [x] SettingsRoot：壳层导航、面包屑、返回条与滚动容器基础布局接入 Tailwind / Lumina primitives；Telegram skin、deep 子布局与滚动条规则保留。
  - [x] SettingsUnified：页级 grid、section panel、block header、status badge 与低风险 action button 接入 Settings 局部原语 / Lumina primitives；业务区块内部布局继续分批迁移。
  - [x] SettingsUnified：meta grid、permission item、radio storage card、desktop mode summary 与 migration scope selector 接入 Settings inset/meta 原语；Telegram variant 与 DCC 细节样式保留。
  - [x] SettingsDetailed：基础容器、preview sticky 区与 detail content 面板接入 Tailwind utility；Telegram skin 覆写保留。
  - [x] NexusPresetManager：外层 section、header、标题图标区、header controls 与新增按钮接入 Tailwind / `LuminaButton`；复杂节点、拖拽和 model dropdown 保留。
  - [x] NexusPresetManager：API list、preset list、API item、preset group、item/group header 与 field grid 接入 Tailwind utility；字段 label、输入控件、节点卡片、拖拽和 model dropdown 保留。
  - [x] NexusPresetManager：节点卡片静态布局、内容区、字段组、底栏、索引徽标、拖拽手柄布局接入 Tailwind utility；拖拽状态、TransitionGroup 与 model dropdown 保留。
  - [x] NexusPresetManager：st-indicator、empty state、简单 icon button 等剩余低风险样式；本轮触碰到的 icon-only buttons 已补 `aria-label`。
  - [x] NexusPresetManager：节点排序按钮尺寸、布局、hover 位移与 disabled 状态接入 Tailwind utility；拖拽状态、TransitionGroup 与 model dropdown 保留。
  - [x] NexusPresetManager：section 标题、副标题、传输模式标签、字段 label 与节点序号 typography token 接入 Tailwind utility；表单输入 focus、compact select、拖拽状态、TransitionGroup 与 model dropdown 保留。
  - [x] NexusPresetManager：可编辑标题输入与传输模式 compact select 的外观、hover/focus 与尺寸规则接入 Tailwind utility；拖拽状态、TransitionGroup 与 model dropdown 保留。
  - [x] NexusPresetManager：accent icon 外观与添加备用节点按钮外壳接入 Tailwind utility；移除未引用的 `node-footer-actions` CSS；拖拽状态、TransitionGroup 与 model dropdown 保留。
  - [x] NexusPresetManager：模型选择器触发器外壳、内嵌输入框继承样式与展开按钮接入 Tailwind utility；model dropdown portal、options、移动端 overlay、拖拽状态与 TransitionGroup 保留。
  - [x] NexusPresetManager：模型下拉内部 header、搜索框、排序按钮、列表、空态、分组 label 与选项状态接入 Tailwind utility；model dropdown portal 定位、移动端 overlay、进入动画、拖拽状态与 TransitionGroup 保留。
  - [x] NexusPresetManager：节点拖拽手柄 cursor、touch-action、hover 与 active 外观接入 Tailwind utility；拖拽态/占位态、TransitionGroup、model dropdown portal 定位、移动端 overlay 与进入动画保留。
  - [x] NexusPresetManager：节点拖拽态与占位态视觉接入 `cn` + Tailwind utility；TransitionGroup、model dropdown portal 定位、移动端 overlay 与进入动画保留。
  - [x] NexusPresetManager：节点列表 `TransitionGroup` move/enter/leave 过渡接入显式 Tailwind class props；model dropdown portal 定位、移动端 overlay 与进入动画保留。
  - [x] NexusPresetManager：model dropdown portal 宽度约束、背景、边框、圆角、阴影、flex 与 overflow 壳层接入 Tailwind utility；portal 锚点定位、z-index、移动端 overlay 与进入动画保留。
  - [x] NexusPresetManager：model dropdown portal 桌面锚点定位接入 Tailwind utility；z-index、移动端 overlay 与进入动画保留。
  - [x] NexusPresetManager：model dropdown portal 层级从 scoped `z-index: 9999` 收敛到 Tailwind 固定层级 `tw:z-50`；移动端 overlay 与进入动画保留。
  - [x] NexusPresetManager：model dropdown portal animation 声明接入 Tailwind arbitrary animation utility，并收敛为 200ms ease-out；移动端 overlay 与 `dropdown-fade-in` keyframes 保留。
  - [x] NexusPresetManager：model dropdown portal `dropdown-fade-in` keyframes 迁移到全局 Tailwind utility layer；移动端 overlay 保留。
  - [x] NexusPresetManager：model dropdown portal 移动端 overlay 接入 Tailwind responsive utility；组件 scoped CSS 已清空移除。
  - [x] NexusPresetManager：修正 Tailwind v4 `tw` 前缀与 variant 的顺序，避免 `hover:tw:*` / `focus:tw:*` 等旧写法无法生成 utility。
  - [x] 全仓 Tailwind variant 前缀顺序修正：机械迁移 `luminaweave-extension/src` 内 `hover:tw:*` / `focus:tw:*` / `disabled:tw:*` / `data-[...]:tw:*` / responsive variant 等旧写法到 `tw:<variant>:*`。
  - [x] TelegramSettingsHome：根布局、hero、头像尺寸、分组、行布局与 copy 截断结构接入 Tailwind utility；Telegram 专属渐变、玻璃背景、hover 与 typography token 保留。
  - [x] SettingsUnified：同步/权限内容栈、迁移 action、差异面板、引擎设置项、LLM preset row、DCC 分区与 inline component 分隔线接入 Tailwind utility；旧 checkbox/toggle 外观、spinner keyframes、DCC label divider、Telegram skin 与移动端 deep 覆写保留。
  - [x] SettingsUnified：权限与引擎设置 switch 替换为 `LuminaToggle`；思维链模式与全局生成参数 select 替换为 `LuminaSelect`；补齐 switch 可访问名称，并移除说明文字上的无关联 `label` 语义。
  - [x] LuminaCheckbox：新增 checkbox 原语，并将 `SettingsUnified` 导入/导出范围多选迁移到该原语；移除局部 `lw-checkbox-label` CSS。
  - [x] SettingsUnified：同步按钮 spinner 改用 Tailwind `tw:animate-spin`；DCC 标题分隔线从 scoped pseudo-element 改为显式 DOM + Tailwind utility；移除局部 `spin` keyframes 与 `dcc-section-label::after` CSS。
  - [x] SettingsUnified：普通响应式 grid/flex 收尾规则与 settings card hover 规则接入 Tailwind utility / Settings 原语；保留 desktop-mode token skin、Telegram variant 与插件图标 deep SVG。
  - [x] SettingControl：小屏水平布局控件区与 stepper body 对齐规则接入 Tailwind responsive utility；保留控件 skin、Telegram / Discord variant 与 keyframes。
  - [x] SettingControl：字体选择器与选项说明提示的进入动画接入 Tailwind utility / 全局 keyframes；移除局部 `slide-in-top`、`slide-down` 与 `fade-slide` CSS。
  - [x] SettingControl：主题色 swatch 尺寸、圆角、边框、hover/active 状态与布局间距接入 Tailwind utility；保留 `theme-options` / `color-btn` 语义类名。

## 保留 CSS 的区域

以下区域第一轮不强制 Tailwind 化：

- ChatStream 气泡矩阵与角色级 typography variables。
- Timeline / LogicFlow 画布样式。
- Telegram / Discord shell 的模式级 skin。
- `:deep()` 依赖、滚动条、复杂 keyframes。
- safe-area / IME / host layout CSS variables。
- workspace drag / resize / motion 相关样式。

## 验收

每个批次至少运行：

```powershell
cd D:\LuminaWeave\luminaweave-extension
npm run type-check
npm run build
```

涉及 settings、Forge blocks、chat renderer 时追加：

```powershell
npm run test
```

视觉检查至少覆盖：

- Shadow DOM 开启与关闭。
- traditional / freeform / Telegram / Discord。
- Settings 控件。
- Forge 表单。
- modal / toast / empty state。
- 移动端安全区与输入框 IME。

## 文档影响

已同步更新：

- `docs/overall/system_design.md`
- `docs/overall/design/`

PDR 只需补充样式系统与开发体验演进，不应改动产品业务能力描述。

## 本轮验证

- `npm run type-check`：通过。
- `npm run build`：通过。
- `dist/style.css` 已包含 `tw:` 前缀 utility。
- 未检测到 Tailwind Preflight 的常见 reset 选择器。
- `npm run test`：默认 5000ms 超时下全量运行稳定出现 `themeRegistry` 单测超时；定向复跑 `src/theme/__tests__/themeRegistry.test.ts` 通过。
- `npm run test -- --testTimeout=10000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
- 第三批验证：
  - `npm run type-check`：通过。
  - `npm run build`：通过；构建仍提示 `vite:vue` plugin timing warning。
  - `dist/style.css` 已包含第三批新增 token utility：`tw:border-lw-border-active`、`tw:bg-lw-selection`。
  - 未检测到 Tailwind Preflight 的常见 reset 选择器。
  - `npm run test -- --testTimeout=10000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
- 第四批验证：
  - `npm run type-check`：通过。
  - `npm run test -- --testTimeout=10000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
  - `npm run build`：通过；本次耗时 3m38s，仍提示 `vite:vue` plugin timing warning。
  - `dist/style.css` 已包含第四批新增 arbitrary utility：`tw:min-w-[min(260px,100%)]`。
  - 未检测到 Tailwind Preflight 的常见 reset 选择器。
- 第五批验证：
  - 迁移 `ForgeAutoListBlock`、`ForgeEntryProposalBlock`、`ForgeMemoryProposalBlock`、`ForgeFormBlock`；Forge blocks 目录当前已无 `<style scoped>`。
  - `npm run type-check`：通过。
  - `npm run test -- --testTimeout=10000`：本机本轮出现主题/插件初始化超时；未出现断言失败。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
  - `npm run build`：通过；本次耗时 3m17s，仍提示 `vite:vue` plugin timing warning。
  - `dist/style.css` 已包含第五批新增 utility：`tw:max-w-[440px]`、`tw:my-1.5`。
  - 未检测到 Tailwind Preflight 的常见 reset 选择器。
- 第六批验证：
  - 迁移 `SettingsRoot` 壳层布局；导航项由可点击 `div` 改为 `button`，返回操作接入 `LuminaButton` 与 `lucide-vue-next` 图标。
  - `npm run type-check`：通过。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
  - `npm run build`：通过；本次耗时 2m48s，仍提示 `vite:vue` plugin timing warning。
  - `dist/style.css` 已包含第六批新增 utility：`tw:w-60`、`tw:font-lw-display`、`tw:sticky`。
  - 未检测到 Tailwind Preflight 的常见 reset 选择器。
- 第七批验证：
  - 新增 Settings 局部原语：`SettingsSectionPanel`、`SettingsBlockHeader`、`SettingsStatusBadge`、`SettingsDescription`。
  - 迁移 `SettingsUnified` 页级 grid、section panel、block header、status badge 与低风险 action button；同步、迁移、Nexus、DCC 业务行为未改。
  - `npm run type-check`：通过。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
  - `npm run build`：通过；本次 Vite/Rolldown 输出多 chunk，并提示部分 chunk 超过 500 kB。
  - `dist/style.css` 已包含第七批新增 utility：Settings grid arbitrary utility、`tw:p-[var(--lw-settings-unified-padding,...)]`、`tw:col-span-full`。
  - 未检测到 Tailwind Preflight 的常见 reset 选择器。
- 第八批验证：
  - 新增 Settings 局部原语：`SettingsInsetPanel`、`SettingsMetaItem`。
  - 迁移 `SettingsUnified` 内部 meta grid、permission item、radio storage card、desktop mode summary 与 migration scope selector；同步、迁移、Nexus、DCC 业务行为未改。
  - `npm run type-check`：通过。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
  - `npm run build`：通过；本次 Vite/Rolldown 仍提示部分 chunk 超过 500 kB。
  - `dist/style.css` 已包含第八批新增 utility：`tw:grid-cols-2`、`tw:tabular-nums`、Settings inset panel 的 token border/radius utility。
  - 未检测到 Tailwind Preflight 的常见 reset 选择器。
- 第九批验证：
  - 迁移 `SettingsDetailed` 基础容器、preview sticky 区与 detail content 面板；保留 `settings-detailed` / `preview-container` / `block-content` 类名供 Telegram variant 覆写。
  - `npm run type-check`：通过。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
  - `npm run build`：通过；本次 Vite/Rolldown 仍提示部分 chunk 超过 500 kB。
  - `dist/style.css` 已包含第九批新增 utility：`lw-settings-detail-outer-padding`、`lw-settings-detail-radius`、`z-index:20`。
  - 未检测到 Tailwind Preflight 的常见 reset 选择器。
- 第十批验证：
  - 迁移 `NexusPresetManager` 外层 section、header、标题图标区、header controls 与新增按钮；按钮接入 `LuminaButton` 与 `lucide-vue-next` 的 `Plus` 图标。
  - 模型下拉、拖拽排序、节点卡片和移动端 dropdown overlay 暂保留原 CSS，避免一次迁移改变复杂交互。
  - `npm run type-check`：通过。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
  - `npm run build`：通过；本次 Vite/Rolldown 仍提示部分 chunk 超过 500 kB。
  - `dist/style.css` 已包含第十批新增 utility：`tw:gap-6`、`tw:size-8`、`tw:bg-lw-subtle`、`tw:size-3.5`。
  - 未检测到 Tailwind Preflight 的常见 reset 选择器。
- 第十一批验证：
  - 迁移 `NexusPresetManager` API list、preset list、API item、preset group、item/group header 与 field grid。
  - 字段 label、输入控件、节点卡片、拖拽排序、TransitionGroup、模型下拉和移动端 dropdown overlay 暂保留原 CSS。
  - `npm run type-check`：通过。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
  - `npm run build`：通过；本次 Vite/Rolldown 仍提示部分 chunk 超过 500 kB。
  - `dist/style.css` 已包含第十一批新增 utility：`tw:p-3.5`、`tw:grid-cols-2`、`tw:border-dashed`、`transition-property:background-color,border-color`。
  - 未检测到 Tailwind Preflight 的常见 reset 选择器。
- 第十二批验证：
  - 迁移 `NexusPresetManager` 节点卡片静态布局、内容区、字段组、底栏、索引徽标与拖拽手柄基础布局。
  - 为本轮触碰到的 icon-only buttons 补充 `aria-label`；拖拽状态、TransitionGroup、模型下拉与移动端 overlay 暂保留原 CSS。
  - `npm run type-check`：通过。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
  - `npm run build`：通过；本次 Vite/Rolldown 仍提示部分 chunk 超过 500 kB。
  - `dist/style.css` 已包含第十二批新增 utility：`tw:h-[42px]`、`tw:h-[18px]`、`tw:rounded-b-lw-md`、`transition-property:background-color,border-color,box-shadow,transform,opacity`。
  - 未检测到 Tailwind Preflight 的常见 reset 选择器。
- 第十三批验证：
  - 迁移 `NexusPresetManager` 的 `st-indicator`、empty state 与简单 icon button；本轮触碰到的 icon-only buttons 已补 `aria-label`。
  - 模型下拉、TransitionGroup、拖拽状态与移动端 overlay 暂保留原 CSS。
  - `npm run type-check`：通过。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
  - `npm run build`：通过；本次 Vite/Rolldown 仍提示部分 chunk 超过 500 kB。
  - `dist/style.css` 已包含第十三批新增 utility：`tw:bg-[var(--lw-bg-app)]`、`tw:p-10`、`tw:mr-1`，并确认 red hover utility 存在。
  - 未检测到 Tailwind Preflight 的常见 reset 选择器。
- 第十四批验证：
  - 迁移 `TelegramSettingsHome` 根布局、hero、头像尺寸、分组、行布局与 copy 截断结构。
  - Telegram 专属渐变图标、玻璃背景、hover 色与 typography token 继续保留在 scoped CSS，作为模式级 skin。
  - `npm run type-check`：通过。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
  - `npm run build`：通过；本次 Vite/Rolldown 仍提示部分 chunk 超过 500 kB。
  - `dist/style.css` 已包含第十四批新增 utility：safe-area calc、`tw:size-[88px]`、`tw:grid-cols-[auto_1fr_auto]`、`tw:rounded-[22px]`。
  - 未检测到 Tailwind Preflight 的常见 reset 选择器。
- 第十五批验证：
  - 迁移 `SettingsUnified` 的同步/权限内容栈、迁移 action、差异面板、引擎设置项、LLM preset row、DCC 分区与 inline component 分隔线。
  - 保留 `lw-checkbox-label` / `lw-toggle` 外观、`spin` keyframes、DCC label divider、Telegram skin 与 `SettingsRoot` 移动端 deep 覆写。
  - `npm run type-check`：通过。
  - `npm run build`：通过；本次 Vite/Rolldown 仍提示部分 chunk 超过 500 kB。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
- 第十六批验证：
  - 迁移 `SettingsUnified` 权限与引擎设置 switch 到 `LuminaToggle`，思维链模式与全局生成参数 select 到 `LuminaSelect`。
  - 本轮补齐 switch 可访问名称；说明文案容器不再使用无关联 `label`。
  - 导入/导出范围 checkbox 暂保留原生控件，待抽出 `LuminaCheckbox` primitive。
  - `npm run type-check`：通过。
  - `npm run build`：通过；本次 Vite/Rolldown 仍提示部分 chunk 超过 500 kB。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
- 第十七批验证：
  - 新增 `LuminaCheckbox` primitive，使用原生 checkbox 输入保留键盘与表单语义，主题样式通过 Tailwind utility 收敛。
  - 迁移 `SettingsUnified` 导入/导出范围多选到 `LuminaCheckbox`，移除局部 `lw-checkbox-label` CSS。
  - `npm run type-check`：通过。
  - `npm run build`：通过；本次 Vite/Rolldown 仍提示部分 chunk 超过 500 kB。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
- 第十八批验证：
  - 迁移 `SettingsUnified` 同步按钮 spinner 到 Tailwind `tw:animate-spin`。
  - 迁移 DCC 标题分隔线到显式 `span` + Tailwind utility，移除局部 pseudo-element CSS。
  - `npm run type-check`：通过。
  - `npm run build`：通过；本次 Vite/Rolldown 仍提示部分 chunk 超过 500 kB。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
- 第十九批验证：
  - 迁移 `NexusPresetManager` 节点排序按钮尺寸、布局、hover 位移与 disabled 状态到 Tailwind utility。
  - 拖拽状态、TransitionGroup 与 model dropdown 继续保留在 scoped CSS，避免改变复杂交互边界。
  - `npm run type-check`：通过。
  - `npm run build`：通过；本次 Vite/Rolldown 仍提示部分 chunk 超过 500 kB。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
- 第二十批验证：
  - 迁移 `NexusPresetManager` section 标题、副标题、传输模式标签、字段 label 与节点序号 typography token 到 Tailwind utility。
  - 表单输入 focus、compact select、拖拽状态、TransitionGroup 与 model dropdown 继续保留在 scoped CSS。
  - `npm run type-check`：通过。
  - `npm run build`：通过；本次 Vite/Rolldown 仍提示部分 chunk 超过 500 kB。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
- 第二十一批验证：
  - 迁移 `NexusPresetManager` 可编辑标题输入与传输模式 compact select 的外观、hover/focus 与尺寸规则到 Tailwind utility。
  - 拖拽状态、TransitionGroup 与 model dropdown 继续保留在 scoped CSS。
  - `npm run type-check`：通过。
  - `npm run build`：通过；本次 Vite/Rolldown 仍提示部分 chunk 超过 500 kB。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
- 第二十二批验证：
  - 迁移 `NexusPresetManager` accent icon 外观与添加备用节点按钮外壳到 Tailwind utility，并移除未引用的 `node-footer-actions` CSS。
  - 拖拽状态、TransitionGroup 与 model dropdown 继续保留在 scoped CSS。
  - `npm run type-check`：通过。
  - `npm run build`：通过；本次 Vite/Rolldown 仍提示部分 chunk 超过 500 kB。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
- 第二十三批验证：
  - 迁移 `NexusPresetManager` 模型选择器触发器外壳、内嵌输入框继承样式与展开按钮到 Tailwind utility。
  - model dropdown portal、options、移动端 overlay、拖拽状态与 TransitionGroup 继续保留在 scoped CSS。
  - `npm run type-check`：通过。
  - `npm run build`：通过；本次 Vite/Rolldown 仍提示部分 chunk 超过 500 kB。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
- 第二十四批验证：
  - 迁移 `NexusPresetManager` 模型下拉内部 header、搜索框、排序按钮、列表、空态、分组 label 与选项状态到 Tailwind utility。
  - model dropdown portal 定位、移动端 overlay、进入动画、拖拽状态与 TransitionGroup 继续保留在 scoped CSS。
  - `npm run type-check`：通过。
  - `npm run build`：通过；本次 Vite/Rolldown 仍提示部分 chunk 超过 500 kB。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
- 第二十五批验证：
  - 迁移 `NexusPresetManager` 节点拖拽手柄 cursor、touch-action、hover 与 active 外观到 Tailwind utility。
  - 拖拽态/占位态、TransitionGroup、model dropdown portal 定位、移动端 overlay 与进入动画继续保留在 scoped CSS。
  - `npm run type-check`：通过。
  - `npm run build`：通过；本次 Vite/Rolldown 仍提示部分 chunk 超过 500 kB。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
- 第二十六批验证：
  - 迁移 `NexusPresetManager` 节点拖拽态与占位态视觉到 `cn` + Tailwind utility。
  - TransitionGroup、model dropdown portal 定位、移动端 overlay 与进入动画继续保留在 scoped CSS。
  - `npm run type-check`：通过。
  - `npm run build`：通过；本次 Vite/Rolldown 仍提示部分 chunk 超过 500 kB。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
- 第二十七批验证：
  - 迁移 `NexusPresetManager` 节点列表 `TransitionGroup` move/enter/leave 过渡到显式 Tailwind class props。
  - model dropdown portal 定位、移动端 overlay 与进入动画继续保留在 scoped CSS。
  - `npm run type-check`：通过。
  - `npm run build`：通过；本次 Vite/Rolldown 仍提示部分 chunk 超过 500 kB。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
- 第二十八批验证：
  - 迁移 `NexusPresetManager` model dropdown portal 宽度约束、背景、边框、圆角、阴影、flex 与 overflow 壳层到 Tailwind utility。
  - portal 锚点定位、z-index、移动端 overlay 与进入动画继续保留在 scoped CSS。
  - `npm run type-check`：通过。
  - `npm run build`：通过；本次 Vite/Rolldown 仍提示部分 chunk 超过 500 kB。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
- 第二十九批验证：
  - 迁移 `NexusPresetManager` model dropdown portal 桌面锚点定位到 Tailwind utility。
  - z-index、移动端 overlay 与进入动画继续保留在 scoped CSS。
  - `npm run type-check`：通过。
  - `npm run build`：通过；本次 Vite/Rolldown 仍提示部分 chunk 超过 500 kB。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
- 第三十批验证：
  - 迁移 `NexusPresetManager` model dropdown portal 层级到 Tailwind 固定层级 `tw:z-50`。
  - 移动端 overlay 与进入动画继续保留在 scoped CSS。
  - `npm run type-check`：通过。
  - `npm run build`：通过；本次 Vite/Rolldown 仍提示部分 chunk 超过 500 kB。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
- 第三十一批验证：
  - 迁移 `NexusPresetManager` model dropdown portal animation 声明到 Tailwind arbitrary animation utility，并收敛为 200ms ease-out。
  - 移动端 overlay 与 `dropdown-fade-in` keyframes 继续保留在 scoped CSS。
  - `npm run type-check`：通过。
  - `npm run build`：通过；本次 Vite/Rolldown 仍提示部分 chunk 超过 500 kB。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
- 第三十二批验证：
  - 迁移 `NexusPresetManager` model dropdown portal 的 `dropdown-fade-in` keyframes 到 `src/styles/tailwind.css`，作为 Tailwind utility layer 全局动画资产。
  - 移动端 overlay 继续保留在 scoped CSS，避免本轮同时改动 fixed 居中、viewport 宽度与遮罩阴影交互。
  - `npm run type-check`：通过。
  - `npm run build`：通过；本次 Vite/Rolldown 仍提示部分 chunk 超过 500 kB。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
- 第三十三批验证：
  - 迁移 `NexusPresetManager` model dropdown portal 的移动端 fixed 居中、viewport 宽度、max-height、overlay shadow 与 `is-flipped` 清理到 Tailwind responsive utility。
  - `NexusPresetManager.vue` 当前已无 `<style scoped>`。
  - `npm run type-check`：通过。
  - `npm run build`：通过；本次 Vite/Rolldown 仍提示部分 chunk 超过 500 kB。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
  - 产物结构检查：`dist/style.css` 已生成 `tw:max-[600px]:*`、overlay shadow 与 `dropdown-fade-in` keyframes；组件内已无 `<style scoped>`。
- 第三十四批验证：
  - 修正 `NexusPresetManager` 内 Tailwind v4 `tw` 前缀与 variant 的顺序，统一为 `tw:hover:*`、`tw:focus:*`、`tw:disabled:*`、`tw:enabled:hover:*`、`tw:active:*` 与 `tw:max-[600px]:*`。
  - `npm run type-check`：通过。
  - `npm run build`：通过；本次 Vite/Rolldown 仍提示部分 chunk 超过 500 kB。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
  - 产物结构检查：`dist/style.css` 已生成 `tw:hover:*`、`tw:focus-within:*`、`tw:disabled:*` 与 `tw:max-[600px]:*`；`NexusPresetManager.vue` 内未残留 `hover:tw:*` 等旧写法。
- 第三十五批验证：
  - 全仓扫描 `luminaweave-extension/src` 下 Tailwind v4 variant 前缀顺序，并机械修正旧写法；覆盖 Launcher、Lumina primitives、Forge blocks 与 Settings 局部组件。
  - `npm run type-check`：通过。
  - `npm run build`：通过；本次 Vite/Rolldown 仍提示部分 chunk 超过 500 kB。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
  - 结构检查：`luminaweave-extension/src` 内旧 `hover:tw:*` / `focus:tw:*` / `disabled:tw:*` / responsive variant 前缀顺序残留为 0；`dist/style.css` 已生成 `tw:hover:*`、`tw:focus:*`、`tw:focus-within:*`、`tw:disabled:*` 与 `tw:max-[600px]:*`。
- 第三十六批验证：
  - 迁移 `SettingsUnified` 普通响应式 grid/flex 收尾规则与 settings card hover 规则到 Tailwind utility / Settings 原语。
  - 保留 desktop-mode token skin、Telegram variant 与插件图标 deep SVG CSS。
  - `npm run type-check`：通过。
  - `npm run build`：通过；本次 Vite/Rolldown 仍提示部分 chunk 超过 500 kB。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
  - 结构检查：`SettingsUnified.vue` 内旧 `@media (max-width: 920px/720px)`、`.backup-actions` 与 `.plugin-settings-block.lw-card:hover` 已移除；`sync-meta` / `scope-selector` 已有 `tw:max-[920px]:grid-cols-1`，`SettingsSectionPanel` 已承接 hover utility，`SettingsBlockHeader` 已承接移动端标题对齐 utility。
- 第三十七批验证：
  - 迁移 `SettingControl` 小屏水平布局控件区与 stepper body 对齐规则到 Tailwind responsive utility。
  - 保留控件 skin、Telegram / Discord variant 与 keyframes CSS。
  - `npm run type-check`：通过。
  - `npm run build`：通过；本次 Vite/Rolldown 仍提示部分 chunk 超过 500 kB。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
  - 结构检查：`SettingControl.vue` 内旧 `@media (max-width: 720px)` 已移除；水平布局控件区已含 `tw:max-[720px]:w-full tw:max-[720px]:justify-start`，stepper body 已由 `settingControlModel.ts` 输出 `tw:max-[720px]:justify-start`。
- 第三十八批验证：
  - 迁移 `SettingControl` 字体选择器与选项说明提示的进入动画到 Tailwind utility / 全局 keyframes。
  - `npm run type-check`：通过。
  - `npm run build`：通过；本次 Vite/Rolldown 仍提示部分 chunk 超过 500 kB。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
  - 结构检查：`SettingControl.vue` 内旧 `@keyframes slide-in-top` / `@keyframes slide-down` 与 `fade-slide-*` CSS 已移除；`src/styles/tailwind.css` 与 `dist/style.css` 已包含 `setting-slide-in-top` / `setting-slide-down` keyframes 及对应 `tw:animate-[...]` utility。
- 第三十九批验证：
  - 迁移 `SettingControl` 主题色 swatch 尺寸、圆角、边框、hover/active 状态与布局间距到 Tailwind utility，并为 swatch 按钮补齐 `aria-label`。
  - `npm run type-check`：通过。
  - `npm run build`：通过；本次 Vite/Rolldown 仍提示部分 chunk 超过 500 kB。
  - `npm run test -- --testTimeout=30000 --hookTimeout=30000`：首次暴露 `settingControlModel` 旧预期仍写死 `theme-options full-width`，同步测试预期后全量通过，68 个测试文件通过，387 个测试通过，2 个跳过。
  - 结构检查：`SettingControl.vue` 内旧 `.theme-options` / `.color-btn` 局部 CSS 已移除；`getThemeColorButtonClass()` 已输出 swatch utility 与 `aria-label`；`settingControlModel.ts` 与对应单测已覆盖 `theme-options tw:flex-wrap tw:gap-2.5`；`dist/style.css` 已生成 `tw:size-9` 与 swatch active shadow utility。
