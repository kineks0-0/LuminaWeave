import { describe, expect, it } from 'vitest';
import { renderChatMarkdown } from '../components/chatMarkdown.js';
import { advanceTextBlocks } from '../presentation/incrementalTextBlocks.js';
import {
    HTML_BLOCK_MESSAGE_SOURCE,
    buildHtmlBlockDocument,
    isHtmlDocumentBlock,
    parseHtmlBlockMessage
} from '../presentation/chatHtmlBlocks.js';

describe('isHtmlDocumentBlock', () => {
    it('recognizes full HTML documents with or without doctype', () => {
        expect(isHtmlDocumentBlock('<!DOCTYPE html>\n<html lang="zh-CN"><body>x</body></html>')).toBe(true);
        expect(isHtmlDocumentBlock('  <!doctype HTML><html></html>  ')).toBe(true);
        expect(isHtmlDocumentBlock('<html>\n<body><script>use()</script></body>\n</html>')).toBe(true);
    });

    it('rejects ordinary code, data and HTML fragments', () => {
        expect(isHtmlDocumentBlock('const a = 1;')).toBe(false);
        expect(isHtmlDocumentBlock('{"a":1}')).toBe(false);
        expect(isHtmlDocumentBlock('<div>hi</div>')).toBe(false);
        expect(isHtmlDocumentBlock('<html>unclosed')).toBe(false);
        expect(isHtmlDocumentBlock('')).toBe(false);
        expect(isHtmlDocumentBlock('   ')).toBe(false);
    });
});

describe('buildHtmlBlockDocument', () => {
    it('rewrites parent/top host access to the injected virtual objects', () => {
        const html = '<html><head></head><body><script>'
            + 'const d = window.parent.document;'
            + 'const d2 = window.top?.document;'
            + 'const st = window.parent?.SillyTavern;'
            + 'parent.document.getElementById("send_textarea");'
            + '</script></body></html>';
        const built = buildHtmlBlockDocument(html);

        expect(built).toContain('window.__luminaVirtualDocument');
        expect(built).toContain('window.__luminaSillyTavern');
        expect(built).not.toContain('window.parent.document');
        expect(built).not.toContain('window.top?.document');
        expect(built).not.toContain('window.parent?.SillyTavern');
        expect(built).not.toContain('parent.document.getElementById');
    });

    it('injects the bridge before body content so page scripts can use the shim', () => {
        const built = buildHtmlBlockDocument('<html><head><title>x</title></head><body><script>use()</script></body></html>');

        const bridgeIndex = built.indexOf('__luminaVirtualDocument');
        expect(bridgeIndex).toBeGreaterThan(-1);
        expect(bridgeIndex).toBeLessThan(built.indexOf('<body>'));
    });

    it('prepends the bridge when the document has no head', () => {
        const built = buildHtmlBlockDocument('<div>hi</div>');

        expect(built.startsWith('<script>')).toBe(true);
        expect(built.endsWith('<div>hi</div>')).toBe(true);
    });
});

describe('regex-injected HTML blocks', () => {
    it('keeps body text alongside the bare-fenced HTML document', () => {
        const text = '正文开头\n\n```\n<!DOCTYPE html>\n<html><body>x</body></html>\n```\n\n正文结尾';
        const state = advanceTextBlocks(null, text, renderChatMarkdown);

        expect(state.blocks).toHaveLength(3);
        expect(state.blocks[0].html).toContain('正文开头');
        expect(state.blocks[2].html).toContain('正文结尾');

        const fenceMatch = state.blocks[1].source.match(/^```[^\n]*\n([\s\S]*?)\n```\s*$/);
        expect(fenceMatch).not.toBeNull();
        expect(isHtmlDocumentBlock(fenceMatch![1])).toBe(true);
        expect(state.blocks[1].html).toContain('<pre><code>');
    });
});

describe('parseHtmlBlockMessage', () => {
    it('parses fill / send / resize bridge messages', () => {
        expect(parseHtmlBlockMessage({
            source: HTML_BLOCK_MESSAGE_SOURCE,
            type: 'fill',
            payload: { text: '填入内容' }
        })).toEqual({ type: 'fill', text: '填入内容' });

        expect(parseHtmlBlockMessage({
            source: HTML_BLOCK_MESSAGE_SOURCE,
            type: 'send',
            payload: { text: '直接发送' }
        })).toEqual({ type: 'send', text: '直接发送' });

        expect(parseHtmlBlockMessage({
            source: HTML_BLOCK_MESSAGE_SOURCE,
            type: 'resize',
            payload: { height: 321.4 }
        })).toEqual({ type: 'resize', height: 321.4 });
    });

    it('parses legacy resizeIframe messages from preset HTML', () => {
        expect(parseHtmlBlockMessage({ type: 'resizeIframe', height: 200 }))
            .toEqual({ type: 'resize', height: 200 });
    });

    it('ignores unrelated messages', () => {
        expect(parseHtmlBlockMessage(null)).toBeNull();
        expect(parseHtmlBlockMessage({ type: 'other' })).toBeNull();
        expect(parseHtmlBlockMessage({ source: HTML_BLOCK_MESSAGE_SOURCE, type: 'unknown' })).toBeNull();
        expect(parseHtmlBlockMessage({ source: HTML_BLOCK_MESSAGE_SOURCE, type: 'resize' })).toBeNull();
    });
});
