# LuminaWeave 测试与 CI 说明

本文记录当前仓库可验证的测试入口和建议策略。它不是对未来 CI 的承诺；未在脚本中存在的命令不会写成已实现能力。

## 1. 测试策略

优先级从高到低：

1. 共享协议与纯逻辑：`luminaweave-extension/shared/`。
2. Core Runtime：会话、同步、事务、存储、生成、Prompt、XML、HAL 与 host-drivers。
3. 后端服务：Storage、Streaming、Nexus。
4. 插件关键交互：Chat、Forge、Timeline、Settings 等。
5. 视觉和桌面模式回归：需要结合浏览器人工或自动化验证。

同步、事务、XML、流式生成、持久化、共享协议变更必须补或运行对应测试。

## 2. 当前命令

### extension

```powershell
cd D:\LuminaWeave\luminaweave-extension
npm run test
npm run type-check
npm run build
```

其他辅助命令：

```powershell
npm run dev
npm run watch
npm run build:debug
npm run analyze
npm run preview
```

### server

```powershell
cd D:\LuminaWeave\luminaweave-server
npm run test
npm run build
```

### root helper

```powershell
cd D:\LuminaWeave
.\dev-start.ps1
.\sync-projects.ps1
```

## 3. 测试文件位置

- extension API 测试：`luminaweave-extension/src/api/__tests__/`
- Core Runtime 测试：`luminaweave-extension/src/api/core/__tests__/`
- API services 测试：`luminaweave-extension/src/api/services/__tests__/`
- 插件测试：`luminaweave-extension/src/plugins/**/__tests__/`
- store / shell / platform 测试：对应目录下的 `__tests__/`
- server 测试：`luminaweave-server/src/__tests__/`

## 4. 改动范围与验证矩阵

| 改动范围 | 建议验证 |
| ---- | ---- |
| XML 解析、标签注册、LuminaView DSL | 运行 XML、LVParser、VTag、MessageRenderer 相关测试 |
| ST 同步、消息映射、世界线 | 运行 STAdapter、STClient、STSyncService、WorldlineStore、ConversationService 相关测试 |
| 事务与持久化 | 运行 Persistence、Transaction、ConversationDocument、StorageService 相关测试 |
| 流式生成与恢复 | 运行 StreamHandler、StreamingPolicy、NexusClient、StreamingManager 相关测试 |
| Forge 编排 | 运行 ForgeAgent、ForgeRuntime、ForgePrompt、ForgeSession、ForgeWorkspace 相关测试 |
| HAL / Resource / VFS | 运行 ResourceRuntime、HAL mock、PromptAssembly、VFS/Shell 相关测试 |
| Vue 组件接口或类型边界 | `npm run type-check` |
| 分发构建、chunk、依赖变更 | `npm run build`，必要时 `npm run analyze` |
| docs-only | PowerShell 链接检查与事实检查 |

## 5. 编写测试原则

- 单个测试只验证一件事。
- 不调用真实 LLM API。
- 不依赖真实 SillyTavern 全局对象；使用 adapter/mock。
- 不把构建产物作为测试输入的事实源。
- 更新 golden/fixture 期望时，在说明中写清楚行为变化原因。

## 6. CI 现状

当前仓库脚本中未发现统一根级 `docs:build`、`lint` 或 CI 聚合命令。若后续引入文档站或 GitHub Actions，应至少包含：

- extension test/type-check/build。
- server test/build。
- docs-only 链接检查。
- 禁止提交用户数据与构建产物误改的检查。
