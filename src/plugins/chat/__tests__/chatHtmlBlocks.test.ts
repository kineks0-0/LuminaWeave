import { describe, expect, it } from 'vitest';
import {
    HTML_BLOCK_MESSAGE_SOURCE,
    buildHtmlBlockDocument,
    parseHtmlBlockMessage
} from '../presentation/chatHtmlBlocks.js';

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
