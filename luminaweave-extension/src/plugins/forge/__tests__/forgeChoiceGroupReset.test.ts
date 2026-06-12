import { describe, expect, it } from 'vitest';

import { buildForgeChoiceGroupResetKey } from '../blocks/forgeChoiceGroupReset.js';

describe('forgeChoiceGroupReset', () => {
    it('keeps the reset key stable when option content is unchanged', () => {
        const firstKey = buildForgeChoiceGroupResetKey({
            label: '下一步',
            options: ['调研', '整理']
        });
        const secondKey = buildForgeChoiceGroupResetKey({
            label: '下一步',
            options: ['调研', '整理']
        });

        expect(secondKey).toBe(firstKey);
    });

    it('changes the reset key when label or option content changes', () => {
        const baseKey = buildForgeChoiceGroupResetKey({
            label: '下一步',
            options: ['调研', '整理']
        });

        expect(buildForgeChoiceGroupResetKey({
            label: '执行方式',
            options: ['调研', '整理']
        })).not.toBe(baseKey);
        expect(buildForgeChoiceGroupResetKey({
            label: '下一步',
            options: ['整理', '调研']
        })).not.toBe(baseKey);
    });
});
