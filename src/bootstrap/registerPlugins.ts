import { pluginManager } from '../core/PluginManager';
import { officialPlugins } from '../plugins/officialPlugins';
import { initializeDesktopModeRuntime } from '../platform/desktop/initializeDesktopModeRuntime';
import { initializeSurfaceRuntime } from '../platform/surface/initializeSurfaceRuntime';

let hasRegisteredPlugins = false;

export const registerLuminaPlugins = () => {
    if (hasRegisteredPlugins) return;

    initializeSurfaceRuntime();
    initializeDesktopModeRuntime();

    officialPlugins.forEach(plugin => {
        pluginManager.register(plugin);
    });

    hasRegisteredPlugins = true;
};
