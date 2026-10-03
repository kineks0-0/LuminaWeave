import { describe, expect, it, vi } from 'vitest';
import { globalXMLTagRegistry } from '@shared/XMLTagRegistry.js';
import { XMLInterceptor } from '@/api/core/xml-view/XMLInterceptor.js';

describe('XMLInterceptor registration disposers', () => {
    it('removes a pattern parser by reference when disposed', () => {
        const interceptor = new XMLInterceptor();
        const handler = vi.fn(() => '');
        const dispose = interceptor.registerPatternParser(/\[disposer-test\]/g, 'persistent', handler);

        interceptor.processAndCleanText('a [disposer-test] b', true);
        expect(handler).toHaveBeenCalledTimes(1);

        dispose();
        interceptor.processAndCleanText('a [disposer-test] b', true);
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('keeps other pattern parsers registered with the same regex when one is disposed', () => {
        const interceptor = new XMLInterceptor();
        const pattern = /\[shared-pattern\]/g;
        const first = vi.fn(() => '');
        const second = vi.fn(() => '');
        const disposeFirst = interceptor.registerPatternParser(pattern, 'persistent', first);
        interceptor.registerPatternParser(pattern, 'persistent', second);

        disposeFirst();
        interceptor.processAndCleanText('[shared-pattern]', true);

        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
    });

    it('returns a disposer from registerXMLParser that removes only that handler', () => {
        const interceptor = new XMLInterceptor();
        const tag = 'Disposer_Tag_One';
        const handler = vi.fn(() => '');
        const dispose = interceptor.registerXMLParser(tag, 'persistent', handler, 'plugin:disposer-test');
        interceptor.processAndCleanText(`<${tag}>x</${tag}>`, true);
        expect(handler).toHaveBeenCalledTimes(1);

        dispose();
        interceptor.processAndCleanText(`<${tag}>x</${tag}>`, true);
        expect(handler).toHaveBeenCalledTimes(1);
        globalXMLTagRegistry.unregister('plugin:disposer-test');
    });

    it('does not remove a handler that replaced the disposed registration', () => {
        const interceptor = new XMLInterceptor();
        const tag = 'Disposer_Tag_Two';
        const first = vi.fn(() => '');
        const second = vi.fn(() => '');
        const disposeFirst = interceptor.registerXMLParser(tag, 'persistent', first, 'plugin:disposer-test2');
        interceptor.registerXMLParser(tag, 'persistent', second, 'plugin:disposer-test2');

        disposeFirst();
        interceptor.processAndCleanText(`<${tag}>x</${tag}>`, true);

        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
        globalXMLTagRegistry.unregister('plugin:disposer-test2');
    });
});
