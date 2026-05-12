# LuminaWeave 自动代码审查清单 (Code Review Checklist)

在提交 Pull Request (PR) 前，请逐项核对并勾选以下检查单。未通过检查项的代码修改将被拒绝合并。

## 一、 PDR & System Design 架构同步 (PDR Protocol)

- [ ] **前置阅读已完成**: 确认已阅读 `docs/overall/PDR.md`、`docs/overall/system_design.md` 及 `docs/overall/architecture/business_behavior_spec.md`。
- [ ] **影响评估**: 本次修改是否越界或改变现有架构？
    - *如果是，请在 PR 描述中详细说明对微内核（microkernel）与子插件（sub-plugins）架构边界、高自由度的请求编排逻辑或增量更新机制的影响。*
- [ ] **文档同步更新**: 本次开发若引入了新的接口、改变了数据流，或使得原有假设失效，是否已**同步更新**相关文档？

## 二、 编码规范与类型安全 (Coding Standards & Types)

- [ ] **TypeScript 严格约束**: **严禁使用 `as any`**。请使用 `unknown` 或定义具体的 interface/type 进行类型断言。
- [ ] **SillyTavern 兼容性**: 依赖 `TavernHelper` 或原生 API 时，是否已参考 `SillyTavern/TavernHelper@types/` 中的定义？
- [ ] **变量隔离**: 是否存在可能污染 `window.chat`、`window.world_info` 或全局命名空间的代码？

## 三、 数据同步与持久化隔离 (Data & Persistence Isolation)

- [ ] **独立数据源优先**: 插件状态（如物品栏、对话节点）是否首先写入 Lumina Core 的影子数据库（LocalChatData）？
- [ ] **事务与防重机制**: `/chat/save` 等核心写入操作是否携带了 `idempotencyKey`，并遵循了 `pending → running → committed` 状态机？
- [ ] **冲突策略**: 是否妥善处理了与 ST 数据的不可合并冲突（hasDivergence）？是否添加了防回灌（自写自读）机制？

## 四、 提示词组装与大模型交互 (Prompt & LLM Flow)

- [ ] **非侵入式提示词**: 新增的规则或系统级指令是否通过虚拟世界书（`PromptWorldInfoMount`）或宏替换（Macro Pipeline）注入，而非直接硬改 `mesRaw`/`mes`？
- [ ] **数据生命周期标签**: XML 解析是否正确注册了其生命周期（`transient`, `ephemeral`, `persistent`, `core`）？
    - *例如：辅助推演类 XML (`<Thoughts>`) 必须标记为 `transient`，绝不污染 Tier 2 (近期记忆)。*
- [ ] **动态上下文压缩 (DCC)**: 修改发送逻辑时，是否正确执行了 `ContextCompactor` 并将需要隐藏的消息标记了原生属性 `is_hidden`？

## 五、 UI/UX 与沙盒隔离 (UI & Sandbox)

- [ ] **Shadow DOM 隔离**: 新增或修改的 UI 组件样式是否被安全隔离在 Shadow DOM 内部，且未对 ST 原生样式造成污染？
- [ ] **流式平滑渲染**: 对消息流式输出的修改，是否基于 `StreamHandler` 的双层缓存（`Confirmed`/`Pending`），避免了正则替换导致的闪烁？
- [ ] **自适应降级**: 对未初始化状态、断网等边缘情况是否做好了 Proxy 代理拦截和异常反馈处理？

---

*提交 PR 时，请附带以上打钩的清单。并请在 PR 描述末尾，简要说明本次开发对 PDR/System Design 产生了哪些影响，或者明确声明“本次修改未改变核心系统设计”。*
