import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { StorageService } from '../StorageService.js';
import { createEmptyConversationDocument } from '@shared/ConversationTypes.js';

describe('StorageService', () => {
    let storage: StorageService;
    const testDir = path.join(process.cwd(), 'tmp/test_data_conversations');

    beforeEach(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
        storage = new StorageService(testDir);
    });

    it('persists unified conversation documents with schemaVersion', () => {
        const document = createEmptyConversationDocument({
            id: 'chat_alpha',
            conversationType: 'chat',
            title: 'Alpha',
            nodes: [{
                id: 'node_1',
                mes: 'hello',
                mesRaw: 'hello',
                name: 'You',
                is_user: true,
                send_date: Date.now(),
                extra: {}
            } as any]
        });

        storage.saveConversation(document.id, document);
        storage.syncToDisk();

        const savedPath = path.join(testDir, 'conversations', 'conversation_chat_alpha.json');
        const saved = JSON.parse(fs.readFileSync(savedPath, 'utf8'));
        expect(saved.schemaVersion).toBe(1);
        expect(saved.nodes).toHaveLength(1);
        expect(storage.listConversations()[0]?.id).toBe('chat_alpha');
    });

    it('migrates legacy chat jsonl into a unified conversation document', () => {
        const legacyPath = path.join(testDir, 'chats', 'chat_legacy_chat.jsonl');
        fs.mkdirSync(path.dirname(legacyPath), { recursive: true });
        fs.writeFileSync(legacyPath, [
            JSON.stringify({
                type: 'metadata',
                activeLeafId: 'legacy_node',
                updatedAt: 123,
                pluginData: { foo: 'bar' },
                transaction: {
                    lastCommittedSeq: 7,
                    lastTransactionId: 'tx_legacy'
                }
            }),
            JSON.stringify({
                id: 'legacy_node',
                mes: 'legacy hello',
                mesRaw: 'legacy hello',
                name: 'Assistant',
                is_user: false,
                send_date: 1,
                extra: {}
            })
        ].join('\n'));

        const document = storage.readConversation('legacy_chat');
        expect(document?.schemaVersion).toBe(1);
        expect(document?.pluginState.chat?.pluginData).toEqual({ foo: 'bar' });
        expect(document?.transaction.lastCommittedSeq).toBe(7);
        expect(document?.nodes).toHaveLength(1);
    });

    it('resolves forge sessionChatId aliases into the canonical conversation document', () => {
        storage.saveForgeSession({
            id: 'forge_session_1',
            sessionChatId: 'lw_card_alias_1',
            title: 'Forge',
            createdAt: 1,
            updatedAt: 1,
            presetId: '',
            activeLeafId: null,
            worldlineNodes: [],
            selectedChatSessionId: null,
            selectedChatSnapshotId: null,
            draftInput: '',
            stagingEntries: [],
            workspaceMode: 'workspace'
        } as any);

        storage.appendChatRecord('lw_card_alias_1', {
            id: 'forge_node_1',
            mes: 'forge hello',
            mesRaw: 'forge hello',
            name: 'Assistant',
            is_user: false,
            send_date: 1,
            extra: {}
        });

        const document = storage.readConversation('forge_session_1');
        expect(document?.pluginState.forge?.sessionChatId).toBe('lw_card_alias_1');
        expect(document?.nodes).toHaveLength(1);
        expect(storage.readConversation('lw_card_alias_1')?.id).toBe('forge_session_1');
    });
});
