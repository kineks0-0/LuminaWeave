import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NexusGenerationFlow, PersistenceDelegate, GenerationFlowContext } from '@shared/api/NexusGenerationFlow';
import { BaseXMLInterceptor } from '@shared/BaseXMLInterceptor';
import { MessageUtils } from '@shared/LuminaMessage';

describe('NexusGenerationFlow', () => {
    let mockInterceptor: BaseXMLInterceptor;
    let mockDelegate: PersistenceDelegate;
    let context: GenerationFlowContext;

    beforeEach(() => {
        mockInterceptor = new BaseXMLInterceptor();
        // Mock syncCore to avoid actual complex XML processing in simple test
        vi.spyOn(MessageUtils, 'syncCore').mockImplementation((node) => {
            node.mesRaw = node.pluginRaw || '';
            node.mes = node.pluginRaw || '';
            node.fingerprint = 'test_fp';
        });

        mockDelegate = {
            appendChatRecord: vi.fn().mockResolvedValue(undefined),
            updateChatMetadata: vi.fn().mockResolvedValue(undefined),
            commitTransaction: vi.fn().mockResolvedValue({ id: 'tx_123', seq: 1 })
        };

        context = {
            chatId: 'chat_001',
            parentId: 'msg_999',
            charName: 'Lumina',
            policy: { allowTopLevel: true }
        };
    });

    it('should accumulate tokens correctly', () => {
        const flow = new NexusGenerationFlow(context, mockInterceptor, mockDelegate);
        flow.pushToken('Hello');
        flow.pushToken(' World');
        
        expect(flow.getFullText()).toBe('Hello World');
        expect(flow.getStats().charCount).toBe(11);
        expect(flow.getStats().chunkCount).toBe(2);
    });

    it('should finalize correctly and trigger persistence', async () => {
        const flow = new NexusGenerationFlow(context, mockInterceptor, mockDelegate);
        flow.pushToken('Test Output');
        
        const node = await flow.finalize('success');

        // 1. 验证节点结构
        expect(node).toBeDefined();
        expect(node.parentId).toBe(context.parentId);
        expect(node.pluginRaw).toBe('Test Output');
        expect(node.role).toBe('assistant');
        expect(node.extra.status).toBe('success');

        // 2. 验证 PersistenceDelegate 是否被调用
        expect(mockDelegate.appendChatRecord).toHaveBeenCalledWith(context.chatId, node);
        expect(mockDelegate.updateChatMetadata).toHaveBeenCalledWith(context.chatId, { activeLeafId: node.id });
        expect(mockDelegate.commitTransaction).toHaveBeenCalled();
        
        // 3. 验证 TransactionID 是否回填
        expect(node.extra.transactionId).toEqual({ id: 'tx_123', seq: 1 });
    });

    it('should handle aborted status in metadata', async () => {
        const flow = new NexusGenerationFlow(context, mockInterceptor, mockDelegate);
        flow.pushToken('Partial...');
        
        const node = await flow.finalize('aborted');
        
        expect(node.extra.status).toBe('aborted');
    });
});
