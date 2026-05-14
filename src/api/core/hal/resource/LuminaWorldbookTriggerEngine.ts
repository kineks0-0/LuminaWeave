import type { CleanedMessage } from '../../../../types/nexus.js';
import type { ResourceDiagnostic, ResourceRef } from '@shared/resources/index.js';

export interface LuminaWorldbookTriggerContext {
    messages?: CleanedMessage[];
    inputText?: string;
    maxRecursivePasses?: number;
    defaultScanDepth?: number;
    maxTriggeredEntries?: number;
    maxWorldbookTokens?: number;
    estimateTokens?: (text: string) => number;
    random?: () => number;
}

export interface LuminaWorldbookTriggerTrace {
    uid: string | number;
    comment: string;
    status: 'selected' | 'skipped';
    reason:
        | 'constant'
        | 'keyword'
        | 'recursive'
        | 'probability'
        | 'disabled'
        | 'empty-content'
        | 'delay-until-recursion'
        | 'no-key-match'
        | 'budget';
    pass: number;
    matchedKeys: string[];
    probability?: number;
    roll?: number;
    budgetLimit?: number;
    budgetType?: 'entry_count' | 'token';
    budgetUsed?: number;
    budgetCost?: number;
    position?: string | number;
    depth?: number;
    order?: number;
    recursiveContentIncluded?: boolean;
    recursionBlockedBy?: 'excludeRecursion' | 'preventRecursion';
    resourceRef?: ResourceRef;
    sourceId?: string;
    resourceId?: string;
    sourcePath?: string;
    firstMatch?: LuminaWorldbookFirstMatch;
}

export interface LuminaWorldbookTriggerResult {
    entries: LuminaLorebookEntry[];
    activatedEntries: LuminaWorldbookActivatedEntry[];
    insertionBuckets: LuminaWorldbookInsertionBuckets;
    trace: LuminaWorldbookTriggerTrace[];
    diagnostics: ResourceDiagnostic[];
    recursivePassesUsed: number;
    recursionLimitReached: boolean;
}

export type LuminaWorldbookInsertionPosition =
    | 'before'
    | 'after'
    | 'an_top'
    | 'an_bottom'
    | 'em_top'
    | 'em_bottom'
    | 'at_depth'
    | 'outlet';

export interface LuminaWorldbookInsertion {
    position: LuminaWorldbookInsertionPosition;
    depth?: number;
    role?: CleanedMessage['role'];
    outletName?: string;
    anchor?: 'character' | 'authors_note' | 'example_messages' | 'depth' | 'outlet';
    anchorPosition?: 'before' | 'after';
}

export interface LuminaWorldbookFirstMatch {
    messageIndexFromLatest: number | null;
    injectionIndex: number;
    matchedKey: string;
    matchedKeyScope: 'primary' | 'secondary';
    matchedKeyType: 'plain' | 'regex';
    charStart: number;
    charEnd: number;
    excerpt: string;
}

export interface LuminaWorldbookActivatedEntry {
    uid: string | number;
    comment: string;
    content: string;
    role: CleanedMessage['role'];
    position: string | number;
    depth: number;
    order: number;
    pass: number;
    reason: 'constant' | 'keyword' | 'recursive';
    matchedKeys: string[];
    recursiveContentIncluded: boolean;
    recursionBlockedBy?: 'excludeRecursion' | 'preventRecursion';
    resourceRef?: ResourceRef;
    sourceId?: string;
    resourceId?: string;
    sourcePath?: string;
    insertion: LuminaWorldbookInsertion;
    firstMatch?: LuminaWorldbookFirstMatch;
}

export type LuminaWorldbookInsertionBuckets = Record<LuminaWorldbookInsertionPosition, LuminaWorldbookActivatedEntry[]>;

interface LuminaLorebookEntryMetadata {
    resourceRef?: ResourceRef;
    sourceId?: string;
    resourceId?: string;
    sourcePath?: string;
    outletName?: string;
    outlet_name?: string;
    extensions?: {
        outlet_name?: string;
        [key: string]: unknown;
    };
}

interface MatchDetail {
    key: string;
    scope: 'primary' | 'secondary';
    type: 'plain' | 'regex';
    charStart: number;
    charEnd: number;
    excerpt: string;
    messageIndexFromLatest: number | null;
    injectionIndex: number;
}

const uniqueStrings = (values: any[]): string[] =>
    Array.from(new Set(values.filter(v => typeof v === 'string').map(value => value.trim()).filter(Boolean)));

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const shouldUseRegex = (entry: LuminaLorebookEntry): boolean => {
    const value = (entry as LuminaLorebookEntry & { useRegex?: boolean; use_regex?: boolean }).useRegex
        ?? (entry as LuminaLorebookEntry & { useRegex?: boolean; use_regex?: boolean }).use_regex;
    return value === true;
};

const shouldMatchWholeWords = (entry: LuminaLorebookEntry): boolean => {
    const value = (entry as LuminaLorebookEntry & { matchWholeWords?: boolean; match_whole_words?: boolean }).matchWholeWords
        ?? (entry as LuminaLorebookEntry & { matchWholeWords?: boolean; match_whole_words?: boolean }).match_whole_words;
    return value === true;
};

const isCaseSensitive = (entry: LuminaLorebookEntry): boolean => {
    const value = (entry as LuminaLorebookEntry & { caseSensitive?: boolean; case_sensitive?: boolean }).caseSensitive
        ?? (entry as LuminaLorebookEntry & { caseSensitive?: boolean; case_sensitive?: boolean }).case_sensitive;
    return value === true;
};

const createKeyRegExp = (key: string, entry: LuminaLorebookEntry): RegExp | null => {
    try {
        const source = shouldUseRegex(entry)
            ? key
            : shouldMatchWholeWords(entry) ? `\\b${escapeRegExp(key)}\\b` : escapeRegExp(key);
        return new RegExp(source, isCaseSensitive(entry) ? 'u' : 'iu');
    } catch {
        return null;
    }
};

const entryId = (entry: LuminaLorebookEntry): string | number =>
    entry.uid ?? entry.comment ?? entry.key?.[0] ?? 'entry';

const entryName = (entry: LuminaLorebookEntry): string =>
    entry.comment || String(entryId(entry));

const isEnabled = (entry: LuminaLorebookEntry): boolean =>
    entry.disable !== true && entry.enabled !== false && Boolean(entry.content?.trim());

const disabledReason = (entry: LuminaLorebookEntry): LuminaWorldbookTriggerTrace['reason'] | null => {
    if (entry.disable === true || entry.enabled === false) return 'disabled';
    if (!entry.content?.trim()) return 'empty-content';
    return null;
};

const shouldUseProbability = (entry: LuminaLorebookEntry): boolean => {
    const useProbability = entry.useProbability ?? entry.use_probability;
    return useProbability !== false && useProbability !== 0;
};

const probabilityFor = (entry: LuminaLorebookEntry): number =>
    Math.max(0, Math.min(100, Number(entry.probability ?? 100)));

const defaultEstimateTokens = (text: string): number => Math.ceil(text.length / 4);

const tokenCostFor = (
    entry: LuminaLorebookEntry,
    estimateTokens: (text: string) => number
): number => Math.max(0, Math.ceil(Number(estimateTokens(entry.content) || 0)));

const matchKeys = (text: string, keys: string[] = [], entry: LuminaLorebookEntry): string[] => {
    if (!text || keys.length === 0) return [];
    return uniqueStrings(keys).filter(key => {
        const pattern = createKeyRegExp(key, entry);
        return pattern ? pattern.test(text) : false;
    });
};

const excerptFor = (text: string, start: number, end: number): string => {
    const before = Math.max(0, start - 40);
    const after = Math.min(text.length, end + 40);
    return text.slice(before, after);
};

const firstKeyMatch = (
    text: string,
    keys: string[] = [],
    scope: MatchDetail['scope'],
    messageIndexFromLatest: number | null,
    injectionIndex: number,
    entry: LuminaLorebookEntry
): MatchDetail | null => {
    if (!text || keys.length === 0) return null;
    for (const key of uniqueStrings(keys)) {
        const pattern = createKeyRegExp(key, entry);
        if (!pattern) continue;
        const match = pattern.exec(text);
        if (!match || match.index < 0) continue;
        const matchedText = match[0] ?? key;
        const index = match.index;
        return {
            key,
            scope,
            type: shouldUseRegex(entry) ? 'regex' : 'plain',
            charStart: index,
            charEnd: index + matchedText.length,
            excerpt: excerptFor(text, index, index + matchedText.length),
            messageIndexFromLatest,
            injectionIndex
        };
    }
    return null;
};

const findFirstMatch = (
    messages: CleanedMessage[],
    inputText: string,
    recursiveText: string,
    entry: LuminaLorebookEntry,
    primaryKeys: string[] = [],
    secondaryKeys: string[] = []
): LuminaWorldbookFirstMatch | undefined => {
    const candidates: Array<{ text: string; messageIndexFromLatest: number | null; injectionIndex: number }> = [
        ...messages.slice().reverse().map((message, index) => ({
            text: message.content,
            messageIndexFromLatest: index,
            injectionIndex: index
        })),
        { text: inputText, messageIndexFromLatest: null, injectionIndex: messages.length },
        { text: recursiveText, messageIndexFromLatest: null, injectionIndex: messages.length + 1 }
    ];

    for (const candidate of candidates) {
        const primary = firstKeyMatch(candidate.text, primaryKeys, 'primary', candidate.messageIndexFromLatest, candidate.injectionIndex, entry);
        const match = primary ?? firstKeyMatch(candidate.text, secondaryKeys, 'secondary', candidate.messageIndexFromLatest, candidate.injectionIndex, entry);
        if (!match) continue;
        return {
            messageIndexFromLatest: match.messageIndexFromLatest,
            injectionIndex: match.injectionIndex,
            matchedKey: match.key,
            matchedKeyScope: match.scope,
            matchedKeyType: match.type,
            charStart: match.charStart,
            charEnd: match.charEnd,
            excerpt: match.excerpt
        };
    }
    return undefined;
};

const scanTextFor = (
    messages: CleanedMessage[],
    inputText: string,
    depth: number
): string => {
    const history = depth > 0 ? messages.slice(-depth) : messages;
    return [
        ...history.map(message => message.content),
        inputText
    ].filter(Boolean).join('\n');
};

const passesSelective = (
    entry: LuminaLorebookEntry,
    primaryMatches: string[],
    secondaryMatches: string[]
): boolean => {
    if (primaryMatches.length === 0) return false;

    if (!entry.selective) {
        return true;
    }

    if (!entry.keysecondary || entry.keysecondary.length === 0) {
        return true;
    }

    const secondaryKeys = uniqueStrings(entry.keysecondary);
    const allSecondaryMatched = secondaryKeys.length > 0 && secondaryKeys.every(key => secondaryMatches.includes(key));
    const anySecondaryMatched = secondaryMatches.length > 0;

    switch (Number(entry.selectiveLogic ?? 0)) {
        case 1:
            return !allSecondaryMatched;
        case 2:
            return !anySecondaryMatched;
        case 3:
            return allSecondaryMatched;
        default:
            return anySecondaryMatched;
    }
};

const sortEntries = (entries: LuminaLorebookEntry[]): LuminaLorebookEntry[] =>
    [...entries].sort((a, b) => {
        const position = Number(a.position ?? 0) - Number(b.position ?? 0);
        if (position !== 0) return position;
        const depth = Number(a.depth ?? 0) - Number(b.depth ?? 0);
        if (depth !== 0) return depth;
        return Number(a.order ?? 0) - Number(b.order ?? 0);
    });

const tracePlacement = (entry: LuminaLorebookEntry): Pick<LuminaWorldbookTriggerTrace, 'position' | 'depth' | 'order'> => ({
    position: entry.position,
    depth: Number(entry.depth ?? 0),
    order: Number(entry.order ?? 0)
});

const entryMetadata = (entry: LuminaLorebookEntry): LuminaLorebookEntryMetadata => {
    const metadata = entry as LuminaLorebookEntry & LuminaLorebookEntryMetadata;
    const outletName = metadata.outletName ?? metadata.outlet_name ?? metadata.extensions?.outlet_name;
    return {
        resourceRef: metadata.resourceRef,
        sourceId: metadata.sourceId ?? metadata.resourceRef?.sourceId,
        resourceId: metadata.resourceId ?? metadata.resourceRef?.resourceId,
        sourcePath: metadata.sourcePath ?? metadata.resourceRef?.path,
        outletName: typeof outletName === 'string' && outletName.trim() ? outletName.trim() : undefined
    };
};

const traceSource = (
    entry: LuminaLorebookEntry
): Pick<LuminaWorldbookTriggerTrace, 'resourceRef' | 'sourceId' | 'resourceId' | 'sourcePath'> => {
    const metadata = entryMetadata(entry);
    return {
        resourceRef: metadata.resourceRef,
        sourceId: metadata.sourceId,
        resourceId: metadata.resourceId,
        sourcePath: metadata.sourcePath
    };
};

const traceRecursionContribution = (
    entry: LuminaLorebookEntry
): Pick<LuminaWorldbookTriggerTrace, 'recursiveContentIncluded' | 'recursionBlockedBy'> => {
    if (entry.preventRecursion) {
        return {
            recursiveContentIncluded: false,
            recursionBlockedBy: 'preventRecursion'
        };
    }
    if (entry.excludeRecursion) {
        return {
            recursiveContentIncluded: false,
            recursionBlockedBy: 'excludeRecursion'
        };
    }
    return {
        recursiveContentIncluded: true
    };
};

const roleFor = (entry: LuminaLorebookEntry): CleanedMessage['role'] => {
    const role = Number(entry.role ?? 0);
    if (role === 1) return 'user';
    if (role === 2) return 'assistant';
    return 'system';
};

const insertionFor = (entry: LuminaLorebookEntry): LuminaWorldbookInsertion => {
    const rawPosition = String(entry.position ?? '').toLowerCase();
    const numericPosition = Number(entry.position ?? 0);
    let position: LuminaWorldbookInsertionPosition;
    let anchor: LuminaWorldbookInsertion['anchor'];
    let anchorPosition: LuminaWorldbookInsertion['anchorPosition'];

    if (rawPosition === 'before_char' || rawPosition === 'before' || numericPosition === 0) {
        position = 'before';
        anchor = 'character';
        anchorPosition = 'before';
    } else if (rawPosition === 'after_char' || rawPosition === 'after' || numericPosition === 1) {
        position = 'after';
        anchor = 'character';
        anchorPosition = 'after';
    } else if (rawPosition === 'before_an' || rawPosition === 'an_top' || numericPosition === 2) {
        position = 'an_top';
        anchor = 'authors_note';
        anchorPosition = 'before';
    } else if (rawPosition === 'after_an' || rawPosition === 'an_bottom' || numericPosition === 3) {
        position = 'an_bottom';
        anchor = 'authors_note';
        anchorPosition = 'after';
    } else if (rawPosition === 'before_example' || rawPosition === 'em_top' || numericPosition === 5) {
        position = 'em_top';
        anchor = 'example_messages';
        anchorPosition = 'before';
    } else if (rawPosition === 'after_example' || rawPosition === 'em_bottom' || numericPosition === 6) {
        position = 'em_bottom';
        anchor = 'example_messages';
        anchorPosition = 'after';
    } else if (rawPosition === 'at_depth' || numericPosition === 4) {
        position = 'at_depth';
        anchor = 'depth';
    } else if (rawPosition === 'outlet' || numericPosition === 7) {
        position = 'outlet';
        anchor = 'outlet';
    } else {
        position = numericPosition < 0 ? 'before' : 'after';
        anchor = 'character';
        anchorPosition = numericPosition < 0 ? 'before' : 'after';
    }

    return {
        position,
        depth: position === 'at_depth' ? Number(entry.depth ?? 0) : undefined,
        role: roleFor(entry),
        outletName: entryMetadata(entry).outletName,
        anchor,
        anchorPosition
    };
};

const toActivatedEntry = (
    entry: LuminaLorebookEntry,
    trace: LuminaWorldbookTriggerTrace
): LuminaWorldbookActivatedEntry => {
    const recursion = traceRecursionContribution(entry);
    const metadata = entryMetadata(entry);
    return {
        uid: entryId(entry),
        comment: entryName(entry),
        content: entry.content,
        role: roleFor(entry),
        position: entry.position,
        depth: Number(entry.depth ?? 0),
        order: Number(entry.order ?? 0),
        pass: trace.pass,
        reason: trace.reason as LuminaWorldbookActivatedEntry['reason'],
        matchedKeys: [...trace.matchedKeys],
        recursiveContentIncluded: recursion.recursiveContentIncluded ?? false,
        recursionBlockedBy: recursion.recursionBlockedBy,
        resourceRef: metadata.resourceRef,
        sourceId: metadata.sourceId,
        resourceId: metadata.resourceId,
        sourcePath: metadata.sourcePath,
        insertion: insertionFor(entry),
        firstMatch: trace.firstMatch
    };
};

const createInsertionBuckets = (entries: LuminaWorldbookActivatedEntry[]): LuminaWorldbookInsertionBuckets => ({
    before: entries.filter(entry => entry.insertion.position === 'before'),
    after: entries.filter(entry => entry.insertion.position === 'after'),
    an_top: entries.filter(entry => entry.insertion.position === 'an_top'),
    an_bottom: entries.filter(entry => entry.insertion.position === 'an_bottom'),
    em_top: entries.filter(entry => entry.insertion.position === 'em_top'),
    em_bottom: entries.filter(entry => entry.insertion.position === 'em_bottom'),
    at_depth: entries.filter(entry => entry.insertion.position === 'at_depth'),
    outlet: entries.filter(entry => entry.insertion.position === 'outlet')
});

export class LuminaWorldbookTriggerEngine {
    public resolve(
        entries: LuminaLorebookEntry[],
        context: LuminaWorldbookTriggerContext = {}
    ): LuminaWorldbookTriggerResult {
        const diagnostics: ResourceDiagnostic[] = [];
        const trace: LuminaWorldbookTriggerTrace[] = [];
        for (const entry of entries) {
            const reason = disabledReason(entry);
            if (!reason) continue;
            trace.push({
                uid: entryId(entry),
                comment: entryName(entry),
                status: 'skipped',
                reason,
                pass: 0,
                matchedKeys: []
            });
        }
        const enabledEntries = entries.filter(isEnabled);
        const selected = new Map<string | number, LuminaLorebookEntry>();
        const messages = context.messages ?? [];
        const random = context.random ?? Math.random;
        const estimateTokens = context.estimateTokens ?? defaultEstimateTokens;
        const maxRecursivePasses = Math.max(1, context.maxRecursivePasses ?? 3);
        const maxTriggeredEntries = context.maxTriggeredEntries === undefined
            ? Number.POSITIVE_INFINITY
            : Math.max(0, context.maxTriggeredEntries);
        const maxWorldbookTokens = context.maxWorldbookTokens === undefined
            ? Number.POSITIVE_INFINITY
            : Math.max(0, context.maxWorldbookTokens);
        let worldbookTokensUsed = 0;
        let scanText = scanTextFor(messages, context.inputText ?? '', context.defaultScanDepth ?? 8);
        let recursivePassesUsed = 0;
        let recursionLimitReached = false;

        for (const entry of enabledEntries) {
            if (!entry.constant) continue;
            if (selected.size >= maxTriggeredEntries) {
                this.pushSkippedOnce(trace, entry, 'budget', 0, {
                    budgetLimit: maxTriggeredEntries,
                    budgetType: 'entry_count',
                    budgetUsed: selected.size
                });
                continue;
            }
            const tokenCost = tokenCostFor(entry, estimateTokens);
            if (worldbookTokensUsed + tokenCost > maxWorldbookTokens) {
                this.pushSkippedOnce(trace, entry, 'budget', 0, {
                    budgetLimit: maxWorldbookTokens,
                    budgetType: 'token',
                    budgetUsed: worldbookTokensUsed,
                    budgetCost: tokenCost
                });
                continue;
            }
            if (!this.passesProbability(entry, random, trace, 0)) continue;
            selected.set(entryId(entry), entry);
            worldbookTokensUsed += tokenCost;
            trace.push({
                uid: entryId(entry),
                comment: entryName(entry),
                status: 'selected',
                reason: 'constant',
                pass: 0,
                matchedKeys: [],
                ...tracePlacement(entry),
                ...traceRecursionContribution(entry),
                ...traceSource(entry)
            });
            if (!entry.excludeRecursion && !entry.preventRecursion) {
                scanText += `\n${entry.content}`;
            }
        }

        for (let pass = 1; pass <= maxRecursivePasses; pass += 1) {
            let changed = false;
            recursivePassesUsed = pass;
            for (const entry of enabledEntries) {
                const id = entryId(entry);
                if (selected.has(id) || entry.constant) continue;
                if (entry.delayUntilRecursion && pass === 1) {
                    this.pushSkippedOnce(trace, entry, 'delay-until-recursion', pass);
                    continue;
                }

                const localScanText = scanTextFor(
                    messages,
                    context.inputText ?? '',
                    Number(entry.scan_depth ?? context.defaultScanDepth ?? 8)
                ) + `\n${scanText}`;
                const primaryMatches = matchKeys(localScanText, entry.key, entry);
                const secondaryMatches = matchKeys(localScanText, entry.keysecondary, entry);
                const firstMatch = findFirstMatch(
                    messages,
                    context.inputText ?? '',
                    scanText,
                    entry,
                    entry.key,
                    entry.keysecondary
                );
                if (!passesSelective(entry, primaryMatches, secondaryMatches)) {
                    this.pushSkippedOnce(trace, entry, 'no-key-match', pass);
                    continue;
                }
                if (selected.size >= maxTriggeredEntries) {
                    this.pushSkippedOnce(trace, entry, 'budget', pass, {
                        budgetLimit: maxTriggeredEntries,
                        budgetType: 'entry_count',
                        budgetUsed: selected.size
                    });
                    continue;
                }
                const tokenCost = tokenCostFor(entry, estimateTokens);
                if (worldbookTokensUsed + tokenCost > maxWorldbookTokens) {
                    this.pushSkippedOnce(trace, entry, 'budget', pass, {
                        budgetLimit: maxWorldbookTokens,
                        budgetType: 'token',
                        budgetUsed: worldbookTokensUsed,
                        budgetCost: tokenCost
                    });
                    continue;
                }
                if (!this.passesProbability(entry, random, trace, pass)) continue;

                selected.set(id, entry);
                worldbookTokensUsed += tokenCost;
                changed = true;
                trace.push({
                    uid: id,
                    comment: entryName(entry),
                    status: 'selected',
                    reason: pass > 1 ? 'recursive' : 'keyword',
                    pass,
                    matchedKeys: [...primaryMatches, ...secondaryMatches],
                    ...tracePlacement(entry),
                    ...traceRecursionContribution(entry),
                    ...traceSource(entry),
                    firstMatch
                });
                if (!entry.excludeRecursion && !entry.preventRecursion) {
                    scanText += `\n${entry.content}`;
                }
            }
            if (changed && pass === maxRecursivePasses && this.hasUnselectedRecursiveCandidates(enabledEntries, selected)) {
                recursionLimitReached = true;
            }
            if (!changed) break;
        }

        if (entries.length > 0 && selected.size === 0) {
            diagnostics.push({
                level: 'info',
                code: 'LUMINA_WORLDBOOK_NO_TRIGGERED_ENTRIES',
                message: 'No enabled worldbook entries matched the current Lumina trigger context.'
            });
        }

        const activatedEntries = this.buildActivatedEntries(selected, trace);

        return {
            entries: sortEntries(Array.from(selected.values())),
            activatedEntries,
            insertionBuckets: createInsertionBuckets(activatedEntries),
            trace,
            diagnostics: [
                ...diagnostics,
                ...(recursionLimitReached ? [{
                    level: 'info' as const,
                    code: 'LUMINA_WORLDBOOK_RECURSION_LIMIT_REACHED',
                    message: `Worldbook recursion stopped after ${maxRecursivePasses} pass(es).`
                }] : [])
            ],
            recursivePassesUsed,
            recursionLimitReached
        };
    }

    private passesProbability(
        entry: LuminaLorebookEntry,
        random: () => number,
        trace: LuminaWorldbookTriggerTrace[],
        pass: number
    ): boolean {
        const probability = probabilityFor(entry);
        if (!shouldUseProbability(entry) || probability >= 100) return true;
        const roll = Math.max(0, Math.min(1, random())) * 100;
        if (roll < probability) return true;
        trace.push({
            uid: entryId(entry),
            comment: entryName(entry),
            status: 'skipped',
            reason: 'probability',
            pass,
            matchedKeys: [],
            probability,
            roll
        });
        return false;
    }

    private pushSkippedOnce(
        trace: LuminaWorldbookTriggerTrace[],
        entry: LuminaLorebookEntry,
        reason: LuminaWorldbookTriggerTrace['reason'],
        pass: number,
        budget?: Pick<LuminaWorldbookTriggerTrace, 'budgetLimit' | 'budgetType' | 'budgetUsed' | 'budgetCost'>
    ): void {
        const id = entryId(entry);
        if (trace.some(item => item.uid === id && item.status === 'skipped' && item.reason === reason)) {
            return;
        }
        trace.push({
            uid: id,
            comment: entryName(entry),
            status: 'skipped',
            reason,
            pass,
            matchedKeys: [],
            ...budget,
            ...tracePlacement(entry),
            ...traceSource(entry)
        });
    }

    private hasUnselectedRecursiveCandidates(
        entries: LuminaLorebookEntry[],
        selected: Map<string | number, LuminaLorebookEntry>
    ): boolean {
        return entries.some(entry => !entry.constant && !selected.has(entryId(entry)));
    }

    private buildActivatedEntries(
        selected: Map<string | number, LuminaLorebookEntry>,
        trace: LuminaWorldbookTriggerTrace[]
    ): LuminaWorldbookActivatedEntry[] {
        const activated = Array.from(selected.values()).map(entry => {
            const selectedTrace = trace.find(item =>
                item.uid === entryId(entry)
                && item.status === 'selected'
                && (item.reason === 'constant' || item.reason === 'keyword' || item.reason === 'recursive')
            );
            return selectedTrace ? toActivatedEntry(entry, selectedTrace) : null;
        }).filter((entry): entry is LuminaWorldbookActivatedEntry => Boolean(entry));
        return activated.sort((a, b) => {
            const position = Number(a.position ?? 0) - Number(b.position ?? 0);
            if (position !== 0) return position;
            const depth = a.depth - b.depth;
            if (depth !== 0) return depth;
            return a.order - b.order;
        });
    }
}

export const luminaWorldbookTriggerEngine = new LuminaWorldbookTriggerEngine();
