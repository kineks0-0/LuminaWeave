# LuminaWeave Stats 子插件 - 系统设计文档 (System Design)

**版本:** v1.0
**所属系统:** LuminaWeave V2

## 一、 组件架构
1. **StatsRoot.vue (主容器)**
   `PluginManager` 下沉组件节点。提供网格排版的固定化基座支撑，渲染状态卡片。
2. **LuminaStats.vue (核心展示组件)**
   主要基于网格 (`grid-cols-2`) 和响应式设计进行视图拆发布局的内部组件，包含属性条区和下方胶囊指标（Badges）区。

## 二、 核心依赖与数据源
- **全局代理**:`window.tavernHelperBridge` 变量作为数据传输中间件，负责跟 ST 自有的 `Tavern Helper` 之类的第三方框架或原生扩展宏建立绑定。
- **侦听机制**: 采用 `setInterval` 或原生 Vue3 `watch` 建立状态轮询 / 事件总线更新。

## 三、 动态绑定策略
- **数值绑定**: 对含有数字百分比型（如最大生命值=100，当前生命值=85）或者无最大上限只记录层数（如 Level = 1）采用两种模板分支渲染。
- **状态集合**: 所有不带进度的字符串文本，合并进 `badges` 下侧队列。

## 四、 扩展规划
- 将来配合 `PluginManager`，允许用户不打开右侧面板时，以微缩顶栏（PanelHeader）的状态显示。
