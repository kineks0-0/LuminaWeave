import type { TimelineSourceId } from '../stores/useTimelineStore';
import type { LorebookVersionMode } from './LorebookViewTypes';

export interface ResolvedLorebookMemoryItem {
    id: string;
    title: string;
    keys: string[];
    excerpt: string;
    disabled: boolean;
}

export interface ResolvedLorebookMemoryEntry {
    bookId: string | null;
    versionMode: LorebookVersionMode;
    versionLabel: string;
    versionHint: string;
    snapshotKey: string | null;
    entryCount: number;
    entries: ResolvedLorebookMemoryItem[];
}

export interface ConversationSessionSummary {
    sourceId: TimelineSourceId;
    sessionId: string | null;
    title: string;
    subtitle: string;
}

export interface MemorySnapshot {
    sourceId: TimelineSourceId;
    sessionId: string | null;
    activeLeafId: string | null;
    messageCount: number;
    selectedChatSessionId?: string | null;
    selectedChatSnapshotId?: string | null;
    lorebook: ResolvedLorebookMemoryEntry;
}
