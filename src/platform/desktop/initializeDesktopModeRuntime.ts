import { listDesktopModes, onDesktopModeRegistered } from '../../theme/themeRegistry.js';
import type { DesktopModeManifest } from '../../theme/types.js';
import FreeformShell from '../../shell/freeform/FreeformShell.vue';
import TraditionalShell from '../../shell/traditional/TraditionalShell.vue';
import TelegramUserInfoPanel from '../../shell/traditional/TelegramUserInfoPanel.vue';
import { desktopModeRuntimeRegistry } from './DesktopModeRuntimeRegistry.js';
import type { DesktopModeRuntimeDescriptor, DesktopShellKind } from './types.js';

const getShellKind = (mode: DesktopModeManifest): DesktopShellKind =>
    mode.shell?.kind || mode.workspacePreset?.defaultMode || 'traditional';

const getShellRenderer = (shellKind: DesktopShellKind) =>
    shellKind === 'freeform' ? FreeformShell : TraditionalShell;

export const createDesktopModeRuntimeDescriptor = (mode: DesktopModeManifest): DesktopModeRuntimeDescriptor => {
    const shellKind = getShellKind(mode);
    const primarySurfaces = shellKind === 'freeform'
        ? ['chat.main', 'settings.root', 'forge.workspace', 'timeline.navigator']
        : ['chat.main'];

    const componentOverrides: DesktopModeRuntimeDescriptor['componentOverrides'] = mode.id === 'telegram'
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
        manifest: mode,
        id: mode.id,
        name: mode.name,
        description: mode.description,
        icon: mode.icon,
        shellKind,
        shellRenderer: getShellRenderer(shellKind),
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

export const registerDesktopModeRuntimeDescriptor = (mode: DesktopModeManifest): void => {
    if (desktopModeRuntimeRegistry.get(mode.id)) {
        return;
    }

    desktopModeRuntimeRegistry.register(createDesktopModeRuntimeDescriptor(mode));
};

let isListeningForDesktopModeRegistrations = false;

export const initializeDesktopModeRuntime = (): void => {
    listDesktopModes().forEach(registerDesktopModeRuntimeDescriptor);

    if (!isListeningForDesktopModeRegistrations) {
        onDesktopModeRegistered(registerDesktopModeRuntimeDescriptor);
        isListeningForDesktopModeRegistrations = true;
    }
};
