# HAL 架构迁移

## 目标

将 LuminaWeave 的现有模块迁移至新的 HAL（领域组装与编排中枢）架构，消除业务层对宿主实现层的直接依赖，使系统在脱离 SillyTavern 后仍可独立运行。

核心原则：**HAL 内部模块禁止直接访问宿主全局变量或 `STClient` 等实现层具体类**。详细架构规范参见 `docs/architecture.md` 第 4-6 节。

## 当前状态

架构设计与违例审查已完成；`docs/architecture.md` 已固化 HAL 接口契约（`IMacroResolver` / `IEventBridge` / `ISessionIdNormalizer` / `IHostStorage` / `IHostNetwork`）、宿主实现层归口规范、目标目录分层结构，以及 7 项已确认的架构违例清单。代码尚未改动。

## 新增架构决策：Prompt HAL 路由

会话绑定与提示词合成引擎必须分离：

- 会话绑定只描述材料来源，例如 `st-chat` 或 `plugin-session`。
- Prompt Assembly Target 描述本次要合成什么，例如 `chat.continuation`、`forge.card`、`forge.conversation`、`forge.planner`、`forge.analyst`、`forge.executor`。
- Prompt Engine 描述如何合成，例如 `st-native` 或 `lumina`。

路由原则：

- `st-native` 只支持绑定 ST 聊天的 `chat.continuation`，不支持制卡、Forge Planner/Analyst/Executor 或插件内独立会话。
- `lumina` 是统一插件合成引擎，支持聊天、制卡、Forge Agent 与 Director 等目标。
- 绑定 ST 的 Forge/插件会话可以读取 ST 角色卡、世界书、预设和历史作为资源来源，但最终合成必须由 `lumina` 引擎负责。
- UI 和插件层只提交合成意图、会话绑定、source policy、preset 选择和业务输入，不在 Vue 组件或 store 内拼最终 prompt。

## 已确认的架构违例

| 违例 | 位置 | 描述 | 优先级 |
| ---- | ---- | ---- | ------ |
| PromptBuilder 直连 STClient | `prompt/PromptBuilder.ts` L113, L119, L467 | Prompt Domain 直接调用 `STClient.substituteMacros / getActiveWorldInfoItems / getPreset`，绕过 HAL 接口 | P0 |
| ConversationService 依赖 STClient | `conversation/ConversationService.ts` L9, L63 | Core API 层使用 `STClient.normalizeChatId()` | P1 |
| STResourceSource 绕过 STClient | `resource-runtime/STResourceSource.ts` L51-78 | 直接读取 `EnvDetector.ctx?.characters` 和 `window.characters` | P1 |
| ConversationService 手动翻译 ST 事件 | `conversation/ConversationService.ts` L434-473 | Core API 层自行将内部事件翻译为领域事件，应由 HAL EventBridge 承担 | P1 |
| EnvDetector 混合路由与访问器 | `host/EnvDetector.ts` | 同时承担环境判定和全局变量代理两个职责 | P2 |
| resource-runtime 目录混杂 | `resource-runtime/` | 混杂了 HAL (ResourceService)、实现层 (STResourceSource) 和 Shell (BashTerminal) | P2 |
| NexusClient 归属不清 | `generation/NexusClient.ts` | 同时继承 facade 基类并直接消费 BridgeDispatcher | P2 |

## 目标目录结构

```
src/api/core/
├── hal/                        # HAL 领域组装层
│   ├── interfaces.ts           # 核心接口族定义
│   ├── HALContext.ts            # HAL 运行时上下文（持有注入的 Provider）
│   ├── bootstrap.ts            # HAL 初始化编排器
│   ├── resource/               # Resource Domain
│   ├── prompt/                 # Prompt Domain (PromptBuilder, DCC, Preset)
│   ├── storage/                # Storage 编排 (作用域路由, 写回策略)
│   ├── event/                  # EventBridge (标准领域事件总线)
│   └── network/                # Network (NexusClient, 流式网关)
├── host-impl/                  # 宿主具体实现层
│   ├── st/                     # STClient, STResourceSource, STEventAdapter
│   ├── tauri/                  # TauriBridgeAdapter, TauriLayoutAdapter
│   └── standalone/             # LocalResourceSource, LocalEventAdapter
├── conversation/               # Core API: 会话服务
├── generation/                 # Core API: 生成任务
├── forge/                      # Core API: Forge 编排
├── storage/                    # Core API: WorldlineStore, Persistence
└── shell/                      # Shell: BashTerminal, Permission, AgentTool
```

## TODO

### P0 — 架构硬伤（阻断独立模式可行性）

1. [x] 定义 HAL 核心接口族。
   - 创建 `src/api/core/hal/interfaces.ts`，定义 `IMacroResolver`、`IEventBridge`、`ISessionIdNormalizer`、`IHostStorage`、`IHostNetwork` 五组接口。
   - 创建 `src/api/core/hal/HALContext.ts`，提供 HAL 运行时上下文（持有所有注入的 Provider 实例）。

2. [x] PromptBuilder 解除对 STClient 的直接依赖。
   - 将 `STClient.substituteMacros()` 的调用替换为 `IMacroResolver.resolve()`。
   - 将 `STClient.getActiveWorldInfoItems()` 的调用替换为通过 `ResourceService` 获取。
   - 将 `STClient.getPreset('in_use')` 的调用替换为通过 `ResourceService.getResource()` 获取。
   - 编写 `STMacroResolver`（ST 实现）包装现有 `STClient.substituteMacros`。

### P1 — 核心层越级访问修复

3. [x] ConversationService 解除对 STClient 的依赖。
   - 将 `STClient.normalizeChatId()` 提升为 `ISessionIdNormalizer` 接口。
   - 编写 `STSessionIdNormalizer`（`.jsonl` 清理）和 `DefaultSessionIdNormalizer`（UUID 透传）。
   - `ConversationService` 改为通过 HAL 上下文获取 normalizer。

4. [x] STResourceSource 物理访问归口。
   - `getContextCharacters()` 改为调用 `STClient` 的标准方法。
   - `getWorldbookNames()` 改为调用 `STClient` 的标准方法。
   - `getPresetNames()` 已在走 `STClient`，确认无需改动。

5. [x] EventBridge 建设。
   - 创建 `src/api/core/hal/event/IEventBridge.ts` 接口。
   - 创建 `STEventBridge`：监听 ST `eventSource` 事件，转化为标准领域事件。
   - 将 `ConversationService.bindHostEvents()` 中的事件翻译逻辑迁移到 `STEventBridge`。
   - `ConversationService` 改为只订阅标准化后的领域事件。

### P2 — 边界清晰化与目录重组

6. [x] EnvDetector 拆分。
   - 拆分为 `HostDetector`（纯路由判定：返回宿主类型 + Capabilities）。
   - 拆分为 `STGlobalAccessor`（ST 宿主全局变量代理，仅在 `host-impl/st/` 内部使用）。
   - 更新所有消费方的导入路径。

7. [x] resource-runtime 目录按架构层级重组。
   - 将 `ResourceService`、`ResourceSourceRegistry`、`VirtualFileSystemService`、`PromptResourceBindingService` 移入 `hal/resource/`。
   - 将 `STResourceSource` 移入 `host-drivers/st/`。
   - 将 `LocalResourceSource` 移入 `host-drivers/standalone/`。
   - 将 `BashTerminalRuntime`、`ShellPermissionService`、`AgentBashToolService` 等移入 `hal/shell/`。
   - 更新所有导入路径和 barrel 文件。

8. [/] NexusClient 归属明确。
   - [ ] 移除 `LuminaWeaveAPIBase` 继承。
   - [x] 移入 `hal/network/` 作为 HAL Network 域的内部组件。
   - [x] Core API 的 `GenerationDomainService` 通过 HAL 上下文获取 network 能力。

### P3 — 完备性补充

9. [x] HAL 初始化编排器。
   - 创建 `src/api/core/hal/bootstrap.ts`。
   - 实现 `HALBootstrap.init()`：HostDetector → 注入 Provider → 各域就绪 → 广播 `HAL_READY`。
   - 将现有 `index.ts` 和 `LuminaWeaveAPI.init()` 中的散落初始化逻辑迁入。

10. [x] Bootstrap 存储与领域存储分离: `lwStorage` 接入 `IBootstrapStorage` 接口，解除了对 `BridgeDispatcher.extensionStore` 的直接依赖。

### P4 — Prompt HAL 路由与多引擎合成

11. [x] 定义 `PromptAssemblyRequest` / `PromptAssemblyTarget` / `SessionBinding` / `PromptAssemblyEngine` 共享契约。
    - `SessionBinding` 至少区分 `st-chat` 与 `plugin-session`。
    - `PromptAssemblyTarget` 至少覆盖 `chat.continuation`、`forge.card`、`forge.conversation`、`forge.planner`、`forge.analyst`、`forge.executor`、`director.memory`。
    - `PromptAssemblyEngine` 至少区分 `st-native` 与 `lumina`。

12. [x] 新增 `PromptAssemblyRouter`。
    - 非 `chat.continuation` 永远路由到 `lumina`。
    - `st-native` 只有在显式策略选择且存在 `st-chat` 绑定时可用。
    - 路由结果必须写入 Prompt trace，供 Prompt Inspector / Forge trace 面板审阅。

13. [/] 将 Forge 提示词合成入口改为提交 HAL Prompt 请求。
    - Forge 只提交 `target`、`forgeProjectId`、`conversationId`、`sessionBinding`、`presetId`、`sourcePolicy` 和业务输入。
    - Forge 不直接判断 ST 是否支持制卡；该能力判断归 `PromptAssemblyRouter`。
    - 绑定 ST 时，ST 只作为资源来源，不作为 Forge prompt engine。

14. [/] 将 Chat 续写入口接入多 engine 策略。
    - 保留 ST 原生聊天合成作为显式选项。
    - 默认 Lumina 合成可以读取 ST 绑定资源，但不得静默 passthrough Lumina local/subscription 资源到 ST native prompt。

## 执行原则

1. **渐进式迁移**：先定义接口，再逐个替换实现，每步确保 `npm run type-check` 和 `npm run test` 通过。
2. **不破坏现有功能**：ST 插件模式下的行为必须保持不变，迁移只是在引入接口层的同时将现有实现包装为 ST Provider。
3. **禁止新增违例**：从现在起，任何新代码禁止从 HAL 内部或 Core API 层直接访问 `STClient`、`EnvDetector.stMain` 等实现层具体类。

## 与其他任务的关系

- **standalone-resource-runtime**：该任务已建立了 `ResourceService`、`ResourceSourceRegistry`、`STResourceSource` 等资源域骨架。本任务在其基础上将这些模块物理迁入 HAL 目录，并补充 HAL 接口契约。资源域的功能迭代（如新 ResourceSource、VFS 增强）仍在 standalone-resource-runtime 中推进。
- **desktop-modes**：桌面模式的 Shell Renderer / Surface 逻辑不受 HAL 迁移影响，它们位于 Surface/Desktop 层，通过 HAL 消费标准事件和资源。
- **forge**：Forge 插件的 Prompt 组装链路是 P0 任务的直接受益者——PromptBuilder 迁移到 HAL 接口后，Forge 测试聊天的资源绑定和提示词合成将更干净。
- **prompt routing**：后续 Forge / Chat / Director 的生成入口应统一提交 `PromptAssemblyRequest`，由 HAL Prompt 路由到 `st-native` 或 `lumina`。会话绑定不等于合成引擎选择。

## 验证方式

每个任务项完成后运行：

```powershell
cd D:\LuminaWeave\luminaweave-extension
npm run type-check
npm run test
npm run build
```

目录重组后额外验证 dev watch 无报错：

```powershell
cd D:\LuminaWeave\luminaweave-extension
npm run dev
```

## 恢复方式

先读：

- `docs/architecture.md`（第 4-6 节为核心约束）
- `docs/overall/system_design.md`（搜索 `HAL` 相关段落）
- `docs/current/tasks/hal-architecture-migration/README.md`（本文件）
- `luminaweave-extension/src/api/core/resource-runtime/README.md`

然后根据本 README 的 TODO 优先级继续实现。
