import { shallowReactive, markRaw } from 'vue';
import { LuminaPlugin, SettingDefinition } from '../types/plugin.js';
import { lwStorage } from '../api/storage.js';
import { pluginDomainRegistry } from '../platform/plugin/PluginDomainRegistry.js';
import { surfaceRegistry } from '../platform/surface/SurfaceRegistry.js';
import type {
    PluginManifestV2,
    PluginRendererDefinitionUnion
} from '../platform/plugin/types.js';
import type { SurfaceRendererDefinitionUnion } from '../platform/surface/types.js';
import { getPluginNavigationSlots } from '../platform/plugin/pluginNavigationSlots.js';

type PluginHookName = keyof NonNullable<LuminaPlugin['hooks']>;
type PluginHookArguments<K extends PluginHookName> = Parameters<
    NonNullable<NonNullable<LuminaPlugin['hooks']>[K]>
>;
type PluginHookCallback<K extends PluginHookName> = (...args: PluginHookArguments<K>) => void;

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
        renderer: PluginRendererDefinitionUnion
    ): renderer is SurfaceRendererDefinitionUnion {
        return 'ownerId' in renderer && 'kind' in renderer;
    }

    private toSurfaceRendererDefinition(
        renderer: PluginRendererDefinitionUnion,
        ownerId: string
    ): SurfaceRendererDefinitionUnion {
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
        } as SurfaceRendererDefinitionUnion;
    }

    private assertNoDuplicateRendererKeys(renderers: SurfaceRendererDefinitionUnion[], source: string): void {
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
        contracts: NonNullable<PluginManifestV2['surfaces']>;
        businessRenderers: SurfaceRendererDefinitionUnion[];
        fallbackRenderers: SurfaceRendererDefinitionUnion[];
    } {
        if (pluginDomainRegistry.get(manifest.id)) {
            throw new Error(`[PluginDomainRegistry] Duplicate plugin manifest id: ${manifest.id}`);
        }

        const contractIds = new Set<string>();
        const contracts = (manifest.surfaces || []).map(contract => {
            if (contractIds.has(contract.id)) {
                throw new Error(
                    `[PluginManager] Duplicate surface contract in manifest: ${contract.id}`
                );
            }
            contractIds.add(contract.id);
            if (contract.ownerPluginId && contract.ownerPluginId !== manifest.id) {
                throw new Error(
                    `[PluginManager] Surface contract owner mismatch: ${contract.id}`
                );
            }
            return {
                ...contract,
                ownerPluginId: manifest.id
            } as typeof contract;
        });
        if (manifest.primarySurface && !contractIds.has(manifest.primarySurface)) {
            throw new Error(
                `[PluginManager] Primary surface is not declared by plugin manifest: ${manifest.primarySurface}`
            );
        }

        const normalizedManifest: PluginManifestV2 = {
            ...manifest,
            surfaces: contracts,
            businessRenderers: manifest.businessRenderers,
            fallbackRenderers: manifest.fallbackRenderers
        };
        const businessRenderers = Object.entries(manifest.businessRenderers || {}).map(([contractId, renderer]) => {
            if (contractId !== renderer?.contractId) {
                throw new Error(`[PluginManager] Business renderer map key mismatch: ${contractId}`);
            }
            const normalizedRenderer = this.toSurfaceRendererDefinition(renderer, manifest.id);
            if (normalizedRenderer.ownerId !== manifest.id) {
                throw new Error(`[PluginManager] Business renderer owner mismatch: ${contractId}`);
            }
            return normalizedRenderer;
        });
        const fallbackRenderers = Object.entries(manifest.fallbackRenderers || {}).map(([contractId, renderer]) => {
            if (contractId !== renderer?.contractId) {
                throw new Error(`[PluginManager] Fallback renderer map key mismatch: ${contractId}`);
            }
            return {
                ...renderer,
                component: markRaw(renderer.component)
            } as SurfaceRendererDefinitionUnion;
        });
        const contractBusinessRenderers = contracts
            .map(contract => contract.businessRenderer)
            .filter((renderer): renderer is SurfaceRendererDefinitionUnion => Boolean(renderer));
        const contractDefaultRenderers = contracts
            .map(contract => contract.defaultRenderer)
            .filter((renderer): renderer is SurfaceRendererDefinitionUnion => Boolean(renderer));

        [...contractBusinessRenderers, ...contractDefaultRenderers].forEach(renderer => {
            if (renderer.ownerId !== manifest.id) {
                throw new Error(
                    `[PluginManager] Embedded renderer owner mismatch: ${renderer.contractId}`
                );
            }
        });
        fallbackRenderers.forEach(renderer => {
            if (renderer.ownerId !== manifest.id) {
                throw new Error(
                    `[PluginManager] Fallback renderer owner mismatch: ${renderer.contractId}`
                );
            }
        });

        this.assertNoDuplicateRendererKeys([...contractBusinessRenderers, ...businessRenderers], 'business');
        this.assertNoDuplicateRendererKeys([...contractDefaultRenderers, ...fallbackRenderers], 'fallback');
        surfaceRegistry.assertCanRegisterBatch({
            contracts,
            businessRenderers,
            defaultRenderers: fallbackRenderers
        });

        return {
            normalizedManifest,
            contracts,
            businessRenderers,
            fallbackRenderers
        };
    }

    private registerPlatformManifest(manifest: PluginManifestV2): void {
        const {
            normalizedManifest,
            contracts,
            businessRenderers,
            fallbackRenderers
        } = this.validatePlatformManifest(manifest);

        surfaceRegistry.registerBatch({
            contracts,
            businessRenderers,
            defaultRenderers: fallbackRenderers
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

    /** 注册插件，并确保平台 manifest 完整落库后再暴露旧插件入口。 */
    register(plugin: LuminaPlugin): void {
        if (!plugin.id) {
            console.error('[LuminaWeave PluginManager] Plugin must have an id.');
            return;
        }

        if (this.plugins[plugin.id]) {
            return;
        }

        if (plugin.component) {
            // 组件定义不参与业务响应式状态，避免 Vue 对其进行深层代理。
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

        // 平台注册完整成功后才暴露旧插件入口，避免两套注册表状态分裂。
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

    getPlugins(): LuminaPlugin[] {
        return Object.values(this.plugins).filter(plugin => !plugin.isEnabled || plugin.isEnabled());
    }

    getPlugin(id: string): LuminaPlugin | undefined {
        return this.plugins[id];
    }

    /**
     * 触发指定名称的插件钩子
     */
    callHooks<K extends PluginHookName>(
        hookName: K, 
        ...args: PluginHookArguments<K>
    ): void {
        Object.values(this.plugins).forEach(plugin => {
            const hook = plugin.hooks?.[hookName] as PluginHookCallback<K> | undefined;
            if (!hook) return;
            try {
                hook(...args);
            } catch (e) {
                console.error(`[PluginManager] Error in hook ${hookName} of plugin ${plugin.id}:`, e);
            }
        });
    }
}

export const pluginManager = new PluginManager();
