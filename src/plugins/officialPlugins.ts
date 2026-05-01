import ChatPlugin from './chat';
import TimelinePlugin from './timeline';
import StatsPlugin from './stats';
import SettingsPlugin from './settings';
import LorebookPlugin from './lorebook';
import { DirectorPlugin } from './director';
import LauncherPlugin from './launcher';
import DevPlugin from './dev';
import ForgePlugin from './forge';
import type { LuminaPlugin } from '../types/plugin';

export const officialPlugins: LuminaPlugin[] = [
    ChatPlugin,
    TimelinePlugin,
    StatsPlugin,
    SettingsPlugin,
    LorebookPlugin,
    DirectorPlugin,
    LauncherPlugin,
    DevPlugin,
    ForgePlugin
];
