import { IHostProvider } from '../../interfaces.js';
import { HALContext } from '../../HALContext.js';
import { STMacroResolver } from './STMacroResolver.js';
import { STSessionIdNormalizer } from './STSessionIdNormalizer.js';
import { STEventBridge } from './STEventBridge.js';
import { STHostStorage } from './STHostStorage.js';
import { STHostNetwork } from './STHostNetwork.js';
import { STResourceProvider } from './STResourceProvider.js';
import { STBootstrapStorage } from './STBootstrapStorage.js';
import { STTokenCounter } from './STTokenCounter.js';

/**
 * SillyTavern 宿主提供者
 * 负责组装标准的 ST 适配器
 */
export class STHostProvider implements IHostProvider {
    createContext(): HALContext {
        return new HALContext(
            new STMacroResolver(),
            new STSessionIdNormalizer(),
            new STEventBridge(),
            new STHostStorage(),
            new STHostNetwork(),
            new STResourceProvider(),
            new STBootstrapStorage(),
            new STTokenCounter()
        );
    }
}
