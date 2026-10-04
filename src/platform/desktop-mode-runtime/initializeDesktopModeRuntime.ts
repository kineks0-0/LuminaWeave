import {
    listDesktopModePackages,
    onDesktopModeRegistered,
    onDesktopModeRegistering,
    onDesktopModeUnregistered,
    getDesktopModeOwnerPluginId
} from '../../desktop-modes/core/registry.js';
import type { DesktopModePackage } from '../../desktop-modes/core/types.js';
import { builtinDesktopModeBindings } from '../../desktop-modes/builtins/bindings.js';
import FreeformShell from '../../shell/freeform/FreeformShell.vue';
import TraditionalShell from '../../shell/traditional/TraditionalShell.vue';
import type { SurfaceRendererDefinitionUnion } from '../surface/types.js';
import { desktopModeRuntimeRegistry } from './DesktopModeRuntimeRegistry.js';
import { applyDesktopModeStyles } from './desktopModeStyles.js';
import type { DesktopModeRuntimeDescriptor, DesktopShellKind } from './types.js';

const getShellKind = (modePackage: DesktopModePackage): DesktopShellKind =>
    modePackage.manifest.shell.kind;

/** manifest-only 模式没有自带 shell 时，按 shell kind 回退通用 renderer。 */
const getFallbackShellRenderer = (shellKind: DesktopShellKind) =>
    shellKind === 'freeform' ? FreeformShell : TraditionalShell;

const normalizeComponentOverrides = (
    modePackage: DesktopModePackage,
    ownerPluginId: string | undefined
): SurfaceRendererDefinitionUnion[] | undefined => {
    const overrides = modePackage.componentOverrides;
    if (!overrides || overrides.length === 0) return undefined;
    const ownerId = ownerPluginId ?? modePackage.manifest.id;
    return overrides.map(override => ({
        contractId: override.contractId,
        component: override.component,
        ownerId,
        kind: 'desktop-override',
        ...(override.variant ? { variant: override.variant } : {}),
        ...(override.createContext ? { createContext: override.createContext } : {})
    }) as SurfaceRendererDefinitionUnion);
};

/** 内置模式 manifest 以纯数据注册，组件绑定在绑定表里补齐；运行时包自带绑定则原样优先。 */
const withBuiltinBinding = (modePackage: DesktopModePackage): DesktopModePackage => {
    const binding = builtinDesktopModeBindings.get(modePackage.manifest.id);
    return binding ? { ...binding, ...modePackage, manifest: modePackage.manifest } : modePackage;
};

export const createDesktopModeRuntimeDescriptor = (input: DesktopModePackage): DesktopModeRuntimeDescriptor => {
    const modePackage = withBuiltinBinding(input);
    const { manifest } = modePackage;
    const shellKind = getShellKind(modePackage);
    const ownerPluginId = getDesktopModeOwnerPluginId(manifest.id);
    const normalizedOverrides = normalizeComponentOverrides(modePackage, ownerPluginId);
    const componentOverrides = normalizedOverrides
        ? Object.fromEntries(normalizedOverrides.map(override => [override.contractId, override])) as
            DesktopModeRuntimeDescriptor['componentOverrides']
        : undefined;

    return {
        manifest,
        id: manifest.id,
        name: manifest.name,
        description: manifest.description,
        icon: manifest.icon,
        shellKind,
        shellRenderer: modePackage.shellRenderer ?? getFallbackShellRenderer(shellKind),
        navigationModel: {
            id: `${manifest.id}.navigation`,
            primarySurfaces: [],
            contextualSurfaces: [],
            mobileSurfaces: []
        },
        interactionPolicy: {
            id: `${manifest.id}.interaction`,
            openSurface: shellKind === 'freeform' ? 'window' : 'panel',
            supportsOverlappingWindows: shellKind === 'freeform',
            supportsContextualTools: true
        },
        tokens: {},
        settingsSchema: manifest.settingsManifest,
        componentOverrides,
        composition: manifest.composition,
        shellChrome: modePackage.shellChrome,
        ownerPluginId
    };
};

export const registerDesktopModeRuntimeDescriptor = (modePackage: DesktopModePackage): void => {
    const { manifest } = modePackage;
    if (desktopModeRuntimeRegistry.get(manifest.id)) {
        return;
    }

    desktopModeRuntimeRegistry.register(createDesktopModeRuntimeDescriptor(modePackage));
    applyDesktopModeStyles(manifest.id, modePackage.styles);
};

export const assertCanRegisterDesktopModeRuntimeDescriptor = (modePackage: DesktopModePackage): void => {
    desktopModeRuntimeRegistry.assertCanRegister(createDesktopModeRuntimeDescriptor(modePackage));
};

let isListeningForDesktopModeRegistrations = false;

export const initializeDesktopModeRuntime = (): void => {
    listDesktopModePackages().forEach(registerDesktopModeRuntimeDescriptor);

    if (!isListeningForDesktopModeRegistrations) {
        onDesktopModeRegistering(assertCanRegisterDesktopModeRuntimeDescriptor);
        onDesktopModeRegistered(registerDesktopModeRuntimeDescriptor);
        onDesktopModeUnregistered(modePackage => {
            desktopModeRuntimeRegistry.unregister(modePackage.manifest.id);
            applyDesktopModeStyles(modePackage.manifest.id, undefined);
        });
        isListeningForDesktopModeRegistrations = true;
    }
};
