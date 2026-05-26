# LuminaWeave Tauri Client 分阶段实施计划

## 目标

在不破坏现有 SillyTavern 插件分发形态的前提下，把 LuminaWeave 前端逐步扩展为可运行的 Tauri 客户端。

## 当前阶段

阶段 1：Web / Windows Tauri 最小可跑版本。

完成标准：

- 保留 `npm run build` 作为现有 ST 扩展分发构建。
- 新增 `npm run build:client`，输出完整 HTML 客户端产物到 `dist-client/`。
- 新增 `src-tauri/` 最小 Rust/Tauri 工程。
- 新增 npm Tauri 脚本，支持 `tauri:dev`、`tauri:build` 和 `tauri:info`。
- HostDetector 不再把普通 Tauri App 误判为 TauriTavern 插件宿主。

已确认约束：

- 当前仓库仍使用 npm 和 `package-lock.json`，本阶段不迁移 pnpm。
- 已在 `D:\toytools\luminaweave-client` 生成空白 Tauri v2 Vue TypeScript + bun 模板作为对照；本项目吸收其 `src-tauri` 结构、1420 固定端口、`TAURI_DEV_HOST` 支持、opener 插件和 capability 配置，但包管理器暂不从 npm 切换到 bun。
- Windows Tauri 编译需要本机 Rust MSVC toolchain；缺少 `cargo` / `rustc` 时只能完成前端 client build 和 Tauri 配置检查。
- Android 不在本阶段启用，等 Windows/Web MVP 确认后再添加移动端目标。

验证记录：

- 2026-05-26：`npm run tauri:info` 已通过，环境识别 WebView2、MSVC、Rust/Cargo 和 opener 插件。
- 2026-05-26：`npm run tauri:build` 已通过，生成 `src-tauri/target/release/luminaweave-client.exe`、`bundle/msi/LuminaWeave_0.1.0_x64_en-US.msi` 与 `bundle/nsis/LuminaWeave_0.1.0_x64-setup.exe`。

## 后续阶段

阶段 2：Windows + Android 可用客户端。

- 添加 Android Tauri 目标和平台配置。
- 验证 Android SDK、NDK、JDK、Rust Android targets。
- 处理移动端 viewport、IME、触控和本地存储边界。

阶段 3：客户端能力优化。

- 抽象专用 Tauri Client runtime port，替换 MVP 阶段的 `standalone-local` fallback。
- 接入 Tauri 原生文件、窗口、日志、资源目录与安全 permission。
- 梳理 Windows/Android 发布与签名流程。
