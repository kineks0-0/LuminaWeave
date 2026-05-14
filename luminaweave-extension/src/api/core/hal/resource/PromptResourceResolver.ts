import {
    worldbookEntriesToLorebookEntries,
    type ResourceDiagnostic,
    type ResourceDocument,
    type ResourceRef
} from '@shared/resources/index.js';
import type { PromptPresetCharCard } from '../../../../types/PromptPresetTypes.js';
import type { ResourceService } from './ResourceService.js';

export interface PromptResourceBundle {
    refs: ResourceRef[];
    documents: ResourceDocument[];
    lorebookEntries: LuminaLorebookEntry[];
    charCard: PromptPresetCharCard | null;
    presetRaw: Record<string, unknown> | null;
    diagnostics: ResourceDiagnostic[];
}

export type STPromptResourceAction = 'passthrough' | 'blocked' | 'virtual_worldbook' | 'macro_injection';

export interface STPromptResourceDecision {
    ref: ResourceRef;
    action: STPromptResourceAction;
    reason: string;
}

export interface STPromptResourceResolution {
    passthroughRefs: ResourceRef[];
    blockedRefs: ResourceRef[];
    decisions: STPromptResourceDecision[];
    diagnostics: ResourceDiagnostic[];
}

export interface PromptResourceLorebookEntry extends LuminaLorebookEntry {
    resourceRef: ResourceRef;
    sourceId: string;
    resourceId: string;
    sourcePath: string;
}

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

const toCharCard = (raw: unknown): PromptPresetCharCard | null => {
    const root = asRecord(raw);
    const data = asRecord(root.data);
    const source = Object.keys(data).length > 0 ? data : root;
    const name = typeof source.name === 'string' ? source.name : typeof root.name === 'string' ? root.name : '';
    const hasUseful = ['description', 'personality', 'scenario', 'system_prompt', 'systemPrompt']
        .some(key => typeof source[key] === 'string' && String(source[key]).trim());
    if (!name && !hasUseful) return null;
    return {
        name,
        description: typeof source.description === 'string' ? source.description : '',
        personality: typeof source.personality === 'string' ? source.personality : '',
        scenario: typeof source.scenario === 'string' ? source.scenario : '',
        systemPrompt: typeof source.system_prompt === 'string'
            ? source.system_prompt
            : typeof source.systemPrompt === 'string' ? source.systemPrompt : ''
    };
};

export class PromptResourceResolver {
    constructor(private readonly resourceService: ResourceService) {}

    async resolve(refs: ResourceRef[] = []): Promise<PromptResourceBundle> {
        const documents: ResourceDocument[] = [];
        const diagnostics: ResourceDiagnostic[] = [];

        for (const ref of refs) {
            const document = await this.resourceService.getResource(ref);
            if (!document) {
                diagnostics.push({
                    level: 'warning',
                    code: 'PROMPT_RESOURCE_NOT_FOUND',
                    message: `Prompt resource not found: ${ref.path}`
                });
                continue;
            }
            documents.push(document);
        }

        const lorebookEntries = documents
            .filter(document => document.ref.resourceType === 'worldbook')
            .flatMap(document => worldbookEntriesToLorebookEntries(document.raw).map(entry => ({
                ...entry,
                resourceRef: document.ref,
                sourceId: document.ref.sourceId,
                resourceId: document.ref.resourceId,
                sourcePath: document.ref.path
            } satisfies PromptResourceLorebookEntry)));

        const charDocument = documents.find(document => document.ref.resourceType === 'character');
        const presetDocument = documents.find(document => document.ref.resourceType === 'preset');

        return {
            refs,
            documents,
            lorebookEntries,
            charCard: charDocument ? toCharCard(charDocument.raw) : null,
            presetRaw: presetDocument ? asRecord(presetDocument.raw) : null,
            diagnostics
        };
    }

    static resolveSTEngineResources(refs: ResourceRef[] = []): STPromptResourceResolution {
        const decisions = refs.map(ref => {
            if (ref.sourceId === 'st') {
                return {
                    ref,
                    action: 'passthrough' as const,
                    reason: 'ST prompt engine can use ST-owned resources through the native preset/world info path.'
                };
            }

            return {
                ref,
                action: 'blocked' as const,
                reason: 'First phase does not silently inject non-ST resources into the ST prompt engine. Use Lumina composition, fork/import into ST, or a future virtual worldbook/macro bridge.'
            };
        });
        const blockedRefs = decisions
            .filter(decision => decision.action === 'blocked')
            .map(decision => decision.ref);

        return {
            passthroughRefs: decisions
                .filter(decision => decision.action === 'passthrough')
                .map(decision => decision.ref),
            blockedRefs,
            decisions,
            diagnostics: blockedRefs.map(ref => ({
                level: 'warning' as const,
                code: 'ST_ENGINE_NON_ST_RESOURCE_BLOCKED',
                message: `ST prompt engine cannot directly consume non-ST resource "${ref.path}". Current policy blocks it instead of silently injecting it; use Lumina composition or fork/import it into ST.`
            }))
        };
    }

    static createSTEngineDiagnostics(refs: ResourceRef[]): ResourceDiagnostic[] {
        return this.resolveSTEngineResources(refs).diagnostics;
    }

    static filterBundleForSTEngine(bundle: PromptResourceBundle): PromptResourceBundle {
        const resolution = this.resolveSTEngineResources(bundle.refs);
        const blockedPaths = new Set(resolution.blockedRefs.map(ref => ref.path));
        const documents = bundle.documents.filter(document => !blockedPaths.has(document.ref.path));
        const lorebookEntries = bundle.lorebookEntries.filter(entry => !blockedPaths.has(entry.sourcePath));
        const characterDocument = documents.find(document => document.ref.resourceType === 'character');
        const presetDocument = documents.find(document => document.ref.resourceType === 'preset');

        return {
            refs: resolution.passthroughRefs,
            documents,
            lorebookEntries,
            charCard: characterDocument ? toCharCard(characterDocument.raw) : null,
            presetRaw: presetDocument ? asRecord(presetDocument.raw) : null,
            diagnostics: [...bundle.diagnostics]
        };
    }
}
