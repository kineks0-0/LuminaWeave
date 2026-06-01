import type { SurfaceSkinContext, ThemeValueMap } from '../../core/types.js';

export const resolveClassicDesignTokens = ({ resolvedAppearance }: SurfaceSkinContext): ThemeValueMap => ({
    '--lw-theme-accent-soft': resolvedAppearance === 'dark'
        ? 'rgba(var(--lw-primary-rgb), 0.16)'
        : 'rgba(var(--lw-primary-rgb), 0.10)'
});
