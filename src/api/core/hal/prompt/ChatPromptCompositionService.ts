import type { CleanedMessage } from '../../../../types/nexus.js';
import type { ResourceRef } from '@shared/resources/index.js';
import { buildSourceResourcePath, characterBookToLorebookEntries } from '@shared/resources/index.js';
import { lwStorage } from '../../../storage.js';
import { promptResourceResolver } from '../resource/index.js';
import { promptResourceBindingService, PromptResourceBindingService } from '../resource/PromptResourceBindingService.js';
import { parseChatCompletionPreset } from './chat/ChatCompletionPresetParser.js';
import { createDefaultChatPreset } from './chat/DefaultChatPreset.js';
import { parseRegexScripts } from '../regex/RegexScriptDocument.js';
import { WorldbookActivationService } from './WorldbookActivationService.js';
import { StagedMacroVariables } from './macros/StagedMacroVariables.js';
import { resolveCharacterFields, type ChatCharacterFields } from './CharacterFields.js';
import { buildRoleplayPrompt, type RoleplayPromptResult } from './RoleplayPromptPipeline.js';
import { promptVariableStore } from './variables/PromptVariableStore.js';
import type { ChatCompletionPreset } from '../../../../types/ChatCompletionPresetTypes.js';
import type { RegexScript } from '../../../../types/RegexScriptTypes.js';

export const CHAT_PROMPT_PRESET_STORAGE_KEY = 'lumina-chat.promptPreset';
export const CHAT_PROMPT_REGEX_STORAGE_KEY = 'lumina-chat.regexScripts';
export const CHAT_PROMPT_ENGINE_STORAGE_KEY = 'lumina-chat.promptEngine';

export interface ChatPromptCompositionRequest {
    history: CleanedMessage[];
    chatId: string | null;
    charId: string | null;
    userName: string;
    charName: string;
    inputText?: string;
}

export interface ChatPromptCompositionResult {
    result: RoleplayPromptResult;
    variables: StagedMacroVariables;
}

const localRef = (resourceType: 'preset' | 'character', resourceId: string): ResourceRef => ({
    sourceId: 'local',
    resourceType,
    resourceId,
    path: buildSourceResourcePath('local', resourceType, resourceId),
    writable: true
});

/**
 * 为聊天管线收集资源：激活预设、角色卡、世界书绑定、正则脚本与变量快照，
 * 然后调用 `buildRoleplayPrompt`。失败时各资源独立降级，不阻断历史生成。
 */
export class ChatPromptCompositionService {
    private readonly worldbookActivationService = new WorldbookActivationService(promptResourceResolver);

    public async compose(request: ChatPromptCompositionRequest): Promise<ChatPromptCompositionResult> {
        const variables = new StagedMacroVariables(await promptVariableStore.getSnapshot(request.chatId));
        const preset = await this.resolvePreset();
        const character = await this.resolveCharacter(request.charId);
        const characterBookEntries = character?.raw ? characterBookToLorebookEntries(character.raw) : [];

        const worldbookRefs = request.chatId
            ? promptResourceBindingService
                .resolveBindings(PromptResourceBindingService.sessionOwner(request.chatId))
                .enabledRefs
                .filter(ref => ref.resourceType === 'worldbook')
            : [];
        const activation = await this.worldbookActivationService.activate({
            refs: worldbookRefs,
            entries: characterBookEntries,
            messages: request.history,
            inputText: request.inputText
        });

        const result = buildRoleplayPrompt({
            history: request.history,
            preset,
            character: character?.fields ?? null,
            personaDescription: this.readPersonaDescription(),
            userName: request.userName,
            charName: character?.fields.name || request.charName,
            worldbookActivation: activation.activation,
            regexScripts: this.readRegexScripts(),
            variables,
            pickSeed: request.chatId ?? undefined
        });

        result.trace.diagnostics.push(...activation.diagnostics);
        return { result, variables };
    }

    private async resolvePreset(): Promise<ChatCompletionPreset> {
        const presetId = lwStorage.get(CHAT_PROMPT_PRESET_STORAGE_KEY, '', 'Global');
        if (typeof presetId !== 'string' || !presetId.trim()) return createDefaultChatPreset();
        try {
            const bundle = await promptResourceResolver.resolve([localRef('preset', presetId.trim())]);
            if (!bundle.presetRaw) return createDefaultChatPreset();
            const parsed = parseChatCompletionPreset(bundle.presetRaw, { nameHint: presetId.trim() });
            return parsed.preset ?? createDefaultChatPreset();
        } catch (error) {
            console.warn('[ChatPromptCompositionService] 读取激活预设失败，使用默认预设。', error);
            return createDefaultChatPreset();
        }
    }

    private async resolveCharacter(
        charId: string | null
    ): Promise<{ fields: ChatCharacterFields; raw: unknown } | null> {
        if (!charId || charId === 'Global') return null;
        try {
            const ref = localRef('character', charId);
            const bundle = await promptResourceResolver.resolve([ref]);
            const document = bundle.documents.find(item => item.ref.resourceType === 'character');
            if (!document) return null;
            return { fields: resolveCharacterFields(document.raw), raw: document.raw };
        } catch (error) {
            console.warn('[ChatPromptCompositionService] 读取角色卡失败。', error);
            return null;
        }
    }

    private readPersonaDescription(): string {
        const value = lwStorage.get('lumina-chat.personaDescription', '', 'Global');
        return typeof value === 'string' ? value : '';
    }

    private readRegexScripts(): RegexScript[] {
        const raw = lwStorage.get(CHAT_PROMPT_REGEX_STORAGE_KEY, [], 'Global');
        return parseRegexScripts(raw).scripts;
    }
}

export const chatPromptCompositionService = new ChatPromptCompositionService();
