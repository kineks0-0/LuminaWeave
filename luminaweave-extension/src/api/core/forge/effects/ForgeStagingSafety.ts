import type { StagingEntry } from '../../../../types/ForgeRuntimeTypes.js';

export interface ForgeSuspiciousStagingDetection {
    suspicious: boolean;
    suspiciousReason?: string;
}

const PROMPT_PROTOCOL_PATTERNS = [
    /<entry_update\b/i,
    /<memory_update\b/i,
    /<forge_auto_list\b/i,
    /ForgeLayerNavigator/i,
    /典型产出/,
    /输出协议/,
    /原生\s*tool\s*calling/i,
    /当前你的项目正处于/,
    /AUTO\/Checklist/i
];

export function detectSuspiciousStagingEntryContent(input: Pick<StagingEntry, 'description' | 'proposedContent' | 'targetEntryId'>): ForgeSuspiciousStagingDetection {
    const inspectedText = [
        input.targetEntryId,
        input.description,
        input.proposedContent
    ].join('\n');
    const matched = PROMPT_PROTOCOL_PATTERNS
        .filter(pattern => pattern.test(inspectedText))
        .map(pattern => pattern.source);
    if (matched.length === 0) {
        return { suspicious: false };
    }
    return {
        suspicious: true,
        suspiciousReason: `possible prompt/protocol staging contamination (${matched.length} marker${matched.length > 1 ? 's' : ''})`
    };
}

export function annotateSuspiciousStagingEntry<T extends Omit<StagingEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: number }>(entry: T): T {
    const detection = detectSuspiciousStagingEntryContent(entry);
    if (!detection.suspicious) return entry;
    return {
        ...entry,
        suspicious: true,
        suspiciousReason: detection.suspiciousReason
    };
}
