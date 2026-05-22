import ChatPlugin from './chat';
import TimelinePlugin from './timeline';
import StatsPlugin from './stats';
import SettingsPlugin from './settings';
import LorebookPlugin from './lorebook';
import { DirectorPlugin } from './director';
import LauncherPlugin from './launcher';
import DevPlugin from './dev';
import ForgePlugin from './forge';
import TerminalPlugin from './terminal';
import type { LuminaPlugin } from '../types/plugin.js';

export const officialPlugins: LuminaPlugin[] = [
    ChatPlugin,
    TimelinePlugin,
    StatsPlugin,
    SettingsPlugin,
    LorebookPlugin,
    DirectorPlugin,
    LauncherPlugin,
    DevPlugin,
    TerminalPlugin,
    ForgePlugin
];
