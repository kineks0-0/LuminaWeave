# LuminaWeave 协作指南

本文面向参与 LuminaWeave 开发和文档维护的协作者。它把仓库级规则整理为人类可读的协作约束。

## 1. 开发前检查

开始功能开发、重构或 Bug 修复前，至少阅读：

- `docs/index.md`
- `docs/overall/PDR.md`
- `docs/overall/system_design.md`
- 目标模块附近的实现与测试
- 目标模块对应的 `docs/overall/modules/<module>/`

如果代码与文档不一致，小改动优先保持代码现实可运行；架构级改动必须同步更新对应文档。

## 2. 仓库分层

```text
luminaweave-extension/
├── src/api/core/          # Core Runtime: 会话、存储、生成、Prompt、事务、HAL
├── src/platform/          # Plugin Domain、Surface Runtime、Desktop Mode Runtime
├── src/plugins/           # 官方子插件 UI 与插件接入
├── src/shell/             # 桌面壳层与导航
├── src/stores/            # Pinia 状态
└── shared/                # 前后端共享协议、事务、XML、资源与会话类型

luminaweave-server/
└── src/                   # 后端 TypeScript 源码；根级 index.js 是构建产物
```

## 3. 依赖方向

- Core Runtime 是业务真相层，不应依赖具体桌面壳层、主题或插件 Vue 页面。
- Plugin Domain 通过 manifest、selectors、intents、settings schema 与 surfaces 声明能力。
- Desktop Mode Runtime 决定壳层、导航、surface override 与交互策略，但不得绕过核心会话、同步、Prompt、事务链路。
- Surface Runtime 只连接 state snapshot、intents 与 theme context，不直接写 Core 内部状态。
- HAL 汇聚宿主能力与多源资源；HAL 内部模块禁止直接访问宿主全局变量或 host driver 具体实现。
- host-drivers 只负责环境交互，不承载业务逻辑。
- shared 中的共享协议和基础引擎应保持平台无关，避免依赖 Vue、Pinia 或宿主全局对象。

## 4. 高风险区域

以下区域直接影响同步、事务、世界线、XML 或前后端共享协议，修改时必须优先补测试：

- `luminaweave-extension/src/api/core/`
- `luminaweave-extension/shared/`
- `luminaweave-server/src/StorageService.ts`
- `luminaweave-server/src/StreamingManager.ts`
- `luminaweave-server/src/NexusService.ts`

尤其谨慎处理：

- ST 原生消息 `id` 与 Lumina 节点 `nodeId` 的映射。
- `ConversationDocument` 与事务日志。
- `pluginRaw`、`mesRaw`、`mesST`、`fingerprint`、`stFingerprint` 的口径。
- XML 标签生命周期、别名与流式解析。
- Resource Ref、VFS 写入策略与外部资源 fork 行为。

## 5. 文档同步

出现以下任一情况，必须同步更新文档：

- 新增或修改公共 API。
- 改变数据流、生命周期、状态机或存储结构。
- 改变 Core / HAL / host-drivers / plugin / desktop / surface 边界。
- 改变构建、安装、测试、发布或运行配置。
- 让 `docs/overall/PDR.md` 或 `docs/overall/system_design.md` 的原有假设失效。

只改局部实现细节且不影响文档描述时，可在回复或 PR 中说明“本次修改未改变核心系统设计”。

## 6. 提交与分支

提交信息遵循 Conventional Commits：

```text
<type>(<scope>): <description>
```

常用类型：

| 类型 | 用途 |
| ---- | ---- |
| `feat` | 新功能 |
| `fix` | 修复 |
| `refactor` | 重构 |
| `docs` | 文档 |
| `test` | 测试 |
| `chore` | 构建、依赖、维护 |
| `style` | 纯格式 |
| `perf` | 性能 |

建议范围：`extension`、`server`、`shared`、`core`、`hal`、`forge`、`chat`、`timeline`、`docs`。

## 7. 验证要求

按改动范围执行最小但完整的验证：

| 改动范围 | 最小验证 |
| ---- | ---- |
| extension 代码 | `npm run test`，必要时 `npm run type-check` 和 `npm run build` |
| server 代码 | `npm run test`，必要时 `npm run build` |
| shared 协议 | extension 相关测试 + server 相关测试 |
| 文档 | 链接检查与事实检查 |
| 同步/事务/XML/流式/持久化 | 对应单测与回归测试 |

当前仓库未发现统一 `docs:build` 脚本；引入文档站后再把文档构建加入验证要求。

## 8. 禁止事项

- 不手改 `luminaweave-server/index.js`。
- 不提交 `luminaweave-server/data/` 用户数据。
- 不把宿主全局对象访问散落到业务层。
- 不在 Vue 组件中硬编码可国际化文案；优先检查 i18n 与 manifest 注册方式。
- 不绕过已有 adapter/client/service 边界直接调用宿主 API。
- 不回滚他人或未确认来源的工作区改动。
