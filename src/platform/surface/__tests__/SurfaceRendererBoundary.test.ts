import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { DesktopExperienceRuntime } from '../../../api/services/DesktopExperienceRuntime.js';
import { desktopExperienceRuntimeKey } from '../../../composables/useDesktopExperienceRuntime.js';
import SurfaceOutlet from '../SurfaceOutlet.vue';
import SurfaceRendererBoundary from '../SurfaceRendererBoundary.vue';
import { surfaceRegistry } from '../SurfaceRegistry.js';
import type { EmptySurfaceData, SurfaceContractSpec } from '../types.js';

declare module '../types.js' {
    interface SurfaceContractMap {
        'test.renderer-failure': SurfaceContractSpec<EmptySurfaceData>;
    }
}

const boundaryPath = fileURLToPath(new URL('../SurfaceRendererBoundary.vue', import.meta.url));

describe('SurfaceRendererBoundary', () => {
    it('captures a renderer failure without preventing a sibling surface from rendering', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const onRendererFailed = vi.fn();
        const ThrowingRenderer = defineComponent({
            setup(): never {
                throw new Error('renderer failed');
            }
        });
        const app = createSSRApp(defineComponent({
            render() {
                return h('main', [
                    h(SurfaceRendererBoundary, {
                        contractId: 'chat.main',
                        ownerId: 'lumina-chat',
                        onRendererFailed
                    }, { default: () => h(ThrowingRenderer) }),
                    h('div', { id: 'healthy-surface' }, 'healthy')
                ]);
            }
        }));

        const html = await renderToString(app);

        expect(html).toContain('id="healthy-surface"');
        expect(consoleError).toHaveBeenCalledWith(
            '[SurfaceRuntime] Renderer failed',
            expect.objectContaining({ contractId: 'chat.main', ownerId: 'lumina-chat' })
        );
        expect(onRendererFailed).toHaveBeenCalledTimes(1);
        consoleError.mockRestore();
    });

    it('switches the client boundary to a local failure surface after capture', () => {
        const source = readFileSync(boundaryPath, 'utf8');

        expect(source).toContain('<SurfaceFailure v-if="failed"');
        expect(source).toContain('onErrorCaptured');
        expect(source).toContain('failed.value = true');
        expect(source).toContain("emit('renderer-failed')");
        expect(source).toContain('return false');
    });

    it('disposes the active surface context when its renderer throws', async () => {
        const disposer = vi.fn();
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const ThrowingRenderer = defineComponent({
            setup(): never {
                throw new Error('renderer failed');
            }
        });
        surfaceRegistry.registerContract({
            id: 'test.renderer-failure',
            ownerPluginId: 'test-renderer',
            inputSchema: z.object({}).strict()
        });
        surfaceRegistry.registerBusinessRenderer({
            contractId: 'test.renderer-failure',
            component: ThrowingRenderer,
            ownerId: 'test-renderer',
            kind: 'plugin-business',
            createContext: ({ onDispose }) => {
                onDispose(disposer);
                return { state: {}, intents: {} };
            }
        });
        const app = createSSRApp(defineComponent({
            render() {
                return h(SurfaceOutlet, {
                    contractId: 'test.renderer-failure',
                    input: {},
                    desktopModeId: 'classic'
                });
            }
        }));
        app.provide(desktopExperienceRuntimeKey, {} as DesktopExperienceRuntime);

        await renderToString(app);

        expect(disposer).toHaveBeenCalledTimes(1);
        consoleError.mockRestore();
    });
});
