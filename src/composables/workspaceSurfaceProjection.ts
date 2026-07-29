import { projectSurfaceInput } from '../platform/surface/surfaceInputProjection.js';
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
