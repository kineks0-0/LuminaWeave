# 阶段 1：单轴模型重建

## 目标

把当前“桌面模式 + layoutMode”双层心智模型收敛为单轴桌面模式模型，并建立正式的 `DesktopModeManifest` 类型基础。

## 输入与前置条件

- 已确认本专项的背景修正：`Discord` 与 `传统桌面 / 自由工作台` 同级
- 已阅读全局文档与主题相关实现
- 当前正式设置命名已朝 `activeDesktopMode + desktop-mode-*` 收敛
- 旧 `activeThemePack + theme-pack-*` 仍需保持兼容读取

## 需要修改的子系统

- `luminaweave-extension/src/theme/*`
- 与桌面模式类型定义直接耦合的设置读取层
- 与桌面模式注册协议直接耦合的内置模式定义

## 明确输出

- 删除“桌面模式 + layoutMode”作为双主状态的建模方式
- 在 `src/theme/*` 中把主协议改为单轴桌面模式模型
- 引入 `DesktopModeManifest`
- 让 `classic / stage / discord` 直接声明自己的 `shell.kind`
- 废弃 `workspacePreset.defaultMode / availableModes / lockedMode` 作为主驱动
- 保留旧类型 / 旧字段兼容层，但不得再作为新实现依赖

## 禁止事项

- 不允许在此阶段继续强化 `layoutMode` 的用户态地位
- 不允许把 `Discord` 继续建模为 `traditional` 的锁定子变体
- 不允许顺手扩展无关主题皮肤体系
- 不允许修改核心会话、同步、持久化运行时

## 验收检查

- 类型层能够直接表达 `Discord` 与 `传统桌面 / 自由工作台` 的同级关系
- 新协议可以直接支撑第三方注册自定义桌面模式
- 旧兼容字段仍可读取，但新实现不再依赖它们驱动主流程
- `npm run type-check` 通过

## 完成后才能进入下一阶段的条件

- `DesktopModeManifest` 及相关注册协议已经稳定
- 内置桌面模式已完成单轴声明
- 没有遗留“必须先选桌面再选布局”的核心类型约束
