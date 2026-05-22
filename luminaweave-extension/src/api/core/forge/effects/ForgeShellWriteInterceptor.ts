/**
 * ForgeShellWriteInterceptor — 截获 shell 写入日志，转为 ForgeRuntimeEffect
 */

import type { ForgeRuntimeEffect } from '../../../../types/ForgeRuntimeTypes.js';
import type { ForgeShellWriteLogEntry } from '../shell/ForgeWorkspaceSearchShell.js';
import { forgeShellWriteParser } from './ForgeShellWriteParser.js';

export interface ForgeShellWriteInterceptResult {
    effects: ForgeRuntimeEffect[];
    unparsedFileCount: number;
}

export class ForgeShellWriteInterceptor {
    intercept(writeLog: ForgeShellWriteLogEntry[]): ForgeShellWriteInterceptResult {
        if (writeLog.length === 0) return { effects: [], unparsedFileCount: 0 };

        const parsed = forgeShellWriteParser.parse(writeLog);
        const effects: ForgeRuntimeEffect[] = [];

        if (parsed.stagingEntries.length > 0) {
            effects.push({
                type: 'stage_from_shell_write',
                entries: parsed.stagingEntries.map(e => ({
                    path: e.path,
                    content: e.proposedContent,
                    originalContent: e.originalContent,
                    command: e.command
                }))
            });
        }

        return {
            effects,
            unparsedFileCount: parsed.unparsedFiles.length
        };
    }
}

export const forgeShellWriteInterceptor = new ForgeShellWriteInterceptor();
