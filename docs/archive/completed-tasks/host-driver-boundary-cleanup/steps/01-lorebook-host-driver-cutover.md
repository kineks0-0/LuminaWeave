# Step 01: Lorebook Host Driver Cutover

## 目标

将世界书相关 ST / TavernHelper / REST 操作从 `LorebookManager` 移入 `host-drivers/st/STWorldInfoDriver`，让 `LorebookManager` 只负责世界书领域状态、快照、排序、筛选和事件派发。

## 输入

- UI / plugin 调用 `LorebookManager.syncFromST()`、`loadLorebook()`、`saveEntry()`、`saveLorebook()`、`deleteEntry()`、`activateAsGlobal()`、`deactivateFromGlobal()`。
- 宿主世界书能力来自当前 ST / TavernHelper 环境。

## 处理流程

1. 补齐 `STWorldInfoDriver`，封装世界书列表、读取、创建、导入、全局绑定与解绑。
2. `LorebookManager` 通过一个窄 `LorebookHostPort` 消费宿主能力。
3. 规范化 ST 世界书数据结构，统一兼容数组 entries 与对象 entries。
4. 保留当前快照与版本模式逻辑，不改变 UI 可见状态。

## 状态变化

- `LorebookManager.books`、`entries`、`selectedBook`、`currentBookData` 仍由 manager 维护。
- ST 世界书真实写入仅通过 host driver 完成。
- 失败时返回 `false` 或空结构，不在 Core 层直接访问 Helper 兜底。

## 输出

- 世界书列表、条目读取、条目保存、全量保存、删除、全局激活/取消行为保持原有语义。
- `LorebookManager` 不再直接引用 `TavernHelper`、`SillyTavern`、`ctx.world_info_list` 或 `/api/worldinfo/get`。

## 上下游影响

- 上游 UI 调用不变。
- 下游 ST/TavernHelper 操作集中在 `host-drivers/st/STWorldInfoDriver.ts`。
- System Design 需要记录世界书 host driver 边界已经落地。

## 验收

- [x] `LorebookManager.ts` 中不再出现 `stHelper`、`this.ctx`、`STClient`、`fetch('/api/worldinfo`。
- [x] `STWorldInfoDriver.ts` 是 ST 世界书物理操作的唯一归口。
- [x] `LuminaWeaveAPIBase.waitForEnvironment()` 通过 `STEnvironmentDriver` 消费宿主就绪能力。
- [x] `LuminaWeaveAPI` 的 ST 函数定位、ST regex、角色资料读取委托给 ST host driver。
- [x] `npm run type-check` 通过。
- [x] `npm run test -- src/api/core/__tests__/forgeVirtualLorebook.test.ts src/api/__tests__/LuminaWeaveAPI.test.ts` 通过，2 个测试文件 / 8 个测试。

## 后续批次

- 继续盘点 `conversation/`、`forge/`、`generation/`、`runtime-utils/` 中的历史 `STClient` 依赖。
- 按功能域补充更窄的 host port，而不是让 Core 继续直接 import `STClient`。
- 将可迁移的读取类依赖优先移入 HAL provider；写入类依赖必须保留明确权限和同步边界。
