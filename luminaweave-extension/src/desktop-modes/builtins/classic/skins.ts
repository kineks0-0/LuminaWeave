import type { DesktopModeManifest } from '../../core/types.js';
import { createSurfaceSkinMap } from '../shared.js';

export const createClassicSurfaceSkinMap = (): DesktopModeManifest['surfaceSkins'] =>
    createSurfaceSkinMap();
