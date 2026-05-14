import type { ForgeTestChatPromptHost } from './ForgeTestChatPromptBuilder.js';
import type { PromptPresetCharCard, PromptPresetGenerationSettings } from '../../../types/PromptPresetTypes.js';

export interface ForgeTestChatHostPort {
    createPromptContext(): ForgeTestChatPromptHost;
    resolveCurrentCharCard(): PromptPresetCharCard | null;
    getPreset(name: string): Promise<Record<string, any> | null>;
    getInstructSettings(): { settings?: PromptPresetGenerationSettings } | null;
}

const emptyForgeTestChatHostPort: ForgeTestChatHostPort = {
    createPromptContext: () => ({}),
    resolveCurrentCharCard: () => null,
    async getPreset() {
        return null;
    },
    getInstructSettings() {
        return null;
    }
};

let forgeTestChatHostPort: ForgeTestChatHostPort = emptyForgeTestChatHostPort;

export function configureForgeTestChatHostPort(port: ForgeTestChatHostPort): void {
    forgeTestChatHostPort = port;
}

export function getForgeTestChatHostPort(): ForgeTestChatHostPort {
    return forgeTestChatHostPort;
}
