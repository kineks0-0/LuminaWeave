# LuminaWeave

LuminaWeave（幻光织机）是面向 SillyTavern 生态的增强框架与综合交互操作平台。它的目标不是只提供一组 UI 小插件，而是在保持宿主兼容的前提下，逐步接管 Prompt、生成流、同步、时间线、资源与工作区等核心链路。

> 当前项目仍处于快速演进阶段。数据结构、插件 API、桌面模式和宿主适配边界可能继续调整；重要改动请同步阅读 `docs/` 下的长期设计与当前任务记录。

## 主要能力

- 深度接管：聊天生成、流式恢复、Prompt 组装、世界线、事务与同步链路逐步收敛到 Lumina 核心。
- 绝对隔离：通过 Shadow DOM、独立存储、HAL、host-drivers 与 surface runtime 降低宿主和子插件之间的耦合。
- 多桌面模式：支持传统桌面、自由工作台、Discord/Telegram 风格模式等不同工作方式。
- 官方子插件：当前包含 Chat、Forge、Timeline、Director、Lorebook、Settings、Stats、Launcher、Dev/Terminal 等方向。
- 资源与工作区：通过 Resource Ref、VFS、Forge workspace、ConversationDocument 与事务日志统一追踪数据来源和写入边界。

## 仓库结构

```text
LuminaWeave/
├── docs/                         # 产品、架构、模块、任务与归档文档
├── luminaweave-extension/         # Vue 3 + Vite + TypeScript 前端扩展
│   ├── src/api/core/              # Core API、HAL、host drivers、conversation/generation/storage 等
│   ├── src/plugins/               # 官方子插件
│   └── shared/                    # 前后端共享协议、事务、XML、资源与会话类型
├── luminaweave-server/            # SillyTavern server plugin 后端补充能力
│   └── src/                       # TypeScript 源码；根级 index.js 是构建产物
├── dev-start.ps1                  # 本地开发启动脚本
└── sync-projects.ps1              # 本地同步脚本
```

## 快速开始

### 前端扩展

```powershell
cd D:\LuminaWeave\luminaweave-extension
npm install
npm run dev
```

常用命令：

```powershell
npm run build
npm run build:debug
npm run watch
npm run analyze
npm run test
npm run type-check
```

### 后端插件

```powershell
cd D:\LuminaWeave\luminaweave-server
npm install
npm run build
npm run test
```

在 SillyTavern 中启用 server plugin 需要把宿主 `config.yaml` 的 `enableServerPlugins` 设置为 `true`，并按后端 README 完成安装。

## 文档入口

- [文档总入口](./docs/index.md)
- [短版架构入口](./docs/architecture.md)
- [全局 PDR](./docs/overall/PDR.md)
- [全局 System Design](./docs/overall/system_design.md)
- [文档规范](./docs/documentation-standards.md)
- [协作指南](./docs/contributing.md)
- [测试与 CI](./docs/testing-and-ci.md)
- [配置参考](./docs/configuration.md)
- [存储与数据](./docs/storage-and-data.md)
- [ADR](./docs/adr/)

## 协作原则

- 改动前先读 `docs/index.md`、`docs/overall/PDR.md`、`docs/overall/system_design.md` 以及目标模块附近文档。
- 改公共 API、存储结构、生命周期、数据流或模块职责时，代码和文档必须同次更新。
- 不手改 `luminaweave-server/index.js` 这类构建产物；真实源码在 `luminaweave-server/src/`。
- 不提交 `luminaweave-server/data/` 中的用户数据。

## 当前限制

- 项目仍处于早期开发与架构收敛期。
- 当前主要测试目标是 SillyTavern 插件形态与 TauriTavern 适配路径。
- 群聊、前端卡、部分 Forge 详细流程和移动端边界仍在持续完善。

## License

MIT
