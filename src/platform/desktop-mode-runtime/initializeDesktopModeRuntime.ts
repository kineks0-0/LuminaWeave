import {
    listDesktopModes,
    onDesktopModeRegistered,
    onDesktopModeRegistering,
    onDesktopModeUnregistered
} from '../../desktop-modes/core/registry.js';
import type { DesktopModeManifest } from '../../desktop-modes/core/types.js';
import FreeformShell from '../../shell/freeform/FreeformShell.vue';
import TraditionalShell from '../../shell/traditional/TraditionalShell.vue';
import TelegramUserInfoPanel from '../../shell/modes/telegram/TelegramUserInfoPanel.vue';
import { desktopModeRuntimeRegistry } from './DesktopModeRuntimeRegistry.js';
import type { DesktopModeRuntimeDescriptor, DesktopShellKind } from './types.js';

const getShellKind = (mode: DesktopModeManifest): DesktopShellKind =>
    mode.shell.kind;

const getShellRenderer = (shellKind: DesktopShellKind) =>
    shellKind === 'freeform' ? FreeformShell : TraditionalShell;

export const createDesktopModeRuntimeDescriptor = (mode: DesktopModeManifest): DesktopModeRuntimeDescriptor => {
    const shellKind = getShellKind(mode);

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
            primarySurfaces: [],
            contextualSurfaces: [],
            mobileSurfaces: []
        },
        interactionPolicy: {
            id: `${mode.id}.interaction`,
            openSurface: shellKind === 'freeform' ? 'window' : 'panel',
            supportsOverlappingWindows: shellKind === 'freeform',
            supportsContextualTools: true
        },
        tokens: {},
        settingsSchema: mode.settingsManifest,
        componentOverrides,
        composition: mode.composition
    };
};

export const registerDesktopModeRuntimeDescriptor = (mode: DesktopModeManifest): void => {
    if (desktopModeRuntimeRegistry.get(mode.id)) {
        return;
    }

    desktopModeRuntimeRegistry.register(createDesktopModeRuntimeDescriptor(mode));
};

export const assertCanRegisterDesktopModeRuntimeDescriptor = (mode: DesktopModeManifest): void => {
    desktopModeRuntimeRegistry.assertCanRegister(createDesktopModeRuntimeDescriptor(mode));
};

let isListeningForDesktopModeRegistrations = false;

export const initializeDesktopModeRuntime = (): void => {
    listDesktopModes().forEach(registerDesktopModeRuntimeDescriptor);

    if (!isListeningForDesktopModeRegistrations) {
        onDesktopModeRegistering(assertCanRegisterDesktopModeRuntimeDescriptor);
        onDesktopModeRegistered(registerDesktopModeRuntimeDescriptor);
        onDesktopModeUnregistered(mode => {
            desktopModeRuntimeRegistry.unregister(mode.id);
        });
        isListeningForDesktopModeRegistrations = true;
    }
};
