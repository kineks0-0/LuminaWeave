import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { computed, nextTick } from 'vue';

import { useCardMakerStore } from '../CardMakerStore.js';

describe('useCardMakerStore transient selections', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    it('invalidates computed consumers when a message-scoped checklist selection changes', async () => {
        const store = useCardMakerStore();
        const selectedDreamSources = computed(() =>
            store.getTransientFieldList('message-1', 'entity_background/why_dreams')
        );

        expect(selectedDreamSources.value).toEqual([]);

        store.upsertTransientSelection('entity_background/why_dreams', ['born_trait'], 'message-1');
        await nextTick();

        expect(selectedDreamSources.value).toEqual(['born_trait']);

        store.upsertTransientSelection('entity_background/why_dreams', ['born_trait', 'curse'], 'message-1');
        await nextTick();

        expect(selectedDreamSources.value).toEqual(['born_trait', 'curse']);
    });
});
