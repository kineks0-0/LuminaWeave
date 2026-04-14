import type {
    ForgeDraftNode,
    ForgeDraftTree,
    ForgeStructuredFieldState,
    ForgeStructuredFormState,
    ForgeStructuredState
} from '../../../types/ForgeStructuredTypes.js';
import type { ForgeMemoryEntry, ForgeMemoryTree } from '../../../types/ForgeMemoryTypes.js';

export const createEmptyStructuredState = (): ForgeStructuredState => ({
    activeFormId: null,
    forms: {},
    activeMessageFormId: null,
    lastUpdatedAt: Date.now()
});

export const createEmptyDraftTree = (): ForgeDraftTree => ({
    nodes: [],
    lastUpdatedAt: Date.now()
});

export const createEmptyForgeMemoryTree = (): ForgeMemoryTree => ({
    entries: [],
    lastUpdatedAt: Date.now()
});

const normalizeFieldValue = (value: unknown): string | string[] => {
    if (Array.isArray(value)) {
        return value.map(item => String(item ?? ''));
    }
    if (typeof value === 'string') {
        return value;
    }
    if (value == null) {
        return '';
    }
    return String(value);
};

const cloneStructuredFieldState = (field: Partial<ForgeStructuredFieldState> | undefined): ForgeStructuredFieldState => ({
    value: normalizeFieldValue(field?.value),
    locked: Boolean(field?.locked),
    confirmed: Boolean(field?.confirmed),
    source: field?.source || 'system',
    updatedAt: typeof field?.updatedAt === 'number' ? field.updatedAt : Date.now()
});

const cloneStructuredFormState = (formId: string, form: Partial<ForgeStructuredFormState> | undefined): ForgeStructuredFormState => ({
    id: form?.id || formId,
    layer: form?.layer || 'concept',
    title: form?.title || formId,
    fields: Object.entries(form?.fields || {}).reduce<Record<string, ForgeStructuredFieldState>>((acc, [fieldKey, fieldState]) => {
        acc[fieldKey] = cloneStructuredFieldState(fieldState);
        return acc;
    }, {}),
    missingFields: Array.isArray(form?.missingFields) ? form.missingFields.map(item => String(item)) : [],
    lastSubmittedAt: typeof form?.lastSubmittedAt === 'number' ? form.lastSubmittedAt : null
});

export const cloneStructuredState = (state?: Partial<ForgeStructuredState> | null): ForgeStructuredState => {
    const fallback = createEmptyStructuredState();

    return {
        activeFormId: typeof state?.activeFormId === 'string' ? state.activeFormId : null,
        activeMessageFormId: typeof state?.activeMessageFormId === 'string' ? state.activeMessageFormId : null,
        forms: Object.entries(state?.forms || {}).reduce<Record<string, ForgeStructuredFormState>>((acc, [formId, formState]) => {
            acc[formId] = cloneStructuredFormState(formId, formState);
            return acc;
        }, {}),
        lastUpdatedAt: typeof state?.lastUpdatedAt === 'number' ? state.lastUpdatedAt : fallback.lastUpdatedAt
    };
};

const cloneDraftNode = (node: Partial<ForgeDraftNode> | undefined): ForgeDraftNode => ({
    id: node?.id || '',
    title: node?.title || '',
    layer: node?.layer || 'concept',
    content: node?.content || '',
    status: node?.status || 'proposal',
    sourceMessageId: node?.sourceMessageId || null,
    sourceEntryId: node?.sourceEntryId || null,
    sourceTag: node?.sourceTag || null,
    sourceSessionId: node?.sourceSessionId || null,
    updatedAt: typeof node?.updatedAt === 'number' ? node.updatedAt : Date.now()
});

export const cloneDraftTree = (tree?: Partial<ForgeDraftTree> | null): ForgeDraftTree => {
    const fallback = createEmptyDraftTree();

    return {
        nodes: Array.isArray(tree?.nodes) ? tree.nodes.map(node => cloneDraftNode(node)) : [],
        lastUpdatedAt: typeof tree?.lastUpdatedAt === 'number' ? tree.lastUpdatedAt : fallback.lastUpdatedAt
    };
};

const cloneForgeMemoryEntry = (entry: Partial<ForgeMemoryEntry> | undefined): ForgeMemoryEntry => ({
    path: entry?.path || '',
    title: entry?.title || '',
    content: entry?.content || '',
    summary: entry?.summary || entry?.content || '',
    updatedAt: typeof entry?.updatedAt === 'number' ? entry.updatedAt : Date.now(),
    source: entry?.source || 'system'
});

export const cloneForgeMemoryTree = (tree?: Partial<ForgeMemoryTree> | null): ForgeMemoryTree => {
    const fallback = createEmptyForgeMemoryTree();

    return {
        entries: Array.isArray(tree?.entries) ? tree.entries.map(entry => cloneForgeMemoryEntry(entry)) : [],
        lastUpdatedAt: typeof tree?.lastUpdatedAt === 'number' ? tree.lastUpdatedAt : fallback.lastUpdatedAt
    };
};
