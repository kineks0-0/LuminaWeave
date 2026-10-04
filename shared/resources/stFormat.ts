import type {
    ResourceSummary,
    ResourceType,
    STCharacterRawPayload,
    STPresetRawPayload,
    STResourceRawPayload,
    STWorldbookRawPayload
} from './types.js';
import { deepClone } from '../CommonUtils.js';

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

const asString = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

const asStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value.map(item => asString(item)).filter(Boolean);
};

const normalizeEntries = (raw: Record<string, unknown>): Array<Record<string, unknown>> => {
    const entries = raw.entries ?? raw.data;
    if (Array.isArray(entries)) {
        return entries.map(asRecord).filter(entry => Object.keys(entry).length > 0);
    }
    if (entries && typeof entries === 'object') {
        return Object.entries(entries as Record<string, unknown>)
            .map(([uid, entry]) => ({ uid, ...asRecord(entry) }));
    }
    return [];
};

const firstDefined = (...values: unknown[]): unknown => values.find(value => value !== undefined && value !== null);

const asBoolean = (value: unknown, fallback = false): boolean => {
    if (value === undefined || value === null) return fallback;
    return value === true || value === 'true' || value === 1;
};

const asNumber = (value: unknown, fallback = 0): number => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
};

const asPosition = (value: unknown): string | number => {
    if (typeof value === 'string' && value.trim()) return value.trim();
    return asNumber(value, 0);
};

export const summarizeSTCharacter = (
    resourceId: string,
    payload: STCharacterRawPayload | Record<string, unknown>
): ResourceSummary => {
    const raw = 'raw' in payload ? asRecord(payload.raw) : asRecord(payload);
    const data = asRecord(raw.data);
    const source = Object.keys(data).length > 0 ? data : raw;
    const name = asString(source.name) || asString(raw.name) || resourceId;
    const description = asString(source.description) || asString(source.personality) || asString(source.scenario);
    const firstMessage = asString(source.first_mes) || asString(source.firstMessage);
    return {
        id: resourceId,
        type: 'character',
        name,
        description: description || firstMessage || undefined,
        keywords: [name].filter(Boolean),
        format: asString(raw.spec) || asString(raw.spec_version) || (Object.keys(data).length > 0 ? 'tavern-card-v2' : 'st-character')
    };
};

export const summarizeSTWorldbook = (
    resourceId: string,
    payload: STWorldbookRawPayload | Record<string, unknown>
): ResourceSummary => {
    const raw = 'raw' in payload ? asRecord(payload.raw) : asRecord(payload);
    const entries = normalizeEntries(raw);
    const keywords = entries.flatMap(entry => [
        ...asStringArray(entry.key),
        ...asStringArray(entry.keys),
        ...asStringArray(entry.keysecondary)
    ]);
    const activeCount = entries.filter(entry => entry.disable !== true && entry.enabled !== false).length;
    return {
        id: resourceId,
        type: 'worldbook',
        name: asString(raw.name) || resourceId,
        description: `${activeCount}/${entries.length} enabled entries`,
        enabled: activeCount > 0,
        entryCount: entries.length,
        keywords: Array.from(new Set(keywords)).slice(0, 24),
        format: Array.isArray(raw.entries ?? raw.data) ? 'st-worldbook-array' : 'st-worldbook-object'
    };
};

export const summarizeSTPreset = (
    resourceId: string,
    payload: STPresetRawPayload | Record<string, unknown>
): ResourceSummary => {
    const raw = 'raw' in payload ? asRecord(payload.raw) : asRecord(payload);
    const prompts = Array.isArray(raw.prompts) ? raw.prompts : [];
    return {
        id: resourceId,
        type: 'preset',
        name: asString(raw.name) || asString(raw.preset_name) || resourceId,
        description: prompts.length > 0 ? `${prompts.length} prompts` : undefined,
        entryCount: prompts.length || undefined,
        format: 'st-preset'
    };
};

export const summarizeSTResource = (
    resourceType: ResourceType,
    resourceId: string,
    raw: unknown
): ResourceSummary => {
    if (resourceType === 'character') {
        return summarizeSTCharacter(resourceId, { kind: 'character', raw: asRecord(raw) });
    }
    if (resourceType === 'worldbook') {
        return summarizeSTWorldbook(resourceId, { kind: 'worldbook', raw: asRecord(raw) });
    }
    if (resourceType === 'preset') {
        return summarizeSTPreset(resourceId, { kind: 'preset', raw: asRecord(raw) });
    }
    return {
        id: resourceId,
        type: resourceType,
        name: resourceId,
        format: 'unknown'
    };
};

export const cloneSTRawPayload = <T>(payload: T): T => deepClone(payload ?? null) as T;

export const toSTResourcePayload = (
    resourceType: ResourceType,
    raw: Record<string, unknown>
): STResourceRawPayload | Record<string, unknown> => {
    if (resourceType === 'character') return { kind: 'character', raw };
    if (resourceType === 'worldbook') return { kind: 'worldbook', raw };
    if (resourceType === 'preset') return { kind: 'preset', raw };
    return raw;
};

export const worldbookEntriesToLorebookEntries = (raw: unknown): LuminaLorebookEntry[] => {
    const entries = normalizeEntries(asRecord(raw));
    return entries.map((entry, index) => {
        const extensions = asRecord(entry.extensions);
        const key = asStringArray(entry.key).length > 0 ? asStringArray(entry.key) : asStringArray(entry.keys);
        const keysecondary = asStringArray(entry.keysecondary).length > 0
            ? asStringArray(entry.keysecondary)
            : asStringArray(entry.secondary_keys);
        const position = firstDefined(extensions.position, entry.position);
        const outletName = asString(firstDefined(entry.outletName, entry.outlet_name, extensions.outlet_name));

        return {
            ...entry,
            uid: typeof entry.uid === 'string' || typeof entry.uid === 'number' ? entry.uid : index,
            comment: asString(entry.comment) || asString(entry.name) || `Entry ${index + 1}`,
            key,
            keysecondary,
            content: asString(entry.content),
            constant: asBoolean(entry.constant),
            selective: asBoolean(entry.selective),
            selectiveLogic: asNumber(firstDefined(extensions.selectiveLogic, entry.selectiveLogic), 0),
            disable: asBoolean(entry.disable),
            enabled: entry.enabled === undefined ? entry.disable !== true : entry.enabled !== false,
            position: asPosition(position),
            role: asNumber(firstDefined(extensions.role, entry.role), 0),
            depth: asNumber(firstDefined(extensions.depth, entry.depth), 0),
            order: asNumber(firstDefined(entry.order, entry.insertion_order), 0),
            probability: asNumber(entry.probability, 100),
            useProbability: firstDefined(entry.useProbability, entry.use_probability) === undefined
                ? undefined
                : asBoolean(firstDefined(entry.useProbability, entry.use_probability), true),
            scan_depth: asNumber(firstDefined(extensions.scan_depth, entry.scan_depth, entry.scanDepth), 0),
            caseSensitive: asBoolean(firstDefined(extensions.case_sensitive, entry.caseSensitive, entry.case_sensitive)),
            matchWholeWords: asBoolean(firstDefined(extensions.match_whole_words, entry.matchWholeWords, entry.match_whole_words)),
            useRegex: asBoolean(firstDefined(entry.useRegex, entry.use_regex)),
            excludeRecursion: asBoolean(firstDefined(extensions.exclude_recursion, entry.excludeRecursion, entry.exclude_recursion)),
            preventRecursion: asBoolean(firstDefined(extensions.prevent_recursion, entry.preventRecursion, entry.prevent_recursion)),
            delayUntilRecursion: asBoolean(firstDefined(extensions.delay_until_recursion, entry.delayUntilRecursion, entry.delay_until_recursion)),
            outletName: outletName || undefined
        };
    });
};
