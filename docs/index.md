# LuminaWeave (幻光织机) 项目全景文档

> **Welcome to LuminaWeave Workspace.**  
> 本项目是基于 SillyTavern (ST) 生态的下一代增强框架，旨在通过深度接管与绝对隔离的架构，重塑 AI 角色扮演的沉浸式体验。

---

## 🌟 项目初衷与定位

**LuminaWeave (幻光织机)** 不仅仅是一个 UI 插件，它是一个运行在 ST 平台之上的 **微内核增强框架**。

- **解决痛点**：消除原生插件堆叠导致的 UI 卡顿，解决长线剧情中的“失忆”与逻辑崩塌。
- **核心定位**：提供 Git 化的树状时间线管理、分层记忆系统、以及高自由度的请求编排能力。
- **设计哲学**：**深度接管** (拦截 Prompt 与生成流) 与 **绝对隔离** (拥有独立的存储与渲染沙盒)。

---

## 🏗️ 核心系统架构

### 1. 微内核设计 (Lumina Core)
LuminaWeave 运行于独立的 Vue 3 实例中，通过 `Lumina Core` 桥接原生 ST 环境。
- **Shadow DOM 隔离**：默认开启 Shadow DOM，确保样式不污染宿主。
- **配置先行**：在挂载前强制加载全局设置以决定渲染策略。

### 2. 核心模块总览
- **[Lumina Timeline](./timeline/PDR.md)**：Git 风格多轴穿梭图，支持物理回滚与世界线剪枝。
- **[Lumina Director](./director/PDR.md)**：导演引擎。通过 XML 标签驱动状态机，实现 `<Next_Plan>` 引导与结构化数据更新。
- **[Lumina Memory Engine](./PDR.md#2-lumina-memory-幻光记忆)**：五层分层记忆模型 (Tier 0-4)，确保 AI 始终掌握当前时空的精确状态。
- **[Unified Storage](./system_design.md#4-shadow-buffer--统一存储代理-unified-storage-engine)**：多级作用域存储系统，支持影子数据库与 ST 物理同步。

---

## 📂 目录结构指南

```text
d:\LuminaWeave\
├── .agents/                    # AI 代理工作流与指令集
├── docs/                       # 📖 项目全景文档库
│   ├── chat/                   # 聊天流渲染引擎设计 (PDR, System Design)
│   ├── timeline/               # 时间线与 Git 轨道逻辑 (PDR, System Design)
│   ├── director/               # 导演引擎与编排逻辑
│   ├── stats/                  # 状态栏与游戏化数值系统
│   ├── settings/               # 统一设置面板设计
│   ├── storage/                # 底层存储与持久化引擎
│   ├── server/                 # 后端存储插件 (Node.js) 说明
│   ├── index.md                # 您当前所在的位置 (项目向导)
│   ├── PDR.md                  # 全局产品需求文档 (Master PDR)
│   ├── system_design.md        # 全局系统架构设计 (Master System Design)
│   └── luminaweave_api.md      # 子插件开发 API 参考手册
├── luminaweave-extension/      # 🚀 核心前端插件 (Vue 3 + Vite)
│   ├── src/
│   │   ├── api/                # 通讯层 (OpenAI-Edge, ST 桥接, Storage)
│   │   ├── core/               # 微内核逻辑 (PluginManager, Lifecycle)
│   │   ├── plugins/            # 子插件实现 (Timeline, Director, etc.)
│   │   └── App.vue             # 宿主入口组件
├── luminaweave-server/         # 💾 独立后端存储服务 (Node.js)
└── stitch/                     # 构建与部署工具链
```

---

## 🛠️ 技术栈与规范

### 技术选型
- **Frontend**: Vue 3 (Composition API) + Pinia + Vite + TS.
- **Backend**: Node.js (Express-like, JSONL Storage). *Note: Modify `index.ts` only; `index.js` is a build artifact.*
- **Communication**: OpenAI-Edge (Ultra-lightweight SSE parser).
- **Style**: Vanilla CSS (Scoped) / CSS Modules.

### 核心开发规范 (IMPORTANT)
1. **显式优于隐式**：使用描述性变量名，严禁使用 `any`。
2. **数据流单向性**：视图订阅 Store -> Store 提交 API -> API 异步写回。
3. **PDR & System Design 维护协议**：**必须**在修改代码前同步阅读并更新对应的设计文档。
4. **Git 提交规范**：遵循 Conventional Commits，提交前需由 `git-commit-formatter` 格式化。

---

## 项目记忆

1. **时空节点意识**：操作消息时请区分 `id` (ST 原生) 与 `nodeId` (Lumina 树结构)。
2. **同步安全**：在执行 `save` 时，确保已通过 `PersistenceService` 进行了 ID 锚定，防止竞态覆盖。
3. **生命周期校验**：添加 XML 解析器时，必须定义对应的生命周期 (`transient`, `ephemeral`, `persistent`)。

---

## 🧭 快速链接
- [产品愿景 (PDR) v5.2](./PDR.md)
- [系统架构 (System Design) v5.2](./system_design.md)
- [API 开发手册](./luminaweave_api.md)

---
*Last Updated: 2026-03-28*  
*Status: Architecture v5.3-dev Active*
