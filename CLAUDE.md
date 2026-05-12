
This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# LuminaWeave (幻光织机) — Claude Code 指南

基于 SillyTavern (ST) 的下一代增强框架，运行于独立的 Vue 3 微内核。通过深度接管（拦截 Prompt 与生成流）与绝对隔离（Shadow DOM + 独立存储）重塑 AI 角色扮演体验。

---

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

---

## 关键目录与外部文档

- `docs/index.md` — 项目全景向导（架构一览）
- `docs/overall/PDR.md` — 产品需求文档
- `docs/overall/system_design.md` — 系统架构设计
- `docs/overall/api/luminaweave_api.md` — 子插件开发 API 手册
- `docs/overall/modules/forge/` — Forge 制卡专项文档（规划/实现/进度看板）
- `docs/configuration.md`、`docs/storage-and-data.md`、`docs/testing-and-ci.md` — 配置、存储和测试参考
- `luminaweave-server/` — 独立后端；真实源码位于 `src/`，`index.js` 是构建产物
- `TavernHelper@types/` — SillyTavern 插件环境类型定义
- `luminaweave-server/data/` — 用户数据，已 `.gitignore`，禁止提交
