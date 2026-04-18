# LuminaWeave (幻光织机) 项目全景文档

> **Welcome to LuminaWeave Workspace.**  
> 本项目是基于 SillyTavern (ST) 生态的下一代增强框架，旨在通过深度接管与绝对隔离的架构，重塑 AI 角色扮演的沉浸式体验。

---

## 🌟 项目初衷与定位

**LuminaWeave (幻光织机)** 不仅仅是一个 UI 插件，它是一个运行在 ST 平台之上的 **微内核增强框架**。

- **解决痛点**：消除原生插件堆叠导致的 UI 卡顿，解决长线剧情中的“失忆”与逻辑崩塌。
- **核心定位**：提供 Git 化的树状时间线管理、分层记忆系统、以及高自由度的请求编排能力。
- **设计哲学**：**深度接管** (拦截 Prompt 与生成流) 与 **绝对隔离** (拥有独立的存储与渲染沙盒)。
- **工作区策略 [UPDATED]**：前端 Shell 同时维护传统桌面与自由工作台两种模式；其中自由工作台已向 iPadOS Stage Manager 式的舞台调度、Dock 与重叠窗口模型演进。
- **桌面模式（Desktop Mode）体系 [UPDATED]**：UI 主题不再只是一组全局颜色变量。当前前端已收敛到单轴 `Desktop Mode` 模型，用户只切换完整桌面模式；`traditional / freeform` 仅作为桌面模式内部的壳层种类。每个桌面模式通过 `shell.kind + navigation preset + surface preset` 决定整套工作方式、导航组织与界面承载方式，`design tokens / surface skins / renderer variants` 只作为表层实现附件。正式设置入口为 `activeDesktopMode + desktop-mode-*`，旧 `activeThemePack + theme-pack-*` 仅保留兼容读取。`Discord` 与 `传统桌面`、`自由工作台` 同级，而不是某个桌面的皮肤或锁定子形态。

---

## 🏗️ 核心系统架构

### 1. 微内核设计 (Lumina Core)
LuminaWeave 运行于独立的 Vue 3 实例中，通过 `Lumina Core` 桥接原生 ST 环境。
- **Shadow DOM 隔离**：默认开启 Shadow DOM，确保样式不污染宿主。
- **配置先行**：在挂载前强制加载全局设置以决定渲染策略。

### 2. 核心模块总览
- **[Lumina Timeline](./timeline/PDR.md)**：Git 风格多轴穿梭图，支持物理回滚与世界线剪枝。
- **Unified Conversation Context [UPDATED]**：Timeline、Lorebook、Memory 等消息型视图现在共享统一的会话上下文与世界线操作 API；UI 只负责展示数据与发送意图，不再各自维护 `chat / forge` 分流逻辑。旧的 `chat-only` 世界线 facade 已移除，统一会话 API 成为唯一入口。
- **Unified Conversation Document [UPDATED]**：主聊天与 Forge 工作会话的持久化真相源已收敛为单个 `ConversationDocument`。前端通过 bridge 只消费统一 DTO，不再直接接触 `jsonl` 或 `forge_sessions` 原始结构；事务日志继续独立保存。
- **[Lumina Director](./director/PDR.md)**：导演引擎。通过 XML 标签驱动状态机，实现 `<Next_Plan>` 引导与结构化数据更新。
- **[Lumina Memory Engine](./PDR.md#2-lumina-memory-幻光记忆)**：五层分层记忆模型 (Tier 0-4)，确保 AI 始终掌握当前时空的精确状态。
- **[Unified Storage](./system_design.md#4-shadow-buffer--统一存储代理-unified-storage-engine)**：多级作用域存储系统，支持影子数据库与 ST 物理同步。

---

## 📂 目录结构与核心文件指南

本项目采用多层解耦的插件化架构，主要包含前端增强插件（Extension）与独立后端存储服务（Server）。

### 1. 项目概览 (Tree View)
```text
d:\LuminaWeave\
├── .agents/                    # AI 代理工作流与指令集
├── docs/                       # 📖 项目全景文档库
│   ├── chat/                   # 聊天流渲染引擎设计 (PDR, System Design)
│   ├── timeline/               # 时间线与 Git 轨道逻辑 (PDR, System Design)
│   ├── director/               # 导演引擎与编排逻辑
│   ├── forge/                  # Forge 制卡文档：规划 / 实现 / 进度看板
│   ├── desktop_modes/          # 桌面模式重构与自定义桌面扩展规划
│   ├── stats/                  # 状态栏与游戏化数值系统
│   ├── settings/               # 统一设置面板设计
│   ├── storage/                # 底层存储与持久化引擎
│   ├── server/                 # 后端存储插件 (Node.js) 说明
│   ├── index.md                # [ROOT] 项目向导 (当前文件)
│   ├── PDR.md                  # 全局产品需求文档 (Master PDR)
│   ├── system_design.md        # 全局系统架构设计 (Master System Design)
│   └── luminaweave_api.md      # 子插件开发 API 参考手册
├── luminaweave-extension/      # 🚀 核心前端插件 (Vue 3 + Vite)
│   ├── src/
│   │   ├── api/
│   │   │   ├── core/           # 🧩 微内核服务核心 (Services)
│   │   │   │   ├── ChatManager.ts        # 本地消息节点池管理
│   │   │   │   ├── ContextCompactor.ts   # DCC 上下文压缩
│   │   │   │   ├── LorebookManager.ts    # 世界书同步代理
│   │   │   │   ├── LVParser.ts           # LuminaView DSL 解析器
│   │   │   │   ├── MeasureService.ts     # 全局文本测量服务
│   │   │   │   ├── MemoryManager.ts      # 核心快照与记忆中心
│   │   │   │   ├── SyncUtils.ts          # 统一指纹与差异计算
│   │   │   │   ├── PersistenceService.ts # 事务化持久化协议
│   │   │   │   ├── PromptBuilder.ts      # 提示词组装与插槽化
│   │   │   │   ├── st-adapter/           # ST 适配层命名空间 (Protocol + Client)
│   │   │   │   │   ├── STProtocol.ts     # ST ↔ Lumina 协议转换 + 指纹口径 (pure)
│   │   │   │   │   └── STClient.ts       # SillyTavern/TavernHelper I/O 封装
│   │   │   │   ├── STAdapter.ts          # 同步门面：compare/applyDelta/getSnapshot
│   │   │   │   ├── STSyncService.ts      # 对话同步逻辑
│   │   │   │   ├── TagTokenizer.ts       # 健壮性 XML 分词器
│   │   │   │   ├── TimelineManager.ts    # 时间线路径计算
│   │   │   │   ├── TransactionProtocol.ts# 事务状态机机制
│   │   │   │   ├── WorldlineStore.ts     # 图谱化存储邻接表
│   │   │   │   └── XMLInterceptor.ts     # 标签解析与生命周期管理
│   │   │   ├── index.ts        # API 全局单例入口
│   │   │   ├── llmEngine.ts    # 官方 OpenAI SDK 请求生成控制
│   │   │   └── storage.ts      # 统一存储引擎
│   │   ├── core/
│   │   │   └── PluginManager.ts# 插件解耦注册中心
│   │   ├── plugins/            # 📦 子插件实现目录
│   │   │   ├── chat/           # 消息流渲染增强 (包含组件化渲染管线)
│   │   │   ├── director/       # 导演引擎、增量更新引擎与规则编排
│   │   │   ├── launcher/       # UI 启动器
│   │   │   ├── lorebook/       # 世界书同步编辑器
│   │   │   ├── memory/         # 记忆子面板展示
│   │   │   ├── settings/       # 统一设置面板
│   │   │   ├── stats/          # 游戏化数值系统状态栏
│   │   │   └── timeline/       # 幻光时间线 (LogicFlow)
│   │   ├── App.vue             # 视觉根组件 (UI Shell)
│   │   └── index.ts            # Extension 挂载点与样式隔离引导
│   └── i18n/                   # 国际化语言包 (zh-CN, en)
├── luminaweave-server/         # 💾 独立后端存储服务 (Node.js)
│   ├── index.ts                # 服务端入口 (JSONL 事务存储与 OpenAI SDK 路由)
│   └── data/                   # [IGNORED] 用户本地数据库存储区
├── TavernHelper@types/         # SillyTavern 插件环境类型定义
├── dev-start.ps1               # 一键开发启动脚本
├── sync-projects.ps1           # 远程仓库同步脚本
└── stitch/                     # 构建与部署工具链
```

### 2. 核心文件功能映射

| 路径分层 | 核心文件 | 功能描述 |
|:---|:---|:---|
| **项目根目录** | `dev-start.ps1` | 一键启动开发环境，同步运行前端热更新与后端服务。 |
| | `sync-projects.ps1` | 自动化子项目同步工具，维护多个独立仓库的一致性。 |
| **Extension 入口** | `src/index.ts` | 插件生命周期底座，处理 Shadow DOM 容器挂载与样式沙盒隔离。 |
| | `src/App.vue` | 视觉根组件，负责面板状态管理、侧边栏悬浮、右侧 Slot 调度，以及当前桌面模式的壳层分支、preset 与 token 注入。 |
| | `src/theme/` | Desktop Mode 注册中心与壳层协议，负责 `shell.kind / navigation / surface` 三层解析，并向下兼容 design token、surface skin 与受控 renderer variant。当前已额外覆盖 Discord 角色卡侧栏与频道式主界面所需的导航变量。 |
| **微内核 (API Core)** | `src/api/index.ts` | 全局 API 单例导出，提供跨组件的统一通讯网关。 |
| | `src/api/llmEngine.ts` | 请求与生成控制核心，桥接后端基于官方 OpenAI SDK 的生成路由。 |
| | `src/api/storage.ts` | 统一存储引擎，实现 Global/Chat/Local 多级作用域的持久化。 |
| | `st-adapter/STClient.ts` | ST 环境 I/O 层，封装对 SillyTavern/TavernHelper 的物理操作与 CSRF 令牌。 |
| | `st-adapter/STProtocol.ts` | ST 协议层，统一文本清洗、双指纹与 ST ↔ Lumina/Storage 的互转。 |
| | `STAdapter.ts` | 同步门面层，统一 compare/applyDelta/getSnapshot 等高阶同步接口。 |
| | `STSyncService.ts` | 对话同步服务，处理线性聊天记录与图谱节点池的双向映射。 |
| | `WorldlineStore.ts` | 图谱化存储邻接表中心，大幅降低树图节点遍历与寻址复杂度。 |
| | `XMLInterceptor.ts` | 消息解析流水线，利用栈式解析器处理 XML 标签的生命周期拦截。 |
| | `ChatManager.ts` | 影子数据库管理器，维护本地消息节点池（Local Chat Data）。 |
| | `TimelineManager.ts` | 时间线逻辑中心，计算活跃世界线路径及节点关联上下文。 |
| | `ConversationService.ts` | 统一会话世界线服务。负责来源注册、全局 viewing context、上下文快照查询与世界线命令分发。 |
| | `PersistenceService.ts`| 事务化存储协议，通过序列对账与竞态锁定保障 IO 安全性。 |
| | `LVParser.ts` | LuminaView 结构化渲染解析器，支持极简 DSL 组件化渲染。 |
| | `ContextCompactor.ts` | DCC 动态上下文压缩引擎，实现“全量+摘要+隐藏”的分层策略。 |
| | `TagTokenizer.ts` | 健壮性 XML 分词器，支持流式解析中的残损/嵌套标签捕捉。 |
| | `LorebookManager.ts` | 世界书同步代理，利用代理函数驱动 ST 原生世界书实时更新。 |
| | `MemoryManager.ts` | 核心快照与记忆中心，负责协调子插件状态并管理时间游走回放。 |
| **子插件 (Plugins)** | `chat/` | 对话增强系统。包含组件流渲染器与 `ChatStream.vue` 等流式界面核心。 |
| | `timeline/` | 幻光时间线。基于 Dagre 排版与 LogicFlow 实现可视化世界线导航。 |
| | `director/` | 导演引擎。处理 XML 增量更新、规划链构建与 `MutationEngine` 沙箱拦截。 |
| | `forge/` | 制卡工作台。当前已演进为 `detailMode 分流可见阶段 + 七层后台设计模型 + 双模式辅助区 + 虚拟工作区闭环` 的 Forge 工作流：`detailed` 暴露 6 段可见阶段，`quick` 压缩为 `kickoff / build / finalize`；自由工作台下 Forge 主窗支持 `内嵌右栏 / 拆出小窗` 双态切换，并按会话记忆当前辅助区呈现模式，传统模式则继续在 Forge 前台内部切换单辅助区。Forge 同时支持专属 `<V>` 组件渲染、A.U.T.O 半专用化 Prompt、`LangGraph runtime orchestrator + typed effect/apply` 编排层与共享 `<thinking>` 思考链协议。 |

### 3. Forge 文档入口
- **[Forge 文档索引](./forge/index.md)**：Forge 专属文档导航。
- **[Forge 规划文档](./forge/planning.md)**：产品目标、交互方向与协议规划。
- **[Forge 实现与技术交接](./forge/implementation.md)**：当前实现链路、技术选型与重构判断。
- **[Forge 进度看板](./forge/progress-board.md)**：已完成项、剩余待办与短期推进顺序。
| | `settings/` | 统一设置。支持子插件与桌面模式通过 Manifest 注册表单组件，并按核心 / 桌面模式 / 插件分层展示。 |
| | `lorebook/` | 世界书管理面板，实现插件端可视化条目编排。 |
| | `stats/` | 面向 RPG 游戏的数值与状态栏。 |
| **后端 (Server)** | `index.ts` | Node.js 事务化存储与生成代理，基于统一 `ConversationDocument` + 独立事务日志与 OpenAI SDK 提供高可用支撑。 |

---

---

## 🛠️ 技术栈与规范

### 技术选型
- **Frontend**: Vue 3 (Composition API) + Pinia + Vite + TS.
- **Backend**: Node.js (Express-like, unified conversation document + transaction log storage). *Note: Modify `index.ts` only; `index.js` is a build artifact.*
- **Communication**: Official OpenAI SDK (High-performance API interactions).
- **Style**: Vanilla CSS (Scoped) / CSS Modules.

### 核心开发规范 (IMPORTANT)
1. **显式优于隐式**：使用描述性变量名，严禁使用 `any`。
2. **数据流单向性**：视图订阅 Store -> Store 提交 API -> API 异步写回。
3. **PDR & System Design 维护协议**：**必须**在修改代码前同步阅读并更新对应的设计文档。
4. **Git 提交规范**：遵循 Conventional Commits，提交前需由 `git-commit-formatter` 格式化。

---

## 🌐 工程化与协作规范

### 1. Git 协作模式 (Monorepo + Subtree)
本项目本地采用 **Monorepo (单体仓库)** 结构，但支持将子项目独立发布至 GitHub：
- **本地仓库**: `D:\LuminaWeave` (根目录) 统一管理所有代码。
- **发布策略**: 使用 `git subtree` 将子项目文件夹（如 `luminaweave-extension`）同步至独立的远程仓库。
- **同步工具**: 可在项目根目录运行 `. .\sync-projects.ps1` 进行一键推送/拉取。

### 2. 冲突预防与构建产物
为了方便用户直接安装，我们会在 Git 中保留 `dist/` 编译产物。
- **防止合并冲突**: 在子项目根目录配置了 `.gitattributes`，设置 `dist/** merge=ours`。这确保了在分支合并时，始终优先保留当前分支的构建版本备份。

### 3. 国际化 (i18n) 规范
插件支持多语言动态切换：
- **标准包**: 位于 `luminaweave-extension/i18n/`，包含 `zh-CN.json` 和 `en.json`。
- **开发要求**: 界面字符串严禁硬编码在 Vue 组件中，必须通过 `manifest.json` 注册并在代码中通过 i18n 系统调用。

### 4. 数据隐私与安全
- **严格忽略**: `luminaweave-server/data/` 被根目录全局忽略，禁止将任何用户敏感数据提交至版本库。

---

## 🚀 开发常用命令速查

### 同步远程子项目
```powershell
. .\sync-projects.ps1
Publish-LuminaExtension  # 发布插件更新
Update-LuminaExtension   # 拉取远程插件更新
Publish-LuminaServer     # 发布服务端更新
```

---

## 项目记忆

1. **时空节点意识**：操作消息时请区分 `id` (ST 原生) 与 `nodeId` (Lumina 树结构)。
2. **同步安全**：在执行 `save` 时，确保已通过 `PersistenceService` 进行了 ID 锚定，防止竞态覆盖。
3. **生命周期校验**：添加 XML 解析器时，必须定义对应的生命周期 (`transient`, `ephemeral`, `persistent`)。

---

## 🧭 快速链接
- [产品愿景 (PDR) v6.0](./PDR.md)
- [系统架构 (System Design) v6.0](./system_design.md)
- [API 开发手册](./luminaweave_api.md)
- [桌面模式重构总规划](./desktop_modes/desktop-mode-architecture-plan.md)

---
*Last Updated: 2026-04-12*  
*Status: Architecture v6.0-dev Active (Lifecycle & Stability)*

