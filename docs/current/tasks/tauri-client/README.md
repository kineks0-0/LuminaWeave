# LuminaWeave Tauri Client 分阶段实施计划

## 目标

在不破坏现有 SillyTavern 插件分发形态的前提下，把 LuminaWeave 前端逐步扩展为可运行的 Tauri 客户端。

## 当前阶段

阶段 2：Windows + Android 可用客户端（进行中）。

阶段 1：Web / Windows Tauri 最小可跑版本已完成。

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
- 2026-05-27：Android 初步可运行后发现 edge-to-edge WebView 与状态栏重叠；采用正式方案：Android native 监听 `WindowInsets`，先把 Android 物理 px 按 `displayMetrics.density` 转成 Web CSS px，再向 WebView 注入 `--lw-native-safe-*` / `--lw-native-ime-bottom`，前端 root layout 继续通过 `--lw-safe-*` 统一消费。
- 2026-05-27：补充 root shell 消费逻辑：普通 Android Tauri App 在 `window` layout 路径下把 native safe inset 提升为 `--lw-root-safe-*`，由 `.lw-fullscreen-panel` 整体避让状态栏、导航栏和刘海区域；TauriTavern `layout-kit.js` 路径保持不变。
- 2026-05-27：参考 TauriTavern 的 native inset bridge 链路，将 `MainActivity` 收敛为生命周期接线；`LuminaAndroidInsetsBridge` 负责 content root `WindowInsets` 监听、ready 重注入和重复快照去重；`LuminaWebViewInsetsStyleApplier` 负责 CSS 变量契约注入。日志同时输出 `rawTopPx`、`cssTopPx` 和 `density`，用于排查物理 px / CSS px 混用。

## 后续阶段

阶段 2：Windows + Android 可用客户端。

- 已添加 Android Tauri 目标和平台配置。
- 已补 Android status bar / display cutout 的 native safe-area 桥接。
- Android safe-area 桥接已按 native raw px -> CSS px -> `:root` CSS 变量 -> root shell 消费的契约收敛。
- 待继续验证 Android SDK、NDK、JDK、Rust Android targets 的 release build 路径。
- 待继续处理移动端 IME、触控和本地存储边界。

阶段 3：客户端能力优化。

- 抽象专用 Tauri Client runtime port，替换 MVP 阶段的 `standalone-local` fallback。
- 接入 Tauri 原生文件、窗口、日志、资源目录与安全 permission。
- 梳理 Windows/Android 发布与签名流程。
