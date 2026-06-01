import type { DesktopModeManifest } from '../core/types.js';
import { classicDesktopMode } from './classic/manifest.js';
import { discordDesktopMode } from './discord/manifest.js';
import { stageDesktopMode } from './stage/manifest.js';
import { telegramDesktopMode } from './telegram/manifest.js';

export const builtinDesktopModes: DesktopModeManifest[] = [
    classicDesktopMode,
    stageDesktopMode,
    telegramDesktopMode,
    discordDesktopMode,
];
