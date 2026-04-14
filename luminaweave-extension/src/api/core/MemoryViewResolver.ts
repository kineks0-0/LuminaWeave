import type {
    MemorySnapshot,
    ConversationSessionSummary,
    ResolvedLorebookMemoryEntry,
    ResolvedLorebookMemoryItem
} from '../../types/MemorySnapshotTypes';
import type { TimelineSourceId } from '../../stores/useTimelineStore';
import type { ResolvedLorebookViewState } from '../../types/LorebookViewTypes';

export interface ResolveMemoryViewParams {
    sourceId: TimelineSourceId;
    sessionId: string | null;
    activeLeafId: string | null;
    messageCount: number;
    lorebook: {
        selectedBookId: string | null;
        resolvedView: ResolvedLorebookViewState;
    };
    forge?: {
        workspaceTitle: string;
        selectedChatSessionId: string | null;
        selectedChatSnapshotId: string | null;
    };
}

export class MemoryViewResolver {
    private static buildLorebookMemoryItems(entries: LuminaLorebookEntry[]): ResolvedLorebookMemoryItem[] {
        return entries.map((entry, index) => {
            const title = entry.comment?.trim()
                || entry.key?.[0]?.trim()
                || `Entry ${index + 1}`;
            const excerpt = (entry.content || '')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 140);

            return {
                id: String(entry.uid ?? `entry_${index}`),
                title,
                keys: Array.isArray(entry.key) ? [...entry.key] : [],
                excerpt,
                disabled: Boolean(entry.disable || entry.enabled === false)
            };
        });
    }

    static buildSessionSummary(params: ResolveMemoryViewParams): ConversationSessionSummary {
        if (params.sourceId === 'forge') {
            return {
                sourceId: 'forge',
                sessionId: params.sessionId,
                title: params.forge?.workspaceTitle || 'Forge Workspace',
                subtitle: params.forge?.selectedChatSessionId
                    ? `参考聊天 ${params.forge.selectedChatSessionId}`
                    : '未绑定历史聊天会话'
            };
        }

        return {
            sourceId: 'chat',
            sessionId: params.sessionId,
            title: '剧情演播',
            subtitle: params.activeLeafId ? `node ${params.activeLeafId.slice(-6)}` : '当前主聊天世界线'
        };
    }

    static buildLorebookMemoryEntry(params: ResolveMemoryViewParams): ResolvedLorebookMemoryEntry {
        return {
            bookId: params.lorebook.selectedBookId,
            versionMode: params.lorebook.resolvedView.mode,
            versionLabel: params.lorebook.resolvedView.versionLabel,
            versionHint: params.lorebook.resolvedView.versionHint,
            snapshotKey: params.lorebook.resolvedView.snapshotKey,
            entryCount: params.lorebook.resolvedView.entries.length,
            entries: this.buildLorebookMemoryItems(params.lorebook.resolvedView.entries)
        };
    }

    static buildSnapshot(params: ResolveMemoryViewParams): MemorySnapshot {
        return {
            sourceId: params.sourceId,
            sessionId: params.sessionId,
            activeLeafId: params.activeLeafId,
            messageCount: params.messageCount,
            selectedChatSessionId: params.forge?.selectedChatSessionId || null,
            selectedChatSnapshotId: params.forge?.selectedChatSnapshotId || null,
            lorebook: this.buildLorebookMemoryEntry(params)
        };
    }
}
