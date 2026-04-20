import { LuminaChatMessage } from '@shared/LuminaMessage.js';
import { globalXMLInterceptor } from '../core/XMLInterceptor.js';
import { MessageComparator, MessageTextResolver, SyncUtils } from '../core/SyncUtils.js';

export type ChatDiffSide = 'lumina' | 'st';

export type ChatDiffType =
    | 'content_mismatch'
    | 'write_text_mismatch'
    | 'metadata_mismatch'
    | 'local_only'
    | 'st_only'
    | 'low_confidence_match';

export type ChatMatchReason = 'id' | 'fingerprint' | 'index' | 'none';
export type ChatMatchConfidence = 'high' | 'medium' | 'low' | 'none';

export type ChatMessageSnapshot = {
    side: ChatDiffSide;
    index: number;
    id: string;
    fingerprint?: string;
    stFingerprint?: string;
    name?: string;
    role?: string;
    is_hidden?: boolean;
    canonicalSnapshot: string;
    stateSnapshot: string;
    canonicalText: string;
    stWriteText: string;
    derivedFromPluginRaw?: boolean;
    extraKeys?: string[];
};

export type ChatDiffItem = {
    indexHint: number;
    matchReason: ChatMatchReason;
    confidence: ChatMatchConfidence;
    diffTypes: ChatDiffType[];
    lumina?: ChatMessageSnapshot;
    st?: ChatMessageSnapshot;
};

export type ChatDiffSummary = {
    luminaCount: number;
    stCount: number;
    matchedCount: number;
    localOnlyCount: number;
    stOnlyCount: number;
    contentMismatchCount: number;
    writeTextMismatchCount: number;
    metadataMismatchCount: number;
    lowConfidenceMatchCount: number;
};

export type ChatDiffReport = {
    summary: ChatDiffSummary;
    divergenceIndex: number;
    firstMismatchIndex: number;
    items: ChatDiffItem[];
};

type SnapshotBuildResult = {
    snapshot: ChatMessageSnapshot;
    rawCanonicalSource: 'mesRaw' | 'extra.mesRaw' | 'message' | 'mes' | 'pluginRaw' | 'none';
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function getString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

function resolveCanonicalWithSource(msg: unknown): { canonicalText: string; source: SnapshotBuildResult['rawCanonicalSource'] } {
    if (!isRecord(msg)) return { canonicalText: '', source: 'none' };

    const extra = isRecord(msg.extra) ? msg.extra : undefined;
    const extraMesRaw = extra ? getString(extra.mesRaw) : undefined;

    const mesRaw = getString(msg.mesRaw);
    const message = getString(msg.message);
    const mes = getString(msg.mes);
    const pluginRaw = getString(msg.pluginRaw);

    const raw = extraMesRaw ?? mesRaw ?? message ?? mes ?? pluginRaw ?? '';
    const source: SnapshotBuildResult['rawCanonicalSource'] =
        extraMesRaw !== undefined ? 'extra.mesRaw'
            : mesRaw !== undefined ? 'mesRaw'
            : message !== undefined ? 'message'
            : mes !== undefined ? 'mes'
            : pluginRaw !== undefined ? 'pluginRaw'
            : 'none';

    const cleaned = globalXMLInterceptor.processAndCleanText(raw, false);
    const canonicalText = MessageTextResolver.normalizeForFingerprint(cleaned);

    return { canonicalText, source };
}

function buildSnapshot(side: ChatDiffSide, index: number, msg: LuminaChatMessage): SnapshotBuildResult {
    const { canonicalText, source } = resolveCanonicalWithSource(msg);

    const stWriteTextRaw = side === 'st'
        ? (msg.mes ?? msg.mesST ?? msg.mesRaw ?? '')
        : MessageTextResolver.resolveForSTWrite(msg);

    const stWriteText = MessageTextResolver.normalize(stWriteTextRaw);
    const stFingerprint = SyncUtils.getSTFingerprint(stWriteText);

    const extraKeys = msg.extra ? Object.keys(msg.extra).sort() : undefined;

    const stateComparable = side === 'st'
        ? { ...msg, mesST: stWriteText, mesRaw: stWriteText }
        : msg;

    return {
        rawCanonicalSource: source,
        snapshot: {
            side,
            index,
            id: msg.id,
            fingerprint: msg.fingerprint,
            stFingerprint,
            name: msg.name,
            role: msg.role,
            is_hidden: msg.is_hidden,
            canonicalSnapshot: MessageComparator.getCanonicalSnapshot(msg),
            stateSnapshot: MessageComparator.getStateSnapshot(stateComparable),
            canonicalText,
            stWriteText,
            derivedFromPluginRaw: source === 'pluginRaw',
            extraKeys
        }
    };
}

function pickUnmatched(indices: number[], used: Set<number>): number | null {
    for (const idx of indices) {
        if (!used.has(idx)) return idx;
    }
    return null;
}

function computeDiffTypes(local: ChatMessageSnapshot, st: ChatMessageSnapshot, isLowConfidence: boolean): ChatDiffType[] {
    const diffTypes: ChatDiffType[] = [];

    const isContentMismatch = (local.fingerprint && st.fingerprint)
        ? local.fingerprint !== st.fingerprint
        : local.canonicalText !== st.canonicalText;
    const isWriteMismatch = (local.stFingerprint && st.stFingerprint)
        ? local.stFingerprint !== st.stFingerprint
        : local.stWriteText !== st.stWriteText;

    if (isContentMismatch) diffTypes.push('content_mismatch');
    if (isWriteMismatch) diffTypes.push('write_text_mismatch');

    const metaMismatch =
        MessageTextResolver.normalize(local.name ?? '') !== MessageTextResolver.normalize(st.name ?? '')
        || MessageTextResolver.normalize(local.role ?? '') !== MessageTextResolver.normalize(st.role ?? '')
        || (!!local.is_hidden) !== (!!st.is_hidden);

    if (metaMismatch) diffTypes.push('metadata_mismatch');
    if (isLowConfidence) diffTypes.push('low_confidence_match');

    return diffTypes;
}

function hasActionableDiff(diffTypes: ChatDiffType[]): boolean {
    return diffTypes.some(type => type !== 'low_confidence_match');
}

export class ChatDiffInspector {
    public static analyze(localChat: LuminaChatMessage[], stChat: LuminaChatMessage[]): ChatDiffReport {
        const localSnapshots: ChatMessageSnapshot[] = localChat.map((m, i) => buildSnapshot('lumina', i, m).snapshot);
        const stSnapshots: ChatMessageSnapshot[] = stChat.map((m, i) => buildSnapshot('st', i, m).snapshot);

        const stById = new Map<string, number>();
        const stByFingerprint = new Map<string, number[]>();
        const stBySTFingerprint = new Map<string, number[]>();
        for (let i = 0; i < stSnapshots.length; i++) {
            const s = stSnapshots[i];
            if (!stById.has(s.id)) stById.set(s.id, i);
            if (s.fingerprint) {
                const arr = stByFingerprint.get(s.fingerprint) ?? [];
                arr.push(i);
                stByFingerprint.set(s.fingerprint, arr);
            }
            if (s.stFingerprint) {
                const arr = stBySTFingerprint.get(s.stFingerprint) ?? [];
                arr.push(i);
                stBySTFingerprint.set(s.stFingerprint, arr);
            }
        }

        const matchedSt = new Set<number>();
        const items: ChatDiffItem[] = [];

        for (let i = 0; i < localSnapshots.length; i++) {
            const local = localSnapshots[i];

            const idxById = stById.get(local.id);
            if (idxById !== undefined && !matchedSt.has(idxById)) {
                matchedSt.add(idxById);
                const st = stSnapshots[idxById];
                items.push({
                    indexHint: i,
                    matchReason: 'id',
                    confidence: 'high',
                    diffTypes: computeDiffTypes(local, st, false),
                    lumina: local,
                    st
                });
                continue;
            }

            const fp = local.fingerprint;
            const fpIndices = fp ? stByFingerprint.get(fp) : undefined;
            const idxByFp = fpIndices ? pickUnmatched(fpIndices, matchedSt) : null;
            if (idxByFp !== null) {
                matchedSt.add(idxByFp);
                const st = stSnapshots[idxByFp];
                items.push({
                    indexHint: i,
                    matchReason: 'fingerprint',
                    confidence: 'medium',
                    diffTypes: computeDiffTypes(local, st, false),
                    lumina: local,
                    st
                });
                continue;
            }

            const stFp = local.stFingerprint;
            const stFpIndices = stFp ? stBySTFingerprint.get(stFp) : undefined;
            const idxByStFp = stFpIndices ? pickUnmatched(stFpIndices, matchedSt) : null;
            if (idxByStFp !== null) {
                matchedSt.add(idxByStFp);
                const st = stSnapshots[idxByStFp];
                items.push({
                    indexHint: i,
                    matchReason: 'fingerprint',
                    confidence: 'medium',
                    diffTypes: computeDiffTypes(local, st, false),
                    lumina: local,
                    st
                });
                continue;
            }

            const idxByIndex = i < stSnapshots.length && !matchedSt.has(i) ? i : null;
            if (idxByIndex !== null) {
                matchedSt.add(idxByIndex);
                const st = stSnapshots[idxByIndex];
                items.push({
                    indexHint: i,
                    matchReason: 'index',
                    confidence: 'low',
                    diffTypes: computeDiffTypes(local, st, true),
                    lumina: local,
                    st
                });
                continue;
            }

            items.push({
                indexHint: i,
                matchReason: 'none',
                confidence: 'none',
                diffTypes: ['local_only'],
                lumina: local
            });
        }

        for (let i = 0; i < stSnapshots.length; i++) {
            if (!matchedSt.has(i)) {
                items.push({
                    indexHint: i,
                    matchReason: 'none',
                    confidence: 'none',
                    diffTypes: ['st_only'],
                    st: stSnapshots[i]
                });
            }
        }

        let firstMismatchIndex = -1;
        for (let i = 0; i < items.length; i++) {
            const d = items[i].diffTypes;
            if (hasActionableDiff(d)) {
                firstMismatchIndex = items[i].indexHint;
                break;
            }
        }

        let divergenceIndex = -1;
        for (const item of items) {
            const hasLocalOnly = item.diffTypes.includes('local_only');
            const hasStOnly = item.diffTypes.includes('st_only');
            const hasIdBackedMismatch = !!item.lumina && !!item.st && item.lumina.id !== item.st.id && hasActionableDiff(item.diffTypes);
            if (hasLocalOnly || hasStOnly || hasIdBackedMismatch) {
                divergenceIndex = item.indexHint;
                break;
            }
        }

        const summary: ChatDiffSummary = {
            luminaCount: localSnapshots.length,
            stCount: stSnapshots.length,
            matchedCount: items.filter(it => it.lumina && it.st).length,
            localOnlyCount: items.filter(it => it.diffTypes.includes('local_only')).length,
            stOnlyCount: items.filter(it => it.diffTypes.includes('st_only')).length,
            contentMismatchCount: items.filter(it => it.diffTypes.includes('content_mismatch')).length,
            writeTextMismatchCount: items.filter(it => it.diffTypes.includes('write_text_mismatch')).length,
            metadataMismatchCount: items.filter(it => it.diffTypes.includes('metadata_mismatch')).length,
            lowConfidenceMatchCount: items.filter(it => it.diffTypes.includes('low_confidence_match')).length
        };

        return { summary, divergenceIndex, firstMismatchIndex, items };
    }

    public static toHumanReadable(report: ChatDiffReport, options: { maxItems?: number; maxTextLen?: number } = {}): string {
        const maxItems = options.maxItems ?? 30;
        const maxTextLen = options.maxTextLen ?? 120;

        const lines: string[] = [];
        lines.push(`[ChatDiff] lumina=${report.summary.luminaCount} st=${report.summary.stCount} matched=${report.summary.matchedCount}`);
        lines.push(`[ChatDiff] localOnly=${report.summary.localOnlyCount} stOnly=${report.summary.stOnlyCount} contentMismatch=${report.summary.contentMismatchCount} writeTextMismatch=${report.summary.writeTextMismatchCount} metaMismatch=${report.summary.metadataMismatchCount} lowConfidence=${report.summary.lowConfidenceMatchCount}`);
        lines.push(`[ChatDiff] divergenceIndex=${report.divergenceIndex} firstMismatchIndex=${report.firstMismatchIndex}`);

        let shown = 0;
        for (const item of report.items) {
            if (shown >= maxItems) break;
            if (item.diffTypes.length === 0) continue;

            const l = item.lumina;
            const s = item.st;
            const title = `#${item.indexHint} match=${item.matchReason}/${item.confidence} diff=${item.diffTypes.join(',')}`;
            lines.push(title);

            if (l) {
                lines.push(`  L id=${l.id} fp=${l.fingerprint ?? ''} stfp=${l.stFingerprint ?? ''} hidden=${l.is_hidden ? '1' : '0'} name=${l.name ?? ''} role=${l.role ?? ''}`);
                lines.push(`  L canon=${truncate(l.canonicalText, maxTextLen)}`);
                lines.push(`  L write=${truncate(l.stWriteText, maxTextLen)}`);
            } else {
                lines.push('  L <empty>');
            }

            if (s) {
                lines.push(`  S id=${s.id} fp=${s.fingerprint ?? ''} stfp=${s.stFingerprint ?? ''} hidden=${s.is_hidden ? '1' : '0'} name=${s.name ?? ''} role=${s.role ?? ''}`);
                lines.push(`  S canon=${truncate(s.canonicalText, maxTextLen)}`);
                lines.push(`  S write=${truncate(s.stWriteText, maxTextLen)}`);
            } else {
                lines.push('  S <empty>');
            }

            shown++;
        }

        return lines.join('\n');
    }
}

function truncate(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    return `${text.slice(0, Math.max(0, maxLen - 1))}…`;
}
