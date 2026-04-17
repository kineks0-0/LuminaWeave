import { useForgeStore } from '../../stores/useForgeStore.js';
import type { ForgeWorkspaceSession, ForgeWorkspaceSessionRef } from '../../types/SessionTypes.js';
import { API_BASE, API_ROUTES } from '../../../../shared/ApiEndpoints.js';
import {
    cloneForgeMemoryTree,
    cloneDraftTree,
    cloneStructuredState,
    createEmptyForgeMemoryTree,
    createEmptyDraftTree,
    createEmptyStructuredState
} from './utils/forgeStateDefaults.js';
import { BridgeDispatcher } from '../../../../shared/api/BridgeDispatcher.js';
import type { ConversationDocument } from '../../../../shared/ConversationTypes.js';
import { migrateLegacyForgeSession } from '../../../../shared/ConversationMigration.js';

const STORAGE_KEY = 'lumina-forge.workspace-sessions';
const ACTIVE_KEY = 'lumina-forge.active-session-id';

const generateSessionChatId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `lw_card_${crypto.randomUUID()}`;
    }
    return `lw_card_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
};

export class ForgeSessionRepository {
    private conversationToSession(document: ConversationDocument): ForgeWorkspaceSession {
        const forge = document.pluginState.forge || {};
        return {
            id: document.id,
            sessionChatId: forge.sessionChatId || document.legacy?.legacyChatId || generateSessionChatId(),
            title: document.title,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
            presetId: forge.presetId || '',
            activeLeafId: document.activeLeafId,
            worldlineNodes: document.nodes || [],
            selectedChatSessionId: forge.selectedChatSessionId || null,
            selectedChatSnapshotId: forge.selectedChatSnapshotId || null,
            draftInput: forge.draftInput || '',
            timelineItems: [],
            stagingEntries: (forge.stagingEntries || []) as any[],
            commitReadyEntries: (forge.commitReadyEntries || []) as any[],
            virtualLorebookEntries: (forge.virtualLorebookEntries || []) as any[],
            importedLorebookId: forge.importedLorebookId || null,
            workflowSnapshot: (forge.workflowSnapshot || null) as any,
            detailMode: (forge.detailMode || null) as any,
            entryMode: (forge.entryMode || null) as any,
            structuredState: cloneStructuredState((forge.structuredState || createEmptyStructuredState()) as any),
            draftTree: cloneDraftTree((forge.draftTree || createEmptyDraftTree()) as any),
            forgeMemoryTree: cloneForgeMemoryTree((forge.forgeMemoryTree || createEmptyForgeMemoryTree()) as any),
            activeLayer: (forge.activeLayer || 'concept') as any,
            completedLayers: (forge.completedLayers || []) as any,
            publishState: (forge.publishState || 'drafting') as any,
            activeAuxPanel: forge.activeAuxPanel as any,
            auxPresentationMode: forge.auxPresentationMode as any,
            worldlineSnapshots: forge.worldlineSnapshots as any,
            workspaceMode: 'workspace'
        };
    }

    private sessionToConversation(session: ForgeWorkspaceSession): ConversationDocument {
        return migrateLegacyForgeSession(session as any, session.worldlineNodes);
    }

    private pruneOldSessions(sessions: ForgeWorkspaceSession[], count: number = 3): ForgeWorkspaceSession[] {
        if (sessions.length <= count) return sessions;
        const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
        // 修正：保留最近更新的 count 个，其余的截断
        return sorted.slice(0, count);
    }

    private mergeSessions(primary: ForgeWorkspaceSession[], secondary: ForgeWorkspaceSession[]): ForgeWorkspaceSession[] {
        const merged = new Map<string, ForgeWorkspaceSession>();

        [...secondary, ...primary].forEach((session) => {
            const existing = merged.get(session.id);
            if (!existing || session.updatedAt >= existing.updatedAt) {
                merged.set(session.id, session);
            }
        });

        return Array.from(merged.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    }

    private readLocal(): ForgeWorkspaceSession[] {
        if (typeof localStorage === 'undefined') return [];
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed)
                ? parsed.map((session: Partial<ForgeWorkspaceSession>) => ({
                    sessionChatId: session.sessionChatId || generateSessionChatId(),
                    id: session.id || `forge_ws_${Date.now().toString(36)}`,
                    title: session.title || 'Forge Workspace',
                    createdAt: session.createdAt || Date.now(),
                    updatedAt: session.updatedAt || Date.now(),
                    presetId: session.presetId || '',
                    activeLeafId: session.activeLeafId || null,
                    worldlineNodes: session.worldlineNodes || [],
                    selectedChatSessionId: session.selectedChatSessionId || null,
                    selectedChatSnapshotId: session.selectedChatSnapshotId || null,
                    draftInput: session.draftInput || '',
                    timelineItems: session.timelineItems || [],
                    stagingEntries: (session.stagingEntries || []).map((entry) => ({
                        ...entry,
                        layer: entry.layer || null,
                        sourceTag: entry.sourceTag || null,
                        sourceMessageId: entry.sourceMessageId || null,
                        sourceSessionId: entry.sourceSessionId || null
                    })),
                    commitReadyEntries: (session.commitReadyEntries || []).map((entry) => ({
                        ...entry,
                        layer: entry.layer || null,
                        sourceTag: entry.sourceTag || null,
                        sourceMessageId: entry.sourceMessageId || null,
                        sourceSessionId: entry.sourceSessionId || null
                    })),
                    virtualLorebookEntries: session.virtualLorebookEntries || [],
                    importedLorebookId: session.importedLorebookId || null,
                    workflowSnapshot: session.workflowSnapshot || null,
                    detailMode: session.detailMode || null,
                    entryMode: session.entryMode || null,
                    structuredState: cloneStructuredState(session.structuredState || createEmptyStructuredState()),
                    draftTree: cloneDraftTree(session.draftTree || createEmptyDraftTree()),
                    forgeMemoryTree: cloneForgeMemoryTree(session.forgeMemoryTree || createEmptyForgeMemoryTree()),
                    activeLayer: session.activeLayer || 'concept',
                    completedLayers: session.completedLayers || [],
                    publishState: session.publishState || 'drafting',
                    workspaceMode: ((session as any).workspaceMode === 'stub' ? 'stub' : 'workspace') as 'workspace'
                }))
                .map(s => this.dehydrateSession(s)) // 强制脱水所有本地读取的数据，确保 localStorage 绝对轻量
                : [];
        } catch {
            return [];
        }
    }

    private writeLocal(sessions: ForgeWorkspaceSession[]): void {
        if (typeof localStorage === 'undefined') return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
        } catch (e: any) {
            if (e.name === 'QuotaExceededError') {
                console.warn('[ForgeRepository] LocalStorage 额度溢出，尝试清理旧会话...');
                // 仅保留最近的几个会话作为缓存，物理隔离新会话
                const pruned = this.pruneOldSessions(sessions, 3);
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
                } catch {
                    console.error('[ForgeRepository] 清理后依然无法保存到本地，将仅依赖后端同步。');
                    // 极致情况：只留当前正在编辑的 ID
                    const activeId = this.getActiveSessionId();
                    const minimal = sessions.filter(s => s.id === activeId);
                    try {
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal));
                    } catch {
                        localStorage.removeItem(STORAGE_KEY);
                    }
                }
            }
        }
    }

    private async syncSessionToServer(session: ForgeWorkspaceSession): Promise<boolean> {
        try {
            await BridgeDispatcher.conversation.saveConversation(session.id, this.sessionToConversation(session));
            return true;
        } catch {
            return false;
        }
    }

    private dehydrateSession(session: ForgeWorkspaceSession): ForgeWorkspaceSession {
        // “脱水”逻辑：清空重量级内容，本地仅留存根
        return {
            ...session,
            worldlineNodes: [],
            timelineItems: [],
            stagingEntries: [],
            commitReadyEntries: [],
            virtualLorebookEntries: [],
            draftTree: createEmptyDraftTree(),
            forgeMemoryTree: createEmptyForgeMemoryTree(),
            structuredState: createEmptyStructuredState(),
            workspaceMode: 'stub' as any // 标记为存根
        };
    }

    listSessions(): ForgeWorkspaceSessionRef[] {
        return this.readLocal()
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((session) => ({
                id: session.id,
                title: session.title,
                createdAt: session.createdAt,
                updatedAt: session.updatedAt,
                messageCount: session.worldlineNodes.length,
                selectedChatSessionId: session.selectedChatSessionId
            }));
    }

    async loadSession(id: string): Promise<ForgeWorkspaceSession | null> {
        // 1. 优先从后端拉取完整数据
        try {
            const data = await BridgeDispatcher.conversation.getConversation(id);
            if (data && data.document) {
                console.log(`[ForgeRepository] 已从后端加载会话: ${id}`);
                // 顺便更新下本地存根，保持元数据同步
                const session = this.conversationToSession(data.document);
                this.updateLocalMeta(session);
                return session;
            }
        } catch (e) {
            console.warn(`[ForgeRepository] 从后端加载会话失败，尝试回退到本地: ${id}`, e);
        }

        // 2. 后端不可用或 404，回退到本地
        const local = this.readLocal().find(session => session.id === id);
        if (local) {
            if ((local as any).workspaceMode === 'stub') {
                console.warn(`[ForgeRepository] 本地仅存在会话存根，且后端不可达: ${id}`);
                // 此时可以考虑弹窗提示，或者直接返回 stub（UI 层需处理空数据）
            }
            return local;
        }

        return null;
    }

    private updateLocalMeta(session: ForgeWorkspaceSession): void {
        const sessions = this.readLocal();
        const index = sessions.findIndex(s => s.id === session.id);
        const stub = this.dehydrateSession(session);
        if (index === -1) {
            sessions.push(stub);
        } else {
            sessions[index] = stub;
        }
        this.writeLocal(sessions);
    }

    async saveSession(session: ForgeWorkspaceSession): Promise<void> {
        const normalizedSession: ForgeWorkspaceSession = {
            ...session,
            structuredState: cloneStructuredState(session.structuredState || createEmptyStructuredState()),
            draftTree: cloneDraftTree(session.draftTree || createEmptyDraftTree()),
            forgeMemoryTree: cloneForgeMemoryTree(session.forgeMemoryTree || createEmptyForgeMemoryTree())
        };

        // 1. 优先推送到后端
        const syncSuccess = await this.syncSessionToServer(normalizedSession);

        // 2. 根据同步结果决定本地存储深度
        const sessions = this.readLocal();
        const index = sessions.findIndex(item => item.id === session.id);
        
        // 本地禁止保存聊天记录与完整状态，仅保留元数据存根
        // 即使同步失败也不回退到本地完整备份，以彻底避免 LocalStorage 溢出
        const localContent = this.dehydrateSession(normalizedSession);

        if (index === -1) {
            sessions.push(localContent);
        } else {
            sessions[index] = localContent;
        }

        this.writeLocal(sessions);
        this.setActiveSessionId(normalizedSession.id);
        
        if (syncSuccess) {
            console.log(`[ForgeRepository] 会话已成功同步至后端，本地存根已更新: ${session.id}`);
        } else {
            console.warn(`[ForgeRepository] 后端同步失败，本地仅保留元数据存根，刷新页面可能会丢失未同步的内容: ${session.id}`);
        }
    }

    renameSession(id: string, title: string): ForgeWorkspaceSession | null {
        const nextTitle = title.trim();
        if (!nextTitle) return null;

        const sessions = this.readLocal();
        const index = sessions.findIndex(item => item.id === id);
        if (index === -1) return null;

        const updated: ForgeWorkspaceSession = {
            ...sessions[index],
            title: nextTitle,
            updatedAt: Date.now()
        };
        sessions[index] = updated;
        this.writeLocal(sessions);
        void this.syncSessionToServer(updated);
        return updated;
    }

    async createSession(partial?: Partial<ForgeWorkspaceSession>): Promise<ForgeWorkspaceSession> {
        const now = Date.now();
        const forgeStore = useForgeStore();
        const id = partial?.id || `forge_ws_${now.toString(36)}`;

        const session: ForgeWorkspaceSession = {
            id,
            sessionChatId: partial?.sessionChatId || generateSessionChatId(),
            title: partial?.title || `Forge Workspace ${new Date(now).toLocaleDateString()}`,
            createdAt: partial?.createdAt || now,
            updatedAt: partial?.updatedAt || now,
            presetId: partial?.presetId || '',
            activeLeafId: partial?.activeLeafId || null,
            worldlineNodes: partial?.worldlineNodes || [],
            selectedChatSessionId: partial?.selectedChatSessionId || null,
            selectedChatSnapshotId: partial?.selectedChatSnapshotId || null,
            draftInput: partial?.draftInput || '',
            timelineItems: partial?.timelineItems || [],
            stagingEntries: (partial?.stagingEntries || forgeStore.stagingArea || []).map((entry) => ({
                ...entry,
                layer: entry.layer || null,
                sourceTag: entry.sourceTag || null,
                sourceMessageId: entry.sourceMessageId || null,
                sourceSessionId: entry.sourceSessionId || null
            })),
            commitReadyEntries: (partial?.commitReadyEntries || forgeStore.commitReadyEntries || []).map((entry) => ({
                ...entry,
                layer: entry.layer || null,
                sourceTag: entry.sourceTag || null,
                sourceMessageId: entry.sourceMessageId || null,
                sourceSessionId: entry.sourceSessionId || null
            })),
            virtualLorebookEntries: partial?.virtualLorebookEntries || [],
            importedLorebookId: partial?.importedLorebookId || null,
            workflowSnapshot: partial?.workflowSnapshot || null,
            detailMode: partial?.detailMode || null,
            entryMode: partial?.entryMode || null,
            structuredState: cloneStructuredState(partial?.structuredState || createEmptyStructuredState()),
            draftTree: cloneDraftTree(partial?.draftTree || createEmptyDraftTree()),
            forgeMemoryTree: cloneForgeMemoryTree(partial?.forgeMemoryTree || createEmptyForgeMemoryTree()),
            activeLayer: partial?.activeLayer || 'concept',
            completedLayers: partial?.completedLayers || [],
            publishState: partial?.publishState || 'drafting',
            workspaceMode: 'workspace'
        };

        await this.saveSession(session);
        return session;
    }

    async refreshFromServer(): Promise<void> {
        try {
            const data = await BridgeDispatcher.conversation.listConversations();
            const remote = Array.isArray(data.conversations)
                ? data.conversations.filter((conversation) => conversation.conversationType === 'forge')
                : [];
            const hydratedRemote = await Promise.all(remote.map(async (conversation) => {
                const full = await BridgeDispatcher.conversation.getConversation(conversation.id);
                return full.document ? this.conversationToSession(full.document) : null;
            }));
            const remoteSessions = hydratedRemote.filter((session): session is ForgeWorkspaceSession => Boolean(session));
            
            const local = this.readLocal();
            
            // 迁移逻辑：如果本地有远端没有的会话，尝试同步给远端
            const remoteIds = new Set(remoteSessions.map((s) => s.id));
            const migrationTasks = local.filter(s => !remoteIds.has(s.id));
            if (migrationTasks.length > 0) {
                console.log(`[ForgeRepository] 发现 ${migrationTasks.length} 个未同步的本地会话，正在迁移至后端...`);
                for (const session of migrationTasks) {
                    await this.syncSessionToServer(session).catch(() => {});
                }
            }

            const merged = this.mergeSessions(local, remoteSessions);
            this.writeLocal(merged);
        } catch (e) {
            console.warn('[ForgeRepository] 刷新服务端会话列表失败，降级为本地模式', e);
        }
    }

    getActiveSessionId(): string | null {
        if (typeof localStorage === 'undefined') return null;
        return localStorage.getItem(ACTIVE_KEY);
    }

    setActiveSessionId(id: string | null): void {
        if (typeof localStorage === 'undefined') return;
        if (!id) {
            localStorage.removeItem(ACTIVE_KEY);
            return;
        }
        localStorage.setItem(ACTIVE_KEY, id);
    }
}

export const forgeSessionRepository = new ForgeSessionRepository();
