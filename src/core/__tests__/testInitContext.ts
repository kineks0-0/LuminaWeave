import { globalXMLTagRegistry } from '@shared/XMLTagRegistry.js';
import { PromptRegistry } from '../../api/core/hal/prompt/PromptRegistry.js';
import { XMLInterceptor } from '../../api/core/xml-view/XMLInterceptor.js';
import { MemoryManager } from '../../api/core/runtime-utils/MemoryManager.js';
import { DesktopSurfaceService } from '../../api/services/DesktopSurfaceService.js';
import { createPluginInitContext } from '../../api/services/PluginInitContextFactory.js';
import type { PluginEventListener, PluginInitContextFactory } from '../../platform/plugin/PluginInitContext.js';

/** 测试用：每次调用生成一套独立的注册中心，并返回基于它们的 context 工厂。 */
export const createTestInitContextHarness = () => {
    const promptRegistry = new PromptRegistry();
    const xmlInterceptor = new XMLInterceptor();
    const memoryManager = new MemoryManager();
    const desktopSurface = new DesktopSurfaceService(() => undefined);
    const listeners = new Map<string, PluginEventListener[]>();
    const events = {
        on: (event: string, listener: PluginEventListener): void => {
            listeners.set(event, [...(listeners.get(event) ?? []), listener]);
        },
        off: (event: string, listener: PluginEventListener): void => {
            listeners.set(event, (listeners.get(event) ?? []).filter(item => item !== listener));
        }
    };
    const factory: PluginInitContextFactory = (pluginId, scope) => createPluginInitContext(pluginId, scope, {
        promptRegistry,
        xmlInterceptor,
        xmlTagRegistry: globalXMLTagRegistry,
        memoryManager,
        getActiveTrace: () => undefined,
        desktopSurface,
        events
    });
    return { factory, promptRegistry, xmlInterceptor, memoryManager, desktopSurface, listeners };
};
