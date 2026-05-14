# Step 05: HAL Adapter Boundary Rule

## 目标

明确 HAL 通用模块与 HAL ST adapter 的边界，避免后续迁移把宿主依赖重新散落回 Core domain。

## 边界规则

- `host-drivers/st/*` 是 ST / TavernHelper / 宿主全局对象的物理 I/O 归口。
- `hal/adapters/st/*` 可以依赖 `host-drivers/st/*`，因为它是 ST 宿主 provider 的实现层。
- `hal/prompt/*`、`conversation/*`、`forge/*`、`generation/*`、`runtime-utils/*`、`facade/*` 不直接 import `STClient` 或 `STGlobalAccessor`。
- Facade 可以保留旧 public 方法名，但实现必须委托 host driver、HAL 或 domain service。

## 已确认合法例外

- `STHostStorage`、`STEventBridge` 直接使用 `STGlobalAccessor` 属于 HAL ST adapter 实现边界。
- `STMacroResolver`、`STResourceProvider`、`STSessionIdNormalizer`、`STTokenCounter` 可以调用 ST host driver / `STClient`。

## 验收

- [x] HAL ST adapter 与 host-drivers 之外无新的 `STClient` / `STGlobalAccessor` import。
- [x] System Design 已记录 HAL ST adapter 的合法边界。
