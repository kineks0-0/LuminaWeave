# 阶段 2：App Shell 与 Header 收敛

## 目标

把运行时 UI 从“桌面模式里再切布局”改成“直接切桌面模式”，让 `App.vue`、`PanelHeader.vue` 和 workspace menu 围绕 `activeDesktopMode` 统一工作。

## 输入与前置条件

- 阶段 1 已完成，单轴桌面模式模型已经建立
- `classic / stage / discord` 已能通过统一 manifest 表达自己的 `shell.kind`
- 当前 UI 仍可能残留 `layoutMode` 相关状态、事件或文案

## 需要修改的子系统

- `luminaweave-extension/src/App.vue`
- `luminaweave-extension/src/components/PanelHeader.vue`
- workspace menu 相关逻辑
- 与桌面模式选择直接相关的设置面板入口

## 明确输出

- `App.vue` 删除独立 `layoutMode` 作为用户主状态
- 运行时改为直接由 `activeDesktopMode` 决定当前壳层
- `PanelHeader.vue` 和 workspace menu 统一改成“切桌面模式”
- 移除 `setLayoutMode()`、`availableLayoutModes`、`lockedMode` 一类交互逻辑
- `data-layout-mode` 只保留为派生只读属性

## 禁止事项

- 不允许保留新的双主状态入口
- 不允许在 UI 中继续暴露“桌面模式里再切 traditional / freeform”的用户入口
- 不允许把 `Discord` 继续展示成“锁定 traditional 的特殊包”
- 不允许在这一阶段引入第三方扩展协议细节

## 验收检查

- UI 中没有“桌面模式里再切传统 / 自由工作台”的入口
- `Discord` 不再表现为“锁定 traditional 的特殊包”
- Header、workspace menu、设置入口都按桌面模式切换
- `npm run type-check` 通过

## 完成后才能进入下一阶段的条件

- 桌面模式切换链路在运行时已收敛到单一入口
- 现有 UI 文案与交互不再暗示双层模型
- `Discord` 已具备作为独立桌面模式归位的运行时基础
