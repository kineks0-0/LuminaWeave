# LuminaWeave 短版架构入口

本文用于快速理解 LuminaWeave 的系统分层和架构边界。更完整的长期设计见 [全局 System Design](./overall/system_design.md)，产品目标见 [全局 PDR](./overall/PDR.md)。

本文只保留稳定架构入口，不记录阶段性任务进度。长周期执行记录进入 `docs/current/tasks/`，已完成记录进入 `docs/archive/completed-tasks/`。

## 1. 整体思路

高层应用面向接口开发无需过于专注底层细节，即跨平台抽象。
为了实现“在酒馆插件下能使用酒馆资源，又能用插件自己的提示词合成”以及脱离酒馆独立运行，系统采用如下解耦分层：
1. **宿主具体实现层 (Host Implementation)**：只负责纯粹的环境交互（读写文件、原生调用），不含业务逻辑。
2. **领域组装与编排中枢 (HAL, Host Abstraction Layer)**：这是真正的跨平台抽象调度者。它汇聚不同宿主底层的能力与资源，并在内部执行资源合并与插件自有的提示词合成（如 DCC 压缩、信息规划），向高层提供完全屏蔽了宿主差异的统一领域视图。


## 2. 开发架构定义

### 层级定义和大致流程

| 抽象层级（低到高）             | 相关模块                                       | 备注                                                         |
| ------------------------------ | ---------------------------------------------- | ------------------------------------------------------------ |
| 宿主具体实现层 (Host Drivers)    | `st-adapter`, `tauri-bridge`, `standalone-local` | 探测宿主环境并提供该环境特定的基础能力（文件 IO、原生 API）。 |
| 领域组装与编排中枢 (HAL)       | 资源域 (Resource Domain)、提示词域 (Prompt Domain) | 统筹底层资源，进行跨源合并、DCC、信息规划和 Prompt 组装。它是核心调度者。 |
| 插件核心层 (Core API)          | 会话、存储、生成流、世界线、事务引擎           | 提供核心业务领域模型，消费 HAL 提供的统一资源 and 事件流，维护业务状态机。 |
| 主题与连接层 (Surface/Desktop) | Surface Runtime / Desktop Mode Runtime         | 决定外壳与导航并提供连接层，通过渲染中心按当前主题解析界面。 |
| 领域能力层 (Plugin)            | 子插件 (Chat, Forge, Timeline 等)              | 插件通过清单(Manifest)注册能力、意图与界面，在核心层数据加载完成后开始工作。 |

### 领域组装与编排中枢 (HAL) 的核心职责

HAL 不再是单纯的透传接口，而是包含多个领域引擎：

| 领域模块   | 相关能力 | 备注 |
| ---------- | -------- | ---- |
| **Resource Domain (资源域)** | 获取世界书、角色卡、预设 | 向宿主实现层请求资源，同时合并 Lumina 独立存储中的本地资源，统一输出 `ResourceRef`。 |
| **Prompt Domain (提示词域)** | 变量系统、提示词编排、DCC | 消费资源域数据，执行动态上下文压缩（DCC）和提示词合成管道（Prompt Assembly Pipeline）。 |
| **Storage & VFS (存储编排)** | 键值存读、写回策略 | 决定数据是写回原生宿主（如酒馆）还是写入独立工作区。 |
| **UI & Lifecycle (交互与生命周期)** | 环境事件拦截、安全布局 | 拦截底层的事件（如 `chat_changed`）并统一转化为 `LUMINA_CONTEXT_UPDATED` 向上广播；处理刘海屏与输入法偏移。 |
| **Network (网络总线)** | 请求路由、流式生成 | 封装 HTTP 与原生 Invoke，对外暴露统一的 SSE 流式响应网关。 |

---

## 3. 系统运行接口规范

核心业务逻辑层（插件和 Core API）仅需与 HAL 层交互：

| 模块       | 接口目标 | 备注 |
| ---------- | -------- | ---- |
| 消息管理   | 统一节点与事务游标 | 消费从 HAL 抽象后的标准结构。 |
| LLM 调度   | 提供标准化 Payload 进行生成 | 通过 HAL Network 模块通信。 |
| 记忆系统   | 快照与历史数据持久化 | 通过 HAL Storage 写入合适的位置。 |
| 事件总线   | 订阅标准领域事件 | 不直接监听 ST 事件或 Window 事件。 |

---

## 4. HAL 内部接口契约

HAL 的每个领域模块向上层暴露标准接口，向下消费宿主实现层注入的 Provider。任何 HAL 内部模块**禁止**直接访问宿主全局变量或 `STClient` 等实现层具体类。

| HAL 接口 | 职责 | 宿主实现层注入 |
| -------- | ---- | -------------- |
| `IMacroResolver` | 宏占位符替换（`{{user}}`、`{{char}}` 等） | ST: 委托 `TavernHelper` 宏引擎；Standalone: 本地变量表替换 |
| `IEventBridge` | 拦截宿主事件并转化为 Lumina 标准领域事件 | ST: 监听 `eventSource.on('chat_changed')` → `LUMINA_SESSION_CHANGED`；Standalone: 监听本地存储变更 |
| `ISessionIdNormalizer` | 会话 ID 格式规范化 | ST: 清理 `.jsonl` 后缀；Standalone: UUID 透传 |
| `IHostStorage` | 基础 KV 存储（区分 Bootstrap 存储与领域存储） | ST: `BridgeDispatcher.storage`；Tauri: `__TAURITAVERN__.api.extension.store` |
| `IHostNetwork` | 网络请求与流式生成 | 统合 `HttpBridgeAdapter` / `TauriBridgeAdapter` |

### Bootstrap 存储与领域存储的分离

- **Bootstrap 存储**：极简同步 KV（如 `localStorage`），仅用于加载 HAL 自身配置（Shadow DOM 开关、桌面模式等），独立于 HAL 生命周期。
- **领域存储**：由 HAL Storage 域管控，支持作用域（Global/Character/Chat/Session）、写回策略和 VFS 映射。HAL 就绪后才可用。

---

## 5. 宿主实现层规范

### 物理访问归口原则

宿主实现层的所有宿主物理 I/O 必须收敛到标准归口：

- **ST 环境**：所有对 `window.SillyTavern`、`TavernHelper`、`window.characters`、`eventSource` 等全局变量的访问，归口至 `STClient` 或其专属子模块。`STResourceSource` 等实现类不得绕过 `STClient` 直接散落访问全局变量。
- **Tauri 环境**：所有对 `__TAURITAVERN__`、`__TAURI__` 的访问归口至 `TauriBridgeAdapter`。
- **环境探测**应拆分为：
  - `HostDetector`（纯路由判定）：只返回宿主类型 (`st-plugin | tauri | standalone`) 与能力清单 (`Capabilities`)。
  - 宿主访问器（如 `STGlobalAccessor`）：仅在对应 adapter 内部使用，不对外暴露。

### 目录物理分层

```
src/api/core/
├── hal/                        # HAL 领域组装层
│   ├── adapters/               # 宿主适配器实现 (STHostProvider, TauriHostProvider)
│   ├── prompt/                 # Prompt 域 (PromptBuilder, DCC, PromptRegistry, Preset)
│   ├── resource/               # Resource Domain (ResourceService, ResourceSource 抽象)
│   ├── event/                  # EventBridge (标准领域事件总线)
│   ├── network/                # Network (NexusClient, 流式网关)
│   └── bootstrap.ts            # HAL 初始化编排器
├── host-drivers/               # 宿主具体实现层
│   ├── st/                     # STClient, STGlobalAccessor, STResourceSource
│   ├── tauri/                  # TauriBridgeAdapter, TauriLayoutAdapter
│   └── standalone/             # LocalResourceSource, LocalEventAdapter
├── conversation/               # Core API: 会话服务
├── generation/                 # Core API: 生成任务
├── forge/                      # Core API: Forge 编排
├── storage/                    # Core API: WorldlineStore, Persistence
└── utils/                      # Core API: 运行时工具 (MemoryManager 等)
```

---

## 6. 当前已知架构违例与迁移约束

以下是经过代码审查确认的、与新 HAL 架构直接冲突的代码路径。后续开发**禁止新增同类违例**，既有违例按优先级逐步迁移。

| 违例 | 位置 | 描述 | 状态 |
| ---- | ---- | ---- | ---- |
| PromptBuilder 直连 STClient | `hal/prompt/PromptBuilder.ts` | 已全面改用 `HALContext.instance` 进行宏解析和资源获取。 | **已修复** |
| ConversationService 依赖 STClient | `conversation/ConversationService.ts` | 已改用 `HALContext` 下的 `sessionIdNormalizer` 和 `eventBridge`。 | **已修复** |
| STResourceSource 绕过 STClient | `host-drivers/st/STResourceSource.ts` | 已移至 `host-drivers/st`，改为通过 `STClient` 访问。 | **已修复** |
| ConversationService 手动翻译 ST 事件 | `conversation/ConversationService.ts` | 已通过 `HALContext.instance.eventBridge` 统一处理领域事件。 | **已修复** |
| EnvDetector 混合路由与访问器 | `host-drivers/EnvDetector.ts` | 同时承担环境判定和全局变量代理两个职责（逐步迁移至 HostDetector） | P2 |
| resource-runtime 目录混杂 | (已移除) | 混杂了 HAL (ResourceService)、实现层 (STResourceSource) 和 Shell (BashTerminal) | **已修复** |
| NexusClient 归属不清 | `hal/network/NexusClient.ts` | 已移至 `hal/network/`，并改用 `BridgeDispatcher` 抽象。 | **已修复** |
