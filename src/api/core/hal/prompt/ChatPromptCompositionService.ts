import type { CleanedMessage } from '../../../../types/nexus.js';
import type { ResourceRef } from '@shared/resources/index.js';
import { buildSourceResourcePath, characterBookToLorebookEntries } from '@shared/resources/index.js';
import { lwStorage } from '../../../storage.js';
import { promptResourceResolver } from '../resource/index.js';
import { promptResourceBindingService, PromptResourceBindingService } from '../resource/PromptResourceBindingService.js';
import { parseChatCompletionPreset } from './chat/ChatCompletionPresetParser.js';
import { createDefaultChatPreset } from './chat/DefaultChatPreset.js';
import { extractCharacterRegexScripts, extractEmbeddedPresetAssets } from './chat/EmbeddedPresetAssets.js';
import { mergeRegexScripts, parseRegexScripts } from '../regex/RegexScriptDocument.js';
import {
    setCachedCharacterRegexScripts,
    setCachedPresetRegexScripts
} from '../regex/LuminaRegexAssetCache.js';
import { applyBoundRegexOverrides } from '../regex/BoundRegexOverrideStore.js';
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
        const resolvedPreset = await this.resolvePreset();
        const presetAssets = extractEmbeddedPresetAssets(resolvedPreset.preset);
        const character = await this.resolveCharacter(request.charId);
        const characterBookEntries = character?.raw ? characterBookToLorebookEntries(character.raw) : [];
        const characterRegexScripts = character ? extractCharacterRegexScripts(character.raw) : [];

        // 绑定正则缓存供显示层同步使用；预设/角色切换后无需等下一次生成。
        setCachedPresetRegexScripts(resolvedPreset.id, presetAssets.regexScripts, resolvedPreset.preset.name ?? null);
        setCachedCharacterRegexScripts(
            character?.id ?? null,
            characterRegexScripts,
            character?.fields.name ?? null
        );

        const sessionWorldbookRefs = request.chatId
            ? promptResourceBindingService
                .resolveBindings(PromptResourceBindingService.sessionOwner(request.chatId))
                .enabledRefs
            : [];
        const globalWorldbookRefs = promptResourceBindingService
            .resolveBindings(PromptResourceBindingService.globalOwner())
            .enabledRefs;
        const worldbookRefs = PromptResourceBindingService.mergeWorldbookRefs(
            globalWorldbookRefs,
            sessionWorldbookRefs
        );
        const activation = await this.worldbookActivationService.activate({
            refs: worldbookRefs,
            entries: characterBookEntries,
            messages: request.history,
            inputText: request.inputText
        });

        const result = buildRoleplayPrompt({
            history: request.history,
            preset: resolvedPreset.preset,
            character: character?.fields ?? null,
            characterId: request.charId,
            personaDescription: this.readPersonaDescription(),
            userName: request.userName,
            charName: character?.fields.name || request.charName,
            worldbookActivation: activation.activation,
            regexScripts: applyBoundRegexOverrides(mergeRegexScripts(
                presetAssets.regexScripts,
                mergeRegexScripts(characterRegexScripts, this.readRegexScripts())
            )),
            variables,
            pickSeed: request.chatId ?? undefined
        });

        result.trace.diagnostics.push(...activation.diagnostics, ...presetAssets.diagnostics);
        return { result, variables };
    }

    /** 预设切换/保存时预热绑定正则缓存（显示层在生成前也能生效）。 */
    public async warmPresetRegex(id: string | null): Promise<void> {
        if (!id) {
            setCachedPresetRegexScripts(null, []);
            return;
        }
        try {
            const bundle = await promptResourceResolver.resolve([localRef('preset', id)]);
            const parsed = bundle.presetRaw ? parseChatCompletionPreset(bundle.presetRaw, { nameHint: id }) : null;
            setCachedPresetRegexScripts(
                id,
                parsed?.preset ? extractEmbeddedPresetAssets(parsed.preset).regexScripts : [],
                parsed?.preset?.name ?? null
            );
        } catch (error) {
            console.warn('[ChatPromptCompositionService] 预热预设正则失败。', error);
            setCachedPresetRegexScripts(id, []);
        }
    }

    /**
     * 按需预热当前上下文的绑定正则（激活预设 + 当前角色卡），供设置面板等只读展示。
     * 与显示层共用同一缓存，失败按空处理，不阻断调用方。
     */
    public async warmBoundRegex(): Promise<void> {
        const presetIdRaw = lwStorage.get(CHAT_PROMPT_PRESET_STORAGE_KEY, '', 'Global');
        const presetId = typeof presetIdRaw === 'string' && presetIdRaw.trim() ? presetIdRaw.trim() : null;
        await this.warmPresetRegex(presetId);

        const { charId } = lwStorage._getContextIds();
        const normalizedCharId = typeof charId === 'string' && charId && charId !== 'Global' ? charId : null;
        const character = await this.resolveCharacter(normalizedCharId);
        setCachedCharacterRegexScripts(
            character?.id ?? null,
            character ? extractCharacterRegexScripts(character.raw) : [],
            character?.fields.name ?? null
        );
    }

    private async resolvePreset(): Promise<{ id: string | null; preset: ChatCompletionPreset }> {
        const presetId = lwStorage.get(CHAT_PROMPT_PRESET_STORAGE_KEY, '', 'Global');
        if (typeof presetId !== 'string' || !presetId.trim()) {
            return { id: null, preset: createDefaultChatPreset() };
        }
        try {
            const bundle = await promptResourceResolver.resolve([localRef('preset', presetId.trim())]);
            if (!bundle.presetRaw) return { id: presetId.trim(), preset: createDefaultChatPreset() };
            const parsed = parseChatCompletionPreset(bundle.presetRaw, { nameHint: presetId.trim() });
            return { id: presetId.trim(), preset: parsed.preset ?? createDefaultChatPreset() };
        } catch (error) {
            console.warn('[ChatPromptCompositionService] 读取激活预设失败，使用默认预设。', error);
            return { id: null, preset: createDefaultChatPreset() };
        }
    }

    private async resolveCharacter(
        charId: string | null
    ): Promise<{ id: string; fields: ChatCharacterFields; raw: unknown } | null> {
        if (!charId || charId === 'Global') return null;
        try {
            const ref = localRef('character', charId);
            const bundle = await promptResourceResolver.resolve([ref]);
            const document = bundle.documents.find(item => item.ref.resourceType === 'character');
            if (!document) return null;
            return { id: charId, fields: resolveCharacterFields(document.raw), raw: document.raw };
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
