import ChatPlugin from '../plugins/chat';
import TimelinePlugin from '../plugins/timeline';
import StatsPlugin from '../plugins/stats';
import SettingsPlugin from '../plugins/settings';
import LorebookPlugin from '../plugins/lorebook';
import { DirectorPlugin } from '../plugins/director';
import { MemoryPlugin } from '../plugins/memory';
import LauncherPlugin from '../plugins/launcher';
import { pluginManager } from '../core/PluginManager';

let hasRegisteredPlugins = false;

export const registerLuminaPlugins = () => {
    if (hasRegisteredPlugins) return;

    [
        ChatPlugin,
        TimelinePlugin,
        StatsPlugin,
        SettingsPlugin,
        LorebookPlugin,
        DirectorPlugin,
        MemoryPlugin,
        LauncherPlugin
    ].forEach(plugin => {
        pluginManager.register(plugin);
    });

    hasRegisteredPlugins = true;
};
