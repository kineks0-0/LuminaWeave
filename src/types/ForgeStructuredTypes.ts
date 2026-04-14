export type ForgeEntryMode = 'structured' | 'freeform';

export type ForgeStage =
    | 'kickoff'
    | 'skeleton'
    | 'narrative'
    | 'expansion'
    | 'rewrite_export';

export type ForgeDetailMode = 'detailed' | 'quick';

export type ForgeLayer =
    | 'concept'
    | 'entity'
    | 'state_machine'
    | 'description'
    | 'variables'
    | 'summary'
    | 'output';

export type ForgeFieldSource = 'manual' | 'seed' | 'freeform' | 'system';

export interface ForgeStructuredFieldState {
    value: string | string[];
    locked: boolean;
    confirmed: boolean;
    source: ForgeFieldSource;
    updatedAt: number;
}

export interface ForgeStructuredFormState {
    id: string;
    layer: ForgeLayer;
    title: string;
    fields: Record<string, ForgeStructuredFieldState>;
    missingFields: string[];
    lastSubmittedAt: number | null;
}

export interface ForgeStructuredState {
    activeFormId: string | null;
    forms: Record<string, ForgeStructuredFormState>;
    activeMessageFormId: string | null;
    lastUpdatedAt: number;
}

export type ForgeDraftNodeStatus =
    | 'proposal'
    | 'approved_for_workspace'
    | 'publish_candidate';

export interface ForgeDraftNode {
    id: string;
    title: string;
    layer: ForgeLayer;
    content: string;
    status: ForgeDraftNodeStatus;
    sourceMessageId: string | null;
    sourceEntryId: string | null;
    sourceTag: string | null;
    sourceSessionId: string | null;
    updatedAt: number;
}

export interface ForgeDraftTree {
    nodes: ForgeDraftNode[];
    lastUpdatedAt: number;
}
