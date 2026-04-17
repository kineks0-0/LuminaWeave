import type { WatchStopHandle } from 'vue';
import { WorldlineStore } from './WorldlineStore.js';
import { PersistenceService } from './PersistenceService.js';
import { chatSessionIndexService } from './ChatSessionIndexService.js';
import { forgeSessionRepository } from './ForgeSessionRepository.js';
import { forgeConversationGateway } from './ForgeConversationGateway.js';
import { ChatConversationGateway } from './ChatConversationGateway.js';
import type { LuminaChatMessage } from '../../../../shared/LuminaMessage.js';
import type {
    ConversationContextOption,
    ConversationContextOverride,
    ConversationContextSwitchInput,
    ConversationNodeSwitchInput,
    ConversationSessionRef,
    ConversationSourceAdapter,
    ConversationSourceId,
    ConversationTimelineNode,
    ConversationViewContext
} from '../../types/ConversationContextTypes.js';
import { LuminaWeaveAPIBase } from './LuminaWeaveAPIBase.js';

type LuminaApiLike = LuminaWeaveAPIBase & {
    chatManager: {
        store: WorldlineStore;
        activeLeafId: string | null;
        persistence: PersistenceService;
        branchFromNode(targetNodeId: string): Promise<boolean>;
        rollbackFromNode(targetNodeId: string): Promise<boolean>;
    };
    on(event: string, callback: Function): void;
};

type ChatSessionCache = {
    store: WorldlineStore;
    persistence: PersistenceService;
};

const DEFAULT_CONTEXT: ConversationContextSwitchInput = {
    sourceId: 'chat',
    sessionId: null
};

const normalizeSessionId = (sessionId: string | null | undefined): string | null => {
    if (!sessionId || sessionId === 'null' || sessionId === 'undefined' || sessionId === 'default') {
        return null;
    }
    return sessionId;
};

const buildTimelineGraph = (nodes: LuminaChatMessage[]): Record<string, ConversationTimelineNode> => {
    return nodes.reduce<Record<string, ConversationTimelineNode>>((acc, node) => {
        acc[node.id] = {
            ...node,
            text: node.mes || node.mesRaw || '',
            timestamp: Number(node.extra?.send_date || node.createdAt || Date.now()),
            _original: node
        };
        return acc;
    }, {});
};

const buildContextFromStore = (
    source: ConversationSourceId,
    sessionId: string | null,
    store: WorldlineStore,
    activeLeafId: string | null,
    meta: ConversationViewContext['meta'] = {}
): ConversationViewContext => {
    const resolvedLeafId = activeLeafId || store.activeLeafId || null;
    const messages = store.getTrace(resolvedLeafId);
    const timelineGraph = buildTimelineGraph(store.nodePool);
    const focusedMessage = resolvedLeafId
        ? messages.find((message) => message.id === resolvedLeafId) || null
        : null;

    return {
        source,
        sessionId,
        activeLeafId: resolvedLeafId,
        messages,
        timelineGraph,
        focusedMessage,
        meta
    };
};

class ChatConversationSourceAdapter implements ConversationSourceAdapter {
    public readonly id = 'chat' as const;
    public readonly label = '剧情演播';
    public readonly description = '当前 ST 主聊天';
    private cache = new Map<string, ChatSessionCache>();
    private readonly gateway: ChatConversationGateway;

    constructor(private api: LuminaApiLike) {
        this.gateway = new ChatConversationGateway(api);
    }

    private getCurrentChatId(): string | null {
        return normalizeSessionId(this.gateway.getCurrentChatId());
    }

    private isLiveSession(sessionId: string | null): boolean {
        const currentChatId = this.getCurrentChatId();
        return Boolean(currentChatId && sessionId === currentChatId);
    }

    private async getCachedSession(chatId: string): Promise<ChatSessionCache> {
        const existing = this.cache.get(chatId);
        if (existing) {
            return existing;
        }

        const store = new WorldlineStore();
        const persistence = new PersistenceService(store, () => true);
        await persistence.loadFromIndependentChat(chatId, { applyMetadataHooks: false });
        const cacheItem = { store, persistence };
        this.cache.set(chatId, cacheItem);
        return cacheItem;
    }

    private async resolveSessionStore(sessionId?: string | null): Promise<{
        sessionId: string | null;
        store: WorldlineStore;
        persistence: PersistenceService;
        isLive: boolean;
    }> {
        const currentChatId = this.getCurrentChatId();
        const resolvedSessionId = normalizeSessionId(sessionId) || currentChatId;
        if (!resolvedSessionId) {
            return {
                sessionId: null,
                store: this.gateway.getLiveStore(),
                persistence: this.gateway.getLivePersistence(),
                isLive: true
            };
        }

        if (this.isLiveSession(resolvedSessionId)) {
            return {
                sessionId: resolvedSessionId,
                store: this.gateway.getLiveStore(),
                persistence: this.gateway.getLivePersistence(),
                isLive: true
            };
        }

        const cached = await this.getCachedSession(resolvedSessionId);
        return {
            sessionId: resolvedSessionId,
            store: cached.store,
            persistence: cached.persistence,
            isLive: false
        };
    }

    async listSessions(): Promise<ConversationSessionRef[]> {
        const sessions = await chatSessionIndexService.listChatSessions();
        return sessions.map((session) => ({
            ...session,
            sourceId: 'chat'
        }));
    }

    async getSourceOption(): Promise<ConversationContextOption> {
        const currentChatId = this.getCurrentChatId();
        const graph = buildTimelineGraph(this.gateway.getLiveStore().nodePool);
        return {
            id: 'chat',
            label: this.label,
            description: this.description,
            count: Object.keys(graph).length,
            sessionId: currentChatId,
            activeLeafId: this.gateway.getActiveLeafId()
        };
    }

    async getContext(override: ConversationContextOverride = {}): Promise<ConversationViewContext> {
        const currentChatId = this.getCurrentChatId();
        const resolved = await this.resolveSessionStore(override.sessionId);
        return buildContextFromStore(
            'chat',
            resolved.sessionId,
            resolved.store,
            override.activeLeafId ?? resolved.store.activeLeafId,
            {
                currentChatSessionId: currentChatId,
                isLive: resolved.isLive
            }
        );
    }

    async selectSession(sessionId: string | null): Promise<string | null> {
        const normalized = normalizeSessionId(sessionId);
        if (!normalized) {
            return this.getCurrentChatId();
        }
        await this.resolveSessionStore(normalized);
        return normalized;
    }

    async switchToNode(input: ConversationNodeSwitchInput): Promise<boolean> {
        const resolved = await this.resolveSessionStore(input.sessionId);
        if (!resolved.sessionId || !resolved.store.hasNode(input.targetNodeId)) {
            return false;
        }

        if (resolved.isLive) {
            return this.gateway.branchFromNode(input.targetNodeId);
        }

        resolved.store.activeLeafId = input.targetNodeId;
        await resolved.persistence.saveToIndependentChat(resolved.sessionId);
        return true;
    }

    async branchFromNode(input: ConversationNodeSwitchInput): Promise<boolean> {
        return this.switchToNode(input);
    }

    async rollbackFromNode(input: ConversationNodeSwitchInput): Promise<boolean> {
        const resolved = await this.resolveSessionStore(input.sessionId);
        if (!resolved.sessionId) {
            return false;
        }

        if (resolved.isLive) {
            return this.gateway.rollbackFromNode(input.targetNodeId);
        }

        const trace = resolved.store.getTrace(resolved.store.activeLeafId);
        const targetIndex = trace.findIndex((node) => node.id === input.targetNodeId);
        if (targetIndex === -1) {
            return false;
        }

        trace.slice(targetIndex + 1).forEach((node) => resolved.store.removeNode(node.id, true));
        resolved.store.activeLeafId = input.targetNodeId;
        resolved.store.emit('WORLDLINE_ROLLED_BACK', input.targetNodeId);
        resolved.store.emit('WORLDLINE_UPDATED');
        await resolved.persistence.saveToIndependentChat(resolved.sessionId);
        return true;
    }
}

class ForgeConversationSourceAdapter implements ConversationSourceAdapter {
    public readonly id = 'forge' as const;
    public readonly label = '制卡工坊';
    public readonly description = 'Forge 工作会话';

    private getCurrentSessionId(): string | null {
        return normalizeSessionId(forgeConversationGateway.getCurrentSessionId());
    }

    private buildLiveContext(override: ConversationContextOverride = {}): ConversationViewContext {
        const store = forgeConversationGateway.getLiveState();
        const currentSessionId = this.getCurrentSessionId();
        const worldlineStore = forgeConversationGateway.getWorldlineStore();
        const fallbackStore = new WorldlineStore();
        const effectiveStore = worldlineStore || fallbackStore;

        if (!worldlineStore) {
            effectiveStore.setNodes(store.messages);
            effectiveStore.activeLeafId = store.activeLeafId;
        }

        return buildContextFromStore(
            'forge',
            currentSessionId,
            effectiveStore,
            override.activeLeafId ?? store.activeLeafId,
            {
                workspaceTitle: store.workspaceTitle,
                selectedChatSessionId: store.selectedChatSessionId,
                selectedChatSnapshotId: store.selectedChatSnapshotId,
                isLive: true
            }
        );
    }

    private async loadStoredContext(sessionId: string): Promise<ConversationViewContext> {
        const session = await forgeSessionRepository.loadSession(sessionId);
        if (!session) {
            const emptyStore = new WorldlineStore();
            return buildContextFromStore('forge', sessionId, emptyStore, null, {
                isLive: false
            });
        }

        const store = new WorldlineStore();
        store.setNodes(session.worldlineNodes || []);
        store.activeLeafId = session.activeLeafId || null;

        return buildContextFromStore('forge', session.id, store, session.activeLeafId || null, {
            workspaceTitle: session.title,
            selectedChatSessionId: session.selectedChatSessionId,
            selectedChatSnapshotId: session.selectedChatSnapshotId,
            isLive: false
        });
    }

    async listSessions(): Promise<ConversationSessionRef[]> {
        await forgeSessionRepository.refreshFromServer();
        return forgeSessionRepository.listSessions().map((session) => ({
            ...session,
            sourceId: 'forge'
        }));
    }

    async getSourceOption(): Promise<ConversationContextOption> {
        const store = forgeConversationGateway.getLiveState();
        return {
            id: 'forge',
            label: this.label,
            description: this.description,
            count: Object.keys(store.timelineGraph).length,
            sessionId: this.getCurrentSessionId(),
            activeLeafId: store.activeLeafId
        };
    }

    async getContext(override: ConversationContextOverride = {}): Promise<ConversationViewContext> {
        const requestedSessionId = normalizeSessionId(override.sessionId);
        const currentSessionId = this.getCurrentSessionId();
        if (!requestedSessionId || requestedSessionId === currentSessionId) {
            return this.buildLiveContext(override);
        }
        return this.loadStoredContext(requestedSessionId);
    }

    async selectSession(sessionId: string | null): Promise<string | null> {
        const normalized = normalizeSessionId(sessionId);
        const currentSessionId = this.getCurrentSessionId();
        if (!normalized || normalized === currentSessionId) {
            return currentSessionId;
        }

        await forgeConversationGateway.openWorkspaceSession(normalized);
        return normalized;
    }

    async switchToNode(input: ConversationNodeSwitchInput): Promise<boolean> {
        await this.selectSession(input.sessionId ?? null);
        const store = forgeConversationGateway.getLiveState();
        if (!store.timelineGraph[input.targetNodeId]) {
            return false;
        }
        forgeConversationGateway.switchToNode(input.targetNodeId);
        return true;
    }

    async branchFromNode(input: ConversationNodeSwitchInput): Promise<boolean> {
        await this.selectSession(input.sessionId ?? null);
        return forgeConversationGateway.branchFromNode(input.targetNodeId);
    }

    async rollbackFromNode(input: ConversationNodeSwitchInput): Promise<boolean> {
        await this.selectSession(input.sessionId ?? null);
        return forgeConversationGateway.rollbackFromNode(input.targetNodeId);
    }
}

export class ConversationService extends LuminaWeaveAPIBase {
    private readonly adapters = new Map<ConversationSourceId, ConversationSourceAdapter>();
    private readonly contextSelection: ConversationContextSwitchInput = { ...DEFAULT_CONTEXT };
    private forgeWatcherStop: WatchStopHandle | null = null;
    private isInitialized = false;

    constructor(private readonly api: LuminaApiLike) {
        super();
        this.registerAdapter(new ChatConversationSourceAdapter(api));
        this.registerAdapter(new ForgeConversationSourceAdapter());
        this.bindHostEvents();
    }

    private bindHostEvents(): void {
        this.api.on('CHAT_CHANGED', () => {
            void this.emitSessionsUpdated();
            void this.emitContextChangedIfCurrent('chat');
        });
        this.api.on('CHAT_CREATED', () => {
            void this.emitSessionsUpdated();
        });
        this.api.on('CHAT_DELETED', () => {
            void this.emitSessionsUpdated();
            void this.emitContextChangedIfCurrent('chat');
        });
        this.api.on('MESSAGE_RECEIVED', () => {
            void this.emitSessionsUpdated();
            void this.emitWorldlineUpdatedIfCurrent('chat');
        });
        this.api.on('TIMELINE_UPDATED', () => {
            void this.emitWorldlineUpdatedIfCurrent('chat');
        });
        this.api.on('WORLDLINE_SWITCHED', (targetNodeId: string) => {
            void this.emitWorldlineSwitchedIfCurrent('chat', targetNodeId);
        });
        this.api.on('WORLDLINE_ROLLED_BACK', (targetNodeId: string) => {
            void this.emitWorldlineRolledBackIfCurrent('chat', targetNodeId);
        });
    }

    private getSelectionSourceId(): ConversationSourceId {
        return this.contextSelection.sourceId;
    }

    private isCurrentSource(sourceId: ConversationSourceId): boolean {
        return this.getSelectionSourceId() === sourceId;
    }

    private async emitContextChangedIfCurrent(sourceId: ConversationSourceId): Promise<void> {
        if (!this.isCurrentSource(sourceId)) return;
        const context = await this.getConversationContext();
        this.emit('CONVERSATION_CONTEXT_CHANGED', { context });
    }

    private async emitWorldlineUpdatedIfCurrent(sourceId: ConversationSourceId): Promise<void> {
        if (!this.isCurrentSource(sourceId)) return;
        const context = await this.getConversationContext();
        this.emit('CONVERSATION_WORLDLINE_UPDATED', { context });
        this.emit('CONVERSATION_CONTEXT_CHANGED', { context });
    }

    private async emitWorldlineSwitchedIfCurrent(sourceId: ConversationSourceId, targetNodeId?: string): Promise<void> {
        if (!this.isCurrentSource(sourceId)) return;
        const context = await this.getConversationContext();
        this.emit('CONVERSATION_WORLDLINE_SWITCHED', { context, targetNodeId });
        this.emit('CONVERSATION_CONTEXT_CHANGED', { context });
    }

    private async emitWorldlineRolledBackIfCurrent(sourceId: ConversationSourceId, targetNodeId?: string): Promise<void> {
        if (!this.isCurrentSource(sourceId)) return;
        const context = await this.getConversationContext();
        this.emit('CONVERSATION_WORLDLINE_ROLLED_BACK', { context, targetNodeId });
        this.emit('CONVERSATION_CONTEXT_CHANGED', { context });
    }

    private registerAdapter(adapter: ConversationSourceAdapter): void {
        this.adapters.set(adapter.id, adapter);
    }

    private getAdapter(sourceId: ConversationSourceId): ConversationSourceAdapter {
        const adapter = this.adapters.get(sourceId);
        if (!adapter) {
            throw new Error(`Unsupported conversation source: ${sourceId}`);
        }
        return adapter;
    }

    private resolveContextInput(override: ConversationContextOverride = {}): ConversationContextOverride {
        return {
            sourceId: override.sourceId || this.contextSelection.sourceId,
            sessionId: override.sessionId !== undefined ? override.sessionId : this.contextSelection.sessionId,
            activeLeafId: override.activeLeafId
        };
    }

    private bindForgeWatcher(): void {
        if (this.forgeWatcherStop) return;
        this.forgeWatcherStop = forgeConversationGateway.watchConversationState(() => {
            void this.emitSessionsUpdated();
            void this.emitWorldlineUpdatedIfCurrent('forge');
        });
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) return;
        this.bindForgeWatcher();
        this.isInitialized = true;
        await this.emitSessionsUpdated();
    }

    async listConversationSources(): Promise<ConversationContextOption[]> {
        return Promise.all(Array.from(this.adapters.values()).map((adapter) => adapter.getSourceOption()));
    }

    async listConversationSessions(sourceId?: ConversationSourceId): Promise<ConversationSessionRef[]> {
        if (sourceId) {
            return this.getAdapter(sourceId).listSessions();
        }

        const [chatSessions, forgeSessions] = await Promise.all([
            this.getAdapter('chat').listSessions(),
            this.getAdapter('forge').listSessions()
        ]);
        return [...chatSessions, ...forgeSessions];
    }

    async getConversationContext(override: ConversationContextOverride = {}): Promise<ConversationViewContext> {
        const input = this.resolveContextInput(override);
        const sourceId = input.sourceId || 'chat';
        return this.getAdapter(sourceId).getContext(input);
    }

    async getConversationMessages(override: ConversationContextOverride = {}): Promise<LuminaChatMessage[]> {
        const context = await this.getConversationContext(override);
        return context.messages;
    }

    async getConversationTimelineGraph(
        override: ConversationContextOverride = {}
    ): Promise<Record<string, ConversationTimelineNode>> {
        const context = await this.getConversationContext(override);
        return context.timelineGraph;
    }

    async switchConversationContext(input: ConversationContextSwitchInput): Promise<ConversationViewContext> {
        const sourceId = input.sourceId;
        const adapter = this.getAdapter(sourceId);
        const resolvedSessionId = adapter.selectSession
            ? await adapter.selectSession(input.sessionId ?? null)
            : normalizeSessionId(input.sessionId);

        this.contextSelection.sourceId = sourceId;
        this.contextSelection.sessionId = input.sessionId ?? null;

        const context = await adapter.getContext({
            sourceId,
            sessionId: resolvedSessionId
        });
        this.emit('CONVERSATION_CONTEXT_CHANGED', { context });
        await this.emitSessionsUpdated();
        return context;
    }

    async switchConversationNode(input: ConversationNodeSwitchInput): Promise<boolean> {
        const contextInput = this.resolveContextInput(input);
        const sourceId = contextInput.sourceId || 'chat';
        const succeeded = await this.getAdapter(sourceId).switchToNode({
            ...contextInput,
            targetNodeId: input.targetNodeId
        });
        if (succeeded) {
            await this.emitWorldlineSwitchedIfCurrent(sourceId, input.targetNodeId);
        }
        return succeeded;
    }

    async branchConversationNode(input: ConversationNodeSwitchInput): Promise<boolean> {
        const contextInput = this.resolveContextInput(input);
        const sourceId = contextInput.sourceId || 'chat';
        const succeeded = await this.getAdapter(sourceId).branchFromNode({
            ...contextInput,
            targetNodeId: input.targetNodeId
        });
        if (succeeded) {
            await this.emitWorldlineSwitchedIfCurrent(sourceId, input.targetNodeId);
        }
        return succeeded;
    }

    async rollbackConversationNode(input: ConversationNodeSwitchInput): Promise<boolean> {
        const contextInput = this.resolveContextInput(input);
        const sourceId = contextInput.sourceId || 'chat';
        const succeeded = await this.getAdapter(sourceId).rollbackFromNode({
            ...contextInput,
            targetNodeId: input.targetNodeId
        });
        if (succeeded) {
            await this.emitWorldlineRolledBackIfCurrent(sourceId, input.targetNodeId);
        }
        return succeeded;
    }

    async emitSessionsUpdated(): Promise<void> {
        const [sources, sessions] = await Promise.all([
            this.listConversationSources(),
            this.listConversationSessions()
        ]);
        this.emit('CONVERSATION_SESSIONS_UPDATED', { sources, sessions });
    }
}
