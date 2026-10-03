import type { XMLTagRegistry } from '@shared/XMLTagRegistry.js';
import type { PromptRegistry } from '../core/hal/prompt/PromptRegistry.js';
import type { XMLInterceptor } from '../core/xml-view/XMLInterceptor.js';
import type { MemoryManager } from '../core/runtime-utils/MemoryManager.js';
import type { DesktopSurfaceService } from './DesktopSurfaceService.js';
import type {
    PluginEventListener,
    PluginInitContext
} from '../../platform/plugin/PluginInitContext.js';
import type {
    PluginRegistrationScope,
    RegistrationDisposer
} from '../../platform/plugin/PluginRegistrationScope.js';

export interface PluginInitContextDeps {
    promptRegistry: Pick<PromptRegistry, 'register' | 'unregisterIfCurrent'>;
    xmlInterceptor: Pick<XMLInterceptor, 'registerXMLParser' | 'registerPatternParser'>;
    xmlTagRegistry: Pick<XMLTagRegistry, 'getDefinition' | 'resolveCanonical' | 'unregister'>;
    memoryManager: Pick<MemoryManager, 'registerProvider' | 'unregisterProvider'>;
    desktopSurface: Pick<DesktopSurfaceService, 'registerPanel' | 'unregisterPanel' | 'registerDesktopMode'>;
    events: {
        on(event: string, listener: PluginEventListener): void;
        off(event: string, listener: PluginEventListener): void;
    };
}

/** 保证撤销函数只执行一次：插件手动撤销后，作用域统一撤销时不会重复执行。 */
const once = (disposer: RegistrationDisposer): RegistrationDisposer => {
    let done = false;
    return () => {
        if (done) return;
        done = true;
        disposer();
    };
};

/**
 * 为单个插件创建 init 上下文。每个注册先落到对应注册中心，再把撤销函数登记进插件作用域；
 * 作用域已撤销（init 期间被卸载）时 `scope.add` 会立即撤销，不留无主注册。
 */
export const createPluginInitContext = (
    pluginId: string,
    scope: PluginRegistrationScope,
    deps: PluginInitContextDeps
): PluginInitContext => {
    const track = (disposer: RegistrationDisposer): RegistrationDisposer => {
        const guarded = once(disposer);
        scope.add(guarded);
        return guarded;
    };
    const xmlSourceId = `plugin:${pluginId}`;
    // 按标签对本插件的 handler 引用计数：只有本插件自动补充了定义、且最后一个 handler 撤销时才回收定义。
    const parserTags = new Map<string, { count: number; addedDefinition: boolean }>();

    return {
        pluginId,
        prompts: {
            register(fragment) {
                deps.promptRegistry.register(fragment);
                return track(() => deps.promptRegistry.unregisterIfCurrent(fragment));
            }
        },
        xml: {
            registerParser(tagName, lifecycle, handler) {
                const canonicalTag = deps.xmlTagRegistry.resolveCanonical(tagName) || tagName;
                let entry = parserTags.get(canonicalTag);
                if (!entry) {
                    entry = { count: 0, addedDefinition: deps.xmlTagRegistry.getDefinition(canonicalTag) === undefined };
                    parserTags.set(canonicalTag, entry);
                }
                entry.count += 1;
                const disposeHandler = deps.xmlInterceptor.registerXMLParser(tagName, lifecycle, handler, xmlSourceId);
                const tagEntry = entry;
                return track(() => {
                    disposeHandler();
                    tagEntry.count -= 1;
                    if (tagEntry.count > 0) return;
                    parserTags.delete(canonicalTag);
                    if (tagEntry.addedDefinition) deps.xmlTagRegistry.unregister(xmlSourceId, canonicalTag);
                });
            },
            registerPatternParser(pattern, lifecycle, handler) {
                return track(deps.xmlInterceptor.registerPatternParser(pattern, lifecycle, handler));
            }
        },
        memory: {
            registerProvider(provider) {
                deps.memoryManager.registerProvider(provider);
                return track(() => deps.memoryManager.unregisterProvider(provider));
            }
        },
        panels: {
            register(panelId, component, options) {
                const entry = deps.desktopSurface.registerPanel(panelId, component, options);
                return track(() => deps.desktopSurface.unregisterPanel(panelId, entry));
            }
        },
        desktopModes: {
            register(manifest) {
                // DesktopModeManifest 目前没有 componentOverrides 字段（运行时 override 只由内置 telegram 描述符硬编码），
                // 所以这里没有官方 contract 命名空间可检查；若将来新增该字段，需在此补校验。
                return track(deps.desktopSurface.registerDesktopMode(manifest));
            }
        },
        events: {
            on(event, listener) {
                deps.events.on(event, listener);
                return track(() => deps.events.off(event, listener));
            }
        },
        onDispose(disposer) {
            track(disposer);
        }
    };
};
