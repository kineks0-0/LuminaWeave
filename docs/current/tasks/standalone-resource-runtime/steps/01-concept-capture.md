# 01 Concept Capture: Runtime 与资源源解绑

## 背景

当前 LuminaWeave 已有 ST 插件运行、Bridge 多端适配、Forge 虚拟世界书、统一 Prompt Preset 合成等基础。新的方向不是立即重写实现，而是先把能力边界重新命名：

- 插件是否运行在 ST 中，不应决定资源只能来自 ST。
- standalone-host 表示宿主无关能力层，不等于只能脱离 ST。
- 资源来源可以独立挂载、浏览、导入和绑定。

## 核心概念

- **Runtime Host**：当前运行环境与宿主能力，例如 `st-plugin`、`standalone-web`、`desktop-native`。
- **Resource Source**：资源来源，例如 `st`、`lumina-local`、`subscription`。
- **Resource Ref**：资源稳定引用，至少需要表达来源、类型、ID、路径、可写性、版本/修订和来源追踪。
- **Resource Domain**：业务层读取世界书、角色卡、预设、会话、记忆的唯一入口。
- **Virtual File System**：Resource Domain 的路径化只读视图，支持命令式浏览和搜索。
- **Write Policy**：外部资源编辑时的写回或 fork 策略。

## 已确定原则

- Runtime 与 Resource Source 解绑。
- ST 插件 Runtime 下仍可同时读取 ST 资源和 Lumina 本地资源。
- 同名或同 ID 资源不自动合并，以显式挂载路径和 Resource Ref 区分。
- 外部资源不静默改写；首次编辑时询问，之后可通过设置保存默认行为。
- 订阅源首版只读，用于发现、浏览、搜索和导入。
- VFS 首版只提供读取与搜索命令，不引入破坏性文件操作。

## 后续讨论入口

- 插件如何声明、读取和管理 Resource Ref。
- Prompt Preset 如何记录 `promptEngine='st' | 'lumina'` 与资源绑定。
- Lumina 自合成提示词需要如何处理世界书触发、角色卡 slots、预设 entries、宏替换和聊天历史裁剪。
- ST 合成路径遇到 Lumina 本地资源时，是转换为虚拟世界书/宏注入，还是提示不可直接参与。

## 2026-05-07 第一阶段实现记录

- 新增共享资源契约与 ST raw summary helper，保持角色卡、世界书、预设的 ST 原始格式为导入/导出边界。
- 新增 Resource Runtime core service：source registry、resource service、本地源、ST 源、write policy、prompt resolver 与 VFS。
- 本地源使用 Lumina extension store 独立 namespace 保存资源，不与现有设置、聊天或 Prompt Preset registry 混用。
- ST 源首版只读读取当前可见角色、世界书列表与当前 ST preset；写入返回显式策略需求，不静默写回。
- PromptBuilder 新增 ResourceRef 异步入口，Forge 测试聊天可消费 Resource bundle；旧同步入口保持兼容。

## 2026-05-07 Prompt Trace / Information Planner 记录

- 新增 Prompt source/trace 类型：`PromptSourceUnit`、`PromptPlannedUnit`、`PromptSourceTrace`、`PromptAssemblyResult`。
- `PromptSourceUnit.kind` 将提示词片段区分为 `control`、`information`、`state`；DCC/Information Planner 默认只对 information/state 做预算规划，control 默认保留。
- 新增 `PromptInformationPlanner`，首版支持 full/summary/hidden/pinned/compressed 规划；聊天消息等已有摘要来源可通过 `summaryContent` 进入 summary。
- 新增 `PromptAssemblyTracer`，负责将 planned units 组装成最终 messages，并记录每个 unit 在输出 message 中的 index/start/end。合并 leading system message 时追加非丢失 `merge` transform。
- `PromptPresetComposer.composeWithTrace()` 已能按 slot 标注来源：角色卡、世界书、历史、记忆、Forge 状态和系统协议分别进入不同 source kind。

## 2026-05-07 Forge Prompt Preview 来源页签

- `ForgePromptContextService` 新增主模型与 Executor 的 preview assembly 构建接口，真实执行请求仍保持原有 messages 输出。
- `CardMakerStore.buildPromptPreviewPayload()` 现在同时返回 payload 和 assembly。
- `ForgePromptPreview` 新增 `Messages / 来源` 视图切换；来源视图显示 `sourceKind`、`kind`、`inclusion`、ResourceRef/path、输出 message offset 与 transform。
- 当前 UI 首版以列表方式展示来源，后续可继续做 message 文本内 offset 高亮。

## 2026-05-07 PromptInspector 来源页签

- `PromptInspector` 新增 `Messages / 来源` 视图切换，可消费未来事件 payload 中携带的 `PromptAssemblyResult`。
- 当前 ST dryRun 探针仍保持 raw messages 契约；当 payload 没有真实 assembly 时，UI 会生成 synthetic trace，标记为 `unknown` source kind 与 `raw_prompt_probe` transform。
- synthetic trace 只说明 raw message 在最终数组中的位置，不伪造 ResourceRef；后续 Lumina 自合成路径接入后应优先传入真实 assembly。
- 来源页签已补充 `diagnostics` 分组展示、transform detail 与 ResourceRef 明细展开。diagnostics 来自 `PromptAssemblyResult.diagnostics`，raw ST 探针 synthetic trace 默认不制造 diagnostics。
- `PromptInspector` 进一步扩展为 `Messages / 合并 / 来源` 三视图。合并视图按最终 message 分组展示 source trace，保留 offset 范围、来源标签、inclusion 和短摘录，方便同时检查最终提示词内容与来源。
