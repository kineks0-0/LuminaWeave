import { pluginManager } from '../core/PluginManager.js';
import { officialPlugins } from '../plugins/officialPlugins.js';
import { initializeDesktopModeRuntime } from '../platform/desktop-mode-runtime/initializeDesktopModeRuntime.js';
import { initializeSurfaceRuntime } from '../platform/surface/initializeSurfaceRuntime.js';

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
