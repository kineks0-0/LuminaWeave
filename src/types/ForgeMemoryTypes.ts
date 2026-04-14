export type ForgeMemorySource = 'user' | 'planner' | 'analyst' | 'system';

export interface ForgeMemoryEntry {
    path: string;
    title: string;
    content: string;
    summary: string;
    updatedAt: number;
    source: ForgeMemorySource;
}

export interface ForgeMemoryTree {
    entries: ForgeMemoryEntry[];
    lastUpdatedAt: number;
}
