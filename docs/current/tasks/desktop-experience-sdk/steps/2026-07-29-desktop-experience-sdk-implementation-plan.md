# Desktop Experience SDK 实施计划

## 目标状态

```text
DesktopModeManifest
└── composition version 1
    ├── desktop root
    └── mobile root
         ↓
Composition Runtime
├── Official Surface Kit
└── trusted plugin renderer
         ↓
DesktopExperienceRuntime
├── conversation
├── generation
├── character
├── timeline
└── activity
```

Presentation 组件只消费 typed surface context。Shell 只负责安全区、窗口、焦点、移动导航与 Activity 容器。

## 公共契约

- `DesktopExperienceRuntime` 统一拥有五组领域能力和 `dispose()` 生命周期。
- `SurfaceContractMap` 为每个 contract 声明 input、state 与 intents。
- `SurfaceRuntimeContext<K>` 提供 typed runtime、input、state、intents、theme 与销毁注册。
- `DesktopModeManifest.composition` 固定为版本 1，desktop/mobile 根节点只允许 group、surface、activity-slot。
- Composition 不接受任意组件引用、任意 attrs、任意 CSS 或宿主全局对象。

## 任务分解

1. Headless Domain Runtime：提升角色会话能力，统一领域订阅与销毁。
2. Typed Surface Runtime：移除开放类型与全局读取，加入 Zod 校验和局部错误边界。
3. Chat Application Controller：收敛消息事实源、生成订阅和全部 Chat intent。
4. Official Surface Kit：拆分角色、会话、消息、输入与 Prompt Inspector surface。
5. Composition Runtime：校验和解析版本化组合树。
6. Shell 与 Workspace：从 manifest、surface registry 和 Activity descriptor 派生界面。
7. 内置模式：依次迁移 classic、stage、discord、telegram。
8. 第三方示例：验证声明式模式和 trusted renderer。
9. 清理与验收：删除旧入口、同步长期文档、执行完整测试与浏览器验证。

## 提交策略

每项任务遵循失败测试、红灯确认、最小实现、定向测试、类型检查、精确暂存和独立 Conventional Commit。现有 `dist/**` 与 `src-tauri/Cargo.toml` 修改不属于本任务。

## 最终验收

- 四个内置模式经过同一 Composition Runtime 和 Official Surface Kit。
- Chat presentation 不导入 Pinia、`lwApi`、Shell 或具体桌面模式。
- Workspace 不硬编码 Forge、Launcher 或插件组件。
- renderer 或订阅销毁后不再更新，单节点错误不影响其他 surface。
- extension 的 type-check、test、build 与 server 的 test、build 全部通过。
