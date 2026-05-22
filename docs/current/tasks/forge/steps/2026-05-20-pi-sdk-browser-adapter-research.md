# pi SDK 浏览器适配调研快照

> 日期：2026-05-20
> 范围：Forge Agent Runtime 是否应在前端内嵌 pi，以及需要复用 pi 的哪些部分。

## 结论

当前没有找到成熟的公开项目把完整 `@earendil-works/pi-coding-agent` 迁移到纯浏览器 runtime。公开生态中更常见的结构是：Web / Electron / Obsidian UI 作为交互层，真正的 pi runtime 运行在 Node、Electron main process、daemon 或 RPC 子进程中。

Forge 若要避免后端 pi runtime，应采用更小的边界：只复用浏览器可打包的 `@earendil-works/pi-agent-core` 根入口，并由 Forge 自己实现 browser adapters。这个方向不是重写完整 `pi-coding-agent`，而是替换它在 Node 环境中承担的文件系统、shell、session manager、资源发现和工具执行适配层。

## 官方 SDK 能力边界

官方 SDK 页面列出的 use case 包括：

- Build a custom UI (web, desktop, mobile)
- Integrate agent capabilities into existing applications
- Create automated pipelines with agent reasoning
- Build custom tools that spawn sub-agents
- Test agent behavior programmatically

但官方示例入口使用的是 `@earendil-works/pi-coding-agent`，例如创建 `AgentSession`、`SessionManager`、`AuthStorage`、`ModelRegistry`。这说明官方支持“自定义 UI 接入 pi runtime”，但不等同于“完整 `pi-coding-agent` 可直接在浏览器里运行”。

本地决策应把这两件事分开：

- custom web UI：可行，已有 Pi Web / pi-gui 等方向。
- browser-only runtime：未发现成熟公开实现；需要 Forge 自行适配。

## 包依赖分析

本地包检查结论：

| 包 | 浏览器适配判断 | 说明 |
| --- | --- | --- |
| `@earendil-works/pi-agent-core` | 可作为候选 | 根入口浏览器打包可行，主要提供 agent loop、harness、session、skill、resource 等核心抽象。 |
| `@earendil-works/pi-agent-core/node` | 前端禁用 | 子路径包含 `node:fs`、`node:child_process`、`node:path`、`node:readline` 等 Node execution env。 |
| `@earendil-works/pi-coding-agent` | 不进入前端 | 包含 Node-heavy 的 session manager、文件系统、锁、spawn、TUI/CLI/资源加载等能力。 |
| `@earendil-works/pi-ai` | 谨慎使用 | root / 部分 provider 入口可打包，但 API key、代理和 provider 策略应继续走 Lumina 现有 Nexus/HAL 管线。 |

因此 Forge 前端方案应设置 bundling guard：任何实现不得引入 `pi-coding-agent`、`pi-agent-core/node`、`node:fs`、`node:child_process` 等 Node-only 依赖。

## 相近项目调研

### Pi Web

- 形态：浏览器控制台 + 后台 API / session daemon。
- 结构：Browser UI -> Fastify Web/API -> Session daemon -> Pi Coding Agent SDK。
- 结论：可参考 UI、session tree、事件展示方式；不能作为纯浏览器 runtime 先例。
- 链接：[Pi Web package](https://pi.dev/packages/%40jmfederico/pi-web)

### pi-gui

- 形态：Electron 桌面 UI。
- 结构：React renderer + Electron main / session driver + `pi-coding-agent`。
- 结论：可参考桌面 UI 与 session driver 组织；runtime 仍不在浏览器 renderer 内。
- 链接：[pi-gui GitHub](https://github.com/minghinmatthewlam/pi-gui)

### OpenClaw

- 形态：服务端/消息网关中嵌入 pi。
- 特点：直接使用 `createAgentSession()`，禁用或替换 pi 内置工具，接入自定义 tools、prompt、session 与事件订阅。
- 结论：对 Forge 最有参考价值的是 custom tool 边界和“宿主拥有写入权限，Agent 只提出工具请求”的设计。
- 链接：[OpenClaw Pi integration architecture](https://github.com/openclaw/openclaw/blob/main/docs/pi.md)

### Obsidian PiChat

- 形态：Obsidian desktop 插件。
- 特点：需要本地安装 Pi，并通过 RPC mode 启动 `pi --mode rpc`。
- 结论：可作为 RPC 备选路径参考，不是当前前端内嵌方案。
- 链接：[PiChat Obsidian plugin](https://community.obsidian.md/plugins/pi-chat)

## Forge 可复用的 pi 设计

- Tree-structured, shareable history：借鉴 session entry 的 `id / parentId` 树结构，让 Forge 协作线程支持分支、checkout、回滚和分享。
- Context engineering：将项目概况、阶段状态、写入边界、Review Gate 状态、能力索引、资源索引拆成 context files，而不是拼接单个大 prompt。
- Skills / extensions / packages：借鉴资源组织方式，把 Forge 中文技能、能力索引、工具说明和 prompt 分层管理。
- Tool trace：把 tool call、tool result、approval needed、approval resolved 作为一等运行事件，派生到 Forge inline trace 和模型请求调试面板。

## Forge 不能直接复用的部分

- Node 文件系统、shell、锁文件、spawn、TUI/CLI。
- `pi-coding-agent` 自带的 workspace 写入语义。
- 任何会绕过 Forge Review Gate 直接写真实 ST 世界书或项目 VFS 的工具。
- 官方 package 发现机制中依赖本地文件系统扫描的部分，需要改为 Forge resource loader。

## 推荐实现路径

```text
Forge Vue UI
  -> ForgePiCoreRuntime
  -> @earendil-works/pi-agent-core
  -> Forge browser adapters
      -> Nexus/HAL model adapter
      -> Forge VFS adapter
      -> Review Gate adapter
      -> 中文技能/能力 resource loader
      -> timeline/staging/session tree persistence
```

实现重点是 browser adapters，而不是重写 pi SDK：

- `ForgePiCoreRuntime`：封装 pi core turn 执行和事件派发。
- `ForgePiModelAdapter`：把现有 Nexus preset / HAL generation 映射为 pi core 模型接口。
- `ForgePiResourceLoader`：从 Forge capability / skill registry 与 prompt resources 生成 context files。
- `ForgePiToolBridge`：把 pi tool call 转成现有 Forge tool registry、VFS、Review Gate、typed effects。
- `ForgePiSessionStore`：把 tree history 持久化到 Forge workspace/session，而不是后端 JSONL。

## 官方链接

- [SDK](https://pi.dev/docs/latest/sdk)
- [Session Format](https://pi.dev/docs/latest/session-format)
- [Extensions](https://pi.dev/docs/latest/extensions)
- [Packages](https://pi.dev/docs/latest/packages)
- [RPC](https://pi.dev/docs/latest/rpc)
