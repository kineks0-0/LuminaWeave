import type { SurfaceSkinContext, ThemeValueMap } from '../../core/types.js';

export const resolveStageDesignTokens = ({ resolvedAppearance }: SurfaceSkinContext): ThemeValueMap => ({
    '--lw-theme-accent-soft': resolvedAppearance === 'dark'
        ? 'rgba(var(--lw-primary-rgb), 0.20)'
        : 'rgba(var(--lw-primary-rgb), 0.14)',
    '--lw-theme-panel-sheen': resolvedAppearance === 'dark'
        ? 'rgba(255, 255, 255, 0.04)'
        : 'rgba(255, 255, 255, 0.42)'
});
