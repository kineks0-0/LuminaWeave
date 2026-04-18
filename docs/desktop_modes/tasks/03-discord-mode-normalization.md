# 阶段 3：Discord 模式归位

## 目标

把 `Discord` 从“主题包 / 特殊锁定变体”彻底归位为独立桌面模式，并清理所有与旧认知冲突的文案和实现。

## 输入与前置条件

- 阶段 1 和阶段 2 已完成
- 运行时已经由 `activeDesktopMode` 统一驱动
- Discord 相关视觉变体、导航与 surface 资产已经存在基础实现

## 需要修改的子系统

- `luminaweave-extension/src/theme/*` 中 Discord 相关注册定义
- `App.vue`、`PanelHeader.vue`、设置面板中的 Discord 文案与状态映射
- Discord 专属 navigation / surface / settings 归属定义
- 必要时同步 `docs/index.md`、`docs/PDR.md`、`docs/system_design.md`

## 明确输出

- 把 `Discord` 定义为独立桌面模式
- 复核并收敛 Discord shell / navigation / surfaces / settings 的归属
- 清理所有暗示“Discord 是传统桌面子形态”的文案与逻辑
- 保持 Discord 固定为频道式传统桌面，不扩自由工作台形态

## 禁止事项

- 不允许把 Discord 再包装成 `classic` 的视觉皮肤
- 不允许引入“Discord 风格自由工作台”作为本阶段目标
- 不允许为兼容旧模型继续保留误导性的文案
- 不允许越权修改核心会话、同步、持久化系统

## 验收检查

- 设置面板中 `Discord 桌面` 与 `传统桌面 / 自由工作台` 并列
- Discord 进入后直接得到完整频道式桌面体验
- 没有额外布局切换入口
- `npm run type-check` 通过

## 完成后才能进入下一阶段的条件

- Discord 的定位在类型、运行时和文案层已经一致
- 旧“Discord 是传统桌面子形态”的残留逻辑已清理
- 自定义桌面 API 设计时不再需要为 Discord 做特殊兼容建模
