import { describe, expect, it } from 'vitest';
import type { CharacterChannelState } from '../../../types/ConversationContextTypes.js';
import { OFFICIAL_SURFACE_INPUT_SCHEMAS } from '../officialContracts.js';

const createCharacterChannelState = (): CharacterChannelState => ({
    characterGroups: [],
    activeSessionId: null,
    selectedViewSessionId: null,
    currentLiveSessionId: null,
    busySessionIds: [],
    expandedCharacterKey: null,
    expandedSessionGroups: {},
    capabilityFlags: {
        supportsCharacterRoster: true,
        supportsCreateSession: true,
        supportsRenameSession: true,
        supportsDeleteSession: true,
        supportsCloseCurrentSession: true,
        supportsNativeOpenSession: true,
        supportsHostHistory: true,
        supportsHostSearch: true,
        supportsFindLastMessage: true,
        supportsStableSessionId: true,
        supportsCurrentWindowInfo: true,
        supportsCharacterImport: true
    },
    status: {
        kind: 'idle',
        text: '',
        sessionId: null,
        characterName: '',
        error: null
    }
});

describe('official surface input schemas', () => {
    it('rejects unsupported setting definition types', () => {
        const result = OFFICIAL_SURFACE_INPUT_SCHEMAS['settings.control'].safeParse({
            pluginId: 'lumina-settings',
            settingKey: 'invalid',
            config: {
                default: false,
                label: 'Invalid',
                type: 'unsupported'
            }
        });

        expect(result.success).toBe(false);
    });

    it('requires the complete character channel state shape', () => {
        const completeState = createCharacterChannelState();
        const { activeSessionId: _activeSessionId, ...incompleteState } = completeState;
        const handlers = {
            onOpenTool: (): void => undefined,
            onCreateSession: (): void => undefined,
            onOpenSession: (): void => undefined
        };

        expect(OFFICIAL_SURFACE_INPUT_SCHEMAS['telegram.infoPanel'].safeParse({
            state: completeState,
            ...handlers
        }).success).toBe(true);
        expect(OFFICIAL_SURFACE_INPUT_SCHEMAS['telegram.infoPanel'].safeParse({
            state: incompleteState,
            ...handlers
        }).success).toBe(false);
    });
});
