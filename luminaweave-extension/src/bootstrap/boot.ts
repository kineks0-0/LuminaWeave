import { HALBootstrap } from '../api/core/hal/HALBootstrap.js';
import { lwStorage } from '../api/storage.js';

/**
 * LuminaWeave 核心引导程序
 * 负责在 UI 挂载前初始化所有基础设施层。
 * 无论是在插件模式还是独立模式下，都应首先调用此函数。
 */
export async function boot() {
    console.log('[LuminaBoot] Starting unified bootstrapping...');

    try {
        // 1. 初始化 HAL 探测与 runtime ports
        await HALBootstrap.init();

        // 2. 初始化持久化存储
        await lwStorage.initStorage();

        console.log('[LuminaBoot] Unified bootstrapping complete.');
    } catch (error) {
        console.error('[LuminaBoot] Bootstrapping failed:', error);
        throw error;
    }
}
