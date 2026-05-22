import { describe, expect, it } from 'vitest';

import { FORGE_AUX_PANEL_META, FORGE_AUX_PANEL_ORDER } from '../forgeAuxPanels.js';

describe('forgeAuxPanels', () => {
    it('keeps Review Gate reachable from the Forge auxiliary panel navigation', () => {
        expect(FORGE_AUX_PANEL_META.review.title).toBe('审阅与暂存');
        expect(FORGE_AUX_PANEL_ORDER).toContain('review');
    });
});
