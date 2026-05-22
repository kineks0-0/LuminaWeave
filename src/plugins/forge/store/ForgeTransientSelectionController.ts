import type { ForgeStructuredState } from '../../../types/ForgeStructuredTypes.js';

type TransientValue = string | string[];

export interface ForgeTransientSelectionControllerDeps {
    getStructuredState(): ForgeStructuredState;
    persistWorkspaceSession(): void | Promise<void>;
    now?: () => number;
}

export class ForgeTransientSelectionController {
    private readonly selections = new Map<string, Map<string, TransientValue>>();
    private readonly now: () => number;

    constructor(private readonly deps: ForgeTransientSelectionControllerDeps) {
        this.now = deps.now ?? (() => Date.now());
    }

    upsertTransientSelection(key: string, value: TransientValue, scopeId?: string | null): void {
        const normalizedScopeId = this.normalizeScopeId(scopeId);
        this.ensureScope(normalizedScopeId).set(key, value);
        const state = this.deps.getStructuredState();
        delete state.submittedScopes[normalizedScopeId];
        state.lastUpdatedAt = this.now();
    }

    getTransientSelections(scopeId?: string | null): Map<string, TransientValue> {
        return this.selections.get(this.normalizeScopeId(scopeId)) || new Map();
    }

    getTransientFieldText(scopeId: string | null | undefined, fieldKey: string): string {
        const value = this.getTransientSelections(scopeId).get(fieldKey);
        if (value === undefined) return '';
        return Array.isArray(value) ? value.join(', ') : String(value || '');
    }

    getTransientFieldList(scopeId: string | null | undefined, fieldKey: string): string[] {
        const value = this.getTransientSelections(scopeId).get(fieldKey);
        if (value === undefined) return [];
        return Array.isArray(value) ? value : (value ? [String(value)] : []);
    }

    clearTransientSelections(scopeId?: string | null): void {
        this.selections.delete(this.normalizeScopeId(scopeId));
    }

    hasPendingTransientSelections(scopeId?: string | null): boolean {
        return this.getTransientSelections(scopeId).size > 0;
    }

    rememberSubmitConfig(scopeId: string, label?: string | null): void {
        const normalizedScopeId = this.normalizeScopeId(scopeId);
        const normalizedLabel = String(label || '').trim();
        if (!normalizedLabel) return;
        const state = this.deps.getStructuredState();
        const existing = state.submitConfigs[normalizedScopeId];
        if (existing?.label === normalizedLabel) return;
        state.submitConfigs[normalizedScopeId] = {
            label: normalizedLabel,
            updatedAt: this.now()
        };
        state.lastUpdatedAt = this.now();
        void this.deps.persistWorkspaceSession();
    }

    resolveSubmitLabel(scopeId: string, fallbackLabel = '提交并继续'): string {
        const state = this.deps.getStructuredState();
        return state.submitConfigs[this.normalizeScopeId(scopeId)]?.label || fallbackLabel;
    }

    markScopeSubmitted(scopeId: string): void {
        const state = this.deps.getStructuredState();
        state.submittedScopes[this.normalizeScopeId(scopeId)] = this.now();
        state.lastUpdatedAt = this.now();
        void this.deps.persistWorkspaceSession();
    }

    isScopeSubmitted(scopeId: string): boolean {
        const state = this.deps.getStructuredState();
        return Boolean(state.submittedScopes[this.normalizeScopeId(scopeId)]);
    }

    private normalizeScopeId(scopeId?: string | null): string {
        const normalized = String(scopeId || '').trim();
        return normalized || '__legacy__';
    }

    private ensureScope(scopeId?: string | null): Map<string, TransientValue> {
        const normalizedScopeId = this.normalizeScopeId(scopeId);
        const existing = this.selections.get(normalizedScopeId);
        if (existing) return existing;
        const nextScope = new Map<string, TransientValue>();
        this.selections.set(normalizedScopeId, nextScope);
        return nextScope;
    }
}
