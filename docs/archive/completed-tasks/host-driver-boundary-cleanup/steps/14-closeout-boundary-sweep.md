# Step 14: 收尾边界扫描与残留清理

状态：Completed

日期：2026-05-14

## 目标

进入归档前，清理 Step 13 后复核发现的两个边界残留：

- `LorebookManager` 默认参数仍直接绑定 `STWorldInfoDriver`。
- `hal/resource/index.ts` 作为 HAL 通用入口仍直接实例化 ST resource source。

本步不改变世界书、资源浏览、Prompt 注入或生成行为，只收口依赖方向。

## 已完成

- 新增 `LorebookHostPort` 注册点，`LorebookManager` 默认消费当前已注册端口；无宿主时使用受控空实现。
- 新增 `STLorebookHostPort`，由 ST 宿主注册阶段把 `STWorldInfoDriver` 与正则同步能力挂入世界书端口。
- `PromptWorldInfoMount` 不再直接 import ST `RegexSyncService`，改为通过 `LorebookManager.syncLuminaRegexToHost()` 触发宿主侧同步。
- `hal/resource/index.ts` 不再直接 import 或实例化 `STResourceSource` / `LocalResourceSource`。
- 新增资源 source provider：
  - `hal/adapters/st/STResourceSourceProvider`
  - `hal/adapters/standalone/LocalResourceSourceProvider`
- 新增 runtime port registration：
  - `hal/adapters/st/STRuntimePortRegistration`
  - `hal/adapters/standalone/StandaloneRuntimePortRegistration`
- `HALBootstrap` 只调用 adapter registration，不再在通用入口展开 ST 具体 driver 注册。
- 移除 `src/api/index.ts` 中旧的 ST driver 注册 import。
- 修复 `StandaloneHostStorage` 与当前 `IHostStorage` 接口不匹配的问题，保留旧 scope API 并补齐 `getItem` / `setItem` / `removeItem`。

## 验收

- Core lorebook 生产代码不再直接 import `host-drivers/st/*`。
- HAL resource 通用入口不再直接实例化 ST resource source。
- ST 物理世界书 I/O、正则同步、资源 source 注册仍位于 ST host driver / ST adapter 允许边界。
- Standalone local resource source 注册位于 standalone adapter 注册侧。

## 验证

- `npm run type-check`：通过。
- `npm run test -- src/api/core/__tests__/forgeVirtualLorebook.test.ts src/api/core/__tests__/STWorldInfoDriver.test.ts src/api/core/__tests__/ResourceRuntime.test.ts src/api/core/__tests__/PromptAssemblyRouter.test.ts src/api/__tests__/LuminaWeaveAPI.test.ts src/api/core/__tests__/StreamHandler.test.ts src/api/core/__tests__/ContextCompactor.test.ts src/api/core/__tests__/MemoryManager.test.ts src/api/core/__tests__/PersistenceService.test.ts`：通过，9 个测试文件 / 90 个测试。
- 依赖扫描：排除 `core/host-drivers/st/`、`core/hal/adapters/st/`、测试文件后，生产 Core 未发现 `host-drivers/st` import、`STClient.`、`STGlobalAccessor.`、`STProtocol.`、`SyncUtils.`、`STWorldInfoDriver`、`new STResourceSource` 或 `TavernHelper.` 直连；`lorebook/` 剩余 ST / TavernHelper 命中仅为注释文本。

## 收尾判断

Host Driver Boundary Cleanup 可以进入归档准备阶段。后续不再以本任务继续扩批；`lumina-assembly` 完整 Prompt Source pipeline、Prompt Inspector source span、Tauri adapter ST 复用去除等属于新的后续任务。
