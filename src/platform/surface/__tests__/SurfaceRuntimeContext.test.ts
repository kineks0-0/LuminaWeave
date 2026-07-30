import { defineComponent } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import type { DesktopExperienceRuntime } from '../../../api/services/DesktopExperienceRuntime.js';
import { createSurfaceRuntimeContext } from '../createSurfaceRuntimeContext.js';
import type { SurfaceRendererDefinition } from '../types.js';

const runtime = {} as DesktopExperienceRuntime;

describe('createSurfaceRuntimeContext', () => {
    it('provides typed input, runtime, theme and idempotent disposal', () => {
        const disposer = vi.fn();
        const renderer: SurfaceRendererDefinition<'settings.root'> = {
            contractId: 'settings.root',
            component: defineComponent({ template: '<div />' }),
            ownerId: 'lumina-settings',
            kind: 'plugin-business',
            createContext: ({ onDispose }) => {
                onDispose(disposer);
                return { state: {}, intents: {} };
            }
        };

        const surface = createSurfaceRuntimeContext({
            contractId: 'settings.root',
            input: { mode: 'small' },
            renderer,
            runtime,
            theme: { desktopModeId: 'classic' }
        });

        expect(surface.context.contractId).toBe('settings.root');
        expect(surface.context.input).toEqual({ mode: 'small' });
        expect(surface.context.runtime).toBe(runtime);
        expect(surface.context.theme.desktopModeId).toBe('classic');

        surface.dispose();
        surface.dispose();
        expect(disposer).toHaveBeenCalledTimes(1);
    });

    it('disposes callbacks registered directly through the public context', () => {
        const disposer = vi.fn();
        const renderer: SurfaceRendererDefinition<'chat.preview'> = {
            contractId: 'chat.preview',
            component: defineComponent({ template: '<div />' }),
            ownerId: 'lumina-chat',
            kind: 'plugin-business'
        };
        const surface = createSurfaceRuntimeContext({
            contractId: 'chat.preview',
            input: {},
            renderer,
            runtime,
            theme: { desktopModeId: 'stage' }
        });

        surface.context.onDispose(disposer);
        surface.dispose();

        expect(disposer).toHaveBeenCalledTimes(1);
    });

    it('preserves the context creation error while isolating disposer failures', () => {
        const originalError = new Error('context creation failed');
        const laterDisposer = vi.fn();
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const renderer: SurfaceRendererDefinition<'chat.preview'> = {
            contractId: 'chat.preview',
            component: defineComponent({ template: '<div />' }),
            ownerId: 'lumina-chat',
            kind: 'plugin-business',
            createContext: ({ onDispose }) => {
                onDispose(() => {
                    throw new Error('disposer failed');
                });
                onDispose(laterDisposer);
                throw originalError;
            }
        };

        expect(() => createSurfaceRuntimeContext({
            contractId: 'chat.preview',
            input: {},
            renderer,
            runtime,
            theme: { desktopModeId: 'classic' }
        })).toThrow(originalError);

        expect(laterDisposer).toHaveBeenCalledTimes(1);
        expect(consoleError).toHaveBeenCalledWith(
            '[SurfaceRuntime] Disposer failed',
            expect.objectContaining({ contractId: 'chat.preview', ownerId: 'lumina-chat' })
        );
        consoleError.mockRestore();
    });

    it('rejects a context that does not expose every required intent', () => {
        const renderer: SurfaceRendererDefinition<'chat.preview'> = {
            contractId: 'chat.preview',
            component: defineComponent({ template: '<div />' }),
            ownerId: 'lumina-chat',
            kind: 'plugin-business',
            createContext: () => ({ state: {}, intents: {} })
        };

        expect(() => createSurfaceRuntimeContext({
            contractId: 'chat.preview',
            input: {},
            renderer,
            runtime,
            theme: { desktopModeId: 'classic' },
            requiredIntents: ['send']
        })).toThrow(/Required surface intent unavailable: send/);
    });
});
