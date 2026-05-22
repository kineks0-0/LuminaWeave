
This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# LuminaWeave (幻光织机) — Claude Code 指南

基于 SillyTavern (ST) 的下一代增强框架，运行于独立的 Vue 3 微内核。通过深度接管（拦截 Prompt 与生成流）与绝对隔离（Shadow DOM + 独立存储）重塑 AI 角色扮演体验。

---

## 需求处理原则

先按用户原始需求理解，**不默认用户已完全想清楚目标与实现路径**。只当歧义会导致明显不同方案时才先澄清；否则基于最合理解释继续，并明确说明前提假设。

- 默认只围绕用户明确提出的目标设计方案，不擅自扩展业务目标。
- 优先给出满足目标的最小完整方案；若"最短路径"与"正确性"冲突，选择不引入结构性错误的最小正确方案。
- 不做与需求无关的兜底、降级或额外分支设计。
- 输出方案前按 输入→处理→状态变化→输出→上下游影响 做链路检查，未验证部分必须标注为假设。

## 代码事实优先级

当代码、文档、口头描述不一致时，优先遵循：**当前代码与测试 > 目录结构与构建脚本 > 文档**。小改动以代码运行现实为准；架构级改动同步更新文档。

## 外部参考代码位置

| 项目 | 路径 |
|------|------|
| SillyTavern 源码 | `D:\Game\SillyTavern` |
| TauriTavern 源码 | `D:\Program\tauritavern\` |
| TauriTavern 文档 | `D:\Program\tauritavern\docs\` (本项目 `TauriTavernDocs\` 有副本) |
| TavernHelper 类型定义 | `TavernHelper@types/` (function 文件夹=函数定义, 另一文件夹=环境定义) |

## 高风险区域

以下目录/文件的改动务必谨慎，改动前先读相关测试：

`STAdapter.ts`、`STSyncService.ts`、`PersistenceService.ts`、`MemoryManager.ts`、`TimelineManager.ts`、`XMLInterceptor.ts`、`st-adapter/`、`conversation/`、`storage/`、`generation/`、`hal/`、`host-drivers/`、`forge/`、`xml-view/`、`luminaweave-server/src/StorageService.ts`、`luminaweave-server/src/StreamingManager.ts`、`luminaweave-server/src/NexusService.ts`、`shared/`

这些区域涉及 ST 原生 `id` ↔ Lumina `nodeId` 映射、`ConversationDocument`、事务日志、时间线回滚、XML 生命周期、流式解析、前后端共享协议等核心链路。

## 测试触发建议

- 改动影响同步/事务/XML/流式/持久化/HAL/Resource/Forge Agent/共享协议 → 运行 `npm run test`
- 改动影响类型边界或 Vue 组件接口 → 额外运行 `npm run type-check`
- 改动影响构建/chunk/依赖/分发产物 → 额外运行 `npm run build`

## 常用命令

所有前端命令均在 `luminaweave-extension/` 目录下执行：

```powershell
cd luminaweave-extension

npm run dev          # Vite 热更新开发服务器
npm run build        # 生产构建（输出到 dist/）
npm run watch        # 文件监视构建（供 ST 插件热加载）
npm run test         # 使用 vitest 运行所有测试
npm run type-check   # vue-tsc 静态类型检查（不输出文件）

# 运行单个测试文件
npx vitest run src/api/core/__tests__/ChatManager.test.ts
```

一键启动开发环境（前端热更新 + 后端服务同步）：
```powershell
# 在项目根目录执行
. .\dev-start.ps1
```

子项目同步到 GitHub 独立仓库：
```powershell
. .\sync-projects.ps1
Publish-LuminaExtension   # 推送插件更新
Update-LuminaExtension    # 拉取远程插件更新
Publish-LuminaServer      # 推送服务端更新
```

---

## 架构总览

### 层次结构

```
SillyTavern 宿主环境
    └── luminaweave-extension/  (Vue 3 微内核，运行于 Shadow DOM 沙盒内)
        ├── src/index.ts              ← 入口：Shadow DOM 挂载 & 样式隔离
        ├── src/App.vue               ← UI Shell：面板调度、侧边栏、工作台窗口系统
        ├── src/bootstrap/registerPlugins.ts  ← 子插件注册中心
        ├── src/core/PluginManager.ts ← 插件解耦注册器
        ├── src/api/
        │   ├── index.ts              ← LuminaWeaveAPI 门面单例（全局通讯网关）
        │   ├── llmEngine.ts          ← LLM 引擎工厂（Factory 层）
        │   ├── storage.ts            ← 统一存储引擎（多级作用域）
        │   └── core/                 ← 微内核服务（见下）
        ├── src/plugins/              ← 各子插件实现
        └── src/stores/              ← Pinia 全局状态
```

### 微内核核心服务 (`src/api/core/`)

| 文件 | 职责 |
|---|---|
| `st-adapter/STClient.ts` | ST 宿主 I/O 层（读写消息、CSRF Token、TavernHelper 调用） |
| `st-adapter/STProtocol.ts` | 协议转换层（文本清洗、双指纹计算、ST ↔ Lumina 消息互转）— 纯函数，无宿主依赖 |
| `STAdapter.ts` | 同步门面（`compareStates / applyDelta / getSnapshot`），组合上两层 |
| `STSyncService.ts` | 对话同步逻辑：线性聊天记录 ↔ 图谱节点池的双向映射 |
| `WorldlineStore.ts` | 图谱化节点池（邻接表），`O(1)` 子节点查询与剪枝 |
| `ChatManager.ts` | 影子数据库管理器，维护本地 `localChatData` 节点池 |
| `TimelineManager.ts` | 活跃世界线路径计算，`getTrace(activeLeafId)` 供 ST 同步使用 |
| `PersistenceService.ts` | 事务化存储协议（`pending → running → committed/aborted`），含幂等与序列校验 |
| `XMLInterceptor.ts` | 栈式 XML 流拦截器，管理标签生命周期 |
| `LVParser.ts` | LuminaView `<V>` DSL 解析器 |
| `ContextCompactor.ts` | DCC 动态上下文压缩（全量区 / 概览区 / 隐藏区） |
| `MemoryManager.ts` | 核心快照与记忆协调中心 |
| `GenerationSession.ts` | 生成会话数据容器（Data 层） |
| `LuminaGenerationTask.ts` | 生成逻辑执行器（Logic 层），绑定 Session，随用随弃 |
| `NexusClient.ts` | 与后端 Nexus SSE 的通信客户端 |

### 数据流（单向）

```
ST 宿主 → STClient → STProtocol → STAdapter → WorldlineStore
                                                    ↓
                            Pinia Store ← ChatManager (影子数据库)
                                ↓
                           Vue 组件（只读订阅）
                                ↓
                        用户意图 → LuminaWeaveAPI → PersistenceService → STAdapter.applyDelta → ST
```

### 消息归一化字段

| 字段 | 来源 | 说明 |
|---|---|---|
| `pluginRaw` | LLM 原始输出 | 权威源，不可篡改 |
| `mesRaw` | 从 `pluginRaw` 提取（XMLInterceptor） | 内容源 |
| `mes` | 清洗 `mesRaw` 的派生字段 | 呈现源 |
| `mesST` | DCC 处理后的最终写回字段 | 发送给模型的真实内容 |
| `thinkingText` | 从 `<thinking>` 提取 | 仅 Lumina 本地折叠视图，不写回 ST |
| `fingerprint` | `mesRaw` 的哈希 | 内容质变判定，驱动派生缓存 |
| `stFingerprint` | `mesST` 的哈希 | 识别 DCC 压缩或用户在 ST 面板编辑 |

### 子插件列表 (`src/plugins/`)

| 目录 | 功能 |
|---|---|
| `chat/` | 消息流渲染增强（组件化渲染管线、ChatStream） |
| `timeline/` | 幻光时间线（LogicFlow + Dagre 布局，可视化世界线） |
| `director/` | 导演引擎（XML 增量更新、MutationEngine 沙箱、规划链） |
| `forge/` | 制卡工作台（Planner-Executor 双模型，LangGraph 编排） |
| `settings/` | 统一设置面板（子插件通过 `settingsManifest` 动态注册） |
| `lorebook/` | 世界书同步编辑器 |
| `stats/` | RPG 数值状态栏 |
| `launcher/` | UI 启动器 |

### XML 标签生命周期

注册新解析器时必须声明：
- `transient`：阅后即焚（如 `<Thoughts>`），提取后丢弃，不写入 ST
- `ephemeral`：单次必需（如 `<Next_Plan>`），暂存于 DirectorStore
- `persistent`：持久状态（如 `<Inventory_Change>`），触发 MutationEngine 写入

---

## 开发规范

1. **禁止 `any`**：使用描述性类型。
2. **数据流单向**：视图只订阅 Store，Store 提交 API，API 异步写回。
3. **双标识符**：`id`（ST 原生，不可变 UUID）≠ `nodeId`（Lumina 树结构）。操作消息时必须区分。
4. **同步安全**：执行 `save` 前须通过 `PersistenceService` 进行 ID 锚定，防止竞态覆盖。
5. **ST 适配层依赖方向**：`STAdapter → (STProtocol, STClient)`；业务层只依赖 `STAdapter`，禁止直接调用 `STClient`。
6. **i18n 强制**：界面字符串禁止硬编码，必须通过 `manifest.json` 注册并走 i18n 系统。
7. **PDR & System Design 协议**：重大功能修改前后同步阅读并更新 `docs/overall/PDR.md` 与 `docs/overall/system_design.md`。
8. **Git 规范**：遵循 Conventional Commits（`feat/fix/refactor/docs/chore`）。
9. **UI 样式强制使用主题 Token**：Vue 组件 `<style>` 中禁止硬编码颜色、字体、圆角等视觉值。必须使用项目语义 CSS 变量：
   - 颜色：`--lw-text-main` / `--lw-text-secondary` / `--lw-text-muted` / `--lw-primary` / `--lw-primary-rgb` / `--lw-border-base` / `--lw-bg-elevated` / `--lw-bg-subtle` / `--lw-bg-surface`
   - 字体：`--lw-font-display` / `--lw-font-main` / `--lw-font-mono`
   - 排版：`--lw-type-{role}-{size|line-height|weight|tracking}`（参考 `docs/overall/design/typography.md`）
   - 过渡：`--lw-transition`
   - 卡片背景：`color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent)`，Pill 按钮：`border-radius: 999px`
   - Tailwind class 必须使用 `tw:` 前缀（参考 `docs/overall/design/tailwind-utility-layer.md`）
   - 设计系统完整契约见 `docs/overall/design/README.md`
10. **新建面板复用已有模式**：创建新的 Forge 辅助面板时，先阅读已有面板（如 `ForgeModelRequestDebugPanel.vue`、`ForgeMemoryPanel.vue`）的样式和结构，使用 `ForgeAuxPanelShell.vue` 作为外壳，遵循相同的卡片（`border-radius: 22px`）、按钮（`border-radius: 999px`）、空状态、标签栏风格。

## PDR & System Design 维护协议

1. **前置读取**：写代码前先静默读取 `docs/index.md`、`docs/overall/PDR.md`、`docs/overall/system_design.md`
2. **影响评估**：评估修改是否会越界——是否影响微内核/子插件边界？是否改变请求编排或增量更新机制？
3. **同步更新**：如果引入新接口、改变数据流或使 PDR 假设失效，必须同步更新对应文档
4. **输出记录**：回复末尾简要说明本次开发对 PDR/System Design 的影响，或声明"本次修改未改变核心系统设计"

## 开工前最小检查单

1. 阅读 `docs/index.md`
2. 阅读目标模块附近实现与测试
3. 确认是否存在共享类型或 adapter 可复用
4. 确认是否需要同步更新 `docs/`
5. 确认不会误改构建产物或本地数据目录

---

## 关键目录与外部文档

- `docs/index.md` — 项目全景向导（架构一览）
- `docs/overall/PDR.md` — 产品需求文档
- `docs/overall/system_design.md` — 系统架构设计
- `docs/overall/api/luminaweave_api.md` — 子插件开发 API 手册
- `docs/overall/modules/forge/` — Forge 制卡专项文档（规划/实现/进度看板）
- `docs/configuration.md`、`docs/storage-and-data.md`、`docs/testing-and-ci.md` — 配置、存储和测试参考
- `docs/overall/design/` — 设计系统契约（Typography、Color Token、Tailwind 约定、组件可主题化边界）
- `luminaweave-server/` — 独立后端；真实源码位于 `src/`，`index.js` 是构建产物
- `TavernHelper@types/` — SillyTavern 插件环境类型定义
- `luminaweave-server/data/` — 用户数据，已 `.gitignore`，禁止提交

<!-- superpowers-zh:begin (do not edit between these markers) -->
# Superpowers-ZH 中文增强版

本项目已安装 superpowers-zh 技能框架（20 个 skills）。

## 核心规则

1. **收到任务时，先检查是否有匹配的 skill** — 哪怕只有 1% 的可能性也要检查
2. **设计先于编码** — 收到功能需求时，先用 brainstorming skill 做需求分析
3. **测试先于实现** — 写代码前先写测试（TDD）
4. **验证先于完成** — 声称完成前必须运行验证命令

## 可用 Skills

Skills 位于 `.claude/skills/` 目录，每个 skill 有独立的 `SKILL.md` 文件。

- **brainstorming**: 在任何创造性工作之前必须使用此技能——创建功能、构建组件、添加功能或修改行为。在实现之前先探索用户意图、需求和设计。
- **chinese-code-review**: 中文 review 沟通参考——话术模板、分级标注（必须修复/建议修改/仅供参考）、国内团队常见反模式应对。仅在用户显式 /chinese-code-review 时调用，不要根据上下文自动触发。
- **chinese-commit-conventions**: 中文 commit 与 changelog 配置参考——Conventional Commits 中文适配、commitlint/husky/commitizen 中文模板、conventional-changelog 中文配置。仅在用户显式 /chinese-commit-conventions 时调用，不要根据上下文自动触发。
- **chinese-documentation**: 中文文档排版参考——中英文空格、全半角标点、术语保留、链接格式、中文文案排版指北约定。仅在用户显式 /chinese-documentation 时调用，不要根据上下文自动触发。
- **chinese-git-workflow**: 国内 Git 平台配置参考——Gitee、Coding.net、极狐 GitLab、CNB 的 SSH/HTTPS/凭据/CI 接入差异与镜像同步配置。仅在用户显式 /chinese-git-workflow 时调用，不要根据上下文自动触发。
- **dispatching-parallel-agents**: 当面对 2 个以上可以独立进行、无共享状态或顺序依赖的任务时使用
- **executing-plans**: 当你有一份书面实现计划需要在单独的会话中执行，并设有审查检查点时使用
- **finishing-a-development-branch**: 当实现完成、所有测试通过、需要决定如何集成工作时使用——通过提供合并、PR 或清理等结构化选项来引导开发工作的收尾
- **mcp-builder**: MCP 服务器构建方法论 — 系统化构建生产级 MCP 工具，让 AI 助手连接外部能力
- **receiving-code-review**: 收到代码审查反馈后、实施建议之前使用，尤其当反馈不明确或技术上有疑问时——需要技术严谨性和验证，而非敷衍附和或盲目执行
- **requesting-code-review**: 完成任务、实现重要功能或合并前使用，用于验证工作成果是否符合要求
- **subagent-driven-development**: 当在当前会话中执行包含独立任务的实现计划时使用
- **systematic-debugging**: 遇到任何 bug、测试失败或异常行为时使用，在提出修复方案之前执行
- **test-driven-development**: 在实现任何功能或修复 bug 时使用，在编写实现代码之前
- **using-git-worktrees**: 当需要开始与当前工作区隔离的功能开发或执行实现计划之前使用——创建具有智能目录选择和安全验证的隔离 git 工作树
- **using-superpowers**: 在开始任何对话时使用——确立如何查找和使用技能，要求在任何响应（包括澄清性问题）之前调用 Skill 工具
- **verification-before-completion**: 在宣称工作完成、已修复或测试通过之前使用，在提交或创建 PR 之前——必须运行验证命令并确认输出后才能声称成功；始终用证据支撑断言
- **workflow-runner**: 在 Claude Code / OpenClaw / Cursor 中直接运行 agency-orchestrator YAML 工作流——无需 API key，使用当前会话的 LLM 作为执行引擎。当用户提供 .yaml 工作流文件或要求多角色协作完成任务时触发。
- **writing-plans**: 当你有规格说明或需求用于多步骤任务时使用，在动手写代码之前
- **writing-skills**: 当创建新技能、编辑现有技能或在部署前验证技能是否有效时使用

## 如何使用

当任务匹配某个 skill 时，使用 `Skill` 工具加载对应 skill 并严格遵循其流程。绝不要用 Read 工具读取 SKILL.md 文件。

如果你认为哪怕只有 1% 的可能性某个 skill 适用于你正在做的事情，你必须调用该 skill 检查。
<!-- superpowers-zh:end -->
