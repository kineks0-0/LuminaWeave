import { shallowReactive, markRaw } from 'vue';
import { LuminaPlugin, SettingDefinition } from '../types/plugin.js';
import { lwStorage } from '../api/storage.js';
import { pluginDomainRegistry } from '../platform/plugin/PluginDomainRegistry.js';
import { surfaceRegistry } from '../platform/surface/SurfaceRegistry.js';
import type { PluginBusinessRendererDefinition, PluginManifestV2 } from '../platform/plugin/types.js';
import type { SurfaceRendererDefinition } from '../platform/surface/types.js';
import { getPluginNavigationSlots } from '../platform/plugin/pluginNavigationSlots.js';

export class PluginManager {
    public plugins: Record<string, LuminaPlugin> = shallowReactive({} as Record<string, LuminaPlugin>);
    public slots: Record<string, LuminaPlugin[]> = shallowReactive({
        mainView: [],
        widget: [],
        headerExtension: [],
        headerCenter: [],
        headerRight: []
    } as Record<string, LuminaPlugin[]>);

    public registeredSettings: Record<string, Record<string, SettingDefinition>> = shallowReactive({} as Record<string, Record<string, SettingDefinition>>);

    constructor() {
        console.log('[LuminaWeave PluginManager] Initialized');
    }

    private isSurfaceRendererDefinition(
        renderer: PluginBusinessRendererDefinition | SurfaceRendererDefinition
    ): renderer is SurfaceRendererDefinition {
        return 'ownerId' in renderer && 'kind' in renderer;
    }

    private toSurfaceRendererDefinition(
        renderer: PluginBusinessRendererDefinition | SurfaceRendererDefinition,
        ownerId: string
    ): SurfaceRendererDefinition {
        if (this.isSurfaceRendererDefinition(renderer)) {
            return {
                ...renderer,
                component: markRaw(renderer.component)
            };
        }

        return {
            contractId: renderer.contractId,
            component: markRaw(renderer.component),
            createContext: renderer.createContext,
            ownerId,
            kind: 'plugin-business'
        };
    }

    private assertNoDuplicateRendererKeys(renderers: SurfaceRendererDefinition[], source: string): void {
        const seen = new Set<string>();
        renderers.forEach(renderer => {
            const key = `${renderer.contractId}:${renderer.variant || ''}`;
            if (seen.has(key)) {
                throw new Error(
                    `[PluginManager] Duplicate ${source} renderer in manifest for surface contract: ${renderer.contractId}` +
                    ` (variant: ${renderer.variant || 'default'})`
                );
            }
            seen.add(key);
        });
    }

    private validatePlatformManifest(manifest: PluginManifestV2): {
        normalizedManifest: PluginManifestV2;
        businessRenderers: SurfaceRendererDefinition[];
        fallbackRenderers: SurfaceRendererDefinition[];
    } {
        if (pluginDomainRegistry.get(manifest.id)) {
            throw new Error(`[PluginDomainRegistry] Duplicate plugin manifest id: ${manifest.id}`);
        }

        const normalizedManifest: PluginManifestV2 = {
            ...manifest,
            businessRenderers: manifest.businessRenderers,
            fallbackRenderers: manifest.fallbackRenderers
        };
        const businessRenderers = Object.values(manifest.businessRenderers || {}).map(renderer =>
            this.toSurfaceRendererDefinition(renderer, manifest.id)
        );
        const fallbackRenderers = Object.values(manifest.fallbackRenderers || {}).map(renderer => ({
            ...renderer,
            component: markRaw(renderer.component)
        }));
        const contractBusinessRenderers = (manifest.surfaces || [])
            .map(contract => contract.businessRenderer)
            .filter((renderer): renderer is SurfaceRendererDefinition => Boolean(renderer));
        const contractDefaultRenderers = (manifest.surfaces || [])
            .map(contract => contract.defaultRenderer)
            .filter((renderer): renderer is SurfaceRendererDefinition => Boolean(renderer));

        this.assertNoDuplicateRendererKeys([...contractBusinessRenderers, ...businessRenderers], 'business');
        this.assertNoDuplicateRendererKeys([...contractDefaultRenderers, ...fallbackRenderers], 'fallback');
        manifest.surfaces?.forEach(contract => surfaceRegistry.assertCanRegisterContract(contract));
        businessRenderers.forEach(renderer => surfaceRegistry.assertCanRegisterBusinessRenderer(renderer));
        fallbackRenderers.forEach(renderer => surfaceRegistry.assertCanRegisterDefaultRenderer(renderer));

        return {
            normalizedManifest,
            businessRenderers,
            fallbackRenderers
        };
    }

    private registerPlatformManifest(manifest: PluginManifestV2): void {
        const {
            normalizedManifest,
            businessRenderers,
            fallbackRenderers
        } = this.validatePlatformManifest(manifest);

        manifest.surfaces?.forEach(contract => surfaceRegistry.registerContract(contract));
        businessRenderers.forEach(renderer => {
            surfaceRegistry.registerBusinessRenderer(renderer);
        });
        fallbackRenderers.forEach(renderer => {
            surfaceRegistry.registerDefaultRenderer(renderer);
        });
        pluginDomainRegistry.register(normalizedManifest);

        if (manifest.settingsSchema) {
            this.registeredSettings[manifest.id] = manifest.settingsSchema;
        }
    }

    /**
     * 判断插件是否被允许注入提示词 (默认允许)
     */
    public isPluginPromptEnabled(pluginId: string): boolean {
        // 从全局存储读取用户的子插件开关设定
        return lwStorage.get(`lumina-settings.plugins.${pluginId}.promptEnabled`, true, 'Global');
    }

    /**
     * Register a new plugin
     * @param {LuminaPlugin} plugin 
     */
    register(plugin: LuminaPlugin) {
        if (!plugin.id) {
            console.error('[LuminaWeave PluginManager] Plugin must have an id.');
            return;
        }

        if (this.plugins[plugin.id]) {
            return;
        }

        if (plugin.component) {
            // markRaw prevents Vue from deep-reactively observing the entire component definition
            plugin.component = markRaw(plugin.component);
        }
        if (plugin.headerCenterComponent) {
            plugin.headerCenterComponent = markRaw(plugin.headerCenterComponent);
        }
        if (plugin.headerRightComponent) {
            plugin.headerRightComponent = markRaw(plugin.headerRightComponent);
        }

        if (plugin.platformManifest) {
            this.registerPlatformManifest(plugin.platformManifest);
        }

        // Create a plain object for the plugin registry only after platform registration succeeds.
        this.plugins[plugin.id] = plugin;

        getPluginNavigationSlots(plugin).forEach(slot => {
            if (this.slots[slot]) {
                this.slots[slot].push(plugin);
            } else {
                console.warn(`[LuminaWeave PluginManager] Slot ${slot} does not exist`);
            }
        });

        if (plugin.settingsManifest) {
            this.registeredSettings[plugin.id] = plugin.settingsManifest;
        }

        console.log(`[LuminaWeave PluginManager] Plugin registered: ${plugin.id}`);
    }

    /**
     * 并行初始化所有已注册插件
     */
    async initializeAllPlugins(): Promise<void> {
        const initPromises = Object.values(this.plugins).map(async (plugin) => {
            const initializers = [
                plugin.init,
                plugin.platformManifest?.init
            ].filter((init, index, list): init is () => void | Promise<void> =>
                typeof init === 'function' && list.indexOf(init) === index
            );

            for (const init of initializers) {
                try {
                    console.log(`[LuminaWeave PluginManager] Initializing plugin: ${plugin.id}`);
                    await init();
                } catch (e) {
                    console.error(`[LuminaWeave PluginManager] Failed to initialize plugin ${plugin.id}:`, e);
                }
            }
        });
        await Promise.all(initPromises);
        console.log('[LuminaWeave PluginManager] All plugins initialized.');
    }


    getPluginsInSlot(slotName: string): LuminaPlugin[] {
        const plugins = this.slots[slotName] || [];
        return plugins.filter(p => !p.isEnabled || p.isEnabled());
    }

    getPlugin(id: string): LuminaPlugin | undefined {
        return this.plugins[id];
    }

    /**
     * 触发指定名称的插件钩子
     */
    callHooks<K extends keyof NonNullable<LuminaPlugin['hooks']>>(
        hookName: K, 
        ...args: Parameters<NonNullable<NonNullable<LuminaPlugin['hooks']>[K]>>
    ) {
        Object.values(this.plugins).forEach(plugin => {
            if (plugin.hooks && typeof (plugin.hooks as any)[hookName] === 'function') {
                try {
                    (plugin.hooks as any)[hookName](...args);
                } catch (e) {
                    console.error(`[PluginManager] Error in hook ${hookName} of plugin ${plugin.id}:`, e);
                }
            }
        });
    }
}

export const pluginManager = new PluginManager();
