import type { DesktopModeManifest, DesktopModePackage } from './types.js';

export const isDesktopModePackage = (
    value: DesktopModeManifest | DesktopModePackage
): value is DesktopModePackage => 'manifest' in value;

/** manifest-only 注册等价于只带 manifest 的 package。 */
export const normalizeDesktopModePackage = (
    value: DesktopModeManifest | DesktopModePackage
): DesktopModePackage => (isDesktopModePackage(value) ? value : { manifest: value });
