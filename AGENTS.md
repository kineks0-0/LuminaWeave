# LuminaWeave Agent Guide

本文件为在 `D:\LuminaWeave` 工作的 AI 代理与协作者提供统一操作说明。目标是让后续修改尽量贴合项目当前架构、文档约束与实际仓库状态。

## 0. 需求处理原则
先从原始需求出发，不默认用户已经完全想清楚目标、约束和实现路径。
只有当需求存在关键歧义，且不同理解会导致明显不同方案或较高错误成本时，才先停下来澄清；否则基于最合理解释继续，并明确说明假设。
当需要给出修改或重构方案时，遵循以下原则：
默认只围绕用户明确提出的目标设计方案，不擅自扩展业务目标，不引入替代业务路径。
优先给出满足目标的最小完整方案，而不是补丁式兼容方案；但如果“最短路径”与“非补丁”冲突，应优先选择不会引入结构性错误的最小正确方案。
不做与当前需求无关的兜底、降级或额外分支设计；但为保证逻辑闭合，允许加入必要的输入约束、状态检查和边界保护。
输出方案前，按输入、处理流程、状态变化、输出、上下游影响进行链路检查；对无法验证的部分必须明确标注假设和未验证前提，不得将推测表述为已确认事实。

## 1. 项目定位

- LuminaWeave 是运行在 SillyTavern 生态上的增强框架，不只是 UI 插件。
- 项目强调两件事：`深度接管`（Prompt、生成流、同步流程）与 `绝对隔离`（Shadow DOM、独立存储、独立渲染/服务层）。
- 当前仓库同时承载前端扩展、后端服务、共享代码与设计文档，属于单仓协作模式。

## 2. 仓库结构

- `docs/`
  - 产品与架构文档中心。
  - `index.md` 是总览入口；长期产品与架构文档位于 `overall/PDR.md`、`overall/system_design.md`。
  - 仓库级协作与参考文档：
    - `documentation-standards.md`：文档体系和更新规则。
    - `contributing.md`：人类协作指南、分层边界和验证要求。
    - `testing-and-ci.md`：测试入口与验证矩阵。
    - `configuration.md`：构建、运行和宿主配置参考。
    - `storage-and-data.md`：ConversationDocument、事务日志、VFS、server data 等存储说明。
    - `adr/`：重大架构决策记录。
  - 当前任务放在 `current/tasks/`，已完成任务归档到 `archive/completed-tasks/`。
- `luminaweave-extension/`
  - 前端扩展，技术栈为 Vue 3 + Vite + TypeScript + Pinia。
  - 关键入口：
    - `src/index.ts`：扩展挂载、宿主桥接、样式隔离。
    - `src/App.vue`：UI Shell。
    - `src/bootstrap/registerPlugins.ts`：插件注册。
  - 核心逻辑集中在 `src/api/core/`，并按功能域拆分为 `conversation/`、`storage/`、`generation/`、`hal/`、`host-drivers/`、`forge/`、`lorebook/`、`xml-view/`、`facade/` 等目录。
  - 平台运行时位于 `src/platform/`，包含 Plugin Domain、Surface Runtime 和 Desktop Mode Runtime。
  - 子插件集中在 `src/plugins/`，当前包括 `chat`、`director`、`forge`、`launcher`、`lorebook`、`settings`、`stats`、`timeline`、`dev`、`terminal` 等方向。
- `luminaweave-server/`
  - 后端服务，当前源码在 `src/`，构建产物输出到根下的 `index.js`。
  - 关键文件：
    - `src/index.ts`：服务入口。
    - `src/StorageService.ts`、`src/StreamingManager.ts`、`src/NexusService.ts`：后端核心能力。
  - `data/` 为本地数据目录，禁止提交用户数据。
- `luminaweave-extension/shared/`
  - 前后端共享类型与基础模块，承载 XML、消息、ConversationDocument、事务、同步、资源/VFS 等共享协议。
- `.agents/`
  - 本地代理技能与工作流配置，不属于产品运行时代码。
- `dev-start.ps1`
  - 开发启动脚本：先构建 server，再启动 extension 的 watch。
- `sync-projects.ps1`
  - 子项目同步脚本，用于本地 monorepo 与外部仓库同步。

## 2.5. 参考文档/代码位置
- `D:\Game\SillyTavern`
  SillyTavern源码
- `D:\Program\tauritavern\`
  TauriTavern项目源码位于
- `D:\Program\tauritavern\docs\`
  TauriTavern项目文档，在本项目 `TauriTavernDocs\` 有副本
- TavernHelper文档在项目根目录下的 `TavernHelper@types\` 里（其中 function 文件夹下是 TavernHelper 的函数定义，另一个文件夹下是环境定义）

## 3. 代码事实优先级

- `docs/index.md` 描述的是架构意图，但代码可能先于文档演化。
- 做判断时遵循以下顺序：
  1. 当前代码与测试
  2. 当前目录结构与构建脚本
  3. `docs/index.md`、`docs/overall/PDR.md`、`docs/overall/system_design.md` 与相关模块文档
- 如果代码与文档不一致：
  - 小改动：优先保持代码现实可运行。
  - 架构级改动：同步更新对应文档，避免继续漂移。

## 4. 工作规则

- 修改前先读相关模块附近代码，不要只依据总览文档操作。
- 涉及核心能力时，优先定位这些目录：
  - 聊天/同步：`luminaweave-extension/src/api/core/conversation/`、`luminaweave-extension/src/api/core/storage/`、`luminaweave-extension/src/api/core/host-drivers/`
  - 生成/Prompt：`luminaweave-extension/src/api/core/generation/`、`luminaweave-extension/src/api/core/hal/`
  - Forge 编排：`luminaweave-extension/src/api/core/forge/`
  - XML/视图协议：`luminaweave-extension/src/api/core/xml-view/` 与 `luminaweave-extension/shared/`
  - 插件 UI：`luminaweave-extension/src/plugins/`
  - 平台/桌面/surface：`luminaweave-extension/src/platform/`、`luminaweave-extension/src/shell/`
  - 全局状态：`luminaweave-extension/src/stores/`
  - 服务端：`luminaweave-server/src/`
  - 共享契约：`luminaweave-extension/shared/`
- 保持 TypeScript 严格风格：
  - 尽量避免 `any`
  - 变量命名明确
  - 新类型优先放在靠近使用处或 `luminaweave-extension/shared/` 的共享契约中
- 遵守单向数据流：
  - 视图层订阅 store
  - store / plugin 调用 API
  - API 负责异步与持久化回写
- 不要把界面文案硬编码进 Vue 组件；优先检查 `i18n/` 与 manifest 相关注册方式。

## 5. 文档联动要求

- 若改动影响以下任一内容，应同步更新 `docs/` 中对应文档：
  - 模块职责
  - 数据流
  - 生命周期
  - 存储结构
  - 对外 API
- 最少应检查：
  - `docs/index.md`
  - `docs/overall/PDR.md`
  - `docs/overall/system_design.md`
  - 目标模块的 `docs/overall/modules/<module>/README.md`
- 若改动涉及配置、存储、测试或协作流程，额外检查：
  - `docs/configuration.md`
  - `docs/storage-and-data.md`
  - `docs/testing-and-ci.md`
  - `docs/contributing.md`
- 若做出重大架构取舍，应新增或更新 `docs/adr/`。
- 若只是局部实现细节修复，可不强制改总览文档，但要确认不会让文档描述失真。

## 6. 构建、测试与常用命令

在对应子项目目录执行：

### extension

```powershell
cd D:\LuminaWeave\luminaweave-extension
npm run dev
npm run build
npm run watch
npm run test
npm run type-check
```

### server

```powershell
cd D:\LuminaWeave\luminaweave-server
npm run build
npm run test
```

### root helper

```powershell
cd D:\LuminaWeave
.\dev-start.ps1
.\sync-projects.ps1
```

说明：

- `dev-start.ps1` 当前行为是先执行 server build，再进入 extension watch。
- `luminaweave-server/index.js` 是构建产物，不应作为手改源文件。
- 服务端真实源码当前以 `luminaweave-server/src/*.ts` 为准。

## 7. 高风险区域

以下改动需要特别谨慎，并尽量补测试：

- `luminaweave-extension/src/api/core/STAdapter.ts`
- `luminaweave-extension/src/api/core/STSyncService.ts`
- `luminaweave-extension/src/api/core/PersistenceService.ts`
- `luminaweave-extension/src/api/core/MemoryManager.ts`
- `luminaweave-extension/src/api/core/TimelineManager.ts`
- `luminaweave-extension/src/api/core/XMLInterceptor.ts`
- `luminaweave-extension/src/api/core/st-adapter/`
- `luminaweave-extension/src/api/core/conversation/`
- `luminaweave-extension/src/api/core/storage/`
- `luminaweave-extension/src/api/core/generation/`
- `luminaweave-extension/src/api/core/hal/`
- `luminaweave-extension/src/api/core/host-drivers/`
- `luminaweave-extension/src/api/core/forge/`
- `luminaweave-extension/src/api/core/xml-view/`
- `luminaweave-server/src/StorageService.ts`
- `luminaweave-server/src/StreamingManager.ts`
- `luminaweave-server/src/NexusService.ts`
- `luminaweave-extension/shared/` 中的共享协议与基础解析器

这些区域直接关系到：

- ST 原生消息 `id` 与 Lumina 树结构 `nodeId` 的映射
- `ConversationDocument` 与事务日志
- 持久化事务安全
- 时间线回滚与世界线分支
- XML 标签生命周期与流式解析稳定性
- 前后端共享事件/消息协议
- Resource Ref、VFS 路径和外部资源写入策略

## 8. 测试建议

- 前端测试主要位于：
  - `luminaweave-extension/src/api/__tests__/`
  - `luminaweave-extension/src/api/core/__tests__/`
  - `luminaweave-extension/src/api/services/__tests__/`
  - `luminaweave-extension/src/plugins/director/__tests__/`
  - 各 store、shell、platform 或插件目录下的 `__tests__/`
- 服务端测试主要位于：
  - `luminaweave-server/src/__tests__/`
- 如果改动影响同步、事务、XML、流式生成、持久化、HAL、Resource/VFS、Forge Agent 或共享协议，至少运行对应子项目的 `npm run test`。
- 如果改动影响类型边界或 Vue 组件接口，额外运行 extension 的 `npm run type-check`。
- 如果改动影响构建、chunk、依赖或分发产物，额外运行 extension 的 `npm run build`。

## 9. 提交与协作约束

- 仓库当前可能处于脏工作区，先看 `git status`，不要回滚他人修改。
- `dist/` 在本项目中可能被保留用于分发，不要默认删除。
- `luminaweave-server/data/` 禁止提交。
- 提交信息遵循 Conventional Commits。
- 若改动同时涉及 extension、server、shared，提交说明中要明确跨层影响。

## 10. 面向本项目的实现偏好

- 新功能尽量以“插件注册 + API 核心能力 + store/UI 接入”的方式接入，避免把所有逻辑堆进单个 Vue 组件。
- 前后端共享的事件、消息、类型，优先抽到 `luminaweave-extension/shared/`，避免重复定义。
- 与 SillyTavern 宿主交互时，优先通过现有 adapter / client 层扩展，不要绕过封装直接散落调用。
- 涉及 XML 标签或流式输出时，先检查现有拦截器、分词器、事件流抽象是否已可复用。

## 11. 开工前最小检查单

开始改动前，至少完成以下动作：

1. 阅读 `docs/index.md`。
2. 阅读目标模块附近实现与测试。
3. 确认是否存在共享类型或 adapter 可复用。
4. 确认是否需要同步更新 `docs/`。
5. 确认不会误改构建产物或本地数据目录。

## 12. 当前已知现实差异

- `docs/index.md` 中部分文件清单偏架构视角；实际代码已经扩展出 `luminaweave-extension/shared/`、`forge`、`NexusClient`、更多测试与新的服务端 `src/` 布局。
- `docs/PDR.md` 与 `docs/system_design.md` 已不是实际路径；当前长期文档位于 `docs/overall/PDR.md` 与 `docs/overall/system_design.md`。
- 服务端 README 中“仅修改根级 `index.ts`”的说法已不再完全符合当前结构；现阶段应以 `luminaweave-server/src/` 为源码主目录。

如无更具体的局部说明，默认以本文件作为仓库级协作指南执行。

# 13. PDR & System Design 维护协议

在执行任何功能开发、代码重构或 Bug 修复时，必须严格遵守以下工作流：

1. **前置读取 (Read)**: 在编写任何代码之前，必须先静默读取 `docs/index.md`、`docs/overall/PDR.md` 和 `docs/overall/system_design.md`（或对应的架构文档），理解当前的系统约束与设计意图。
2. **影响评估 (Evaluate)**: 评估你的代码修改是否会越界或改变现有架构。例如：是否影响了现有的微内核 (microkernel) 与子插件 (sub-plugins) 架构边界？是否改变了高自由度的请求编排逻辑或增量更新机制？
3. **同步更新 (Update)**: 如果当前开发引入了新的接口、改变了数据流，或使得 PDR 中的原有假设失效，**必须**在提交代码修改的同时，同步更新 PDR 和 System Design 文档。
4. **输出记录 (Log)**: 在你的回复末尾，简要说明本次开发对 PDR/System Design 产生了哪些影响，或者明确声明“本次修改未改变核心系统设计”。
