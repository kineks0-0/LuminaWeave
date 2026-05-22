import { STClient } from './STClient.js';
import { STGlobalAccessor } from './STGlobalAccessor.js';
import { configureForgeTestChatHostPort } from '../../forge/test-chat/ForgeTestChatHostPort.js';
import type { ForgeTestChatCharCard } from '../../../../types/ForgeTestChatTypes.js';
import type { PromptPresetCharCard, PromptPresetGenerationSettings } from '../../../../types/PromptPresetTypes.js';

export interface STForgeTestChatPromptContext {
    charCard: Partial<ForgeTestChatCharCard> | null;
    personaDescription: string | null;
    dialogueExamples: string | null;
    substituteMacros(content: string): string;
    snapshotVariables(): STVariableSnapshot;
    restoreVariables(snapshot: unknown): void;
}

export interface STVariableSnapshot {
    local: Record<string, unknown>;
    global: Record<string, unknown>;
}

function cloneRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return JSON.parse(JSON.stringify(value));
}

export class STForgeTestChatDriver {
    static createPromptContext(): STForgeTestChatPromptContext {
        return {
            charCard: this.resolveCurrentCharCard(),
            personaDescription: this.resolvePersonaDescription(),
            dialogueExamples: this.resolveDialogueExamples(),
            substituteMacros: (content: string) => STClient.substituteMacros(content),
            snapshotVariables: () => this.snapshotVariables(),
            restoreVariables: (snapshot: unknown) => this.restoreVariables(snapshot as STVariableSnapshot)
        };
    }

    static resolveCurrentCharCard(): PromptPresetCharCard | null {
        try {
            const ctx = ((STGlobalAccessor.stHelper as any)?.contexts || STGlobalAccessor.ctx) as any;
            if (!ctx) return null;
            const charId = ctx.characterId;
            const char = ctx.characters?.[charId];
            const data = char?.data ?? char;
            if (!data) return null;
            return {
                name: data.name ?? char?.name ?? '',
                description: data.description ?? '',
                personality: data.personality ?? '',
                scenario: data.scenario ?? '',
                systemPrompt: data.system_prompt ?? data.systemPrompt ?? ''
            };
        } catch {
            return null;
        }
    }

    static resolvePersonaDescription(): string | null {
        try {
            const st = STGlobalAccessor.stMain as any;
            const personaDesc = st?.powerUserSettings?.persona?.description ?? '';
            return typeof personaDesc === 'string' && personaDesc.trim() ? personaDesc.trim() : null;
        } catch {
            return null;
        }
    }

    static resolveDialogueExamples(): string | null {
        try {
            const ctx = STGlobalAccessor.ctx as any;
            const charId = ctx?.characterId;
            const char = ctx?.characters?.[charId];
            const data = char?.data ?? char;
            const examples = data?.mes_example ?? '';
            return typeof examples === 'string' && examples.trim() ? examples.trim() : null;
        } catch {
            return null;
        }
    }

    static snapshotVariables(): STVariableSnapshot {
        const glob = STGlobalAccessor.stGlobal;
        return {
            local: cloneRecord(glob?.chat_metadata?.variables),
            global: cloneRecord(glob?.extension_settings?.variables?.global)
        };
    }

    static restoreVariables(snapshot: STVariableSnapshot): void {
        const glob = STGlobalAccessor.stGlobal;
        if (!glob) return;

        const chatMeta = glob.chat_metadata;
        if (chatMeta) {
            chatMeta.variables = cloneRecord(snapshot.local);
        }

        const extSettings = glob.extension_settings;
        if (extSettings?.variables) {
            extSettings.variables.global = cloneRecord(snapshot.global);
        }
    }

    static async getPreset(name: string): Promise<Record<string, any> | null> {
        return STClient.getPreset(name);
    }

    static getInstructSettings(): { settings?: PromptPresetGenerationSettings } | null {
        return STClient.getInstructSettings();
    }
}

let registered = false;

export function registerSTForgeTestChatHostPort(): void {
    if (registered) return;
    registered = true;
    configureForgeTestChatHostPort({
        createPromptContext: () => STForgeTestChatDriver.createPromptContext(),
        resolveCurrentCharCard: () => STForgeTestChatDriver.resolveCurrentCharCard(),
        getPreset: (name: string) => STForgeTestChatDriver.getPreset(name),
        getInstructSettings: () => STForgeTestChatDriver.getInstructSettings()
    });
}
