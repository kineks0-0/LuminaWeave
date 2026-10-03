import type { DesktopModeManifest, PluginManifestV2 } from '../../sdk/index.js';
import CharacterFocusSurface from './CharacterFocusSurface.vue';
import {
    CHARACTER_FOCUS_CONTRACT_ID,
    CHARACTER_FOCUS_PLUGIN_ID,
    characterFocusContractDefinition
} from './characterFocusContract.js';
import { createCharacterFocusSurfaceContext } from './createCharacterFocusSurfaceContext.js';

export const characterFocusPluginManifest: PluginManifestV2 = {
    id: CHARACTER_FOCUS_PLUGIN_ID,
    name: 'Character Focus Example',
    description: 'A trusted renderer example backed only by DesktopExperienceRuntime capabilities.',
    primarySurface: CHARACTER_FOCUS_CONTRACT_ID,
    surfaces: [characterFocusContractDefinition],
    businessRenderers: {
        [CHARACTER_FOCUS_CONTRACT_ID]: {
            contractId: CHARACTER_FOCUS_CONTRACT_ID,
            component: CharacterFocusSurface,
            createContext: createCharacterFocusSurfaceContext
        }
    }
};

export const characterFocusDesktopModeManifest: DesktopModeManifest = {
    id: 'example-character-focus-mode',
    name: 'Character Focus Example',
    description: 'A purely declarative desktop mode example for a trusted third-party surface.',
    shell: { kind: 'traditional' },
    composition: {
        version: 1,
        desktop: {
            id: 'example-character-focus-desktop',
            kind: 'group',
            direction: 'row',
            size: 'fill',
            visibility: 'visible',
            children: [
                {
                    id: 'example-character-focus-desktop-surface',
                    kind: 'surface',
                    contractId: CHARACTER_FOCUS_CONTRACT_ID,
                    input: {
                        title: 'Current character',
                        showTimeline: true
                    },
                    size: 'content',
                    visibility: 'visible'
                },
                {
                    id: 'example-character-focus-desktop-activity',
                    kind: 'activity-slot',
                    size: 'fill',
                    visibility: 'visible'
                }
            ]
        },
        mobile: {
            id: 'example-character-focus-mobile',
            kind: 'group',
            direction: 'column',
            size: 'fill',
            visibility: 'visible',
            children: [
                {
                    id: 'example-character-focus-mobile-surface',
                    kind: 'surface',
                    contractId: CHARACTER_FOCUS_CONTRACT_ID,
                    input: {
                        title: 'Current character',
                        showTimeline: false
                    },
                    size: 'content',
                    visibility: 'visible'
                },
                {
                    id: 'example-character-focus-mobile-activity',
                    kind: 'activity-slot',
                    size: 'fill',
                    visibility: 'visible'
                }
            ]
        }
    }
};
