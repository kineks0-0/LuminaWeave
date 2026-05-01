import { listDesktopModes } from '../../theme/themeRegistry';
import type { DesktopModeManifest } from '../../theme/types';
import FreeformShell from '../../shell/freeform/FreeformShell.vue';
import TraditionalShell from '../../shell/traditional/TraditionalShell.vue';
import TelegramUserInfoPanel from '../../shell/traditional/TelegramUserInfoPanel.vue';
import { desktopModeRuntimeRegistry } from './DesktopModeRuntimeRegistry';
import type { DesktopModeManifestV2 } from './types';

const toDesktopModeManifestV2 = (mode: DesktopModeManifest): DesktopModeManifestV2 => {
    const shellKind = mode.shell?.kind || mode.workspacePreset?.defaultMode || 'traditional';
    const primarySurfaces = shellKind === 'freeform'
        ? ['chat.main', 'settings.root', 'forge.workspace', 'timeline.navigator']
        : ['chat.main'];

    const componentOverrides: DesktopModeManifestV2['componentOverrides'] = mode.id === 'telegram'
        ? {
            'telegram.infoPanel': {
                contractId: 'telegram.infoPanel',
                component: TelegramUserInfoPanel,
                ownerId: 'telegram',
                kind: 'desktop-override',
                variant: 'telegram'
            }
        }
        : undefined;

    return {
        id: mode.id,
        name: mode.name,
        description: mode.description,
        icon: mode.icon,
        shellKind,
        shellRenderer: shellKind === 'freeform' ? FreeformShell : TraditionalShell,
        navigationModel: {
            id: `${mode.id}.navigation`,
            primarySurfaces,
            contextualSurfaces: ['settings.root', 'timeline.navigator'],
            mobileSurfaces: mode.id === 'telegram'
                ? ['chat.main', 'settings.root']
                : ['chat.main', 'settings.root', 'timeline.navigator']
        },
        interactionPolicy: {
            id: `${mode.id}.interaction`,
            openSurface: shellKind === 'freeform' ? 'window' : 'panel',
            supportsOverlappingWindows: shellKind === 'freeform',
            supportsContextualTools: true
        },
        tokens: {},
        settingsSchema: mode.settingsManifest,
        componentOverrides
    };
};

let initialized = false;

export const initializeDesktopModeRuntime = (): void => {
    if (initialized) return;

    listDesktopModes().forEach(mode => {
        desktopModeRuntimeRegistry.register(toDesktopModeManifestV2(mode));
    });

    initialized = true;
};
