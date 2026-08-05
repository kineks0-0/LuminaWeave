import { defineComponent } from 'vue';
import { describe, expect, it } from 'vitest';
import type { DesktopModeManifest } from '../../../desktop-modes/core/types.js';
import { OFFICIAL_SURFACE_INPUT_SCHEMAS } from '../../surface/officialContracts.js';
import { SurfaceRegistry } from '../../surface/SurfaceRegistry.js';
import type { SurfaceRendererDefinition } from '../../surface/types.js';
import { DesktopModeRuntimeRegistry } from '../DesktopModeRuntimeRegistry.js';
import type { DesktopModeRuntimeDescriptor } from '../types.js';

const createSurfaceRegistry = (): SurfaceRegistry => {
    const registry = new SurfaceRegistry();
    registry.registerContract({
        id: 'chat.main',
        inputSchema: OFFICIAL_SURFACE_INPUT_SCHEMAS['chat.main']
    });
    return registry;
};

const createDescriptor = (composition: object): DesktopModeRuntimeDescriptor => ({
    manifest: {
        id: 'composable-mode',
        name: 'Composable Mode',
        shell: { kind: 'traditional' },
        composition
    } as DesktopModeManifest,
    id: 'composable-mode',
    name: 'Composable Mode',
    shellKind: 'traditional',
    navigationModel: { id: 'composable-mode.navigation' },
    interactionPolicy: { id: 'composable-mode.interaction' }
});

const createValidComposition = (): object => ({
    version: 1,
    desktop: {
        id: 'desktop-root',
        kind: 'group',
        direction: 'row',
        size: 'fill',
        visibility: 'visible',
        children: [
            {
                id: 'desktop-chat',
                kind: 'surface',
                contractId: 'chat.main',
                input: { workspaceCompact: true },
                size: 'fill',
                visibility: 'visible'
            },
            {
                id: 'desktop-activity',
                kind: 'activity-slot',
                size: 'content',
                visibility: 'hidden'
            }
        ]
    },
    mobile: {
        id: 'mobile-chat',
        kind: 'surface',
        contractId: 'chat.main',
        input: { isMobile: true },
        size: 'fill',
        visibility: 'visible'
    }
});

describe('Desktop composition runtime', () => {
    it('registers version 1 composition and resolves desktop and mobile roots deterministically', () => {
        const registry = new DesktopModeRuntimeRegistry(createSurfaceRegistry());
        registry.register(createDescriptor(createValidComposition()));

        const firstDesktop = registry.resolveComposition('composable-mode', 'desktop');
        const secondDesktop = registry.resolveComposition('composable-mode', 'desktop');
        const mobile = registry.resolveComposition('composable-mode', 'mobile');

        expect(firstDesktop).toEqual(secondDesktop);
        expect(firstDesktop).not.toBe(secondDesktop);
        expect(firstDesktop).toMatchObject({ id: 'desktop-root', kind: 'group' });
        expect(mobile).toMatchObject({ id: 'mobile-chat', kind: 'surface' });
    });

    it('rejects unsupported composition versions', () => {
        const registry = new DesktopModeRuntimeRegistry(createSurfaceRegistry());
        const composition = { ...createValidComposition(), version: 2 };

        expect(() => registry.register(createDescriptor(composition)))
            .toThrow('[DesktopCompositionRuntime] Unsupported composition version');
        expect(registry.get('composable-mode')).toBeUndefined();
    });

    it('rejects duplicate node ids across desktop and mobile roots', () => {
        const registry = new DesktopModeRuntimeRegistry(createSurfaceRegistry());
        const composition = {
            ...createValidComposition(),
            mobile: {
                id: 'desktop-chat',
                kind: 'surface',
                contractId: 'chat.main',
                input: {},
                size: 'fill',
                visibility: 'visible'
            }
        };

        expect(() => registry.register(createDescriptor(composition)))
            .toThrow('[DesktopCompositionRuntime] Duplicate composition node id');
        expect(registry.get('composable-mode')).toBeUndefined();
    });

    it('rejects unknown surface contracts', () => {
        const registry = new DesktopModeRuntimeRegistry(createSurfaceRegistry());
        const composition = {
            ...createValidComposition(),
            mobile: {
                id: 'mobile-chat',
                kind: 'surface',
                contractId: 'unknown.surface',
                input: {},
                size: 'fill',
                visibility: 'visible'
            }
        };

        expect(() => registry.register(createDescriptor(composition)))
            .toThrow('[DesktopCompositionRuntime] Unknown surface contract');
        expect(registry.get('composable-mode')).toBeUndefined();
    });

    it('rejects invalid surface input', () => {
        const registry = new DesktopModeRuntimeRegistry(createSurfaceRegistry());
        const composition = {
            ...createValidComposition(),
            mobile: {
                id: 'mobile-chat',
                kind: 'surface',
                contractId: 'chat.main',
                input: { onOpenPanel: 'not-a-function' },
                size: 'fill',
                visibility: 'visible'
            }
        };

        expect(() => registry.register(createDescriptor(composition)))
            .toThrow('[DesktopCompositionRuntime] Invalid surface input');
        expect(registry.get('composable-mode')).toBeUndefined();
    });

    it('rejects layout values outside the controlled enums', () => {
        const registry = new DesktopModeRuntimeRegistry(createSurfaceRegistry());
        const composition = {
            ...createValidComposition(),
            desktop: {
                id: 'desktop-root',
                kind: 'group',
                direction: 'diagonal',
                size: 'fill',
                visibility: 'visible',
                children: [
                    {
                        id: 'desktop-chat',
                        kind: 'surface',
                        contractId: 'chat.main',
                        input: {},
                        size: 'fill',
                        visibility: 'visible'
                    }
                ]
            }
        };

        expect(() => registry.register(createDescriptor(composition)))
            .toThrow('[DesktopCompositionRuntime] Invalid composition layout');
        expect(registry.get('composable-mode')).toBeUndefined();
    });

    it('rejects arbitrary css, component references and attrs', () => {
        const registry = new DesktopModeRuntimeRegistry(createSurfaceRegistry());
        const composition = {
            ...createValidComposition(),
            mobile: {
                id: 'mobile-chat',
                kind: 'surface',
                contractId: 'chat.main',
                input: {},
                size: 'fill',
                visibility: 'visible',
                style: { display: 'grid' },
                component: defineComponent({ name: 'InjectedComponent', template: '<div />' }),
                attrs: { class: 'injected' }
            }
        };

        expect(() => registry.register(createDescriptor(composition)))
            .toThrow('[DesktopCompositionRuntime] Invalid composition layout');
        expect(registry.get('composable-mode')).toBeUndefined();
    });

    it('does not retain overrides when composition validation fails', () => {
        const surfaces = createSurfaceRegistry();
        const registry = new DesktopModeRuntimeRegistry(surfaces);
        const renderer: SurfaceRendererDefinition<'chat.main'> = {
            contractId: 'chat.main',
            component: defineComponent({ name: 'ComposableChat', template: '<div />' }),
            ownerId: 'composable-mode',
            kind: 'desktop-override'
        };
        const descriptor = createDescriptor({ ...createValidComposition(), version: 2 });
        descriptor.componentOverrides = { 'chat.main': renderer };

        expect(() => registry.register(descriptor))
            .toThrow('[DesktopCompositionRuntime] Unsupported composition version');
        expect(registry.get('composable-mode')).toBeUndefined();
        expect(() => surfaces.registerDesktopOverride('composable-mode', renderer)).not.toThrow();
    });
});
