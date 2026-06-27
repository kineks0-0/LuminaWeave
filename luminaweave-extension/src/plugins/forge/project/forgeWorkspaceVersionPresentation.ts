import type {
    ForgeWorkspaceGitChangedFile,
    ForgeWorkspaceGitLogEntry
} from '../../../api/core/forge/project/ForgeWorkspaceGitService.js';

export interface WorkspaceVersionRow {
    id: string;
    hash: string;
    shortHash: string;
    title: string;
    summary: string;
    createdAt: number;
    parentHash: string | null;
    changedFiles: ForgeWorkspaceGitChangedFile[];
}

export const buildWorkspaceVersionRowsFromGitLog = (
    entries: ForgeWorkspaceGitLogEntry[]
): WorkspaceVersionRow[] => entries.map(entry => ({
    id: entry.hash,
    hash: entry.hash,
    shortHash: entry.shortHash,
    title: entry.message.trim() || 'Update Forge workspace',
    summary: `${entry.changedFiles.length} file change(s)`,
    createdAt: entry.createdAt,
    parentHash: entry.parents[0] ?? null,
    changedFiles: entry.changedFiles
}));

export const countGitVersionChanges = (rows: WorkspaceVersionRow[]): number =>
    rows.reduce((sum, row) => sum + row.changedFiles.length, 0);

export const gitChangeStatusLabel = (status: ForgeWorkspaceGitChangedFile['status']): string => {
    if (status === 'added') return '新增';
    if (status === 'deleted') return '删除';
    return '更新';
};

export const compactId = (value: string): string =>
    value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
