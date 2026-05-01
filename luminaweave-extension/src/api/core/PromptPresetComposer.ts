import { getPromptPresetProfile, type PromptPresetProfileDefinition } from './PromptPresetProfiles.js';
import { promptPresetRegistry } from './PromptPresetRegistry.js';
import type { CleanedMessage } from '../../types/nexus.js';
import type {
    PromptComposeResolvedEntry,
    PromptComposeResult,
    PromptComposeSources,
    PromptPresetDefinition,
    PromptPresetEntry,
    PromptPresetProfileId
} from '../../types/PromptPresetTypes.js';

const trimContent = (value: string | undefined): string => value?.trim() || '';

const normalizeMessages = (messages: CleanedMessage[] | null): CleanedMessage[] => {
    if (!messages || messages.length === 0) {
        return [];
    }
    return messages
        .map(message => ({
            ...message,
            content: trimContent(message.content)
        }))
        .filter(message => message.content);
};

const resolveProfile = (profile: PromptPresetProfileId | PromptPresetProfileDefinition): PromptPresetProfileDefinition =>
    typeof profile === 'string' ? getPromptPresetProfile(profile) : profile;

const resolvePreset = (
    profileId: PromptPresetProfileId,
    preset: string | PromptPresetDefinition
): PromptPresetDefinition => {
    if (typeof preset !== 'string') {
        return {
            ...preset,
            entries: preset.entries.map(entry => ({ ...entry })),
            specials: { ...preset.specials }
        };
    }
    const resolved = promptPresetRegistry.getPreset(profileId, preset);
    if (!resolved) {
        throw new Error(`Prompt preset not found: ${profileId}/${preset}`);
    }
    return resolved;
};

export class PromptPresetComposer {
    public static compose(
        profile: PromptPresetProfileId | PromptPresetProfileDefinition,
        preset: string | PromptPresetDefinition,
        sources: PromptComposeSources
    ): PromptComposeResult {
        const resolvedProfile = resolveProfile(profile);
        const resolvedPreset = resolvePreset(resolvedProfile.id, preset);

        if (resolvedPreset.profileId !== resolvedProfile.id) {
            throw new Error(`Prompt preset profile mismatch: expected ${resolvedProfile.id}, got ${resolvedPreset.profileId}`);
        }

        if (resolvedPreset.engine === 'st_preset') {
            return {
                messages: [],
                resolvedEntries: []
            };
        }

        const messages: CleanedMessage[] = [];
        const resolvedEntries: PromptComposeResolvedEntry[] = [];

        resolvedPreset.entries.forEach((entry) => {
            if (!entry.enabled) return;

            const entryMessages = this.resolveEntry(resolvedProfile, entry, sources);
            normalizeMessages(entryMessages).forEach((message) => {
                messages.push(message);
                resolvedEntries.push({
                    id: entry.id,
                    type: entry.type,
                    slotId: entry.slotId,
                    role: message.role,
                    content: message.content
                });
            });
        });

        return {
            messages,
            resolvedEntries
        };
    }

    private static resolveEntry(
        profile: PromptPresetProfileDefinition,
        entry: PromptPresetEntry,
        sources: PromptComposeSources
    ): CleanedMessage[] | null {
        if (entry.type === 'custom') {
            const content = trimContent(entry.content);
            if (!content) return null;
            return [{
                role: entry.role || 'system',
                content
            }];
        }

        const slotId = entry.slotId;
        if (!slotId) {
            throw new Error(`Prompt preset slot entry missing slotId: ${entry.id}`);
        }

        const slotDefinition = profile.slots.find(slot => slot.slot.id === slotId);
        if (!slotDefinition) {
            throw new Error(`Slot "${slotId}" is not compatible with profile "${profile.id}"`);
        }

        const resolved = slotDefinition.resolve(sources);
        const normalized = normalizeMessages(resolved);
        if (normalized.length === 0) {
            return null;
        }

        if (!entry.role || !slotDefinition.slot.supportsRoleOverride) {
            return normalized;
        }

        return normalized.map(message => ({
            ...message,
            role: entry.role || message.role
        }));
    }
}
