import { projectSurfaceInput } from '../platform/surface/surfaceInputProjection.js';
import { getPluginNavigationSlots } from '../platform/plugin/pluginNavigationSlots.js';
import type { ActivityDescriptor } from '../platform/activity/types.js';
import type { LuminaPlugin } from '../types/plugin.js';
import type {
    SurfaceInputProjectionEnvironment
} from '../platform/surface/surfaceInputProjection.js';
import type {
    SurfaceContractId,
    SurfaceInput
} from '../platform/surface/types.js';

export interface WorkspaceSurfaceProjection<K extends SurfaceContractId = SurfaceContractId> {
    contractId: K;
    rawInput: Readonly<Record<string, unknown>>;
    environment?: SurfaceInputProjectionEnvironment;
}

export interface CreateWorkspaceSurfaceOutletPropsInput<K extends SurfaceContractId>
    extends WorkspaceSurfaceProjection<K> {
    desktopModeId: string;
    isMobile: boolean;
    isCompact: boolean;
}

export interface WorkspaceSurfaceOutletProps<K extends SurfaceContractId> {
    contractId: K;
    input: SurfaceInput<K>;
    desktopModeId: string;
}

export interface WorkspacePluginCatalogEntry {
    id: string;
    pluginId: string;
    title: string;
    icon: string;
    contractId: SurfaceContractId;
    activity: ActivityDescriptor;
    kind: 'main' | 'widget';
}

const createDefaultActivity = (kind: WorkspacePluginCatalogEntry['kind']): ActivityDescriptor => (
    kind === 'widget'
        ? { size: 'small', pageType: 'nested' }
        : { size: 'default', pageType: 'nested' }
);

export const deriveWorkspacePluginCatalog = (
    plugins: readonly LuminaPlugin[]
): WorkspacePluginCatalogEntry[] => {
    const catalog: WorkspacePluginCatalogEntry[] = [];
    const visited = new Set<string>();

    plugins.forEach((plugin) => {
        if (visited.has(plugin.id)) return;
        visited.add(plugin.id);

        const contractId = plugin.platformManifest?.primarySurface;
        if (!contractId) return;

        const navigationSlots = getPluginNavigationSlots(plugin);
        const kinds: WorkspacePluginCatalogEntry['kind'][] = [];
        if (navigationSlots.includes('mainView')) kinds.push('main');
        if (navigationSlots.includes('widget')) kinds.push('widget');
        if (kinds.length === 0 && plugin.platformManifest?.activity) {
            kinds.push(plugin.platformManifest.activity.size === 'small' ? 'widget' : 'main');
        }

        kinds.forEach((kind) => {
            catalog.push({
                id: kind === 'widget' && kinds.includes('main')
                    ? `widget:${plugin.id}`
                    : `plugin:${plugin.id}`,
                pluginId: plugin.id,
                title: plugin.name,
                icon: plugin.icon,
                contractId,
                activity: plugin.platformManifest?.activity || createDefaultActivity(kind),
                kind
            });
        });
    });

    return catalog;
};

export const createWorkspaceSurfaceOutletProps = <K extends SurfaceContractId>(
    input: CreateWorkspaceSurfaceOutletPropsInput<K>
): WorkspaceSurfaceOutletProps<K> => ({
    contractId: input.contractId,
    input: projectSurfaceInput(input.contractId, input.rawInput, {
        ...input.environment,
        isMobile: input.isMobile || input.isCompact,
        workspaceCompact: input.isCompact
    }),
    desktopModeId: input.desktopModeId
});
