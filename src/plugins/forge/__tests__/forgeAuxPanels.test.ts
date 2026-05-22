import { describe, expect, it } from 'vitest';

import { FORGE_AUX_PANEL_META, FORGE_AUX_PANEL_ORDER } from '../forgeAuxPanels.js';

describe('forgeAuxPanels', () => {
    it('keeps the legacy review panel hidden from the primary auxiliary navigation', () => {
        expect(FORGE_AUX_PANEL_META.review.title).toBe('历史暂存');
        expect(FORGE_AUX_PANEL_ORDER).not.toContain('review');
        expect(FORGE_AUX_PANEL_ORDER).toContain('workspace_versions');
    });
});
