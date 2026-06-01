import type { CSSProperties } from 'vue';
import type { ResolvedThemeAppearance } from '../../theme/types.js';
import type {
  ActivityStatusBarDescriptor,
  ResolvedActivityStatusBarAppearance
} from './types.js';

export const resolveActivityStatusBarIconColor = ({
  iconColor,
  resolvedAppearance
}: {
  iconColor?: ActivityStatusBarDescriptor['iconColor'];
  resolvedAppearance: ResolvedThemeAppearance;
}): ResolvedActivityStatusBarAppearance['iconColor'] => {
  if (iconColor === 'light' || iconColor === 'dark') {
    return iconColor;
  }

  return resolvedAppearance === 'dark' ? 'light' : 'dark';
};

export const resolveActivityStatusBarAppearance = ({
  statusBar,
  resolvedAppearance
}: {
  statusBar: ActivityStatusBarDescriptor | null | undefined;
  resolvedAppearance: ResolvedThemeAppearance;
}): ResolvedActivityStatusBarAppearance => ({
  background: statusBar?.background || null,
  iconColor: resolveActivityStatusBarIconColor({
    iconColor: statusBar?.iconColor,
    resolvedAppearance
  }),
  safeArea: statusBar?.safeArea || 'shell'
});

export const createActivityStatusBarStyle = (
  appearance: ResolvedActivityStatusBarAppearance
): CSSProperties => ({
  ...(appearance.background ? { '--lw-activity-statusbar-bg': appearance.background } : {}),
  '--lw-activity-statusbar-icon-color': appearance.iconColor,
  '--lw-activity-statusbar-safe-area': appearance.safeArea
});
