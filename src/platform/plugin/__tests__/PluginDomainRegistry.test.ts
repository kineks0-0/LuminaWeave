import { describe, expect, it } from 'vitest';
import { PluginDomainRegistry } from '../PluginDomainRegistry.js';

describe('PluginDomainRegistry', () => {
    it('removes a registered manifest through the returned disposer', () => {
        const registry = new PluginDomainRegistry();
        const manifest = { id: 'demo', name: 'Demo' };
        const dispose = registry.register(manifest);
        expect(registry.get('demo')).toBe(manifest);

        dispose();
        dispose();

        expect(registry.get('demo')).toBeUndefined();
        expect(registry.list()).toEqual([]);
    });

    it('does not remove a newer manifest registered under the same id', () => {
        const registry = new PluginDomainRegistry();
        const disposeFirst = registry.register({ id: 'demo', name: 'First' });
        disposeFirst();
        const second = { id: 'demo', name: 'Second' };
        registry.register(second);

        disposeFirst();

        expect(registry.get('demo')).toBe(second);
    });
});
