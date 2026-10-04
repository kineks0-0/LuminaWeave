import type { ForgeVirtualLorebookEntry } from '../../../types/SessionTypes.js';
import type { StagingEntry } from '../../../types/ForgeRuntimeTypes.js';
import { parseAttributes } from '@shared/TagTokenizer.js';
import { extractEntryTitle } from './forgeEntryParser.js';

const appendLookupId = (sink: string[], value: string | null | undefined): void => {
    const normalized = String(value || '').trim();
    if (!normalized || sink.includes(normalized)) return;
    sink.push(normalized);
};

const buildLookupIds = (lookupId?: string | null, entry?: Partial<LuminaLorebookEntry> | null): string[] => {
    const ids: string[] = [];
    appendLookupId(ids, lookupId);
    appendLookupId(ids, typeof entry?.uid === 'string' ? entry.uid : null);
    appendLookupId(ids, typeof entry?.comment === 'string' ? entry.comment : null);
    return ids;
};

export const findVirtualLorebookEntryIndex = (
    entries: ForgeVirtualLorebookEntry[],
    lookupId?: string | null,
    entry?: Partial<LuminaLorebookEntry> | null
): number => {
    const lookupIds = buildLookupIds(lookupId, entry);
    if (lookupIds.length === 0) return -1;

    return entries.findIndex((item) => lookupIds.includes(item.id)
        || (typeof item.entry.uid === 'string' && lookupIds.includes(item.entry.uid))
        || (typeof item.entry.comment === 'string' && lookupIds.includes(item.entry.comment)));
};

export const findVirtualLorebookEntry = (
    entries: ForgeVirtualLorebookEntry[],
    lookupId?: string | null,
    entry?: Partial<LuminaLorebookEntry> | null
): ForgeVirtualLorebookEntry | null => {
    const index = findVirtualLorebookEntryIndex(entries, lookupId, entry);
    return index >= 0 ? entries[index] : null;
};

export const buildFrozenVirtualLorebookContent = (
    stagedEntry: StagingEntry,
    existingEntry?: LuminaLorebookEntry | null
): LuminaLorebookEntry => {
    // 优先使用 description；若为空，尝试从内容提取可读标题
    const resolvedComment = stagedEntry.description
        || existingEntry?.comment
        || extractEntryTitle(stagedEntry.proposedContent)
        || stagedEntry.targetEntryId;

    return {
    uid: existingEntry?.uid || stagedEntry.targetEntryId,
    key: existingEntry?.key ? [...existingEntry.key] : [],
    keysecondary: existingEntry?.keysecondary ? [...existingEntry.keysecondary] : [],
    comment: resolvedComment,
    content: stagedEntry.proposedContent,
    order: existingEntry?.order ?? 100,
    disable: existingEntry?.disable ?? false,
    constant: existingEntry?.constant ?? false,
    selective: existingEntry?.selective ?? false,
    selectiveLogic: existingEntry?.selectiveLogic ?? 0,
    position: existingEntry?.position ?? 0,
    depth: existingEntry?.depth ?? 0,
    probability: existingEntry?.probability ?? 100,
    scan_depth: existingEntry?.scan_depth ?? 0
    };
};

export const parseEntryUpdateXml = (xmlContent: string): LuminaLorebookEntry | null => {
    const openTagMatch = xmlContent.match(/^<entry_update\b[^>]*>/i);
    if (!openTagMatch) return null;
    const openTag = openTagMatch[0];
    const attributes = parseAttributes(openTag);

    const content = xmlContent
        .replace(/^<entry_update\b[^>]*>/i, '')
        .replace(/<\/entry_update>$/i, '')
        .trim();

    return {
        uid: attributes.id || attributes.entry_id || attributes.target || attributes.uid || '',
        comment: attributes.title || attributes.comment || '',
        key: attributes.key ? attributes.key.split('|').map(k => k.trim()).filter(Boolean) : [],
        keysecondary: attributes.keysecondary ? attributes.keysecondary.split('|').map(k => k.trim()).filter(Boolean) : [],
        content,
        constant: attributes.constant === 'true',
        selective: attributes.selective === 'true',
        selectiveLogic: parseInt(attributes.selectiveLogic || attributes.selective_logic || '0'),
        disable: attributes.disable === 'true',
        position: attributes.position || '0',
        depth: parseInt(attributes.depth || '0'),
        order: parseInt(attributes.order || '100'),
        probability: parseInt(attributes.probability || '100'),
        scan_depth: parseInt(attributes.scan_depth || '0')
    };
};
