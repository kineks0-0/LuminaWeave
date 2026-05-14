import { beforeEach, describe, expect, it, vi } from 'vitest';

const stGlobalAccessorMock = vi.hoisted(() => ({
    stHelper: {
        getWorldbook: vi.fn()
    },
    ctx: {}
}));

vi.mock('../host-drivers/st/STGlobalAccessor.js', () => ({
    STGlobalAccessor: stGlobalAccessorMock
}));

vi.mock('../host-drivers/st/STClient.js', () => ({
    STClient: {
        getCsrfToken: vi.fn(async () => 'csrf'),
        getWorldbookNames: vi.fn(() => [])
    }
}));

import { STWorldInfoDriver } from '../host-drivers/st/STWorldInfoDriver.js';

describe('STWorldInfoDriver', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('normalizes TavernHelper worldbook entries into Lumina/ST editor fields', async () => {
        stGlobalAccessorMock.stHelper.getWorldbook.mockResolvedValue([
            {
                uid: 7,
                name: '角色设定',
                enabled: true,
                strategy: {
                    type: 'selective',
                    keys: ['艾莉娜'],
                    keys_secondary: {
                        logic: 'and_all',
                        keys: ['学院']
                    },
                    scan_depth: 4
                },
                position: {
                    type: 'at_depth',
                    role: 'assistant',
                    depth: 2,
                    order: 120
                },
                content: '条目内容',
                probability: 75,
                recursion: {
                    prevent_incoming: false,
                    prevent_outgoing: true,
                    delay_until: null
                }
            }
        ]);

        const book = await STWorldInfoDriver.getWorldbook('test-book');
        const entry = book.entries['7'];

        expect(entry).toMatchObject({
            uid: 7,
            comment: '角色设定',
            key: ['艾莉娜'],
            keysecondary: ['学院'],
            content: '条目内容',
            constant: false,
            selective: true,
            selectiveLogic: 0,
            disable: false,
            enabled: true,
            position: 4,
            role: 2,
            depth: 2,
            order: 120,
            probability: 75,
            scan_depth: 4,
            preventRecursion: true
        });
    });

    it('normalizes ST v2 entry arrays returned inside a book object', async () => {
        stGlobalAccessorMock.stHelper.getWorldbook.mockResolvedValue({
            name: 'test-book',
            entries: [
                {
                    id: 3,
                    keys: ['主关键词'],
                    secondary_keys: ['次关键词'],
                    comment: '原始备注',
                    content: '原始内容',
                    constant: true,
                    selective: false,
                    insertion_order: 88,
                    enabled: false,
                    position: 'before_author_note',
                    extensions: {
                        probability: 100,
                        depth: 1,
                        role: 0,
                        scan_depth: 2,
                        selectiveLogic: 1
                    }
                }
            ]
        });

        const book = await STWorldInfoDriver.getWorldbook('test-book');
        const entry = book.entries['3'];

        expect(entry).toMatchObject({
            uid: 3,
            comment: '原始备注',
            key: ['主关键词'],
            keysecondary: ['次关键词'],
            content: '原始内容',
            constant: true,
            selective: false,
            disable: true,
            position: 2,
            order: 88,
            probability: 100,
            scan_depth: 2
        });
    });
});
