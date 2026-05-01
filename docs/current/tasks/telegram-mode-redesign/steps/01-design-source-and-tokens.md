# Step 01: Design Source and Tokens

## 目标

固化 Telegram 模式重设计的视觉来源和基础 token，尤其是弥散渐变背景，避免后续实现只按 PNG 目测复刻。

## 状态

已完成首轮实现。

## 输入与前置条件

- 已提供 Figma 文件链接，但 Figma MCP 当前因 Starter plan 调用上限无法读取节点图层。
- 已读取 `Group 11.svg`，该文件包含背景弥散渐变的矢量与滤镜参数。
- 桌面主视觉以第 4 张精修聊天界面为准，桌面角色概览以第 1 张为准，移动角色概览以第 3 张为准。

## 背景参数

`Group 11.svg` 尺寸为 `1586 x 992`，包含 3 个带高斯模糊的椭圆层：

1. 主蓝色弥散层
   - fill: `#6BABFF`
   - ellipse: `cx=758.619`, `cy=264.925`, `rx=758.619`, `ry=264.925`
   - transform: `matrix(0.989288 -0.145974 0.160448 0.987044 0 224.014)`
   - blur: `stdDeviation=315.45`
2. 左上白色高光层
   - fill: `white`
   - fill opacity: `0.52`
   - ellipse: `cx=344.255`, `cy=150.782`, `rx=344.255`, `ry=150.782`
   - transform: `matrix(0.942938 -0.332968 0.362546 0.931966 34.6008 229.251)`
   - blur: `stdDeviation=126.75`
3. 中上白色高光层
   - fill: `white`
   - fill opacity: `0.71`
   - ellipse: `cx=78.3147`, `cy=122.065`, `rx=78.3147`, `ry=122.065`
   - transform: `matrix(0.0245417 -0.999699 0.999752 0.0222784 725.602 333.733)`
   - blur: `stdDeviation=74.8`

## 需要修改的子系统

- `luminaweave-extension/src/theme/builtinThemePacks.ts`
- `luminaweave-extension/src/theme/themeComponentRegistry.ts`（仅当需要新增暴露 token）
- Telegram shell / surface 相关 CSS 中消费背景 token 的位置

## 明确输出

- Telegram app/frame 背景以弥散蓝色渐变为底，不再只使用普通线性浅蓝背景。
- 运行时不得引用下载目录中的 `Group 11.svg` 文件。
- 背景实现优先使用 CSS layers、pseudo element 或内联 data SVG；如使用 data SVG，应把来源参数留在本步骤文档中作为维护依据。
- token 命名应保持 Telegram surface 语义，例如 `--lw-telegram-diffuse-bg`、`--lw-telegram-diffuse-highlight-*`。

## 禁止事项

- 不从 PNG 目测重造背景参数。
- 不把 `C:/Users/.../Downloads/...` 作为运行时资源路径。
- 不引入新的全局主题模型或替换 Desktop Mode Runtime。

## 验收检查

- Telegram 桌面背景呈现类似 Figma 的弥散蓝色渐变，而不是单一浅蓝面。
- 暗色模式若暂未精修，不得破坏现有可读性。
- 背景层不遮挡三栏内容，不影响点击和滚动。
- `npm run type-check` 已通过。
