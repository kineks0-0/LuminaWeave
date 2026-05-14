# HAL 架构迁移 — 任务清单

- [x] **P0: 架构硬伤修复 (Decoupling)**
    - [x] 定义 HAL 核心接口契约 (`src/api/core/hal/interfaces.ts`)，包含 KV 多维参数支持
    - [x] 建立 HAL 运行时上下文持有类 (`HALContext.ts`)
    - [x] 实现 ST 宿主的 Provider 系列 (Macro, Resource, Storage 等)
    - [x] 重构 `PromptBuilder` 以消费 HAL 接口，解除对 `STClient` 的直接依赖
    - [x] 在 `LuminaWeaveAPI` 初始化阶段注入 HALContext

## P1 — 核心层越级访问修复

- [x] ConversationService 解除对 STClient 的依赖
  - [x] `STClient.normalizeChatId()` → `ISessionIdNormalizer` 接口
  - [x] 编写 `STSessionIdNormalizer`（`.jsonl` 清理）和 `DefaultSessionIdNormalizer`（UUID 透传）
  - [x] `ConversationService` 改为通过 HAL 上下文获取 normalizer
- [x] STResourceSource 物理访问归口
  - [x] `getContextCharacters()` 改为调用 `STClient` 标准方法
  - [x] `getWorldbookNames()` 改为调用 `STClient` 标准方法
- [x] EventBridge 建设
  - [x] 创建 `src/api/core/hal/event/IEventBridge.ts` 接口
  - [x] 创建 `STEventBridge`：监听 ST `eventSource` → 标准领域事件
  - [x] `ConversationService.bindHostEvents()` 事件翻译逻辑迁移到 `STEventBridge`
  - [x] `ConversationService` 改为只订阅标准领域事件

## P2 — 边界清晰化与目录重组

- [x] EnvDetector 拆分
  - [x] 拆出 `HostDetector`（纯路由判定）
  - [x] 拆出 `STGlobalAccessor`（仅 `host-impl/st/` 内部使用）
  - [x] 更新所有消费方导入路径
- [x] resource-runtime 目录按架构层级重组
  - [x] `ResourceService` / `ResourceSourceRegistry` / `VFS` / `PromptResourceBindingService` → `hal/resource/`
  - [x] `STResourceSource` → `host-drivers/st/`
  - [x] `LocalResourceSource` → `host-drivers/standalone/`
  - [x] `BashTerminalRuntime` / `ShellPermissionService` / `AgentBashToolService` → `shell/`
  - [x] 更新所有导入路径和 barrel 文件
- [x] NexusClient 归属明确
  - [x] 移除 `LuminaWeaveAPIBase` 继承
  - [x] 移入 `hal/network/`
  - [x] Core API 通过 HAL 上下文获取 network 能力

## P3 — 完备性补充

- [x] HAL 初始化编排器
  - [x] 创建 `src/api/core/hal/bootstrap.ts`
  - [x] 实现 `HALBootstrap.init()`：HostDetector → 注入 Provider → 各域就绪 → `HAL_READY`
  - [x] 现有 `index.ts` / `LuminaWeaveAPI.init()` 散落初始化逻辑迁入
- [/] Bootstrap 存储与领域存储分离
  - [x] 定义 Bootstrap 存储接口（同步 KV，仅读取 HAL 配置）
  - [/] `lwStorage.loadIndependentGlobalData()` 使用 Bootstrap 存储
  - [/] 领域存储在 HAL 就绪后才对外暴露

## P4 — Prompt HAL 路由与多引擎合成

- [x] 定义 Prompt Assembly 共享契约
  - [x] `SessionBinding`: `st-chat` / `plugin-session`
  - [x] `PromptAssemblyTarget`: `chat.continuation` / `forge.card` / `forge.conversation` / `forge.planner` / `forge.analyst` / `forge.executor` / `director.memory`
  - [x] `PromptAssemblyEngine`: `st-native` / `lumina`
  - [x] `PromptAssemblyRequest` 包含 target、sessionBinding、policy、presetId、inputs
- [x] 实现 `PromptAssemblyRouter`
  - [x] 非聊天续写目标强制走 `lumina`
  - [x] `st-native` 仅允许显式选择且绑定 `st-chat`
  - [x] engine 选择、拒绝原因和资源来源写入 route diagnostics
- [/] Forge 接入 HAL Prompt 请求
  - [x] Forge 主预览与 executor 预览提交合成意图和 source policy
  - [x] 绑定 ST 时只读取 ST 资源，不把 ST native 当作制卡 engine
  - [ ] 真实生成请求同步接入 route trace
  - [ ] Prompt Preview / Trace 面板展示 router、engine、source units、budget
- [/] Chat 续写接入 engine policy
  - [x] ST 原生聊天合成作为显式选项保留
  - [x] Lumina 合成支持 `st-chat` 与 `plugin-session` 路由
  - [ ] ST native passthrough 禁止静默混入 Lumina local/subscription 资源
