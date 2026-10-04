import type { ResourceDiagnostic, ResourceDocument, ResourceRef, ResourceSaveResult } from '@shared/resources/index.js';
import { buildSourceResourcePath } from '@shared/resources/index.js';
import { ResourceService, resourceService } from '../../resource/index.js';
import { lwStorage } from '../../../../storage.js';
import type { ChatCompletionPreset } from '../../../../../types/ChatCompletionPresetTypes.js';
import { parseChatCompletionPreset, serializeChatCompletionPreset } from './ChatCompletionPresetParser.js';
import { createDefaultChatPreset } from './DefaultChatPreset.js';
import { CHAT_PROMPT_PRESET_STORAGE_KEY } from '../ChatPromptCompositionService.js';

export interface ChatPromptPresetListEntry {
    id: string;
    name: string;
    promptCount: number;
    isActive: boolean;
}

export interface ChatPromptPresetImportResult {
    document: ResourceDocument | null;
    diagnostics: ResourceDiagnostic[];
}

/**
 * 预设库 CRUD：本地 preset 资源 + 激活 id（lwStorage）。
 * 资源 raw 始终保持 ST 兼容 JSON，编辑往返通过 parser/serializer 保真。
 */
export class ChatPromptPresetLibraryService {
    constructor(private readonly resources: ResourceService = resourceService) {}

    public async list(): Promise<ChatPromptPresetListEntry[]> {
        const documents = await this.resources.listResources({ sourceId: 'local', resourceType: 'preset' });
        const activeId = this.getActiveId();
        return documents
            .map(document => {
                const parsed = parseChatCompletionPreset(document.raw, { nameHint: document.ref.resourceId });
                return {
                    id: document.ref.resourceId,
                    name: parsed.preset?.name || document.summary.name || document.ref.resourceId,
                    promptCount: parsed.preset?.prompts.length ?? 0,
                    isActive: document.ref.resourceId === activeId
                };
            })
            .sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'));
    }

    public async load(id: string): Promise<{ preset: ChatCompletionPreset | null; diagnostics: ResourceDiagnostic[] }> {
        const document = await this.resources.getResource(this.ref(id));
        if (!document) {
            return {
                preset: null,
                diagnostics: [{ level: 'error', code: 'preset.not_found', message: `找不到预设「${id}」。` }]
            };
        }
        const parsed = parseChatCompletionPreset(document.raw, { nameHint: id });
        return { preset: parsed.preset, diagnostics: parsed.diagnostics };
    }

    public async save(id: string, preset: ChatCompletionPreset): Promise<ResourceSaveResult> {
        return this.resources.saveResource(this.ref(id), serializeChatCompletionPreset(preset));
    }

    public async importFromRaw(raw: unknown, nameHint?: string): Promise<ChatPromptPresetImportResult> {
        const parsed = parseChatCompletionPreset(raw, nameHint ? { nameHint } : {});
        if (!parsed.preset) {
            return { document: null, diagnostics: parsed.diagnostics };
        }
        const document = await this.resources.importResource('local', 'preset', raw);
        return { document, diagnostics: parsed.diagnostics };
    }

    public async createFromDefault(name?: string): Promise<ResourceDocument> {
        const preset = createDefaultChatPreset();
        if (name?.trim()) preset.name = name.trim();
        return this.resources.importResource('local', 'preset', serializeChatCompletionPreset(preset));
    }

    public async duplicate(id: string, name?: string): Promise<ResourceDocument | null> {
        const document = await this.resources.getResource(this.ref(id));
        if (!document) return null;
        const parsed = parseChatCompletionPreset(document.raw, { nameHint: id });
        const preset = parsed.preset ?? createDefaultChatPreset();
        preset.name = name?.trim() || `${preset.name} 副本`;
        return this.resources.importResource('local', 'preset', serializeChatCompletionPreset(preset));
    }

    public async remove(id: string): Promise<boolean> {
        const removed = await this.resources.deleteResource(this.ref(id));
        if (removed && this.getActiveId() === id) this.setActive(null);
        return removed;
    }

    public getActiveId(): string {
        const value = lwStorage.get(CHAT_PROMPT_PRESET_STORAGE_KEY, '', 'Global');
        return typeof value === 'string' ? value : '';
    }

    public setActive(id: string | null): void {
        void lwStorage.set(CHAT_PROMPT_PRESET_STORAGE_KEY, id ?? '', 'Global');
    }

    private ref(id: string): ResourceRef {
        return {
            sourceId: 'local',
            resourceType: 'preset',
            resourceId: id,
            path: buildSourceResourcePath('local', 'preset', id),
            writable: true
        };
    }
}

export const chatPromptPresetLibraryService = new ChatPromptPresetLibraryService();
