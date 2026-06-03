import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const resolvePlatformPath = (relativePath: string) =>
    new URL(`../${relativePath}`, import.meta.url);

describe('desktop mode runtime structure', () => {
    it('keeps desktop mode runtime in the explicit runtime directory', () => {
        expect(existsSync(resolvePlatformPath('desktop-mode-runtime/DesktopModeRuntimeRegistry.ts')))
            .toBe(true);
        expect(existsSync(resolvePlatformPath('desktop/DesktopModeRuntimeRegistry.ts')))
            .toBe(false);
    });
});
