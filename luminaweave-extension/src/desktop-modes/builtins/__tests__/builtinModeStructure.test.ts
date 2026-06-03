import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const readSource = (relativePath: string) =>
    readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('builtin desktop mode structure', () => {
    it('keeps per-mode settings definitions in each builtin mode directory', () => {
        const sharedSource = readSource('shared.ts');
        const cases = [
            ['classic/settings.ts', 'classicDesktopModeSettings'],
            ['stage/settings.ts', 'stageDesktopModeSettings'],
            ['discord/settings.ts', 'discordDesktopModeSettings'],
            ['telegram/settings.ts', 'telegramDesktopModeSettings'],
        ] as const;

        cases.forEach(([, exportName]) => {
            expect(sharedSource).not.toContain(`export const ${exportName}`);
        });

        cases.forEach(([filePath, exportName]) => {
            const source = readSource(filePath);
            expect(source).toContain(`export const ${exportName}`);
            expect(source).not.toContain(`export { ${exportName} } from '../shared.js';`);
        });
    });

    it('keeps per-mode design token resolvers in each builtin mode directory', () => {
        const sharedSource = readSource('shared.ts');
        const cases = [
            ['discord/tokens.ts', 'resolveDiscordDesignTokens'],
            ['telegram/tokens.ts', 'resolveTelegramDesignTokens'],
        ] as const;

        cases.forEach(([, exportName]) => {
            expect(sharedSource).not.toContain(`export const ${exportName}`);
        });

        cases.forEach(([filePath, exportName]) => {
            const source = readSource(filePath);
            expect(source).toContain(`export const ${exportName}`);
            expect(source).not.toContain(`export { ${exportName} } from '../shared.js';`);
        });
    });

    it('keeps per-mode surface skin maps in each builtin mode directory', () => {
        const sharedSource = readSource('shared.ts');
        const cases = [
            ['discord/skins.ts', 'createDiscordSurfaceSkinMap'],
            ['telegram/skins.ts', 'createTelegramSurfaceSkinMap'],
        ] as const;

        cases.forEach(([, exportName]) => {
            expect(sharedSource).not.toContain(`export const ${exportName}`);
        });

        cases.forEach(([filePath, exportName]) => {
            const source = readSource(filePath);
            expect(source).toContain(`export const ${exportName}`);
            expect(source).not.toContain(`export { ${exportName} } from '../shared.js';`);
        });
    });
});
