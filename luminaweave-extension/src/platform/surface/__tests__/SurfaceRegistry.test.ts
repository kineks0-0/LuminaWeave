import { defineComponent } from 'vue';
import { describe, expect, it } from 'vitest';
import { SurfaceRegistry } from '../SurfaceRegistry';
import type { SurfaceRendererDefinition } from '../types';

const createRenderer = (
    ownerId: string,
    kind: SurfaceRendererDefinition['kind'],
    variant?: string
): SurfaceRendererDefinition => ({
    contractId: 'chat.preview',
    component: defineComponent({ name: `${ownerId}Renderer`, template: '<div />' }),
    ownerId,
    kind,
    variant
});

describe('SurfaceRegistry', () => {
    it('resolves desktop override before plugin business and core default renderers', () => {
        const registry = new SurfaceRegistry();
        registry.registerDefaultRenderer(createRenderer('core', 'core-default'));
        registry.registerBusinessRenderer(createRenderer('lumina-chat', 'plugin-business'));
        registry.registerDesktopOverride('telegram', createRenderer('telegram', 'desktop-override'));

        const resolved = registry.resolve({
            contractId: 'chat.preview',
            desktopModeId: 'telegram'
        });

        expect(resolved.source).toBe('desktop-override');
        expect(resolved.renderer.ownerId).toBe('telegram');
    });

    it('falls back to plugin business renderer before core default renderer', () => {
        const registry = new SurfaceRegistry();
        registry.registerDefaultRenderer(createRenderer('core', 'core-default'));
        registry.registerBusinessRenderer(createRenderer('lumina-chat', 'plugin-business'));

        const resolved = registry.resolve({
            contractId: 'chat.preview',
            desktopModeId: 'classic'
        });

        expect(resolved.source).toBe('plugin-business');
        expect(resolved.renderer.ownerId).toBe('lumina-chat');
    });

    it('falls back to core default renderer when no desktop or plugin renderer exists', () => {
        const registry = new SurfaceRegistry();
        registry.registerDefaultRenderer(createRenderer('core', 'core-default'));

        const resolved = registry.resolve({
            contractId: 'chat.preview',
            desktopModeId: 'classic'
        });

        expect(resolved.source).toBe('core-default');
        expect(resolved.renderer.ownerId).toBe('core');
    });

    it('uses an empty renderer for missing surfaces when one is registered', () => {
        const registry = new SurfaceRegistry();
        registry.registerEmptyRenderer(createRenderer('core-empty', 'empty'));

        const resolved = registry.resolve({
            contractId: 'settings.root',
            desktopModeId: 'stage'
        });

        expect(resolved.source).toBe('empty');
        expect(resolved.renderer.contractId).toBe('settings.root');
        expect(resolved.renderer.ownerId).toBe('core-empty');
    });
});
