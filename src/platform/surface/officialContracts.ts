import type { SurfaceContractId } from './types.js';

export const OFFICIAL_SURFACE_CONTRACTS = [
    'chat.main',
    'chat.preview',
    'chat.composer',
    'settings.root',
    'settings.control',
    'forge.workspace',
    'timeline.navigator',
    'stats.panel',
    'director.panel',
    'lorebook.workspace',
    'forge.settings.summary',
    'forge.settings.workbench',
    'launcher.root',
    'dev.tools',
    'terminal.root',
    'telegram.infoPanel'
] as const satisfies readonly SurfaceContractId[];

export type OfficialSurfaceContractId = typeof OFFICIAL_SURFACE_CONTRACTS[number];
