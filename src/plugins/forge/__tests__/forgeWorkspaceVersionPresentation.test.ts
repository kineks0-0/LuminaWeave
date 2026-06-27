import { describe, expect, it } from 'vitest';
import type { ForgeWorkspaceGitLogEntry } from '@/api/core/forge/project/ForgeWorkspaceGitService.js';
import {
    buildWorkspaceVersionRowsFromGitLog,
    compactId,
    countGitVersionChanges,
    gitChangeStatusLabel
} from '../project/forgeWorkspaceVersionPresentation.js';

const logEntry = (overrides: Partial<ForgeWorkspaceGitLogEntry> = {}): ForgeWorkspaceGitLogEntry => ({
    hash: '1234567890abcdef1234567890abcdef12345678',
    shortHash: '1234567',
    message: 'Update card',
    parents: ['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
    authorName: 'Forge',
    authorEmail: 'forge@example.test',
    createdAt: 1000,
    changedFiles: [{
        path: 'card.md',
        status: 'modified',
        oldHash: 'old',
        newHash: 'new'
    }],
    ...overrides
});

describe('forgeWorkspaceVersionPresentation', () => {
    it('projects Git log entries into version rows', () => {
        const rows = buildWorkspaceVersionRowsFromGitLog([
            logEntry(),
            logEntry({
                hash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                shortHash: 'bbbbbbb',
                message: 'Create memory',
                parents: [],
                changedFiles: [{
                    path: 'memory/AUTO.md',
                    status: 'added'
                }]
            })
        ]);

        expect(rows).toEqual([
            expect.objectContaining({
                id: '1234567890abcdef1234567890abcdef12345678',
                title: 'Update card',
                parentHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                summary: '1 file change(s)'
            }),
            expect.objectContaining({
                id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                title: 'Create memory',
                parentHash: null
            })
        ]);
        expect(countGitVersionChanges(rows)).toBe(2);
    });

    it('formats status labels and compact hashes', () => {
        expect(gitChangeStatusLabel('added')).toBe('新增');
        expect(gitChangeStatusLabel('deleted')).toBe('删除');
        expect(gitChangeStatusLabel('modified')).toBe('更新');
        expect(compactId('1234567890abcdef')).toBe('123456...cdef');
    });
});
