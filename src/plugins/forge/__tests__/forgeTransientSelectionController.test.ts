import { describe, expect, it, vi } from 'vitest';
import { createEmptyStructuredState } from '../../../api/core/utils/forgeStateDefaults.js';
import { ForgeTransientSelectionController } from '../store/ForgeTransientSelectionController.js';

describe('ForgeTransientSelectionController', () => {
    it('stores transient selections in a normalized legacy scope', () => {
        const state = createEmptyStructuredState();
        state.submittedScopes.__legacy__ = 1;
        const controller = new ForgeTransientSelectionController({
            getStructuredState: () => state,
            persistWorkspaceSession: vi.fn(),
            now: () => 10
        });

        controller.upsertTransientSelection('语气', '温柔', null);

        expect(controller.getTransientFieldText(undefined, '语气')).toBe('温柔');
        expect(controller.hasPendingTransientSelections()).toBe(true);
        expect(state.submittedScopes.__legacy__).toBeUndefined();
        expect(state.lastUpdatedAt).toBe(10);
    });

    it('returns list values without flattening them into text-only state', () => {
        const state = createEmptyStructuredState();
        const controller = new ForgeTransientSelectionController({
            getStructuredState: () => state,
            persistWorkspaceSession: vi.fn(),
            now: () => 20
        });

        controller.upsertTransientSelection('关键词', ['雪', '钟楼'], 'scope-1');

        expect(controller.getTransientFieldText('scope-1', '关键词')).toBe('雪, 钟楼');
        expect(controller.getTransientFieldList('scope-1', '关键词')).toEqual(['雪', '钟楼']);
        expect(controller.getTransientFieldList('scope-1', '缺失')).toEqual([]);
    });

    it('remembers submit labels and submitted scopes with persistence hooks', () => {
        const state = createEmptyStructuredState();
        const persistWorkspaceSession = vi.fn();
        const controller = new ForgeTransientSelectionController({
            getStructuredState: () => state,
            persistWorkspaceSession,
            now: () => 30
        });

        controller.rememberSubmitConfig('scope-2', '  送出  ');
        controller.rememberSubmitConfig('scope-2', '送出');
        controller.markScopeSubmitted('scope-2');

        expect(controller.resolveSubmitLabel('scope-2')).toBe('送出');
        expect(controller.isScopeSubmitted('scope-2')).toBe(true);
        expect(state.submitConfigs['scope-2']).toEqual({
            label: '送出',
            updatedAt: 30
        });
        expect(persistWorkspaceSession).toHaveBeenCalledTimes(2);
    });
});
