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
import {
    PluginRegistrationScope,
    type RegistrationHandle
} from '../platform/plugin/PluginRegistrationScope.js';

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

    private readonly scopes = new Map<string, PluginRegistrationScope>();
    private readonly initializedPluginIds = new Set<string>();
    private resolveBuiltinsInitialized: (() => void) | null = null;
    private readonly builtinsInitialized = new Promise<void>(resolve => {
        this.resolveBuiltinsInitialized = resolve;
    });

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
                    `[LuminaWeave PluginManager] Duplicate ${source} renderer in manifest for surface contract: ${renderer.contractId}` +
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
                    `[LuminaWeave PluginManager] Duplicate surface contract in manifest: ${contract.id}`
                );
            }
            contractIds.add(contract.id);
            if (contract.ownerPluginId && contract.ownerPluginId !== manifest.id) {
                throw new Error(
                    `[LuminaWeave PluginManager] Surface contract owner mismatch: ${contract.id}`
                );
            }
            return {
                ...contract,
                ownerPluginId: manifest.id
            } as typeof contract;
        });
        if (manifest.primarySurface && !contractIds.has(manifest.primarySurface)) {
            throw new Error(
                `[LuminaWeave PluginManager] Primary surface is not declared by plugin manifest: ${manifest.primarySurface}`
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
                throw new Error(`[LuminaWeave PluginManager] Business renderer map key mismatch: ${contractId}`);
            }
            const normalizedRenderer = this.toSurfaceRendererDefinition(renderer, manifest.id);
            if (normalizedRenderer.ownerId !== manifest.id) {
                throw new Error(`[LuminaWeave PluginManager] Business renderer owner mismatch: ${contractId}`);
            }
            return normalizedRenderer;
        });
        const fallbackRenderers = Object.entries(manifest.fallbackRenderers || {}).map(([contractId, renderer]) => {
            if (contractId !== renderer?.contractId) {
                throw new Error(`[LuminaWeave PluginManager] Fallback renderer map key mismatch: ${contractId}`);
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
                    `[LuminaWeave PluginManager] Embedded renderer owner mismatch: ${renderer.contractId}`
                );
            }
        });
        fallbackRenderers.forEach(renderer => {
            if (renderer.ownerId !== manifest.id) {
                throw new Error(
                    `[LuminaWeave PluginManager] Fallback renderer owner mismatch: ${renderer.contractId}`
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

    private registerPlatformManifest(manifest: PluginManifestV2, scope: PluginRegistrationScope): void {
        const {
            normalizedManifest,
            contracts,
            businessRenderers,
            fallbackRenderers
        } = this.validatePlatformManifest(manifest);

        scope.add(surfaceRegistry.registerBatch({
            contracts,
            businessRenderers,
            defaultRenderers: fallbackRenderers
        }));
        scope.add(pluginDomainRegistry.register(normalizedManifest));

        if (manifest.settingsSchema) {
            this.setRegisteredSettings(manifest.id, manifest.settingsSchema, scope);
        }
    }

    private setRegisteredSettings(
        pluginId: string,
        settings: Record<string, SettingDefinition>,
        scope: PluginRegistrationScope
    ): void {
        const previous = this.registeredSettings[pluginId];
        this.registeredSettings[pluginId] = settings;
        scope.add(() => {
            if (this.registeredSettings[pluginId] !== settings) return;
            if (previous) {
                this.registeredSettings[pluginId] = previous;
            } else {
                delete this.registeredSettings[pluginId];
            }
        });
    }

    private createHandle(pluginId: string, scope: PluginRegistrationScope): RegistrationHandle {
        return {
            pluginId,
            // 只撤销仍由该作用域持有的注册，过期句柄不会误卸载同 id 的新注册。
            dispose: () => {
                if (this.scopes.get(pluginId) === scope) this.unregister(pluginId);
            }
        };
    }

    /**
     * 判断插件是否被允许注入提示词 (默认允许)
     */
    public isPluginPromptEnabled(pluginId: string): boolean {
        // 从全局存储读取用户的子插件开关设定
        return lwStorage.get(`lumina-settings.plugins.${pluginId}.promptEnabled`, true, 'Global');
    }

    /** 注册插件，并确保平台 manifest 完整落库后再暴露旧插件入口；返回可撤销句柄。 */
    register(plugin: LuminaPlugin): RegistrationHandle | undefined {
        if (!plugin.id) {
            console.error('[LuminaWeave PluginManager] Plugin must have an id.');
            return undefined;
        }

        const existing = this.plugins[plugin.id];
        if (existing) {
            const existingScope = this.scopes.get(plugin.id);
            // 只有同一对象的重复注册才拿回句柄；异对象同 id 不授予所有权。
            return existing === plugin && existingScope ? this.createHandle(plugin.id, existingScope) : undefined;
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

        const scope = new PluginRegistrationScope(plugin.id);
        try {
            if (plugin.platformManifest) {
                this.registerPlatformManifest(plugin.platformManifest, scope);
            }

            // 平台注册完整成功后才暴露旧插件入口，避免两套注册表状态分裂。
            this.plugins[plugin.id] = plugin;
            scope.add(() => {
                if (this.plugins[plugin.id] === plugin) delete this.plugins[plugin.id];
            });

            getPluginNavigationSlots(plugin).forEach(slot => {
                if (!this.slots[slot]) {
                    console.warn(`[LuminaWeave PluginManager] Slot ${slot} does not exist`);
                    return;
                }
                // 替换数组而不是 push，使 shallowReactive 的 slots 能为运行时注册触发更新。
                this.slots[slot] = [...this.slots[slot], plugin];
                scope.add(() => {
                    this.slots[slot] = this.slots[slot].filter(entry => entry !== plugin);
                });
            });

            if (plugin.settingsManifest) {
                this.setRegisteredSettings(plugin.id, plugin.settingsManifest, scope);
            }
        } catch (error) {
            scope.dispose();
            throw error;
        }

        this.scopes.set(plugin.id, scope);
        console.log(`[LuminaWeave PluginManager] Plugin registered: ${plugin.id}`);
        return this.createHandle(plugin.id, scope);
    }

    /** 按相反顺序撤销插件的全部注册；插件未注册时返回 false。 */
    unregister(pluginId: string): boolean {
        const scope = this.scopes.get(pluginId);
        if (!scope) return false;
        this.scopes.delete(pluginId);
        this.initializedPluginIds.delete(pluginId);
        scope.dispose();
        console.log(`[LuminaWeave PluginManager] Plugin unregistered: ${pluginId}`);
        return true;
    }

    /**
     * 运行时注册：注册后立即初始化，初始化失败时整体回滚并抛出（ADR-0005 决策 11）。
     * 内置插件仍由 initializeAllPlugins 初始化，失败时只记录日志。
     * init 内部未经作用域的全局注册（Prompt/XML/Panel 等）不会回滚，E2b 提供 init(context) 后解决；
     * init 期间插件已对外可见。
     */
    async registerAndInitialize(plugin: LuminaPlugin): Promise<RegistrationHandle> {
        if (!plugin.id) {
            throw new Error('[LuminaWeave PluginManager] Plugin must have an id.');
        }
        if (this.plugins[plugin.id]) {
            throw new Error(`[LuminaWeave PluginManager] Duplicate plugin id: ${plugin.id}`);
        }
        const handle = this.register(plugin);
        if (!handle) {
            throw new Error(`[LuminaWeave PluginManager] Failed to register plugin: ${plugin.id}`);
        }
        const scope = this.scopes.get(plugin.id);
        this.initializedPluginIds.add(plugin.id);
        try {
            for (const init of this.collectInitializers(plugin)) {
                await init();
            }
        } catch (error) {
            handle.dispose(); // 带作用域校验，不会误卸载同 id 的新注册
            throw error;
        }
        if (!scope || scope.isDisposed) {
            throw new Error(`[LuminaWeave PluginManager] Plugin was unregistered during init: ${plugin.id}`);
        }
        return handle;
    }

    private collectInitializers(plugin: LuminaPlugin): Array<() => void | Promise<void>> {
        return [
            plugin.init,
            plugin.platformManifest?.init
        ].filter((init, index, list): init is () => void | Promise<void> =>
            typeof init === 'function' && list.indexOf(init) === index
        );
    }

    /**
     * 第一次 initializeAllPlugins 完成（内置插件已注册并初始化）后 resolve；运行时插件注册以此为门控。
     * 宿主初始化在插件阶段之前失败时永不 resolve，运行时注册将一直挂起。
     */
    whenBuiltinsInitialized(): Promise<void> {
        return this.builtinsInitialized;
    }

    /**
     * 并行初始化所有已注册插件
     */
    async initializeAllPlugins(): Promise<void> {
        const initPromises = Object.values(this.plugins)
            .filter(plugin => !this.initializedPluginIds.has(plugin.id))
            .map(async (plugin) => {
                this.initializedPluginIds.add(plugin.id);
                for (const init of this.collectInitializers(plugin)) {
                    try {
                        console.log(`[LuminaWeave PluginManager] Initializing plugin: ${plugin.id}`);
                        await init();
                    } catch (e) {
                        console.error(`[LuminaWeave PluginManager] Failed to initialize plugin ${plugin.id}:`, e);
                    }
                }
            });
        await Promise.all(initPromises);
        this.resolveBuiltinsInitialized?.();
        this.resolveBuiltinsInitialized = null;
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
                console.error(`[LuminaWeave PluginManager] Error in hook ${hookName} of plugin ${plugin.id}:`, e);
            }
        });
    }
}

export const pluginManager = new PluginManager();
