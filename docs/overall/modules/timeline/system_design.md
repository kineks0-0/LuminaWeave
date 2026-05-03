# LuminaWeave Timeline 子插件 - 系统设计文档 (System Design)

**版本:** v2.0
**所属系统:** LuminaWeave V2

## 一、 组件架构
1. **TimelineRoot.vue (主容器)**
   `PluginManager` 入口，管理和响应大/小窗口模式 (`mode` prop) 的展示。
2. **LuminaTimeline.vue (时间线核心组件)**
   负责根据大/小窗口模式分发到轻量列表或大画布视图；大画布通过异步 chunk 加载，避免首屏同步引入 LogicFlow。

## 二、 核心依赖与算法
- **Large Mode 布局引擎 (LogicFlow + Dagre)**:
    - 采用 `LogicFlow` 作为底层画布引擎，提供更强的 SVG 渲染能力和 Shadow DOM 兼容性。
    - 通过 `@logicflow/layout/es/dagre` 直接导入 Dagre 子入口，支持横向 (LR) 与纵向 (TB) 分层布局。
    - 不再从 `@logicflow/layout` 顶层 barrel 入口导入，避免未使用的 `elkLayout` 将 `elkjs/lib/elk.bundled` 打入大画布 chunk。
    - 自动化处理节点的分层与避让，通过 Dagre 计算坐标并实时回填至 LogicFlow 节点。
- **Small Mode (Git-like) 布局算法**:
    - **多轴占位算法**: 递归为每个分支分配独立的 `trackIndex` (轨道号)，通过检测垂直线占用情况动态扩展。
    - **Zero-noise 剪枝**: 非活跃分支在递归时会被物理剪枝，仅保留其根节点作为 UI 入口。
    - **SVG 拓扑连接**: 采用 S 形贝塞尔曲线连接不同轨道的节点，使用 `isFirstInTrack` / `isLastInTrack` 逻辑维护线条闭合。

## 三、 画布引擎控制 (Canvas Control Engine)
- **大屏幕平移阻尼 (Pan)** 
  监听根包裹 `div` 上的 `@mousedown`, `@mousemove`, `@mouseup` 创建拖拽模型（`handleMouseDown` => 运算 `pan.x/y` 结合 `zoom`）。
- **滚动条与滚轮 (Scroll & Wheel)**
  允许鼠标滚轮调整 CSS 的 `transform: scale(v)` 以改变视图焦距，并通过原生 overflow 提供水平辅助拖动区。

## 四、 交互与生命周期
- **节点点击 (`handleNodeClick`)**: 触发 `focusedNodeId` 切换，通过 Vue 的 Transition 动态撑开操作面板。
- **动态高度自适应**: 移除卡片固定高度，采用 Flex 垂直布局 + `gap` 确保内容展开时不会产生重叠，并自动调节 SVG 连线长度。
- **动态样式**: Vue 动态绑定 `svg` path 颜色与 `stroke-width` 以区分活跃路径与普通分支。
