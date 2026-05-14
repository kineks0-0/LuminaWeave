# Step 04: Generation / Facade Boundary Cutover

## 目标

清理生成与 facade 中剩余的 STClient 透传，让生成请求、token count、chat id normalize 与 facade public 方法通过 HAL 或 host driver。

## 输入

- `LuminaGenerationTask` polling 路径需要发起宿主认证请求。
- `StreamHandler` 需要规范化 chat id。
- `ContextCompactor` 需要 token count。
- `LuminaWeaveAPI` 需要保留旧 public 方法兼容 UI / 插件调用。

## 处理流程

1. 扩展 HAL `IHostNetwork.fetchWithAuth`，ST adapter 使用 `STClient.fetchWithCsrf` 实现。
2. 新增 HAL `ITokenCounter`，ST adapter 使用 `STClient.getTokenCount`，默认实现使用估算值。
3. `LuminaGenerationTask` polling start 请求走 HAL network。
4. `StreamHandler` 使用 HAL session normalizer。
5. `LuminaWeaveAPIBase` 继续通过 `STEnvironmentDriver` 暴露兼容 getter，类型不再直接引用 ST / TavernHelper 全局类型。

## 状态变化

- `generation/` 不再直接 import `STClient`。
- `hal/prompt/ContextCompactor` 不再直接依赖 ST 具体类。
- Facade public 方法保持兼容，宿主 I/O 由 driver / HAL 执行。

## 验收

- [x] `generation/` 中无 `STClient` import。
- [x] `ContextCompactor` 使用 HAL token counter。
- [x] `LuminaGenerationTask` polling 使用 HAL network auth fetch。
- [x] `npm run type-check` 通过。
