import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const outletPath = fileURLToPath(new URL('../SurfaceOutlet.vue', import.meta.url));

describe('SurfaceOutlet boundary', () => {
    it('does not access settings, storage, host globals or arbitrary attrs', () => {
        const source = readFileSync(outletPath, 'utf8');

        expect(source).not.toContain('useAttrs');
        expect(source).not.toContain('containerProps');
        expect(source).not.toContain('activeSettings');
        expect(source).not.toContain('lwStorage');
        expect(source).not.toContain('window.LuminaWeave');
        expect(source).not.toContain('(window as any)');
        expect(source).toContain('input: SurfaceInput<K>');
    });

    it('retries rebuilt surfaces and disposes a context immediately after renderer failure', () => {
        const source = readFileSync(outletPath, 'utf8');

        expect(source).toContain(':key="surfaceRevision"');
        expect(source).toContain('@renderer-failed="handleRendererFailure"');
        expect(source).toContain('const handleRendererFailure = (): void =>');
        expect(source).toContain('deep: true');
        expect(source).toContain('isSurfaceValueEquivalent');
    });
});
