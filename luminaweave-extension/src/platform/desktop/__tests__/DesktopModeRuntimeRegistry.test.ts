import { defineComponent } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { DesktopModeRuntimeRegistry } from '../DesktopModeRuntimeRegistry.js';
import { desktopModeRuntimeRegistry } from '../DesktopModeRuntimeRegistry.js';
import { initializeDesktopModeRuntime } from '../initializeDesktopModeRuntime.js';
import { SurfaceRegistry } from '../../surface/SurfaceRegistry.js';
import type { SurfaceRendererDefinition } from '../../surface/types.js';

vi.mock('../../../shell/traditional/TelegramUserInfoPanel.vue', () => ({
    default: defineComponent({ name: 'TelegramUserInfoPanelStub', template: '<div />' })
}));
vi.mock('../../../shell/traditional/TraditionalShell.vue', () => ({
    default: defineComponent({ name: 'TraditionalShellStub', template: '<div />' })
}));
vi.mock('../../../shell/freeform/FreeformShell.vue', () => ({
    default: defineComponent({ name: 'FreeformShellStub', template: '<div />' })
}));

const createRenderer = (ownerId: string): SurfaceRendererDefinition => ({
    contractId: 'settings.root',
    component: defineComponent({ name: `${ownerId}SettingsRoot`, template: '<div />' }),
    ownerId,
    kind: 'desktop-override'
});

describe('DesktopModeRuntimeRegistry', () => {
    it('registers desktop component overrides into the provided surface registry shape', () => {
        const desktopRegistry = new DesktopModeRuntimeRegistry();
        const renderer = createRenderer('telegram');

        desktopRegistry.register({
            id: 'telegram',
            name: 'Telegram 桌面',
            shellKind: 'traditional',
            navigationModel: {
                id: 'telegram.navigation',
                primarySurfaces: ['chat.main'],
                contextualSurfaces: ['settings.root']
            },
            componentOverrides: {
                'settings.root': renderer
            },
            interactionPolicy: {
                id: 'telegram.policy',
                openSurface: 'temporary-tab',
                supportsContextualTools: true
            }
        });

        const mode = desktopRegistry.get('telegram');

        expect(mode?.navigationModel.primarySurfaces).toEqual(['chat.main']);
        expect(mode?.componentOverrides?.['settings.root']?.ownerId).toBe('telegram');
    });

    it('rejects duplicate desktop mode ids', () => {
        const desktopRegistry = new DesktopModeRuntimeRegistry();
        const manifest = {
            id: 'stage',
            name: '自由工作台',
            shellKind: 'freeform' as const,
            navigationModel: { id: 'stage.navigation' },
            interactionPolicy: { id: 'stage.policy', supportsOverlappingWindows: true }
        };

        desktopRegistry.register(manifest);

        expect(() => desktopRegistry.register(manifest)).toThrow(/Duplicate desktop mode id: stage/);
    });

    it('keeps surface registry override semantics compatible with desktop overrides', () => {
        const surfaceRegistry = new SurfaceRegistry();
        const renderer = createRenderer('discord');

        surfaceRegistry.registerDesktopOverride('discord', renderer);

        const resolved = surfaceRegistry.resolve({
            contractId: 'settings.root',
            desktopModeId: 'discord'
        });

        expect(resolved.source).toBe('desktop-override');
        expect(resolved.renderer.ownerId).toBe('discord');
    });

    it('adapts current built-in desktop modes into runtime v2 manifests', () => {
        desktopModeRuntimeRegistry.clearForTests();
        initializeDesktopModeRuntime();

        const ids = desktopModeRuntimeRegistry.list().map(mode => mode.id);

        expect(ids).toContain('classic');
        expect(ids).toContain('stage');
        expect(ids).toContain('telegram');
        expect(ids).toContain('discord');
        expect(desktopModeRuntimeRegistry.get('stage')?.interactionPolicy.supportsOverlappingWindows).toBe(true);
        expect(desktopModeRuntimeRegistry.get('classic')?.shellRenderer).toBeDefined();
        expect(desktopModeRuntimeRegistry.get('stage')?.shellRenderer).toBeDefined();
        expect(desktopModeRuntimeRegistry.get('telegram')?.navigationModel.mobileSurfaces).toContain('settings.root');
        expect(desktopModeRuntimeRegistry.get('telegram')?.componentOverrides?.['telegram.infoPanel']?.ownerId).toBe('telegram');
    });
});
