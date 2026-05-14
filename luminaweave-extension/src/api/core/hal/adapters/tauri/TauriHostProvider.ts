import { IHostProvider } from '../../interfaces.js';
import { HALContext } from '../../HALContext.js';
// Tauri 环境目前主要基于 ST 的 Web 内容，因此组合复用 ST 的适配器
// 未来可以在这里注入 Tauri 特有的 NativeStorage 或 NativeNetwork
import { STMacroResolver } from '../st/STMacroResolver.js';
import { STSessionIdNormalizer } from '../st/STSessionIdNormalizer.js';
import { STEventBridge } from '../st/STEventBridge.js';
import { STHostStorage } from '../st/STHostStorage.js';
import { STHostNetwork } from '../st/STHostNetwork.js';
import { STResourceProvider } from '../st/STResourceProvider.js';
import { DefaultBootstrapStorage } from '../../defaults/DefaultBootstrapStorage.js';
import { STTokenCounter } from '../st/STTokenCounter.js';

/**
 * TauriTavern 宿主提供者
 * 负责组装带有原生增强能力的适配器集合
 */
export class TauriHostProvider implements IHostProvider {
    createContext(): HALContext {
        // P2/P3 阶段可在此处灵活替换具体实现，例如使用 new TauriHostStorage()
        return new HALContext(
            new STMacroResolver(),
            new STSessionIdNormalizer(),
            new STEventBridge(),
            new STHostStorage(),
            new STHostNetwork(),
            new STResourceProvider(),
            new DefaultBootstrapStorage(),
            new STTokenCounter()
        );
    }
}
