import { describe, expect, it } from 'vitest';
import { LuminaChatMessage, MessageUtils } from '@shared/LuminaMessage.js';
import { STProtocol } from '@/api/core/host-drivers/st/STProtocol.js';
import { WorldlineStore } from '@/api/core/storage/WorldlineStore.js';
import { globalXMLInterceptor } from '@/api/core/xml-view/XMLInterceptor.js';

describe('RobustnessSync Pipeline', () => {

    it('should automatically populate mesRaw and mes from pluginRaw in syncCore', () => {
        const msg: any = {
            is_user: false,
            pluginRaw: '<Chat_Reply>Hello world</Chat_Reply><thinking>secret</thinking>',
            extra: {}
        };

        MessageUtils.syncCore(msg as LuminaChatMessage, globalXMLInterceptor);

        expect(msg.mesRaw).toBe('Hello world');
        expect(msg.mes).toBe('Hello world');
        expect(msg.fingerprint).toBeDefined();
        expect(msg.fingerprint).toMatch(/^fp_/);
    });

    it('should keep the character greeting raw and clean other messages', () => {
        const raw = '<thinking>先想</thinking><Character_Action>挥手</Character_Action><Chat_Reply>你好</Chat_Reply>';
        const greeting: any = {
            is_user: false,
            parentId: null,
            conversationType: 'chat',
            pluginRaw: raw,
            extra: {}
        };
        MessageUtils.syncCore(greeting as LuminaChatMessage, globalXMLInterceptor, { force: true });
        expect(greeting.mes).toContain('<thinking>');

        const reply: any = {
            is_user: false,
            parentId: 'node-parent',
            conversationType: 'chat',
            pluginRaw: raw,
            extra: {}
        };
        MessageUtils.syncCore(reply as LuminaChatMessage, globalXMLInterceptor, { force: true });
        expect(reply.mes).toBe('你好');
    });

    it('should automatically update mesST and stFingerprint in extension sync', () => {
        const msg: any = {
            id: 'test-1',
            parentId: null,
            name: 'Assistant',
            role: 'assistant',
            is_user: false,
            mesRaw: 'Hello world',
            mes: '',
            fingerprint: '',
            extra: {}
        };

        STProtocol.syncMessageCalculatedFields(msg);

        expect(msg.mes).toBe('Hello world');
        expect(msg.mesST).toBe('Hello world');
        expect(msg.stFingerprint).toBeDefined();
        expect(msg.stFingerprint).toMatch(/^fp_/);
    });

    it('should trigger sync automatically when upserting to WorldlineStore', () => {
        const store = new WorldlineStore();
        const msg: any = {
            id: 'node-sync-test',
            parentId: 'node-parent',
            conversationType: 'chat',
            role: 'assistant',
            is_user: false,
            pluginRaw: '<Chat_Reply>Automated</Chat_Reply>',
            extra: {}
        };

        store.upsertNode(msg);

        const node = store.getNode('node-sync-test');
        expect(node?.mesRaw).toBe('Automated');
        expect(node?.mes).toBe('Automated');
        expect(node?.fingerprint).toBeDefined();
    });

    it('should skip heavyweight hashing during streaming to optimize performance', () => {
        const store = new WorldlineStore();
        const msg: any = {
            id: 'streaming-node',
            parentId: null,
            role: 'assistant',
            is_user: false,
            mesRaw: 'Updating...',
            syncStatus: 'streaming',
            extra: {}
        };

        store.upsertNode(msg);

        const node = store.getNode('streaming-node');
        expect(node?.mes).toBe('Updating...');
        // Fingerprint SHOULD stay empty or old during streaming (as per performance optimization in WorldlineStore)
        expect(node?.fingerprint || '').toBe('');
    });

    it('should recover full state when syncStatus changes from streaming to synced', () => {
        const store = new WorldlineStore();
        const msg: any = {
            id: 'finalize-node',
            parentId: null,
            role: 'assistant',
            is_user: false,
            mesRaw: 'Final content',
            syncStatus: 'streaming',
            fingerprint: '',
            extra: {}
        };

        store.upsertNode(msg);
        expect(store.getNode('finalize-node')?.fingerprint || '').toBe('');

        // Finalize
        const finalizedMsg = { ...msg, syncStatus: 'synced' };
        store.upsertNode(finalizedMsg);

        const node = store.getNode('finalize-node');
        expect(node?.mes).toBe('Final content');
        expect(node?.fingerprint).toMatch(/^fp_/);
    });
});
