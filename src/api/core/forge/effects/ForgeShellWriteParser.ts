/**
 * ForgeShellWriteParser — 解析 shell 写入产物为 StagingEntry 数组
 */

import type { StagingEntry } from '../../../../types/ForgeRuntimeTypes.js';
import type { ForgeShellWriteLogEntry } from '../shell/ForgeWorkspaceSearchShell.js';

export interface ParsedShellWrite {
    stagingEntries: Array<{
        targetEntryId: string;
        proposedContent: string;
        description: string;
        originalContent: string;
        sourceTag: string;
        command: string;
        path: string;
    }>;
    unparsedFiles: string[];
}

export class ForgeShellWriteParser {
    parse(writeLog: ForgeShellWriteLogEntry[]): ParsedShellWrite {
        const stagingEntries: ParsedShellWrite['stagingEntries'] = [];
        const unparsedFiles: string[] = [];

        for (const entry of writeLog) {
            if (!entry.contentAfter || entry.contentAfter === entry.contentBefore) continue;
            const basename = entry.path.split('/').pop() || entry.path;
            const parsed = this.tryParseContent(entry.contentAfter, basename, entry.path);
            if (parsed) {
                stagingEntries.push({
                    ...parsed,
                    originalContent: entry.contentBefore,
                    command: entry.command,
                    sourceTag: 'shell-write',
                    path: entry.path
                });
            } else {
                stagingEntries.push({
                    targetEntryId: entry.path,
                    proposedContent: entry.contentAfter,
                    description: `Shell 写入: ${basename}`,
                    originalContent: entry.contentBefore,
                    sourceTag: 'shell-write',
                    command: entry.command,
                    path: entry.path
                });
            }
        }

        return { stagingEntries, unparsedFiles };
    }

    private tryParseContent(content: string, basename: string, path: string): {
        targetEntryId: string;
        proposedContent: string;
        description: string;
        sourceTag: string;
    } | null {
        const ext = basename.match(/\.(\w+)$/)?.[1]?.toLowerCase();

        // JSON
        if (ext === 'json') {
            try {
                const obj = JSON.parse(content);
                const title = obj.title || obj.name || obj.comment || basename.replace('.json', '');
                const entryContent = obj.content || obj.body || obj.text || JSON.stringify(obj, null, 2);
                return {
                    targetEntryId: obj.id || obj.uid || path.replace(/\.[^.]+$/, ''),
                    proposedContent: entryContent,
                    description: `shell-write: ${title}`,
                    sourceTag: 'shell-write'
                };
            } catch {
                return null;
            }
        }

        // YAML / YML
        if (ext === 'yaml' || ext === 'yml') {
            try {
                // lazy require to avoid dependency overhead when unused
                const yaml = require('yaml');
                const obj = yaml.parse(content);
                if (obj && typeof obj === 'object') {
                    const title = obj.title || obj.name || basename.replace(/\.ya?ml$/, '');
                    const entryContent = obj.content || obj.body || content;
                    return {
                        targetEntryId: obj.id || obj.uid || path.replace(/\.[^.]+$/, ''),
                        proposedContent: entryContent,
                        description: `shell-write: ${title}`,
                        sourceTag: 'shell-write'
                    };
                }
            } catch {
                return null;
            }
        }

        return null;
    }
}

export const forgeShellWriteParser = new ForgeShellWriteParser();
