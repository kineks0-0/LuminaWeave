import { describe, expect, it } from 'vitest';
import {
    parseForgePiAgentOutput,
    projectForgePiStreamingOutput
} from '@/api/core/forge/agent-app/session/ForgePiAgentOutputParser.js';

describe('ForgePiAgentOutputParser', () => {
    it('separates explicit process blocks from the final assistant reply', () => {
        const parsed = parseForgePiAgentOutput([
            '<process>',
            '我需要先读取 xx.md 确认当前结构。',
            '</process>',
            '',
            '<final>',
            '已完成修改，主要调整了说明。',
            '</final>'
        ].join('\n'));

        expect(parsed).toEqual({
            rawText: '<process>\n我需要先读取 xx.md 确认当前结构。\n</process>\n\n<final>\n已完成修改，主要调整了说明。\n</final>',
            processBlocks: ['我需要先读取 xx.md 确认当前结构。'],
            finalText: '已完成修改，主要调整了说明。',
            diagnostics: []
        });
    });

    it('keeps malformed or tag-outside text out of persisted process and assistant fields', () => {
        const parsed = parseForgePiAgentOutput([
            '标签外文本',
            '<process>公开说明</process>',
            '<final>最终回复'
        ].join('\n'));

        expect(parsed.processBlocks).toEqual(['公开说明']);
        expect(parsed.finalText).toBe('');
        expect(parsed.diagnostics).toEqual([
            expect.objectContaining({ code: 'text_outside_block' }),
            expect.objectContaining({ code: 'unclosed_block', tag: 'final' })
        ]);
    });

    it('projects streaming output without leaking process text into final display', () => {
        const projection = projectForgePiStreamingOutput([
            '<process>我需要读取文件。</process>',
            '<final>最终回复正在生成'
        ].join('\n'));

        expect(projection.processText).toBe('我需要读取文件。');
        expect(projection.finalText).toBe('最终回复正在生成');
        expect(projection.rawText).toContain('<process>');
    });
});
