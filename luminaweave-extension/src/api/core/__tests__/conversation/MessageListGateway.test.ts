import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageListGateway } from '@/api/core/conversation/MessageListGateway.js';
import { STClient } from '@/api/core/host-drivers/st/STClient.js';

vi.mock('@/api/core/host-drivers/st/STClient.js', () => ({
    STClient: {
        hasActiveLiveChat: vi.fn(),
        getRawMessages: vi.fn(),
        updateMessages: vi.fn(),
        flush: vi.fn()
    }
}));

describe('MessageListGateway', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (STClient.hasActiveLiveChat as any).mockReturnValue(true);
    });

    it('should return an empty snapshot when host chat is closed even if stale ST messages remain', async () => {
        (STClient.hasActiveLiveChat as any).mockReturnValue(false);
        (STClient.getRawMessages as any).mockReturnValue([
            {
                message_id: 0,
                name: 'Assistant',
                role: 'assistant',
                message: 'stale',
                extra: {
                    id: 'node_stale',
                    fingerprint: 'fp_stale',
                    _lw_sync_chat_id: 'chat_stale'
                }
            }
        ]);

        const snapshot = await MessageListGateway.getSnapshot({ ensureStableIds: true });
        const syncSnapshot = MessageListGateway.getSnapshotSync();

        expect(snapshot).toEqual({
            raw: [],
            lumina: [],
            idToIndex: new Map()
        });
        expect(syncSnapshot).toEqual({
            raw: [],
            lumina: [],
            idToIndex: new Map()
        });
        expect(STClient.getRawMessages).not.toHaveBeenCalled();
    });
});
