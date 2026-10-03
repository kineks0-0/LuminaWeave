import { afterEach, describe, expect, it } from 'vitest';
import { globalXMLTagRegistry } from '@shared/XMLTagRegistry.js';
import { PromptRegistry, PromptSlot, type PromptFragment } from '@/api/core/hal/prompt/PromptRegistry.js';

const createFragment = (id: string, tag?: string): PromptFragment => ({
    id,
    slot: PromptSlot.ST_MAIN,
    priority: 1,
    xmlTags: tag ? [{ tag, description: 'test', priority: 1 }] : undefined,
    getFragment: () => null
});

describe('PromptRegistry.unregisterIfCurrent', () => {
    afterEach(() => {
        globalXMLTagRegistry.unregister('pr-frag-a');
        globalXMLTagRegistry.unregister('pr-frag-b');
    });

    it('removes the fragment and its xml tags when it is still current', () => {
        const registry = new PromptRegistry();
        const fragment = createFragment('pr-frag-a', 'PR_Test_Tag_A');
        registry.register(fragment);
        expect(globalXMLTagRegistry.getDefinition('PR_Test_Tag_A')).toBeDefined();

        registry.unregisterIfCurrent(fragment);

        expect(registry.getAllFragments()).toEqual([]);
        expect(globalXMLTagRegistry.getDefinition('PR_Test_Tag_A')).toBeUndefined();
    });

    it('does not remove a newer fragment registered under the same id', () => {
        const registry = new PromptRegistry();
        const first = createFragment('pr-frag-b', 'PR_Test_Tag_B');
        const second = createFragment('pr-frag-b', 'PR_Test_Tag_B');
        registry.register(first);
        registry.register(second);

        registry.unregisterIfCurrent(first);

        expect(registry.getAllFragments()).toEqual([second]);
        expect(globalXMLTagRegistry.getDefinition('PR_Test_Tag_B')).toBeDefined();
    });
});
