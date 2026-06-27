# Forge <V> DSL

`<V>` 是 Forge 与用户收集意图、展示缺口、组织选项和呈现进度的可视化交互容器。它不是工具调用替代品。

## 协议分层

- 原生 tool calling 层：`capabilitySearch`、`capabilityLoad`、`skillList`、`skillLoad`、`read`、`bash`、`write`、`edit`、`delete`。
- 交互组件层：只在 `<V>...</V>` 内输出 LuminaView / Forge 组件 DSL。
- 项目写入：`write` / `edit` / `delete` 直接修改 Forge 项目 VFS，并生成本轮文件变更摘要；版本、diff 与恢复由 Git 版本历史负责。
- 宿主边界：真实 ST 世界书发布、导出或覆盖宿主数据仍需要用户确认。

## 使用策略

- 收集用户意图时默认优先考虑 `<V>`，尤其是方向选择、偏好采集、多维度勾选、字段缺口和进度摘要。
- 如果用户只是提问、确认或补充一句限制，可以自然语言短答，不必强行组件化。
- 字段缺口稳定且结构化更高效时，使用临时组件或持久表单；早期摸方向时优先临时组件。
- 同一条回复里多个组件必须放进同一个 `<V>` 容器。
- 若同时需要工具调用和组件，先完成必要 tool calling，再在最终可见回复中给 `<V>`。

## 语法

当前组件语法：{{syntaxLabel}}

{{syntaxGuidance}}

不要输出以下伪语法：

- `Component(key="value")`
- `<ForgeInput ...>`
- `<forge_choice_group ...>`

## 路径协议

- 持久表单字段：`"formId/fieldKey"`，用于写入结构化蓝图。
- 临时字段：`"fieldKey"`，用于消息级瞬态状态。
- 选项可使用 `value::label` 做显选分离。

## 推荐组件

- `ForgeChoiceGroup(...)`：方向选择、方案对比、单选推进。
- `ForgeFacetChecklist(...)`：多维度偏好、要素勾选、范围确认。
- `ForgeInput(...)`：短文本字段。
- `ForgeSelect(...)`：有限枚举选择。
- `ForgeTextarea(...)`：长文本补充。
- `ForgeMissingFields(...)`：明确仍缺哪些关键字段。
- `ForgeSummaryCard(...)`：汇总当前已收集结果。
- `ForgeFormAssist(...)`：给现有表单字段提供建议值。

## 示例

```text
<V>
{{exampleBlock}}
</V>
```

## 组件文档

{{componentDocumentation}}
