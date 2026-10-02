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
- `PluginManifestV2.primarySurface` 是插件主 Surface 的唯一来源；不得根据插件 ID 推断 contract。
- contract、renderer 与 desktop override 必须先完成整批校验再原子注册。
- `DesktopModeManifest.composition` 是必填的版本 1 契约，desktop/mobile 根节点只允许 group、surface、activity-slot。
- Desktop Mode Runtime 必须提供明确 shell renderer；root 不从 `shellKind` 推断 renderer。registered panel 只通过显式 `surfaceContractId` 选择 typed Surface，不从 panel ID 推断。
- Composition 不接受任意组件引用、任意 attrs、任意 CSS 或宿主全局对象。

## 非目标

- 不调整 runtime extension store 的物理实现。普通 Tauri 保留 SQLite；浏览器与 standalone-local 的既有 IndexedDB 路径保持不变。
- 不修改 `tauri-plugin-sql`、`TauriSqliteExtensionStore`、SQL capability 或 SQLite 数据路径。
- 不以数据库替换解决 Surface、Shell 或 Chat 的职责耦合。

## 任务分解

1. 架构基线与问题记录：已完成任务文档、ADR-0004、参考项目取舍和问题日志。
2. Headless Domain Runtime：已完成角色会话能力提升、领域订阅与统一销毁。
3. Typed Surface Runtime：已完成开放类型清理、Zod 校验和局部错误边界。
4. Chat Application Controller：已完成消息事实源、生成订阅和 Chat intent 收敛。
5. Official Surface Kit：已完成角色、会话、消息、输入、header 与 Prompt Inspector surface 拆分；Shell、Workspace 与设置预览通过 `ThemedSurfaceOutlet` 挂载业务 surface，消息渲染设置通过 typed surface state 投影，用户消息与 assistant 交互块使用独立渲染路径。
6. Composition Runtime：已完成 version 1 类型、strict Zod schema、跨 registry 原子预检、Surface input 校验与 desktop/mobile 确定性解析器；任务 10 已完成字段必填化和 fallback 删除。
7. Shell 与 Workspace：已完成 concrete Shell 内的 composition outlet 接入、通用 Activity 容器、完整插件目录派生的 Workspace catalog 和 Shell 业务硬编码清理。
8. 内置模式：classic、stage、discord、telegram 已完成显式 desktop/mobile composition；Discord desktop 组合角色 roster 与 Activity，Discord mobile overlay、Telegram desktop 左栏及 mobile 页面栈统一消费 Official Surface Kit，`chat.main` 不再暴露 Telegram 专属 callback 名称。
9. 第三方示例：已通过独立导出的 `example.characterFocus` contract、纯声明式 desktop/mobile mode fixture 与 `businessRenderers` trusted Vue renderer，验证 strict input、当前角色/会话/消息/时间线投影、typed runtime intents、订阅销毁和局部错误隔离；示例不自动注册。
10. 清理与验收：已完成。已删除旧角色组合组件、panel contract 映射表和 Shell/composition fallback；Forge placement、sidebar 与辅助面板 presentation ownership 已收回 Forge app；长期文档、全量测试、构建和八组 desktop/mobile 浏览器验证均已完成。

## 提交策略

每项任务遵循失败测试、红灯确认、最小实现、定向测试、类型检查、精确暂存和独立 Conventional Commit。现有 `dist/**` 与 `src-tauri/Cargo.toml` 修改不属于本任务。

任务 5 的最终定向验证覆盖 27 个测试文件、120 个用例，`npm run type-check` 通过。Telegram 桌面/移动 chat header callback、presentation command、Workspace/设置预览 theme、streaming effect、user/assistant 渲染边界、Choice block 全局依赖与 MessageRenderer 存储穿透均已通过新增红灯固定；真实桌面/移动浏览器验证保留到内置模式迁移与最终验收阶段。

任务 6 的最终定向验证覆盖 4 个测试文件、38 个用例；extension 全量 `npm run test` 通过 184 个测试文件、921 个用例，2 个用例跳过，`npm run type-check` 与 `npm run build` 均通过。构建产物继续只由构建命令生成，不纳入 Composition Runtime 提交。

任务 7 审查收敛后的 Shell、Workspace、Activity 与 Desktop Runtime 定向验证覆盖 15 个测试文件、77 个用例。最终 extension 全量 `npm run test` 通过 184 个测试文件、930 个用例，2 个用例跳过，`npm run type-check` 与 `npm run build` 均通过。Workspace 应用目录只从完整插件集合中的 `primarySurface`、navigation slots、Activity metadata 与动态 Activity 派生；Freeform Shell 不再持有 Forge、Launcher 或 Settings 业务特判。生成的 `dist/**` 不纳入本任务提交。

任务 8 第一批将 classic、stage 的 desktop/mobile Activity 纳入 Composition Runtime。第二批为 Discord、Telegram 增加 version 1 composition，将角色与会话入口替换为 `character.roster` / `conversation.sessionList`，并通过通用 `chat.main` callback 维持 Shell 页面栈导航；扩大定向验证通过 18 个测试文件、92 个用例，`npm run type-check` 通过。旧业务组件文件与未使用的 Shell runtime 状态统一留到任务 10 删除。

任务 9 在 `src/examples/desktop-experience/` 增加只导出、不自动注册的第三方扩展示例。测试先因示例模块不存在而红灯，随后以独立 Surface/Desktop Mode registry 验证声明式 composition 与 trusted renderer 装配；示例自身测试通过 1 个测试文件、6 个用例，扩大到 Surface/Composition Runtime 的定向测试通过 6 个测试文件、52 个用例，`npm run type-check` 通过。

任务 10 先以结构测试固定 `composition` 必填、root composition slot 和 runtime shell renderer 边界，再用冲突用例证明 panel ID 与已注册 contract 同名时旧实现会误投影为 Surface。实现删除无 composition 分支、`shellKind` renderer fallback、官方 panel 映射和同名 contract 探测；registered panel 只消费显式 `surfaceContractId/defaultInput/navigation`。Forge placement 改为 app-owned 纯 resolver，sidebar 折叠状态按 Surface 实例隔离。定向验证通过 16 个测试文件、116 个用例；extension 全量 type-check/test/build 与 server test/build 通过。classic、stage、discord、telegram 均完成 `1440x900` desktop 与 `390x844` mobile 验收，无横向溢出或 renderer unavailable。standalone 环境仍记录既有 Vue lifecycle warning、ST 世界书宿主缺失与 Dexie 持久化失败，真实 SillyTavern/Tauri 宿主验证不计入本轮证据。

## 最终验收

- 四个内置模式经过同一 Composition Runtime 和 Official Surface Kit。
- Chat presentation 不导入 Pinia、`lwApi`、Shell 或具体桌面模式。
- Workspace 不硬编码 Forge、Launcher 或插件组件。
- renderer 或订阅销毁后不再更新，单节点错误不影响其他 surface。
- extension 的 type-check、test、build 与 server 的 test、build 全部通过。
- classic、stage、discord、telegram 的 desktop/mobile 浏览器视口均经过可见 UI 切换，主要容器可见且无横向溢出或 renderer unavailable。
