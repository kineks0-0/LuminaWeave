# Tailwind System Migration Current Task

## 目标

将 LuminaWeave 前端样式体系迁移到 Tailwind CSS + Lumina UI 原语层，降低后续 UI 开发成本，减少重复 SFC 样式块，并保持 Desktop Mode / Theme Pack 的结构级边界不变。

本任务不是简单接入 Tailwind，而是样式系统重构：Tailwind 作为 utility layer，Lumina UI primitives 作为业务组件的默认 UI 基座，`--lw-*` / Desktop Mode manifest / surface skin 继续作为主题与桌面模式真相源。

## 当前状态

- 当前 extension 为 Vue 3 + Vite + TypeScript。
- 已接入 Tailwind CSS v4、`@tailwindcss/vite`、`clsx` 与 `tailwind-merge`。
- 已新增 `src/styles/tailwind.css`，Tailwind 使用 `tw:` 前缀并只导入 theme/utilities，不启用 Preflight。
- 已新增 `src/ui/cn.ts` 与第一批 `src/ui/primitives/` 基础组件。
- 已完成首批低风险迁移：`EmptySurface` 与 `GlobalConfirmationModal`。
- 已完成第二批低风险迁移：`ToastNotification`、Forge summary/checklist/aux panel、`LuminaStepper`。
- 已完成第三批低风险迁移：`LauncherRoot` 简单面板、`SettingControl` 通用控件入口、Forge input/select/textarea blocks。
- 已完成第四批低风险迁移：Forge choice、choice group、facet checklist、mode picker、missing fields、message submit、form assist、layer navigator blocks。
- 已完成第五批低风险迁移：Forge auto list、entry proposal、memory proposal、form blocks；当前 Forge blocks 目录已无 `<style scoped>`。
- 已完成第六批低风险迁移：`SettingsRoot` 壳层导航、面包屑、返回条与滚动容器基础布局；Telegram skin、deep 子布局与滚动条规则继续保留在 scoped CSS。
- 已完成第七批低风险迁移：新增 Settings 局部 UI 原语，`SettingsUnified` 页级 grid、section panel、block header、status badge 与低风险 action button 已接入 Tailwind / Lumina primitives；同步、迁移、Nexus、DCC 业务行为未改。
- 已完成第八批低风险迁移：新增 Settings inset/meta 原语，`SettingsUnified` 内部 meta grid、permission item、radio storage card、desktop mode summary 与 migration scope selector 已接入 Tailwind / Settings 原语；Telegram variant 与 DCC 细节样式继续保留。
- 已完成第九批低风险迁移：`SettingsDetailed` 基础容器、preview sticky 区与 detail content 面板接入 Tailwind utility；保留 Telegram skin 覆写选择器。
- 已完成第十批低风险迁移：`NexusPresetManager` 外层 section、header、标题图标区、header controls 与新增按钮接入 Tailwind / `LuminaButton`；模型下拉、拖拽排序、节点卡片与 modal-like dropdown 继续保留原 CSS。
- 已完成第十一批低风险迁移：`NexusPresetManager` 的 API list、preset list、API item、preset group、item/group header 与 field grid 接入 Tailwind utility；字段 label、输入控件、节点卡片、模型下拉与拖拽排序继续保留。
- 已完成第十二批低风险迁移：`NexusPresetManager` 节点卡片静态布局、内容区、字段组、底栏、索引徽标、拖拽手柄布局接入 Tailwind utility；`is-dragging` / `is-placeholder`、TransitionGroup、模型下拉与移动端 overlay 继续保留。
- 已完成第十三批低风险迁移：`NexusPresetManager` 的 `st-indicator`、empty state 与简单 icon button 接入 Tailwind utility；本轮补齐相关 icon-only button 的 `aria-label`。
- 已完成第十四批低风险迁移：`TelegramSettingsHome` 根布局、hero、头像尺寸、分组、行布局与 copy 截断结构接入 Tailwind utility；Telegram 专属渐变图标、玻璃背景、hover 与 typography token 继续作为模式级 skin CSS 保留。
- 已完成第十五批低风险迁移：`SettingsUnified` 的同步/权限内容栈、迁移 action、差异面板、引擎设置项、LLM preset row、DCC 分区与 inline component 分隔线接入 Tailwind utility；保留旧 checkbox/toggle 外观、spinner keyframes、DCC label divider、Telegram skin 与移动端 deep 覆写。
- 已完成第十六批低风险迁移：`SettingsUnified` 中的权限与引擎设置 switch 全部替换为 `LuminaToggle`，思维链模式与全局生成参数选择替换为 `LuminaSelect`；本轮补齐 switch 的可访问名称，并移除说明文字上的无关联 `label` 语义。
- 已完成第十七批低风险迁移：新增 `LuminaCheckbox` primitive，并将 `SettingsUnified` 导入/导出范围多选迁移到该原语；移除 `SettingsUnified` 局部 `lw-checkbox-label` CSS。
- 已完成第十八批低风险迁移：`SettingsUnified` 同步按钮旋转动画改用 Tailwind `tw:animate-spin`，DCC 标题分隔线从 scoped pseudo-element 改为显式 DOM + Tailwind utility；移除局部 `spin` keyframes 与 `dcc-section-label::after` CSS。
- 已完成第十九批低风险迁移：`NexusPresetManager` 节点排序按钮尺寸、布局、hover 位移与 disabled 状态迁移到 Tailwind utility；拖拽状态、TransitionGroup 与模型下拉门户 CSS 继续保留。
- 已完成第二十批低风险迁移：`NexusPresetManager` section 标题、副标题、传输模式标签、字段 label 与节点序号 typography token 迁移到 Tailwind utility；表单输入 focus、compact select、拖拽状态、TransitionGroup 与模型下拉门户 CSS 继续保留。
- 已完成第二十一批低风险迁移：`NexusPresetManager` 可编辑标题输入与传输模式 compact select 的外观、hover/focus 与尺寸规则迁移到 Tailwind utility；拖拽状态、TransitionGroup 与模型下拉门户 CSS 继续保留。
- 已完成第二十二批低风险迁移：`NexusPresetManager` accent icon 外观与添加备用节点按钮外壳迁移到 Tailwind utility，并移除未引用的 `node-footer-actions` CSS；拖拽状态、TransitionGroup 与模型下拉门户 CSS 继续保留。
- 已完成第二十三批低风险迁移：`NexusPresetManager` 模型选择器触发器外壳、内嵌输入框继承样式与展开按钮迁移到 Tailwind utility；模型下拉门户、选项列表、移动端 overlay、拖拽状态与 TransitionGroup CSS 继续保留。
- 已完成第二十四批低风险迁移：`NexusPresetManager` 模型下拉内部 header、搜索框、排序按钮、列表、空态、分组 label 与选项状态迁移到 Tailwind utility；下拉门户定位、移动端 overlay、进入动画、拖拽状态与 TransitionGroup CSS 继续保留。
- 已完成第二十五批低风险迁移：`NexusPresetManager` 节点拖拽手柄的 cursor、touch-action、hover 与 active 外观迁移到 Tailwind utility；拖拽状态、占位状态、TransitionGroup、下拉门户定位、移动端 overlay 与进入动画 CSS 继续保留。
- 已完成第二十六批低风险迁移：`NexusPresetManager` 节点拖拽态与占位态视觉迁移到 `cn` + Tailwind utility；TransitionGroup、下拉门户定位、移动端 overlay 与进入动画 CSS 继续保留。
- 已完成第二十七批低风险迁移：`NexusPresetManager` 节点列表 `TransitionGroup` move/enter/leave 过渡迁移到显式 Tailwind class props，并将过渡约束为 200ms transform/opacity；下拉门户定位、移动端 overlay 与进入动画 CSS 继续保留。
- 已完成第二十八批低风险迁移：`NexusPresetManager` 模型下拉 portal 的宽度约束、背景、边框、圆角、阴影、flex 与 overflow 壳层迁移到 Tailwind utility；portal 锚点定位、移动端 overlay、z-index 与进入动画 CSS 继续保留。
- 已完成第二十九批低风险迁移：`NexusPresetManager` 模型下拉 portal 的桌面锚点定位迁移到 Tailwind utility；z-index、移动端 overlay 与进入动画 CSS 继续保留。
- 已完成第三十批低风险迁移：`NexusPresetManager` 模型下拉 portal 层级从 scoped `z-index: 9999` 收敛到 Tailwind 固定层级 `tw:z-50`；移动端 overlay 与进入动画 CSS 继续保留。
- 已完成第三十一批低风险迁移：`NexusPresetManager` 模型下拉 portal 的 animation 声明迁移到 Tailwind arbitrary animation utility，并收敛为 200ms ease-out；移动端 overlay 与 `dropdown-fade-in` keyframes CSS 继续保留。
- 已完成第三十二批低风险迁移：`NexusPresetManager` 模型下拉 portal 的 `dropdown-fade-in` keyframes 从组件 scoped CSS 迁移到全局 Tailwind utility layer；移动端 overlay CSS 继续保留。
- 已完成第三十三批低风险迁移：`NexusPresetManager` 模型下拉 portal 的移动端 fixed 居中、viewport 宽度、max-height、overlay shadow 与 `is-flipped` 清理迁移到 Tailwind responsive utility；组件 scoped CSS 已清空移除。
- 已完成第三十四批低风险修正：修正 `NexusPresetManager` 内 Tailwind v4 `tw` 前缀与 variant 的顺序，统一为 `tw:hover:*`、`tw:focus:*`、`tw:max-[600px]:*` 等可生成形式。
- 已完成第三十五批低风险修正：全仓扫描并机械修正 `luminaweave-extension/src` 下已迁移 Tailwind class 的 variant 前缀顺序，覆盖 Launcher、Lumina primitives、Forge blocks 与 Settings 局部组件。
- 已完成第三十六批低风险迁移：`SettingsUnified` 普通响应式 grid/flex 收尾规则与 settings card hover 规则迁移到 Tailwind utility / Settings 原语；Telegram skin、`:deep(svg)` 与桌面模式 token skin 继续保留。
- 已完成第三十七批低风险迁移：`SettingControl` 小屏水平布局控件区与 stepper body 对齐规则迁移到 Tailwind responsive utility；组件底部小屏 `@media` 块已移除。
- 已完成第三十八批低风险迁移：`SettingControl` 字体选择器与选项说明提示的进入动画迁移到 Tailwind utility / 全局 keyframes；组件内 `slide-in-top`、`slide-down` 与 `fade-slide` 局部动画 CSS 已移除。
- 已完成第三十九批低风险迁移：`SettingControl` 主题色 swatch 的尺寸、圆角、边框、hover/active 状态与布局间距迁移到 Tailwind utility；保留 `theme-options` / `color-btn` 语义类名并补齐 swatch 按钮可访问名称。
- 样式主要分散在 `src/style.css`、`src/styles/app-shell-base.css` 与大量 Vue SFC `<style scoped>` 中。
- 已确认第一轮迁移允许大幅重构，目标优先服务后续开发简化。
- 已确认采用 Lumina 自有 UI 原语层，而不是让业务组件直接堆 Tailwind utility class。

## 下一步

1. 对 Forge 表单/提案块做浏览器视觉抽查，确认统一 primitives 后的密度、按钮层级与 proposal 状态表达仍清晰。
2. 对共享 Lumina primitives 做浏览器视觉/交互抽查，重点覆盖 hover、focus、disabled、checked、data-state 等交互态是否恢复生成。
3. 对 `NexusPresetManager` 做浏览器视觉/交互抽查，重点覆盖桌面下拉锚点、移动端居中 overlay、模型搜索、排序、选择与外部点击关闭。
4. 对 `SettingsUnified` / `SettingControl` 做下一轮收尾分类：当前剩余 CSS 主要是 desktop-mode token skin、Telegram / Discord variant、插件图标 deep SVG、分段控件与控件 skin。
5. 评估 Shell 通用控件迁移范围，优先按钮、标题、面板容器。
6. 最后评估 ChatStream、Timeline、Telegram、Discord 等高耦合样式区域。
7. 每批迁移后运行 `npm run type-check`、`npm run build`，涉及主题/插件初始化时使用足够的 Vitest timeout 排除机器负载噪声。

## 恢复入口

- [Tailwind system migration plan](./steps/01-tailwind-system-migration-plan.md)
