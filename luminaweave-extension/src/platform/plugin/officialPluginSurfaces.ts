import type { SurfaceContractId } from '../surface/types.js';

const PRIMARY_PLUGIN_SURFACES: Record<string, SurfaceContractId> = {
    'lumina-chat': 'chat.main',
    'lumina-settings': 'settings.root',
    'lumina-timeline': 'timeline.navigator',
    'lumina-stats': 'stats.panel',
    'lumina-director': 'director.panel',
    'lumina-lorebook': 'lorebook.workspace',
    'lumina-forge': 'forge.workspace',
    'lumina-launcher': 'launcher.root',
    'lumina-dev': 'dev.tools',
    'lumina-terminal': 'terminal.root'
};

export const getPrimarySurfaceContractIdForPlugin = (pluginId: string): SurfaceContractId =>
    PRIMARY_PLUGIN_SURFACES[pluginId] || pluginId;
