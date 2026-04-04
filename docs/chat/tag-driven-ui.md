# LuminaWeave 标签驱动 UI (Tag-Driven UI) 协议规范

本规范定义了 LuminaWeave 框架下，AI 消息如何通过 XML 标签与结构化 DSL 触发前端组件渲染的通用逻辑。

## 1. 标签生命周期 (Lifecycle)

所有自定义 XML 标签必须归属于以下四种生命周期之一，这决定了数据的流转与清理策略：

| 生命周期 | 标识符 | 处理方式 | 典型用途 |
| :--- | :--- | :--- | :--- |
| **瞬态 (Transient)** | `transient` | 提取并执行 Handler 后直接丢弃，不存入记录。 | `<Thinking>` (推理过程) |
| **短暂 (Ephemeral)** | `ephemeral` | 提取后存入临时 Store，作为下一轮生成的约束。 | `<Next_Plan>` (剧情规划) |
| **持久 (Persistent)** | `persistent` | 提取并触发数据中心 (Store/DB) 状态变更。 | `<Inventory_Change>` (物品变更) |
| **展示 (Presentational)** | `presentational` | **原样保留在消息流中**，由前端渲染器解析。 | `<V>` (可视化组件容器) |

## 2. LuminaView DSL 语法

在 `<V>` 标签内部，使用以下两种 DSL 语法驱动组件渲染：

### 2.1 函数式 DSL (主要)
适用于参数较多、具有结构化语意的组件。
- **格式**: `ComponentName("arg1", 123, true, { ... })`
- **示例**: `Stat("生命值", 75, 100)`

### 2.2 管道微 DSL (补充)
适用于极致 Token 压缩、单行输出。
- **格式**: `ShortCode|arg1|arg2|...`
- **示例**: `C|选项1|选项2` (Choices)

## 3. 开发工作流 (如何添加新组件)

1.  **定义组件**: 在 `src/plugins/chat/components/blocks/` 下创建新的 Vue 组件。
2.  **注册 Schema**: 在 `ViewComponentRegistry.ts` 中注册组件的 `name`, `shortCode` 及属性映射 (Props Schema)。
3.  **更新提示词**: 在 `SystemPromptProvider.ts` 中注册该组件的指令说明，系统会自动将其注入到 LLM 的 `System Protocol` 中。
4.  **配置拦截器**: 若标签具有特殊拦截需求（非纯展示），需在 `XMLInterceptor.ts` 中注册对应的 Handler。

## 4. 渲染管线原则

1.  **流式对齐**: `deriveStreamState` 必须能够透传 `presentational` 标签，确保在打字机过程中 UI 能即时“破壳”。
2.  **双层渲染**: 优先由 `MessageRenderer` 分离文本与视图段，文本段再交由 Markdown 引擎处理，避免混淆。
3.  **容错降级**: 未识别或参数错误的 DSL 应降级为代码块显示，不应导致整个气泡崩溃。
