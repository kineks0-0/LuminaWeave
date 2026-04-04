import { shallowReactive, markRaw } from 'vue';
import { LuminaPlugin, SettingDefinition } from '../types/plugin';
import { lwStorage } from '../api/storage';

class PluginManager {
    public plugins: Record<string, LuminaPlugin> = shallowReactive({});
    public slots: Record<string, LuminaPlugin[]> = shallowReactive({
        mainView: [],
        widget: [],
        headerExtension: [],
        headerCenter: [],
        headerRight: []
    });

    public registeredSettings: Record<string, Record<string, SettingDefinition>> = shallowReactive({});

    constructor() {
        console.log('[LuminaWeave PluginManager] Initialized');
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

        // Create a plain object for the plugin registry
        this.plugins[plugin.id] = plugin;

        if (plugin.slots) {
            plugin.slots.forEach(slot => {
                if (this.slots[slot]) {
                    this.slots[slot].push(plugin);
                } else {
                    console.warn(`[LuminaWeave PluginManager] Slot ${slot} does not exist`);
                }
            });
        }

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
            if (typeof plugin.init === 'function') {
                try {
                    console.log(`[LuminaWeave PluginManager] Initializing plugin: ${plugin.id}`);
                    await (plugin.init as any)();
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
