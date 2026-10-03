import { describe, expect, it, vi } from 'vitest';
import { advanceTextBlocks } from '../presentation/incrementalTextBlocks.js';

const lineRenderer = (text: string): string => text
    .split('\n')
    .map(line => (line.trim() ? `<p>${line}</p>` : '<div class="empty-line"></div>'))
    .join('');

describe('advanceTextBlocks', () => {
    it('keeps committed blocks identical while only the tail changes', () => {
        const render = vi.fn(lineRenderer);
        const first = advanceTextBlocks(null, 'alpha\n\nbe', render);
        expect(first.blocks.map(block => block.key)).toEqual(['b0', 'b1']);

        const second = advanceTextBlocks(first, 'alpha\n\nbeta gamma', render);
        expect(second.blocks[0]).toBe(first.blocks[0]);
        expect(second.blocks[1].html).toBe('<p>beta gamma</p>');
        expect(render.mock.calls.filter(([text]) => text.startsWith('alpha'))).toHaveLength(1);
    });

    it('produces exactly the same html as rendering the whole text', () => {
        const text = 'one\n\ntwo\n\n\nthree\nfour\n\nfive';
        let state = null;
        for (let length = 1; length <= text.length; length += 1) {
            state = advanceTextBlocks(state, text.slice(0, length), lineRenderer);
        }
        expect(state?.blocks.map(block => block.html).join('')).toBe(lineRenderer(text));
        expect(advanceTextBlocks(null, text, lineRenderer).blocks.map(block => block.html).join(''))
            .toBe(lineRenderer(text));
    });

    it('does not split inside an unfinished fenced code block', () => {
        const state = advanceTextBlocks(null, 'intro\n\n```ts\nconst a = 1;\n\nconst b = 2;', lineRenderer);
        expect(state.blocks.map(block => block.source)).toEqual([
            'intro\n',
            '```ts\nconst a = 1;\n\nconst b = 2;'
        ]);
    });

    it('splits again after a fenced code block closes', () => {
        const state = advanceTextBlocks(null, '```\na\n\nb\n```\n\nafter', lineRenderer);
        expect(state.blocks.map(block => block.source)).toEqual(['```\na\n\nb\n```\n', 'after']);
    });

    it('keeps indented continuation lines with the previous block', () => {
        const state = advanceTextBlocks(null, '1. item\n\n   continued\n\nnext', lineRenderer);
        expect(state.blocks.map(block => block.source)).toEqual(['1. item\n\n   continued\n', 'next']);
    });

    it('waits for the next block to start before committing a boundary', () => {
        const state = advanceTextBlocks(null, 'alpha\n\n', lineRenderer);
        expect(state.blocks).toHaveLength(1);
        expect(state.blocks[0].source).toBe('alpha\n\n');
    });

    it('resets when the new text is not an extension of the committed text', () => {
        const first = advanceTextBlocks(null, 'alpha\n\nbeta', lineRenderer);
        const second = advanceTextBlocks(first, 'ALPHA\n\nbeta', lineRenderer);
        expect(second.blocks[0]).not.toBe(first.blocks[0]);
        expect(second.blocks[0].html).toBe('<p>ALPHA</p><div class="empty-line"></div>');
    });

    it('resets when the render function changes', () => {
        const first = advanceTextBlocks(null, 'alpha\n\nbeta', lineRenderer);
        const otherRenderer = (text: string) => `<span>${text}</span>`;
        const second = advanceTextBlocks(first, 'alpha\n\nbeta', otherRenderer);
        expect(second.blocks[0].html).toBe('<span>alpha\n</span>');
    });

    it('returns no blocks for empty text', () => {
        expect(advanceTextBlocks(null, '', lineRenderer).blocks).toEqual([]);
    });
});

describe('advanceTextBlocks with chat markdown', () => {
    it('matches whole-text markdown rendering for common content', async () => {
        const { renderChatMarkdown } = await import('../components/chatMarkdown.js');
        const text = [
            '# Title',
            '',
            'First paragraph with **bold**',
            'and a soft break.',
            '',
            '- one',
            '- two',
            '',
            '```js',
            'const a = 1;',
            '',
            'const b = 2;',
            '```',
            '',
            '| a | b |',
            '| - | - |',
            '| 1 | 2 |',
            '',
            '> quote'
        ].join('\n');
        let state = null;
        for (let length = 1; length <= text.length; length += 3) {
            state = advanceTextBlocks(state, text.slice(0, length), renderChatMarkdown);
        }
        state = advanceTextBlocks(state, text, renderChatMarkdown);
        const normalize = (html: string) => html.replace(/\n/g, '');
        expect(normalize(state.blocks.map(block => block.html).join('')))
            .toBe(normalize(renderChatMarkdown(text)));
    });
});
