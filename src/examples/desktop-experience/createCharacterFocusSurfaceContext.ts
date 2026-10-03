import { shallowRef, watch } from 'vue';
import type {
    CharacterChannelGroup,
    CharacterChannelState,
    GenerationDomainEvent,
    SurfaceRendererContextFactoryInput,
    SurfaceRendererContextValues
} from '../../sdk/index.js';
import type {
    CharacterFocusSessionOption,
    CharacterFocusSnapshot
} from './characterFocusContract.js';

interface CharacterFocusProjection {
    characterName: string;
    sessionId: string | null;
    availableSessions: CharacterFocusSessionOption[];
    error: string | null;
}

const selectActiveCharacterGroup = (state: CharacterChannelState): CharacterChannelGroup | null => {
    const sessionId = state.activeSessionId || state.selectedViewSessionId;
    if (sessionId) {
        return state.characterGroups.find(group => (
            group.sessions.some(session => session.id === sessionId)
        )) || null;
    }
    return state.characterGroups.find(group => group.key === state.expandedCharacterKey)
        || state.characterGroups[0]
        || null;
};

const projectCharacterState = (state: CharacterChannelState): CharacterFocusProjection => {
    const currentGroup = selectActiveCharacterGroup(state);
    return {
        characterName: currentGroup?.characterName.trim() || '',
        sessionId: state.activeSessionId || state.selectedViewSessionId,
        availableSessions: currentGroup?.sessions.map(session => ({
            id: session.id,
            title: session.title
        })) || [],
        error: state.status.error
    };
};

const createInitialSnapshot = (
    context: SurfaceRendererContextFactoryInput<'example.characterFocus'>
): CharacterFocusSnapshot => {
    const character = context.runtime.character.state.value;
    const projection = projectCharacterState(character);
    return {
        characterName: projection.characterName,
        sessionId: projection.sessionId,
        conversation: null,
        messages: [],
        timeline: {},
        availableSessions: projection.availableSessions,
        isGenerating: context.runtime.generation.isGenerating(),
        loading: true,
        error: projection.error
    };
};

export const createCharacterFocusSurfaceContext = (
    context: SurfaceRendererContextFactoryInput<'example.characterFocus'>
): SurfaceRendererContextValues<'example.characterFocus'> => {
    const snapshot = shallowRef(createInitialSnapshot(context));
    let disposed = false;
    let revision = 0;

    const synchronizeState = async (): Promise<void> => {
        if (disposed) return;
        const activeRevision = ++revision;
        const character = context.runtime.character.state.value;
        const projection = projectCharacterState(character);
        snapshot.value = {
            ...snapshot.value,
            characterName: projection.characterName,
            sessionId: projection.sessionId,
            availableSessions: projection.availableSessions,
            isGenerating: snapshot.value.isGenerating,
            loading: true,
            error: projection.error
        };

        try {
            const [conversation, messages, timeline] = await Promise.all([
                context.runtime.conversation.getContext(),
                context.runtime.conversation.getMessages(),
                context.runtime.timeline.getGraph()
            ]);
            if (disposed || activeRevision !== revision) return;
            const latestCharacter = context.runtime.character.state.value;
            const latestProjection = projectCharacterState(latestCharacter);
            snapshot.value = {
                characterName: latestProjection.characterName,
                sessionId: conversation.sessionId || latestProjection.sessionId,
                conversation,
                messages,
                timeline,
                availableSessions: latestProjection.availableSessions,
                isGenerating: snapshot.value.isGenerating,
                loading: false,
                error: latestProjection.error
            };
        } catch (error: unknown) {
            if (disposed || activeRevision !== revision) return;
            const characterError = context.runtime.character.state.value.status.error;
            snapshot.value = {
                ...snapshot.value,
                loading: false,
                error: characterError || (error instanceof Error ? error.message : String(error))
            };
        }
    };

    const handleGenerationEvent = (event: GenerationDomainEvent): void => {
        if (disposed) return;
        if (event.type === 'started' || event.type === 'updated') {
            snapshot.value = {
                ...snapshot.value,
                isGenerating: true
            };
            return;
        }
        snapshot.value = {
            ...snapshot.value,
            isGenerating: false
        };
        void synchronizeState();
    };

    context.onDispose(() => {
        disposed = true;
        revision += 1;
    });
    context.onDispose(context.runtime.conversation.subscribe(() => {
        void synchronizeState();
    }));
    context.onDispose(context.runtime.generation.subscribe(handleGenerationEvent));
    context.onDispose(watch(
        context.runtime.character.state,
        () => {
            void synchronizeState();
        },
        { deep: true }
    ));
    void synchronizeState();

    return {
        state: { snapshot },
        intents: {
            refresh: async () => {
                await context.runtime.character.refresh();
                await synchronizeState();
            },
            openSession: async (sessionId) => {
                await context.runtime.character.openSession(sessionId);
                await synchronizeState();
            },
            sendMessage: async (text) => {
                const sent = await context.runtime.generation.sendMessage(text);
                await synchronizeState();
                return sent;
            },
            stopGeneration: () => context.runtime.generation.stop()
        }
    };
};
