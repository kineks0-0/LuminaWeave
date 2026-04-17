import { BridgeDispatcher } from '../../../shared/api/BridgeDispatcher.js';
import { HttpBridgeAdapter } from '../api/adapters/HttpBridgeAdapter.js';
import { TauriBridgeAdapter } from '../api/adapters/TauriBridgeAdapter.js';
import { LocalBridgeAdapter } from '../api/adapters/LocalBridgeAdapter.js';
import { EnvDetector } from '../api/core/EnvDetector.js';

/**
 * 桥接系统初始化
 * 根据当前运行环境（Web/Tauri/Android）注入相应的适配器。
 * 包含自动降级机制：如果检测到后端不可用，则切换到 LocalBridge 模式。
 */
export async function initBridge() {
    console.log('[Bridge] 正在探测运行环境与连接状态...');

    if (EnvDetector.isTauriTavern) {
        console.log('[Bridge] 检测到 TauriTavern 环境，注入 TauriBridgeAdapter');
        // 原生环境默认认为后端可用（同进程或受控子进程）
        BridgeDispatcher.inject(new TauriBridgeAdapter());
    } else {
        const httpAdapter = new HttpBridgeAdapter();
        try {
            // 尝试与后端握手：获取设置信息作为活性探测
            console.log('[Bridge] 正在探测 Lumina 后端...');
            await httpAdapter.settings.getSettings();
            console.log('[Bridge] 后端连接成功，已注入 HttpBridgeAdapter');
            BridgeDispatcher.inject(httpAdapter);
        } catch (e) {
            console.warn('[Bridge] 探测后端失败 (Lumina Server 可能未启动)，正在降级为 LocalBridgeAdapter (离线模式)');
            BridgeDispatcher.inject(new LocalBridgeAdapter());
        }
    }
}
