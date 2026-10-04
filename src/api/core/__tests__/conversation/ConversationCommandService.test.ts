import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import { ChatManager } from '@/api/core/conversation/ChatManager.js';
import {
    ConversationCommandService,
    type ConversationCommandServiceDependencies
} from '@/api/core/conversation/ConversationCommandService.js';
import type { ChatMessageMutationPort } from '@/api/core/conversation/ChatMessageMutationPort.js';
import { MessageStorageProjection } from '@/api/core/storage/MessageStorageProjection.js';
import { pluginManager } from '@/core/PluginManager.js';

vi.mock('@/api/storage.js', () => ({
    lwStorage: {
        _getContextIds: vi.fn(() => ({ charId: 'char1', chatId: 'chat1' })),
        get: vi.fn((_key: string, def: unknown) => def),
        set: vi.fn(),
        on: vi.fn(),
        emit: vi.fn()
    }
}));

vi.mock('@/api/core/storage/PersistenceService.js', () => ({
    PersistenceService: vi.fn(function () {
        return {
            loadFromIndependentChat: vi.fn().mockResolvedValue(true),
            saveToIndependentChat: vi.fn().mockResolvedValue(true),
            appendToIndependentChat: vi.fn().mockResolvedValue(true),
            alignTransactionState: vi.fn().mockResolvedValue(true)
        };
    })
}));

const buildMessage = (
    id: string,
    parentId: string | null,
    overrides: Partial<LuminaChatMessage> = {}
): LuminaChatMessage => ({
    id,
    parentId,
    mes: '',
    mesRaw: '',
    mesST: '',
    role: 'user',
    is_user: true,
    extra: {},
    ...overrides
} as LuminaChatMessage);

const createHarness = () => {
    const chatManager = new ChatManager({ ctx: {} });
    chatManager.activate();
    vi.spyOn(chatManager, 'commitToST').mockResolvedValue();

    let generatedId = 0;
    const hostIndexes = new Map<string, number>();
    const messageHost: ChatMessageMutationPort = {
        normalizeChatId: vi.fn((chatId: string | null | undefined) => chatId ?? null),
        getSnapshotMessagesSync: vi.fn(() => chatManager.store.nodePool),
        compareStates: vi.fn(() => ({ hasDivergence: false, onlyInIndependent: [], onlyInST: [], updated: [], diffCount: 0 })),
        getHostIndex: vi.fn(async (messageId: string) => hostIndexes.get(messageId)),
        getFingerprint: vi.fn((text: string) => MessageStorageProjection.getFingerprint(text)),
        getHostFingerprint: vi.fn((text: string) => MessageStorageProjection.getFingerprint(text)),
        generateNodeId: vi.fn(() => `generated-${++generatedId}`),
        syncMessageCalculatedFields: vi.fn(),
        resolveHostWriteText: vi.fn((message: LuminaChatMessage) => message.mesST || message.mesRaw || message.mes || ''),
        updateHostMessage: vi.fn(async () => undefined),
        deleteHostMessage: vi.fn(async () => undefined),
        appendHostMessage: vi.fn(async () => undefined),
        extractMessageText: vi.fn((message: LuminaChatMessage) => message.mesRaw || message.mes || '')
    };

    let conversationMessages: LuminaChatMessage[] = [];
    const syncFromHost = vi.fn(async () => undefined);
    const dependencies: ConversationCommandServiceDependencies = {
        chatManager,
        getConversationMessages: async () => conversationMessages,
        applyDisplayRegex: (text, source, depth) => `display:${source}:${depth}:${text}`,
        getUserName: () => 'User',
        getCharName: () => 'Char',
        syncFromHost,
        messageHost
    };

    const service = new ConversationCommandService(dependencies);
    const setConversation = (messages: LuminaChatMessage[]) => {
        conversationMessages = messages;
        chatManager.store.setNodes(messages);
    };

    return { chatManager, messageHost, service, setConversation, syncFromHost, hostIndexes };
};

describe('ConversationCommandService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('edits a message: rewrites body, display text, fingerprints and host record under the sync lock', async () => {
        const { chatManager, messageHost, service, setConversation, syncFromHost } = createHarness();
        const message = buildMessage('m1', null, { mesRaw: 'old', mes: 'old', mesST: 'old' });
        setConversation([message]);
        const pause = vi.spyOn(chatManager.sync, 'pauseAutoSync');
        const resume = vi.spyOn(chatManager.sync, 'resumeAutoSync');

        const result = await service.mutateChatRecord(0, 'edit', 'new');
        const newFingerprint = MessageStorageProjection.getFingerprint('new');

        expect(result).toEqual({ success: true, events: [] });
        expect(message.mesRaw).toBe('new');
        expect(message.mesST).toBe('new');
        expect(message.mes).toBe('display:user_input:0:new');
        expect(message.fingerprint).toBe(newFingerprint);
        expect(message.stFingerprint).toBe(newFingerprint);
        expect(message.extra?.mesRaw).toBe('new');
        expect(chatManager.activeLeafId).toBe('m1');
        expect(messageHost.updateHostMessage).toHaveBeenCalledWith(expect.objectContaining({ index: 0, content: 'new' }));
        expect(pause).toHaveBeenCalledTimes(1);
        expect(resume).toHaveBeenCalledTimes(1);
        expect(syncFromHost).toHaveBeenCalledTimes(1);
    });

    it('extracts the chat reply block when editing an assistant message', async () => {
        const { service, setConversation } = createHarness();
        const message = buildMessage('m1', null, { role: 'assistant', is_user: false, mesRaw: 'old' });
        setConversation([message]);

        await service.mutateChatRecord('m1', 'edit', '<Chat_Reply>cleaned</Chat_Reply>');

        expect(message.mesRaw).toBe('cleaned');
        expect(message.mes).toBe('display:ai_output:0:cleaned');
    });

    it('reports no host write for an out-of-range edit but still syncs under the lock', async () => {
        const { messageHost, service, setConversation, syncFromHost } = createHarness();
        setConversation([buildMessage('m1', null)]);

        const result = await service.mutateChatRecord(5, 'edit', 'new');

        expect(result).toEqual({ success: true, events: [] });
        expect(messageHost.updateHostMessage).not.toHaveBeenCalled();
        expect(syncFromHost).toHaveBeenCalledTimes(1);
    });

    it('deletes the host message and moves the active leaf to the previous message', async () => {
        const { chatManager, messageHost, service, setConversation } = createHarness();
        const first = buildMessage('m1', null);
        const second = buildMessage('m2', 'm1');
        setConversation([first, second]);
        chatManager.store.upsertNode(buildMessage('m3', 'm2'));
        chatManager.activeLeafId = 'm3';

        const result = await service.mutateChatRecord('m2', 'delete');

        expect(result).toEqual({ success: true, events: [] });
        // 见 ISSUES_LOG.md #42：deleteMessage 走 removeSubtree，目标节点本身仍留在节点池
        expect(chatManager.store.hasNode('m2')).toBe(true);
        expect(chatManager.store.hasNode('m3')).toBe(false);
        expect(chatManager.activeLeafId).toBe('m1');
        expect(messageHost.deleteHostMessage).toHaveBeenCalledWith(1);
    });

    it('adds a user message under the active leaf and appends it to the host', async () => {
        const { chatManager, messageHost, service, setConversation } = createHarness();
        setConversation([buildMessage('m1', null)]);
        chatManager.activeLeafId = 'm1';
        const hooks = vi.spyOn(pluginManager, 'callHooks');

        const result = await service.mutateChatRecord(0, 'add', 'hello', { is_user: true });

        expect(result).toEqual({ success: true, events: [] });
        expect(messageHost.appendHostMessage).toHaveBeenCalledTimes(1);
        const added = chatManager.store.getNode('generated-1');
        expect(added?.parentId).toBe('m1');
        expect(added?.mesRaw).toBe('hello');
        expect(added?.mes).toBe('display:user_input:0:hello');
        expect(added?.name).toBe('User');
        expect(added?.characterId).toBe('char1');
        expect(chatManager.activeLeafId).toBe('generated-1');
        expect(hooks).toHaveBeenCalledWith('onMessageAdding', expect.objectContaining({ id: 'generated-1' }), expect.anything());
        expect(hooks).toHaveBeenCalledWith('onMessageAdded', expect.objectContaining({ id: 'generated-1' }), expect.anything());
    });

    it('reuses an existing child with the same content and role instead of appending a duplicate', async () => {
        const { chatManager, messageHost, service, setConversation, hostIndexes } = createHarness();
        const child = buildMessage('child1', 'm1', {
            mesRaw: 'hello',
            mes: 'hello',
            role: 'user',
            fingerprint: MessageStorageProjection.getFingerprint('hello')
        });
        setConversation([buildMessage('m1', null), child]);
        chatManager.activeLeafId = 'm1';
        hostIndexes.set('child1', 9);

        const result = await service.mutateChatRecord(0, 'add', 'hello', { is_user: true });

        expect(result).toEqual({ success: true, events: ['MESSAGE_RECEIVED'] });
        expect(messageHost.appendHostMessage).not.toHaveBeenCalled();
        expect(messageHost.updateHostMessage).not.toHaveBeenCalled();
        expect(chatManager.activeLeafId).toBe('child1');
        expect(chatManager.persistence.saveToIndependentChat).toHaveBeenCalledWith('chat1');
        expect(chatManager.commitToST).toHaveBeenCalled();
    });

    it('rebuilds calculated fields and persists only when something changed', async () => {
        const { chatManager, messageHost, service, setConversation } = createHarness();
        const first = buildMessage('m1', null, { mesRaw: 'a', fingerprint: 'fp:a' });
        const second = buildMessage('m2', 'm1', { mesRaw: 'b', fingerprint: 'fp:b' });
        setConversation([first, second]);
        messageHost.syncMessageCalculatedFields = vi.fn((message: LuminaChatMessage) => {
            if (message.id === 'm2') message.fingerprint = 'fp:changed';
        });

        const changed = await service.rebuildCurrentChatMessages();
        expect(changed).toEqual({ total: 2, rebuilt: 1 });
        expect(chatManager.commitToST).toHaveBeenCalledTimes(1);
        expect(chatManager.persistence.saveToIndependentChat).toHaveBeenCalledWith('chat1');

        vi.clearAllMocks();
        const untouched = await service.rebuildCurrentChatMessages();
        expect(untouched).toEqual({ total: 2, rebuilt: 0 });
        expect(chatManager.commitToST).not.toHaveBeenCalled();
    });
});
