export type LorebookVersionMode = 'follow-timeline' | 'pinned' | 'manual';

export interface LorebookTimelineContext {
  bookId: string | null;
  sourceId: string;
  activeLeafId: string | null;
  sessionId?: string | null;
}

export interface LorebookEntrySnapshot {
  key: string;
  bookId: string;
  sourceId: string;
  activeLeafId: string | null;
  sessionId?: string | null;
  capturedAt: string;
  label: string;
  entries: LuminaLorebookEntry[];
}

export interface ResolvedLorebookViewState {
  mode: LorebookVersionMode;
  snapshotKey: string | null;
  versionLabel: string;
  versionHint: string;
  entries: LuminaLorebookEntry[];
}
