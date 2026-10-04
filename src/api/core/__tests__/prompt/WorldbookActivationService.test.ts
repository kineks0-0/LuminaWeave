import { describe, it, expect } from 'vitest';
import {
    WorldbookActivationService,
    type WorldbookResourceResolver
} from '@/api/core/hal/prompt/WorldbookActivationService.js';
import type { PromptResourceBundle } from '@/api/core/hal/resource/PromptResourceResolver.js';

const makeEntry = (
    uid: number,
    content: string,
    overrides: Partial<LuminaLorebookEntry> = {}
): LuminaLorebookEntry => ({
    uid,
    comment: `entry-${uid}`,
    key: [],
    keysecondary: [],
    content,
    constant: true,
    selective: false,
    selectiveLogic: 0,
    disable: false,
    enabled: true,
    position: 0,
    role: 0,
    depth: 0,
    order: 100,
    probability: 100,
    scan_depth: 0,
    ...overrides
});

const createBundle = (overrides: Partial<PromptResourceBundle> = {}): PromptResourceBundle => ({
    refs: [],
    documents: [],
    lorebookEntries: [],
    charCard: null,
    presetRaw: null,
    diagnostics: [],
    ...overrides
});

const createResolver = (bundle: PromptResourceBundle): WorldbookResourceResolver => ({
    resolve: async () => bundle
});

describe('WorldbookActivationService', () => {
    it('没有 refs 与额外条目时返回 null', async () => {
        const service = new WorldbookActivationService(createResolver(createBundle()));
        const outcome = await service.activate({ messages: [] });

        expect(outcome.activation).toBeNull();
        expect(outcome.diagnostics).toEqual([]);
    });

    it('激活 ref 加载的常驻条目并进入插入分桶', async () => {
        const service = new WorldbookActivationService(createResolver(createBundle({
            lorebookEntries: [makeEntry(1, '世界设定')]
        })));
        const outcome = await service.activate({
            refs: [{ sourceId: 'local', resourceType: 'worldbook', resourceId: 'book-1', path: '/x', writable: true }],
            messages: [{ role: 'user', content: '你好' }]
        });

        expect(outcome.activation).not.toBeNull();
        expect(outcome.activation!.entries).toHaveLength(1);
        expect(outcome.activation!.insertionBuckets.before).toHaveLength(1);
        expect(outcome.activation!.insertionBuckets.before[0].content).toBe('世界设定');
    });

    it('合并额外条目（角色卡内嵌世界书）', async () => {
        const service = new WorldbookActivationService(createResolver(createBundle({
            lorebookEntries: [makeEntry(1, '全局设定')]
        })));
        const outcome = await service.activate({
            refs: [{ sourceId: 'local', resourceType: 'worldbook', resourceId: 'book-1', path: '/x', writable: true }],
            entries: [makeEntry(2, '角色设定')],
            messages: []
        });

        expect(outcome.activation!.entries).toHaveLength(2);
    });

    it('关键词条目按 inputText 命中', async () => {
        const service = new WorldbookActivationService(createResolver(createBundle({
            lorebookEntries: [makeEntry(1, '龙的传说', {
                constant: false,
                key: ['龙'],
                position: 1,
                depth: 0
            })]
        })));
        const outcome = await service.activate({
            refs: [{ sourceId: 'local', resourceType: 'worldbook', resourceId: 'book-1', path: '/x', writable: true }],
            messages: [],
            inputText: '我看见了龙'
        });

        expect(outcome.activation!.entries).toHaveLength(1);
        expect(outcome.activation!.insertionBuckets.after).toHaveLength(1);
    });

    it('预算裁剪进入 trace', async () => {
        const service = new WorldbookActivationService(createResolver(createBundle({
            lorebookEntries: [makeEntry(1, 'A'), makeEntry(2, 'B')]
        })));
        const outcome = await service.activate({
            refs: [{ sourceId: 'local', resourceType: 'worldbook', resourceId: 'book-1', path: '/x', writable: true }],
            messages: [],
            maxTriggeredEntries: 1
        });

        expect(outcome.activation!.entries).toHaveLength(1);
        expect(
            outcome.activation!.trace.some(item => (item as { reason?: string }).reason === 'budget')
        ).toBe(true);
    });

    it('合并解析器与触发器的诊断', async () => {
        const service = new WorldbookActivationService(createResolver(createBundle({
            lorebookEntries: [makeEntry(1, 'A')],
            diagnostics: [{ level: 'warning', code: 'PROMPT_RESOURCE_NOT_FOUND', message: '缺失资源' }]
        })));
        const outcome = await service.activate({
            refs: [{ sourceId: 'local', resourceType: 'worldbook', resourceId: 'book-1', path: '/x', writable: true }],
            messages: []
        });

        expect(outcome.diagnostics.some(item => item.code === 'PROMPT_RESOURCE_NOT_FOUND')).toBe(true);
    });
});
