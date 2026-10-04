import { lwStorage, type StorageScope } from '../../../storage.js';
import type { PromptSourceSelection, ResourceDiagnostic, ResourceRef, ResourceType } from '@shared/resources/index.js';

export type PromptResourceBindingOwnerKind = 'session' | 'prompt-preset' | 'forge-workspace' | 'global';

export interface PromptResourceBindingOwner {
    kind: PromptResourceBindingOwnerKind;
    id: string;
}

export interface PromptResourceBindingDocument {
    owner: PromptResourceBindingOwner;
    refs: ResourceRef[];
    sourceSelection?: PromptSourceSelection;
    updatedAt: number;
}

export interface PromptResourceBindingResolution {
    owner: PromptResourceBindingOwner;
    refs: ResourceRef[];
    enabledRefs: ResourceRef[];
    excludedRefs: ResourceRef[];
    sourceSelection?: PromptSourceSelection;
}

const STORAGE_KEY = 'lumina.resources.bindings';

const ownerKey = (owner: PromptResourceBindingOwner): string => `${owner.kind}:${owner.id}`;
const promptPresetOwnerId = (profileId: string, presetId: string): string => `${profileId}/${presetId}`;

const cloneRef = (ref: ResourceRef): ResourceRef => ({
    ...ref,
    forkedFrom: ref.forkedFrom ? cloneRef(ref.forkedFrom) : ref.forkedFrom
});

const cloneDocument = (document: PromptResourceBindingDocument): PromptResourceBindingDocument => ({
    owner: { ...document.owner },
    refs: document.refs.map(cloneRef),
    sourceSelection: document.sourceSelection ? cloneSourceSelection(document.sourceSelection) : undefined,
    updatedAt: document.updatedAt
});

const cloneSourceSelection = (selection: PromptSourceSelection): PromptSourceSelection => ({
    history: selection.history ? { ...selection.history } : undefined,
    memory: selection.memory ? { ...selection.memory } : undefined,
    worldbook: selection.worldbook ? {
        ...selection.worldbook,
        includedRefs: selection.worldbook.includedRefs?.map(cloneRef),
        excludedRefs: selection.worldbook.excludedRefs?.map(cloneRef)
    } : undefined,
    examples: selection.examples ? { ...selection.examples } : undefined
});

const normalizeMap = (value: unknown): Record<string, PromptResourceBindingDocument> =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, PromptResourceBindingDocument>
        : {};

export class PromptResourceBindingService {
    constructor(private readonly scope: StorageScope = 'Global') {}

    static sessionOwner(sessionId: string): PromptResourceBindingOwner {
        return { kind: 'session', id: sessionId };
    }

    /** 全局世界书启用列表：对所有会话生效。 */
    static globalOwner(): PromptResourceBindingOwner {
        return { kind: 'global', id: 'worldbooks' };
    }

    static promptPresetOwner(profileId: string, presetId: string): PromptResourceBindingOwner {
        return { kind: 'prompt-preset', id: promptPresetOwnerId(profileId, presetId) };
    }

    static forgeWorkspaceOwner(workspaceId: string): PromptResourceBindingOwner {
        return { kind: 'forge-workspace', id: workspaceId };
    }

    /** 按来源顺序合并世界书 ref 并去重（全局在前、会话在后），只保留 worldbook 类型。 */
    static mergeWorldbookRefs(...sources: ResourceRef[][]): ResourceRef[] {
        const seen = new Set<string>();
        const merged: ResourceRef[] = [];
        for (const refs of sources) {
            for (const ref of refs) {
                if (ref.resourceType !== 'worldbook') continue;
                const key = `${ref.sourceId}:${ref.resourceType}:${ref.resourceId}`;
                if (seen.has(key)) continue;
                seen.add(key);
                merged.push(ref);
            }
        }
        return merged;
    }

    static createSourceSelectionDiagnostics(excludedRefs: ResourceRef[] = []): ResourceDiagnostic[] {
        return excludedRefs.map(ref => ({
            level: 'info',
            code: 'PROMPT_RESOURCE_EXCLUDED_BY_SOURCE_SELECTION',
            message: `Prompt resource excluded by source selection: ${ref.path}`
        }));
    }

    listBindings(): PromptResourceBindingDocument[] {
        const map = this.readMap();
        return Object.values(map).map(cloneDocument);
    }

    getBindings(owner: PromptResourceBindingOwner): ResourceRef[] {
        const document = this.readMap()[ownerKey(owner)];
        return document ? document.refs.map(cloneRef) : [];
    }

    getDocument(owner: PromptResourceBindingOwner): PromptResourceBindingDocument | null {
        const document = this.readMap()[ownerKey(owner)];
        return document ? cloneDocument(document) : null;
    }

    getSourceSelection(owner: PromptResourceBindingOwner): PromptSourceSelection | undefined {
        const document = this.readMap()[ownerKey(owner)];
        return document?.sourceSelection ? cloneSourceSelection(document.sourceSelection) : undefined;
    }

    setBindings(owner: PromptResourceBindingOwner, refs: ResourceRef[]): PromptResourceBindingDocument {
        const map = this.readMap();
        const existing = map[ownerKey(owner)];
        const document: PromptResourceBindingDocument = {
            owner: { ...owner },
            refs: this.dedupeRefs(refs).map(cloneRef),
            sourceSelection: existing?.sourceSelection ? cloneSourceSelection(existing.sourceSelection) : undefined,
            updatedAt: Date.now()
        };
        map[ownerKey(owner)] = document;
        void lwStorage.set(STORAGE_KEY, map, this.scope);
        return cloneDocument(document);
    }

    migrateForgeWorkspaceOwner(oldWorkspaceId: string, newProjectId: string): PromptResourceBindingDocument | null {
        const oldId = oldWorkspaceId.trim();
        const newId = newProjectId.trim();
        if (!oldId || !newId || oldId === newId) return null;

        const oldOwner = PromptResourceBindingService.forgeWorkspaceOwner(oldId);
        const newOwner = PromptResourceBindingService.forgeWorkspaceOwner(newId);
        const map = this.readMap();
        const oldDocument = map[ownerKey(oldOwner)];
        if (!oldDocument) return null;

        const existingNew = map[ownerKey(newOwner)];
        const mergedRefs = this.dedupeRefs([
            ...(existingNew?.refs ?? []),
            ...oldDocument.refs
        ]).map(cloneRef);
        const document: PromptResourceBindingDocument = {
            owner: newOwner,
            refs: mergedRefs,
            sourceSelection: existingNew?.sourceSelection
                ? cloneSourceSelection(existingNew.sourceSelection)
                : oldDocument.sourceSelection
                    ? cloneSourceSelection(oldDocument.sourceSelection)
                    : undefined,
            updatedAt: Date.now()
        };
        map[ownerKey(newOwner)] = document;
        delete map[ownerKey(oldOwner)];
        void lwStorage.set(STORAGE_KEY, map, this.scope);
        return cloneDocument(document);
    }

    setSourceSelection(owner: PromptResourceBindingOwner, sourceSelection: PromptSourceSelection | undefined): PromptResourceBindingDocument {
        const map = this.readMap();
        const existing = map[ownerKey(owner)];
        const document: PromptResourceBindingDocument = {
            owner: { ...owner },
            refs: existing?.refs ? existing.refs.map(cloneRef) : [],
            sourceSelection: sourceSelection ? cloneSourceSelection(sourceSelection) : undefined,
            updatedAt: Date.now()
        };
        map[ownerKey(owner)] = document;
        void lwStorage.set(STORAGE_KEY, map, this.scope);
        return cloneDocument(document);
    }

    setWorldbookEnabled(owner: PromptResourceBindingOwner, enabled: boolean): PromptResourceBindingDocument {
        const selection = this.getSourceSelection(owner) ?? {};
        return this.setSourceSelection(owner, {
            ...selection,
            worldbook: {
                ...selection.worldbook,
                enabled
            }
        });
    }

    includeWorldbook(owner: PromptResourceBindingOwner, ref: ResourceRef): PromptResourceBindingDocument {
        return this.setWorldbookRefSelection(owner, ref, 'include');
    }

    excludeWorldbook(owner: PromptResourceBindingOwner, ref: ResourceRef): PromptResourceBindingDocument {
        return this.setWorldbookRefSelection(owner, ref, 'exclude');
    }

    clearWorldbookRefSelection(owner: PromptResourceBindingOwner, ref: ResourceRef): PromptResourceBindingDocument {
        return this.setWorldbookRefSelection(owner, ref, 'clear');
    }

    getEnabledBindings(owner: PromptResourceBindingOwner): ResourceRef[] {
        return this.resolveBindings(owner).enabledRefs;
    }

    resolveBindings(owner: PromptResourceBindingOwner): PromptResourceBindingResolution {
        const document = this.getDocument(owner);
        if (!document) {
            return {
                owner: { ...owner },
                refs: [],
                enabledRefs: [],
                excludedRefs: []
            };
        }

        const excluded = new Set((document.sourceSelection?.worldbook?.excludedRefs ?? []).map(this.refKey));
        const included = new Set((document.sourceSelection?.worldbook?.includedRefs ?? []).map(this.refKey));
        const enabledRefs: ResourceRef[] = [];
        const excludedRefs: ResourceRef[] = [];

        for (const ref of document.refs) {
            const shouldEnable = ref.resourceType !== 'worldbook'
                ? true
                : document.sourceSelection?.worldbook?.enabled === false
                    ? included.has(this.refKey(ref))
                    : !excluded.has(this.refKey(ref));
            if (shouldEnable) {
                enabledRefs.push(cloneRef(ref));
            } else {
                excludedRefs.push(cloneRef(ref));
            }
        }

        return {
            owner: { ...document.owner },
            refs: document.refs.map(cloneRef),
            enabledRefs,
            excludedRefs,
            sourceSelection: document.sourceSelection ? cloneSourceSelection(document.sourceSelection) : undefined
        };
    }

    addBinding(owner: PromptResourceBindingOwner, ref: ResourceRef): PromptResourceBindingDocument {
        return this.setBindings(owner, [...this.getBindings(owner), ref]);
    }

    removeBinding(owner: PromptResourceBindingOwner, predicate: Partial<Pick<ResourceRef, 'sourceId' | 'resourceType' | 'resourceId'>>): PromptResourceBindingDocument {
        const refs = this.getBindings(owner).filter(ref => {
            if (predicate.sourceId && ref.sourceId !== predicate.sourceId) return true;
            if (predicate.resourceType && ref.resourceType !== predicate.resourceType) return true;
            if (predicate.resourceId && ref.resourceId !== predicate.resourceId) return true;
            return false;
        });
        return this.setBindings(owner, refs);
    }

    getPromptPresetBindings(profileId: string, presetId: string): ResourceRef[] {
        return this.getBindings(PromptResourceBindingService.promptPresetOwner(profileId, presetId));
    }

    setPromptPresetBindings(profileId: string, presetId: string, refs: ResourceRef[]): PromptResourceBindingDocument {
        return this.setBindings(PromptResourceBindingService.promptPresetOwner(profileId, presetId), refs);
    }

    getByType(owner: PromptResourceBindingOwner, resourceType: ResourceType): ResourceRef[] {
        return this.getBindings(owner).filter(ref => ref.resourceType === resourceType);
    }

    private readMap(): Record<string, PromptResourceBindingDocument> {
        return { ...normalizeMap(lwStorage.get(STORAGE_KEY, {}, this.scope)) };
    }

    private dedupeRefs(refs: ResourceRef[]): ResourceRef[] {
        const map = new Map<string, ResourceRef>();
        refs.forEach(ref => {
            map.set(this.refKey(ref), ref);
        });
        return Array.from(map.values());
    }

    private setWorldbookRefSelection(
        owner: PromptResourceBindingOwner,
        ref: ResourceRef,
        mode: 'include' | 'exclude' | 'clear'
    ): PromptResourceBindingDocument {
        if (ref.resourceType !== 'worldbook') {
            throw new Error(`Worldbook source selection only accepts worldbook refs: ${ref.path}`);
        }
        const selection = this.getSourceSelection(owner) ?? {};
        const includedRefs = this.removeRef(selection.worldbook?.includedRefs ?? [], ref);
        const excludedRefs = this.removeRef(selection.worldbook?.excludedRefs ?? [], ref);
        if (mode === 'include') includedRefs.push(cloneRef(ref));
        if (mode === 'exclude') excludedRefs.push(cloneRef(ref));
        return this.setSourceSelection(owner, {
            ...selection,
            worldbook: {
                ...selection.worldbook,
                includedRefs,
                excludedRefs
            }
        });
    }

    private removeRef(refs: ResourceRef[], ref: ResourceRef): ResourceRef[] {
        const key = this.refKey(ref);
        return refs.filter(item => this.refKey(item) !== key).map(cloneRef);
    }

    private refKey(ref: ResourceRef): string {
        return `${ref.sourceId}:${ref.resourceType}:${ref.resourceId}`;
    }
}

export const promptResourceBindingService = new PromptResourceBindingService();
