import type { SurfaceContractId } from '../surface/types';

const REGISTERED_PANEL_SURFACE_CONTRACTS: Record<string, SurfaceContractId> = {
    card_maker: 'forge.workspace'
};

export const getSurfaceContractIdForRegisteredPanel = (panelId: string): SurfaceContractId | null =>
    REGISTERED_PANEL_SURFACE_CONTRACTS[panelId] ?? null;
