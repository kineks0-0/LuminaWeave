import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { globalXMLTagRegistry } from '@shared/XMLTagRegistry.js';
import { globalPromptRegistry } from '../../../api/core/hal/prompt/PromptRegistry.js';
import { createTestInitContextHarness } from '../../../core/__tests__/testInitContext.js';
import { PluginRegistrationScope } from '../../../platform/plugin/PluginRegistrationScope.js';
import { IncrementalMutationEngine } from '../MutationEngine.js';

describe('IncrementalMutationEngine.install(context)', () => {
    let scope = new PluginRegistrationScope('mutation-install-test');
    beforeEach(() => {
        scope = new PluginRegistrationScope('mutation-install-test');
    });
    afterEach(() => {
        scope.dispose();
    });

    it('does not register anything globally on construction', () => {
        new IncrementalMutationEngine();

        expect(globalPromptRegistry.getAllFragments().some(f => f.id === 'mutation-engine-xml-docs')).toBe(false);
        expect(globalXMLTagRegistry.getDefinition('Mutation')?.sourceId).toBe('core-default-mutation');
    });

    it('parses <Mutation>, <M> and the inventory pattern only after install', () => {
        const harness = createTestInitContextHarness();
        const engine = new IncrementalMutationEngine();
        const onUpdate = vi.fn();
        const onAdd = vi.fn();
        engine.registerDataModel('global', { onUpdate });
        engine.registerDataModel('inventory', { onAdd });
        const input = '<Mutation>global = {time: "dawn"}</Mutation><M>global = {time: "dusk"}</M>[物品栏更新]：\n- 消耗品：金疮药（止血）';

        harness.xmlInterceptor.processAndCleanText(input, true);
        expect(onUpdate).not.toHaveBeenCalled();

        engine.install(harness.factory('mutation-install-test', scope));
        harness.xmlInterceptor.processAndCleanText(input, true);

        expect(onUpdate).toHaveBeenCalledWith({ time: 'dawn' }, undefined, undefined);
        expect(onUpdate).toHaveBeenCalledWith({ time: 'dusk' }, undefined, undefined);
        expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ count: 1 }), undefined, undefined);
        expect(harness.promptRegistry.getAllFragments().some(f => f.id === 'mutation-engine-xml-docs')).toBe(true);
    });

    it('removes parsers and the docs fragment when the scope is disposed', () => {
        const harness = createTestInitContextHarness();
        const engine = new IncrementalMutationEngine();
        const onUpdate = vi.fn();
        engine.registerDataModel('global', { onUpdate });
        engine.install(harness.factory('mutation-install-test', scope));

        scope.dispose();
        harness.xmlInterceptor.processAndCleanText('<Mutation>global = {time: "dawn"}</Mutation>', true);

        expect(onUpdate).not.toHaveBeenCalled();
        expect(harness.promptRegistry.getAllFragments().some(f => f.id === 'mutation-engine-xml-docs')).toBe(false);
        // Mutation 标签自带 core-default 定义，撤销后应回到该定义而不是被清空。
        expect(globalXMLTagRegistry.getDefinition('Mutation')?.sourceId).toBe('core-default-mutation');
    });

    it('registerDataModel returns a disposer that only removes its own proxy', () => {
        const engine = new IncrementalMutationEngine();
        const first = { onUpdate: vi.fn() };
        const second = { onUpdate: vi.fn() };
        const disposeFirst = engine.registerDataModel('x', first);
        engine.registerDataModel('x', second);

        disposeFirst();
        expect(engine.models.get('x')).toBe(second);
    });
});
