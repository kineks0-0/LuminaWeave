import type { DesktopModeManifest } from '../../core/types.js';
import { createSurfaceSkinMap } from '../shared.js';

export const createStageSurfaceSkinMap = (): DesktopModeManifest['surfaceSkins'] =>
    createSurfaceSkinMap({
        '--lw-shell-main-bg':
            'linear-gradient(180deg, color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent), color-mix(in srgb, var(--lw-bg-surface) 88%, transparent))',
        '--lw-shell-widget-bg':
            'linear-gradient(180deg, color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent), color-mix(in srgb, var(--lw-bg-surface) 88%, transparent))',
        '--lw-shell-stage-bg':
            'radial-gradient(circle at 18% 20%, rgba(var(--lw-primary-rgb), 0.20), transparent 26%), radial-gradient(circle at 82% 14%, rgba(255, 255, 255, 0.32), transparent 24%), linear-gradient(180deg, color-mix(in srgb, var(--lw-bg-elevated) 74%, white), color-mix(in srgb, var(--lw-bg-app) 86%, transparent))',
        '--lw-chat-stream-bg': 'color-mix(in srgb, var(--lw-bg-elevated) 64%, transparent)',
        '--lw-chat-input-surface': 'color-mix(in srgb, var(--lw-bg-surface) 88%, transparent)',
        '--lw-chat-header-bg': 'transparent',
        '--lw-chat-input-area-bg': 'transparent',
        '--lw-chat-bubble-shadow': '0 18px 32px rgba(15, 23, 42, 0.10)'
    });
