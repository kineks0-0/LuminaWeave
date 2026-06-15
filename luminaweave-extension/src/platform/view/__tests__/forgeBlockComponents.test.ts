import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

describe('forge block component aggregation', () => {
    it('exports the Forge XML block components from one lazy module', () => {
        const modulePath = fileURLToPath(new URL('../../../plugins/forge/blocks/forgeBlockComponents.ts', import.meta.url));
        const source = readFileSync(modulePath, 'utf8');
        const exportedNames = Array.from(source.matchAll(/export \{ default as (\w+) \}/g))
            .map(match => match[1])
            .sort();

        expect(exportedNames).toEqual([
            'ForgeAutoListBlock',
            'ForgeChecklistBlock',
            'ForgeChoiceBlock',
            'ForgeChoiceGroupBlock',
            'ForgeEntryProposalBlock',
            'ForgeFacetChecklistBlock',
            'ForgeFormAssistBlock',
            'ForgeFormBlock',
            'ForgeInputBlock',
            'ForgeLayerNavigatorBlock',
            'ForgeMemoryProposalBlock',
            'ForgeMessageAutoSubmit',
            'ForgeMessageSubmitBlock',
            'ForgeMissingFieldsBlock',
            'ForgeModePickerBlock',
            'ForgeSelectBlock',
            'ForgeSummaryCardBlock',
            'ForgeTextareaBlock'
        ]);
    });
});
