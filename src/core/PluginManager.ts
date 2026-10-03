import { shallowReactive, shallowRef, markRaw, type Ref } from 'vue';
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
import type { PluginInitContext, PluginInitContextFactory } from '../platform/plugin/PluginInitContext.js';
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

    private readonly revision = shallowRef(0);
    /**
     * 插件条目对外可见性变化（暴露/撤销）时递增，供响应式消费者重新计算；只增不减。
     * 注意：延迟暴露期间 settings 已写入 registeredSettings，但版本号要等 expose() 时才递增。
     */
    public readonly registrationVersion: Readonly<Ref<number>> = this.revision;

    private readonly scopes = new Map<string, PluginRegistrationScope>();
    private readonly initializedPluginIds = new Set<string>();
    // 由 api 层注入（真实注册中心在 api/ 单例里，core/ 不反向依赖它们）。
    private initContextFactory: PluginInitContextFactory | null = null;
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

    /** 注入 init context 工厂；必须早于 initializeAllPlugins / registerAndInitialize。 */
    setInitContextFactory(factory: PluginInitContextFactory): void {
        this.initContextFactory = factory;
    }

    private createInitContext(pluginId: string): PluginInitContext {
        const scope = this.scopes.get(pluginId);
        if (!this.initContextFactory) {
            throw new Error(`[LuminaWeave PluginManager] init context factory is not configured (plugin: ${pluginId})`);
        }
        if (!scope) {
            throw new Error(`[LuminaWeave PluginManager] Plugin has no registration scope: ${pluginId}`);
        }
        return this.initContextFactory(pluginId, scope);
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
        return this.registerInternal(plugin, false)?.handle;
    }

    /**
     * deferExposure 仅供 registerAndInitialize 使用：平台 manifest 立即生效，
     * 旧入口（plugins / slots）封装成 expose，由调用方在 init 成功后调用。
     */
    private registerInternal(
        plugin: LuminaPlugin,
        deferExposure: boolean
    ): { handle: RegistrationHandle; expose: () => void } | undefined {
        if (!plugin.id) {
            console.error('[LuminaWeave PluginManager] Plugin must have an id.');
            return undefined;
        }

        const existing = this.plugins[plugin.id];
        const existingScope = this.scopes.get(plugin.id);
        if (existing) {
            // 只有同一对象的重复注册才拿回句柄；异对象同 id 不授予所有权。
            return existing === plugin && existingScope
                ? { handle: this.createHandle(plugin.id, existingScope), expose: () => undefined }
                : undefined;
        }
        // 延迟暴露的运行时插件在 init 期间没有 plugins 条目，但 scope 已占位。
        if (existingScope) {
            console.warn(`[LuminaWeave PluginManager] Plugin is still initializing, registration ignored: ${plugin.id}`);
            return undefined;
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
        const expose = (): void => {
            this.plugins[plugin.id] = plugin;
            scope.add(() => {
                if (this.plugins[plugin.id] === plugin) {
                    delete this.plugins[plugin.id];
                    this.revision.value += 1;
                }
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
            this.revision.value += 1;
        };
        try {
            if (plugin.platformManifest) {
                this.registerPlatformManifest(plugin.platformManifest, scope);
            }

            // 平台注册完整成功后才暴露旧插件入口，避免两套注册表状态分裂。
            if (!deferExposure) expose();

            if (plugin.settingsManifest) {
                this.setRegisteredSettings(plugin.id, plugin.settingsManifest, scope);
            }
        } catch (error) {
            scope.dispose();
            throw error;
        }

        this.scopes.set(plugin.id, scope);
        console.log(`[LuminaWeave PluginManager] Plugin registered: ${plugin.id}`);
        return { handle: this.createHandle(plugin.id, scope), expose };
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
     * init 内经 context 做的全局注册（Prompt/XML/Memory/Panel/事件）登记在插件作用域内，回滚时一并撤销；
     * 绕过 context 的全局注册不会回滚。插件在 init 成功后才对外可见（plugins / slots），init 期间不可见。
     */
    async registerAndInitialize(plugin: LuminaPlugin): Promise<RegistrationHandle> {
        if (!plugin.id) {
            throw new Error('[LuminaWeave PluginManager] Plugin must have an id.');
        }
        // scopes 在 init 期间就占位，能挡住尚未暴露的同 id 并发注册。
        if (this.plugins[plugin.id] || this.scopes.has(plugin.id)) {
            throw new Error(`[LuminaWeave PluginManager] Duplicate plugin id: ${plugin.id}`);
        }
        const registration = this.registerInternal(plugin, true);
        if (!registration) {
            throw new Error(`[LuminaWeave PluginManager] Failed to register plugin: ${plugin.id}`);
        }
        const { handle, expose } = registration;
        const scope = this.scopes.get(plugin.id);
        this.initializedPluginIds.add(plugin.id);
        try {
            const initializers = this.collectInitializers(plugin);
            if (initializers.length > 0) {
                const context = this.createInitContext(plugin.id);
                for (const init of initializers) {
                    await init(context);
                }
            }
        } catch (error) {
            handle.dispose(); // 带作用域校验，不会误卸载同 id 的新注册
            throw error;
        }
        if (!scope || scope.isDisposed) {
            throw new Error(`[LuminaWeave PluginManager] Plugin was unregistered during init: ${plugin.id}`);
        }
        expose();
        return handle;
    }

    private collectInitializers(plugin: LuminaPlugin): Array<(context: PluginInitContext) => void | Promise<void>> {
        // 旧的 LuminaPlugin.init 不接收参数，可直接赋给带 context 参数的签名；调用时多传的 context 会被忽略。
        return [
            plugin.init,
            plugin.platformManifest?.init
        ].filter((init, index, list): init is (context: PluginInitContext) => void | Promise<void> =>
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
                const initializers = this.collectInitializers(plugin);
                if (initializers.length === 0) return;
                let context: PluginInitContext;
                try {
                    context = this.createInitContext(plugin.id);
                } catch (e) {
                    console.error(`[LuminaWeave PluginManager] Failed to initialize plugin ${plugin.id}:`, e);
                    return;
                }
                for (const init of initializers) {
                    try {
                        console.log(`[LuminaWeave PluginManager] Initializing plugin: ${plugin.id}`);
                        await init(context);
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
