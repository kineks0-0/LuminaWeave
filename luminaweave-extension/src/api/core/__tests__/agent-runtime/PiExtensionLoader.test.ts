import { describe, expect, it, vi } from 'vitest';
import {
    PiExtensionCompatHost,
    PiExtensionLoader
} from '@/api/core/agent-runtime/index.js';

describe('PiExtensionLoader', () => {
    it('returns diagnostics and continues when one extension module fails to import', async () => {
        const compatHost = new PiExtensionCompatHost({ cwd: 'D:/repo' });
        const loader = new PiExtensionLoader({
            compatHost,
            moduleLoader: {
                importModule: vi.fn(async path => {
                    if (path.endsWith('broken.ts')) {
                        throw new Error('load failed');
                    }
                    return {
                        default: vi.fn()
                    };
                })
            }
        });

        await expect(loader.load({
            runtimeId: 'test-runtime',
            paths: ['./broken.ts', './working.ts']
        })).resolves.toMatchObject({
            extensions: [{ id: './working.ts' }],
            diagnostics: [{
                type: 'error',
                path: './broken.ts',
                message: 'load failed'
            }]
        });
    });
});
