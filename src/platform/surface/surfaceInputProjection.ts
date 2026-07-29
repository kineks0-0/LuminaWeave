import type { ActivityDescriptor } from '../activity/types.js';
import type { SurfaceContractId, SurfaceInput } from './types.js';
import { OFFICIAL_SURFACE_CONTRACTS } from './officialContracts.js';

export interface SurfaceInputProjectionEnvironment {
    activity?: ActivityDescriptor;
    isMobile?: boolean;
    workspaceCompact?: boolean;
    embeddedInWorkspaceWindow?: boolean;
    auxSidebarMode?: 'left' | 'right' | 'widget' | 'hidden';
    activeRightPanelId?: string;
}

const OFFICIAL_SURFACE_CONTRACT_IDS = new Set<SurfaceContractId>(OFFICIAL_SURFACE_CONTRACTS);

const withDefined = (
    input: Record<string, unknown>,
    key: string,
    value: unknown
): Record<string, unknown> => (
    value === undefined ? input : { ...input, [key]: value }
);

const withoutKeys = (
    input: Readonly<Record<string, unknown>>,
    keys: readonly string[]
): Record<string, unknown> => {
    const result = { ...input };
    keys.forEach(key => {
        delete result[key];
    });
    return result;
};

/**
 * Shell 只向官方 contract 注入其明确声明的环境字段；第三方 input 完全由调用方提供。
 */
export const projectSurfaceInput = <K extends SurfaceContractId>(
    contractId: K,
    rawInput: Readonly<Record<string, unknown>>,
    environment: SurfaceInputProjectionEnvironment = {}
): SurfaceInput<K> => {
    if (!OFFICIAL_SURFACE_CONTRACT_IDS.has(contractId)) {
        return rawInput as SurfaceInput<K>;
    }

    const explicitInput = withoutKeys(rawInput, ['isTabMode', 'isTemporaryWidgetTab']);

    let projectedInput = explicitInput;
    if (contractId === 'chat.main') {
        projectedInput = withoutKeys(projectedInput, [
            'activity',
            'embeddedInWorkspaceWindow',
            'auxSidebarMode',
            'activeRightPanelId'
        ]);
        projectedInput = withDefined(projectedInput, 'isMobile', environment.isMobile);
        projectedInput = withDefined(projectedInput, 'workspaceCompact', environment.workspaceCompact);
    } else if (contractId === 'settings.root') {
        projectedInput = withoutKeys(projectedInput, [
            'isMobile',
            'workspaceCompact',
            'embeddedInWorkspaceWindow',
            'auxSidebarMode',
            'activeRightPanelId'
        ]);
        projectedInput = withDefined(projectedInput, 'activity', environment.activity);
    } else if (contractId === 'forge.workspace') {
        projectedInput = withDefined(projectedInput, 'activity', environment.activity);
        projectedInput = withDefined(projectedInput, 'isMobile', environment.isMobile);
        projectedInput = withDefined(projectedInput, 'workspaceCompact', environment.workspaceCompact);
        projectedInput = withDefined(
            projectedInput,
            'embeddedInWorkspaceWindow',
            environment.embeddedInWorkspaceWindow
        );
        projectedInput = withDefined(projectedInput, 'auxSidebarMode', environment.auxSidebarMode);
        projectedInput = withDefined(projectedInput, 'activeRightPanelId', environment.activeRightPanelId);
    } else if (
        contractId === 'timeline.navigator'
        || contractId === 'stats.panel'
        || contractId === 'director.panel'
        || contractId === 'lorebook.workspace'
    ) {
        projectedInput = withoutKeys(projectedInput, [
            'workspaceCompact',
            'embeddedInWorkspaceWindow',
            'auxSidebarMode',
            'activeRightPanelId'
        ]);
        projectedInput = withDefined(projectedInput, 'activity', environment.activity);
        projectedInput = withDefined(projectedInput, 'isMobile', environment.isMobile);
    } else if (contractId === 'telegram.infoPanel') {
        projectedInput = withoutKeys(projectedInput, [
            'activity',
            'workspaceCompact',
            'embeddedInWorkspaceWindow',
            'auxSidebarMode',
            'activeRightPanelId'
        ]);
        projectedInput = withDefined(projectedInput, 'isMobile', environment.isMobile);
    } else {
        projectedInput = withoutKeys(projectedInput, [
            'activity',
            'isMobile',
            'workspaceCompact',
            'embeddedInWorkspaceWindow',
            'auxSidebarMode',
            'activeRightPanelId'
        ]);
    }

    // 动态 contract 关联在运行时由对应 Zod schema 再次校验，此处只收敛投影位置。
    return projectedInput as SurfaceInput<K>;
};
