import { describe, expect, it } from 'vitest';
import type { ResourceRef } from '@shared/resources/index.js';
import { PromptResourceBindingService } from '@/api/core/hal/resource/PromptResourceBindingService.js';

const ref = (sourceId: string, resourceType: ResourceRef['resourceType'], resourceId: string): ResourceRef => ({
    sourceId,
    resourceType,
    resourceId,
    path: `${sourceId}://${resourceType}/${resourceId}`,
    writable: true
});

describe('PromptResourceBindingService.mergeWorldbookRefs', () => {
    it('merges global and session worldbooks in order and drops duplicates', () => {
        const merged = PromptResourceBindingService.mergeWorldbookRefs(
            [ref('local', 'worldbook', 'a'), ref('local', 'preset', 'ignored')],
            [ref('local', 'worldbook', 'a'), ref('st', 'worldbook', 'b')]
        );

        expect(merged.map(item => `${item.sourceId}:${item.resourceId}`)).toEqual(['local:a', 'st:b']);
    });

    it('keeps same resource id from different sources', () => {
        const merged = PromptResourceBindingService.mergeWorldbookRefs(
            [ref('local', 'worldbook', 'shared')],
            [ref('st', 'worldbook', 'shared')]
        );

        expect(merged).toHaveLength(2);
    });
});
