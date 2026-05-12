# LuminaWeave 配置参考

本文记录当前可从仓库确认的安装、构建与运行配置。无法从源码或脚本确认的默认值不写成事实。

## 1. SillyTavern Server Plugin

如果使用 `luminaweave-server/` 提供的后端增强能力，需要在 SillyTavern 宿主 `config.yaml` 中启用 server plugin：

```yaml
enableServerPlugins: true
```

修改后需要重启 SillyTavern。后端安装和验证细节见 `luminaweave-server/README.md`。

## 2. extension 构建模式

位置：`luminaweave-extension/package.json`。

| 命令 | 说明 |
| ---- | ---- |
| `npm run dev` | 启动 Vite 开发服务 |
| `npm run build` | 使用 `github` mode 构建正式分发产物 |
| `npm run build:debug` | 使用 `debug` mode 构建，便于排查 |
| `npm run analyze` | 使用 `analyze` mode 构建并生成体积分析报告 |
| `npm run watch` | 使用 `debug` mode 持续构建 |
| `npm run preview` | 启动 Vite preview |
| `npm run test` | 运行 Vitest |
| `npm run type-check` | 运行 `vue-tsc --noEmit` |

分发时必须携带完整 `dist/` 目录。`dist/index.js` 是入口，异步 chunk 位于 `dist/assets/`。

## 3. server 构建模式

位置：`luminaweave-server/package.json`。

| 命令 | 说明 |
| ---- | ---- |
| `npm run build` | 使用 esbuild 从 `src/index.ts` 打包到根级 `index.js` |
| `npm run test` | 运行 Vitest |

`luminaweave-server/index.js` 是构建产物，不应手动修改。真实源码在 `luminaweave-server/src/`。

## 4. 数据目录

| 路径 | 说明 | Git 策略 |
| ---- | ---- | ---- |
| `luminaweave-server/data/` | 后端本地数据目录 | 禁止提交用户数据 |
| `luminaweave-extension/dist/` | 前端分发产物 | 本项目可能保留用于分发，不默认删除 |
| `luminaweave-extension/dist/assets/` | 异步 chunk 目录 | 发布和同步时需与入口一同携带 |

## 5. Nexus 与模型配置

当前代码中存在 Nexus、Vercel AI SDK provider 与本地/后端生成路径。模型 key、provider、preset 等用户配置主要通过插件设置、Nexus 预设或宿主桥接读取。

本文件不虚构环境变量名。后续如果引入稳定环境变量或配置文件，应在这里补充：

| 配置项 | 环境变量/存储 key | 类型 | 默认值 | 说明 |
| ---- | ---- | ---- | ---- | ---- |
| 待源码确认 | 待源码确认 | 待源码确认 | 待源码确认 | 待源码确认 |

## 6. 宿主适配

当前运行形态包括：

- SillyTavern 插件环境。
- TauriTavern / 原生宿主环境。
- Standalone / local fallback 路径。

具体能力通过 HAL 与 host-drivers 适配。新增宿主能力时应同步更新：

- `docs/architecture.md`
- `docs/overall/system_design.md`
- 本文件的运行配置说明
- 对应 ADR（如果是架构级取舍）
