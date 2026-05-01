# Telegram Figma 风格设计稿生成 Brief

## 目标

为 LuminaWeave 的 Telegram 桌面模式生成 6 张高保真 UI 设计稿。目标不是概念图、宣传图或氛围图，而是像 Figma 文件中导出的 App Frame 截图：真实界面比例、清晰组件层级、可落地布局、明确交互职责。

输出风格参考 Telegram 浅雾蓝轻玻璃，但不复制真实 Telegram 产品页面，也不伪装成 call / video / media 等真实 IM 资料页。

## 全局视觉约束

- 画面必须是 high-fidelity Figma UI design screenshot。
- 正交视角、平面 App Frame，无透视、无漂浮设备、无设备壳、无营销标题。
- 桌面稿使用完整应用窗口画布，清楚展示左栏、中间 surface、右侧面板关系。
- 移动稿使用单个移动端 screen frame，不做手机样机拼贴。
- 使用 Telegram-inspired light mist blue liquid glass 风格：
  - 半透明浅蓝面板
  - 细蓝灰描边
  - 柔和但克制的阴影
  - 清晰文字层级
  - 统一圆角、间距、列表行样式
- 避免：
  - 概念图
  - 宣传海报
  - 大面积背景插画
  - 抽象 UI 组件
  - 夸张渐变和强光效
  - 真实 Telegram logo
  - 真实 IM 的 call / video / media 资料页拟态
  - 重型编辑器或复杂图谱画布

## 固定交互与文案

左侧 tab 文案必须严格为：

```text
所有 / 角色 / 工具 / 筛选
```

上下文工具入口必须严格为：

```text
时间线 / 状态 / 导演 / 世界书
```

左侧列表所有项目必须使用统一 Telegram row 样式。角色、具体聊天记录、制卡工坊、启动台、工具入口不能使用不同卡片体系。

## 6 张设计稿

### 1. desktop-character-overview.png

桌面角色概览页。

画面结构：

- 左栏选中角色 row，角色名为 `艾莉娅`。
- 左栏包含 app header、搜索框、固定 tabs：`所有 / 角色 / 工具 / 筛选`。
- 左栏列表混合展示角色、具体聊天、制卡工坊、启动台、工具入口，全部保持同一种 row。
- 中间主区不是聊天气泡，而是角色概览页。

中间角色概览内容：

- 大头像
- 角色名称 `艾莉娅`
- 同步状态 `已同步`
- 简短角色摘要
- `最近聊天`
- `所有聊天记录`
- 主按钮 `开始新聊天`
- 轻量上下文入口：`时间线 / 状态 / 导演 / 世界书`

### 2. desktop-chat-active.png

桌面聊天激活页。

画面结构：

- 左栏选中某段具体聊天记录，例如 `艾莉娅 · 雨夜街角`。
- 左栏 tab 仍为 `所有 / 角色 / 工具 / 筛选`。
- 左栏 row 样式与角色概览页完全一致。
- 中间主区显示 Telegram-style 气泡聊天。
- 右侧面板不展开，或只显示非常轻量的关闭态提示。

聊天区内容：

- 顶栏显示头像、`艾莉娅`、在线或同步状态。
- 左右消息气泡清晰区分。
- 包含少量中文角色扮演对话。
- 可以有一条轻量系统摘要 chip。
- 底部 composer 包含附件、输入框、表情、发送或麦克风图标。

### 3. desktop-filter-menu.png

桌面筛选菜单页。

画面结构：

- 左栏为主要视觉焦点。
- tabs 固定为 `所有 / 角色 / 工具 / 筛选`。
- `筛选` tab 被选中，并展开一个二级菜单或 popover。
- 中间主区可以显示弱化的角色概览预览，但不能抢占左栏焦点。

筛选菜单建议项：

- `全部项目`
- `仅角色`
- `仅聊天`
- `仅工具`
- `有未读`
- `最近同步`

要求：

- 筛选菜单必须像真实 UI popover。
- 列表项目仍保持统一 Telegram row。
- 工具 row 不能变成独立卡片风格。

### 4. desktop-profile-panel.png

桌面右侧角色资料页。

画面结构：

- 三栏布局：左栏列表、中间主区、右侧资料栏。
- 左栏选中角色 `艾莉娅`。
- 中间可以是角色概览或聊天预览，但右侧资料栏是画面重点。
- 右侧 panel 标题为 `角色资料`。

右侧资料栏内容：

- 关闭图标
- 大头像
- 名称 `艾莉娅`
- 同步或在线状态
- `角色摘要`
- `当前会话摘要`
- `最近历史`
- 上下文工具入口：`时间线 / 状态 / 导演 / 世界书`

要求：

- 这是 Telegram 轻玻璃风格的角色资料页。
- 不能伪装成真实 IM 的 call/video/media 页面。
- 不展示聊天 composer。
- 不展示复杂编辑器。
- 不展示完整时间线图谱。

### 5. desktop-right-widget.png

桌面右侧上下文小窗。

画面结构：

- 三栏布局仍保留。
- 左栏和中间区作为上下文背景存在。
- 右侧显示从资料页打开的轻量上下文小窗。
- 该图必须与 `desktop-profile-panel.png` 明显不同。

右侧小窗内容：

- 标题建议：`状态摘要` 或 `时间线摘要`
- 返回或关闭按钮
- 来源提示：`来自 角色资料`
- 摘要卡片，例如：
  - 当前情绪 / 状态
  - 场景事实
  - 最近变化
  - 下一步入口
- 快捷入口：`时间线 / 状态 / 导演 / 世界书`

要求：

- 小窗只展示摘要与入口。
- 不能内嵌复杂编辑器。
- 不能展示完整 timeline graph。
- 不能变成第二个资料页。

### 6. mobile-character-overview.png

移动端角色概览页。

画面结构：

- 单个移动端 screen frame，竖屏。
- 不显示手机外壳，不做设备 mockup。
- 顶部栏显示返回或菜单、`艾莉娅`、同步状态。
- 主体是角色概览，不是聊天气泡页。

内容：

- 大头像
- 名称 `艾莉娅`
- 同步状态 `已同步`
- 简短角色摘要
- `最近聊天`
- `所有聊天记录`
- 主按钮 `开始新聊天`
- 轻量上下文入口：`时间线 / 状态 / 导演 / 世界书`
- 底部导航可为：`聊天 / 角色 / 设置 / 个人资料`，其中 `角色` active。

## 可直接用于图片生成的总提示词前缀

```text
Generate a high-fidelity Figma UI design screenshot, flat orthographic app frame, production UI mockup, no marketing scene, no concept art, no device mockup, no perspective. Telegram-inspired light mist blue liquid glass interface, translucent frosted panels, thin blue-gray borders, soft practical shadows, crisp typography, clean spacing, realistic component hierarchy. Avoid real Telegram logo, call/video/media profile imitation, heavy editor UI, poster background, floating devices, exaggerated gradients, unreadable tiny text.
```

## 验收标准

- 6 张图均为 UI 设计稿截图感，而不是概念图。
- 桌面图有明确应用窗口、左栏、中间 surface、右侧区域。
- 移动图是单个移动 screen frame。
- 左栏 tabs 文案严格为 `所有 / 角色 / 工具 / 筛选`。
- 上下文工具严格为 `时间线 / 状态 / 导演 / 世界书`。
- 左侧列表 row 样式统一。
- 角色概览、中间聊天、右侧资料页、右侧小窗职责清晰分离。
- `desktop-profile-panel.png` 与 `desktop-right-widget.png` 是两个不同场景。
- 上下文工具只作为入口或摘要，不成为 Telegram 主导航或重型编辑器。

## 本轮范围

- 只讨论和生成设计稿图片。
- 不修改 LuminaWeave 代码。
- 不新增核心业务状态。
- 不改变 `telegram.infoPanel`、panel/widget surface 的既有设计边界。
- 不改变 PDR / System Design。
