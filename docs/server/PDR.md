# LuminaWeave Server (后端解耦引擎) - PDR

## 一、 系统定位
`luminaweave-server` 是为 LuminaWeave 专门打造的脱机（脱离原生浏览器限制）Node.js 后端服务体系。它主要用于赋予前端扩展超越沙盒的读写、文件 IO 和跨端联机能力。

## 二、 核心痛点与需求池 (Pain Points & Needs)
1. **Frontend Sandbox 封锁**
   - 痛点：SillyTavern public extension 仅在浏览器中运作，数据只能保存在原生 `extension_settings`。一旦跨浏览器、跨设备或重置环境，独立的高定设置（全局主题、游玩记录）将全部丢失。
   - 方案：引入真正的后端写盘能力，生成独立的 `LuminaWeave.json` 文件供用户随时备份。

2. **Full-Stack 解耦共生**
   - 痛点：不应当直接魔改 ST 源码。
   - 方案：符合 ST 规范创建标准 `Server Plugin`。只负责提供独立 Endpoint (例如 `/settings/save`)，而无需引入繁乱的 Express 等依赖包。

## 三、 用户价值 (User Value)
- **数据主权归还**：全局设置存落到本地硬盘。随时可以通过备份本地 JSON 或者使用网盘自动同步实现全设备游玩进度大统一。
- **免合并阵痛**：采用软链接 (`mklink /j`) 的外挂形式，在开发环境保持双轨制独立迭代。

## 四、 演进路线 (Roadmap)
- **Phase 1 (Done)**：基础的 JSON 跨源通信接口挂载。
- **Phase 2 (Done)**：
    - **JSONL 分轨**：支持将对话独立存储为 `.jsonl`。
    - **高性能追加模式**：实现基于 `fs.appendFile` 的增量持久化逻辑。
- **Phase 3 (WIP)**：开放更进阶的文件网关（比如动态上传导出玩家立绘、记录专属背景音乐库）。
- **Phase 3**：参考 Webpack 最终架构方案实现真正的 Full-Stack 单文件安装模式 (`Plugin-WebpackTemplate`)，彻底掩盖安装复杂度。
