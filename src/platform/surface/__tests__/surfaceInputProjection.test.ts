import { describe, expect, it } from 'vitest';
import type { SurfaceContractSpec } from '../types.js';
import { projectSurfaceInput } from '../surfaceInputProjection.js';

declare module '../types.js' {
    interface SurfaceContractMap {
        'projection.custom': SurfaceContractSpec<{ recordId: string }>;
    }
}

describe('projectSurfaceInput', () => {
    it('projects only settings input fields from legacy Activity metadata', () => {
        const activity = { size: 'small' as const, pageType: 'standalone' as const };

        const input = projectSurfaceInput('settings.root', {
            mode: 'small',
            activity,
            isMobile: true,
            isTemporaryWidgetTab: true
        }, {
            activity,
            isMobile: true
        });

        expect(input).toEqual({ mode: 'small', activity });
    });

    it('keeps chat callbacks while excluding unrelated Activity metadata', () => {
        const onTelegramBack = (): void => undefined;
        const input = projectSurfaceInput('chat.main', {
            activity: { size: 'default', pageType: 'nested' },
            onTelegramBack
        }, {
            isMobile: true,
            workspaceCompact: true
        });

        expect(input).toEqual({
            isMobile: true,
            workspaceCompact: true,
            onTelegramBack
        });
    });

    it('adds Forge shell context without leaking legacy flags', () => {
        const activity = { size: 'small' as const, pageType: 'nested' as const };
        const input = projectSurfaceInput('forge.workspace', {
            embeddedInWorkspaceWindow: true,
            isTabMode: true
        }, {
            activity,
            isMobile: false,
            auxSidebarMode: 'widget',
            activeRightPanelId: 'card_maker'
        });

        expect(input).toEqual({
            embeddedInWorkspaceWindow: true,
            activity,
            isMobile: false,
            auxSidebarMode: 'widget',
            activeRightPanelId: 'card_maker'
        });
    });

    it('does not infer input fields for third-party contracts', () => {
        const input = projectSurfaceInput('projection.custom', {
            recordId: 'record-1'
        }, {
            activity: { size: 'small', pageType: 'nested' },
            isMobile: true
        });

        expect(input).toEqual({ recordId: 'record-1' });
    });
});
