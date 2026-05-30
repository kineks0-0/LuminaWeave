# Desktop Modes 模块文档

Desktop Modes 定义 LuminaWeave 的平台级桌面模式。桌面模式不是局部皮肤，而是由 shell、navigation、surface preset、renderer variant、tokens 与 interaction policy 共同决定的工作方式。

## Activity 与启动意图

组件页面统一用 Activity metadata 描述，不再把“大窗口/小窗口”当作业务层容器决策。业务层通过 LaunchIntent 声明目标、角色、默认/小窗偏好、嵌套/独立页面，以及状态栏、标题栏和二级菜单 metadata。

Desktop Mode Runtime 负责解析 LaunchIntent：

- Traditional 桌面端：主 Activity 进入主区，support / auxiliary 小窗进入右侧栏或内嵌右栏。
- Traditional 移动端：support / auxiliary 小窗进入临时移动页。
- Telegram 移动端：standalone Activity 进入 Telegram 移动页面栈，可声明状态栏区域。
- Freeform：support / auxiliary / standalone Activity 进入自由工作台窗口。

旧 `mode: large | small` 仅作为迁移期兼容输入，映射到 `Activity.size = default | small`。

## 文档

- [桌面模式架构计划](./desktop-mode-architecture-plan.md)
- [Telegram Liquid Glass Mode](./telegram-liquid-glass-mode.md)
- [Classic Design](./classic/design.md)
- [Discord Design](./discord/design.md)
- [Stage Design](./stage/design.md)
- [Telegram Design](./telegram/design.md)

## 维护提示

修改桌面模式 manifest、surface override、导航结构、移动端壳层或设计 token 时，应同步更新本目录和 `docs/overall/design/`。
