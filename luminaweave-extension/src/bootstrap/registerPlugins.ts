import ChatPlugin from '../plugins/chat';
import TimelinePlugin from '../plugins/timeline';
import StatsPlugin from '../plugins/stats';
import SettingsPlugin from '../plugins/settings';
import LorebookPlugin from '../plugins/lorebook';
import { DirectorPlugin } from '../plugins/director';
import LauncherPlugin from '../plugins/launcher';
import DevPlugin from '../plugins/dev';
import ForgePlugin from '../plugins/forge';
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
        LauncherPlugin,
        DevPlugin,
        ForgePlugin
    ].forEach(plugin => {
        pluginManager.register(plugin);
    });

    hasRegisteredPlugins = true;
};
