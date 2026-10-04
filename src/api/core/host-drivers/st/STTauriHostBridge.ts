import { STClient } from './STClient.js';
import { STGlobalAccessor } from './STGlobalAccessor.js';
import type { TauriHostBridge } from '../../hal/adapters/tauri/TauriNativeRuntime.js';

/**
 * TauriTavern 宿主桥：把 ST 物理访问收敛在驱动层，
 * 由 HALBootstrap 在 TauriTavern 环境下注入 TauriNativeRuntime。
 */
export const createTauriTavernHostBridge = (): TauriHostBridge => ({
    getMainApi: () => STClient.getMainApi(),
    getCharacterName: () => {
        const ctx = STGlobalAccessor.ctx as { characterName?: string; name?: string } | undefined;
        return ctx?.characterName || ctx?.name || 'Global';
    }
});
