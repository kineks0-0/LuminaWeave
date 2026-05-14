# Step 12: HAL/Core Cross-Layer Cleanup

状态：Completed

日期：2026-05-14

## 目标

清理 HAL prompt 通用模块和 Core storage 模块对 `host-drivers/st/SyncUtils`、`STProtocol` 等 ST 专用 helper 的直接引用，把 host-neutral 逻辑迁入中立工具或服务。

## 已完成

- 新增 `src/api/core/runtime-utils/MessageTextProjection.ts`。
  - 提供 host-neutral 消息文本投影。
  - `ContextCompactor` 不再 import `host-drivers/st/SyncUtils` 或 `MessageTextResolver`。
- 新增 `src/api/core/storage/ContextControlSettingsService.ts`。
  - `DCCManager` 不再通过 ST `SyncUtils.getDccSettings()` 读取 DCC 设置。
- 新增 `src/api/core/storage/MessageStorageProjection.ts`。
  - 承接 storage 层需要的消息字段补全、storage projection、fingerprint、compare pools。
  - `PersistenceService`、`TimelineManager`、`WorldlineStore` 不再 import `STProtocol` 或 ST `SyncUtils`。

## 验收

- 通用 `src/api/core/hal/prompt/*.ts` 中无 `host-drivers/st`、`STClient`、`STGlobalAccessor`、`STProtocol`、`STAdapter`、`SyncUtils` 直接引用。
- `src/api/core/storage/*.ts` 中无 `host-drivers/st`、`STProtocol`、`SyncUtils` 直接引用。

## 验证

- `npm run type-check`：通过。
- `npm run test -- src/api/core/__tests__/ContextCompactor.test.ts src/api/core/__tests__/MemoryManager.test.ts src/api/core/__tests__/PersistenceService.test.ts`：包含在 Step 11-13 联合验证中通过。
