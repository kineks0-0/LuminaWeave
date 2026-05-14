# Step 07: Facade Runtime Port Cleanup

## 目标

继续清理 `LuminaWeaveAPI` / `LuminaWeaveAPIBase` 的宿主运行时依赖。重点不是删除旧 public API 名称，而是让 facade 不再直接 import `STEnvironmentDriver`、`ST_EVENT` 或读取 `ctx/stMain/stEventSource/event_types`。

## 输入

- Step 06 已完成 Core port 注入清理。
- 当前残留集中在 facade 初始化、ST 事件绑定、生成状态安全检查、正则应用和 ST 函数定位。

## 处理流程

1. 新增 `HostRuntimePort`，定义环境等待、事件绑定、生成标志、宿主函数定位、正则应用和当前聊天快照读取。
2. 新增 ST runtime driver，在 `host-drivers/st` 内部将 `STEnvironmentDriver` 与 `ST_EVENT` 适配为 host-neutral runtime port。
3. `LuminaWeaveAPIBase.waitForEnvironment()` 改为消费 runtime port，移除 `ctx/stMain/stHelper/stEventSource/stEventTypes` protected getter。
4. `LuminaWeaveAPI.initSTEvents()` 改为通过 runtime port 绑定事件和读取生成标志。
5. 保留 `_getSTFunction()`、`applySTRegex()`、`getSTCore()` 旧 public 方法名，但实现委托 runtime port。

## 状态变化

- Facade/Core 不再直接消费 ST 环境对象。
- ST 事件名解析保留在 ST host driver 内。
- 旧调用方仍可使用现有 public API。

## 验收

- [x] `core/facade/` 中无 `STEnvironmentDriver` / `ST_EVENT` / `STGlobalAccessor` 直接 import。
- [x] `LuminaWeaveAPIBase` 不暴露宿主全局对象 getter。
- [x] `LuminaWeaveAPI.initSTEvents()` 不直接读取 `stEventSource` / `event_types`。
- [x] `type-check` 与 facade 相关测试通过。

## 执行记录

- 新增 `core/facade/HostRuntimePort.ts`，将环境等待、宿主事件绑定、生成标志、正则处理、ST 函数定位和当前聊天消息读取抽为 runtime port。
- 新增 `host-drivers/st/STFacadeRuntimeDriver.ts`，在 ST host driver 边界内解析 `ST_EVENT` / `event_types` 并注册 runtime port。
- `LuminaWeaveAPIBase` 改为通过 runtime port 等待宿主环境，移除 `ctx/stMain/stHelper/stEventSource/stEventTypes` getter。
- `LuminaWeaveAPI.initSTEvents()` 改为通过 `HostRuntimePort.on()` 绑定宿主事件，通过 runtime port 读取生成状态和最后一条宿主消息。
- `applySTRegex()`、`getSTCore()`、`_getSTFunction()` 保留旧方法名，但实现委托 runtime port。
- `RegexSyncService` 作为 ST host driver 内部实现，改为直接使用 `STEnvironmentDriver.stHelper`；`llmEngine` 的 `st_current` 模型读取改为通过 runtime port。

## 验证

```powershell
cd D:\LuminaWeave\luminaweave-extension
npm run type-check
npm run test -- src/api/__tests__/LuminaWeaveAPI.test.ts src/api/core/__tests__/StreamHandler.test.ts
```

- `type-check`：通过。
- 目标测试：通过，2 个测试文件 / 13 个测试。
- 依赖扫描：`core/facade/` 未发现 `STEnvironmentDriver` / `ST_EVENT` / `STGlobalAccessor` / `host-drivers/st` 直接引用；`src/api/index.ts` 未发现 `STEnvironmentDriver`、独立 `ST_EVENT`、`this.ctx`、`this.stMain`、`this.stEventSource`、`this.stEventTypes`、`event_types` 残留。
