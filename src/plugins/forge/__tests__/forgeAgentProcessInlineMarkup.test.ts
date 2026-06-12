import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const panelSource = (): string => readFileSync(
    resolve(__dirname, '../app/CardMakerPanel.vue'),
    'utf8'
);

describe('forge agent process inline markup', () => {
    it('renders the agent process as an inline section instead of a card', () => {
        const source = panelSource();

        expect(source).toContain('class="agent-process-inline"');
        expect(source).not.toContain('agent-process-card');
        expect(source).not.toContain('.agent-process-card');
    });
});
