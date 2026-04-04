import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { STClient } from '../../api/core/st-adapter/STClient';
import { llmEngine } from '../../api/llmEngine';

type BackendPresetMeta = {
    id: string;
    name: string;
    isDefault: boolean;
    createdAt: number;
    updatedAt: number;
};

type CleanMessage = {
    role: 'user' | 'assistant' | 'system';
    content: string;
    name?: string;
};

type CompiledPrompt = {
    messages: CleanMessage[];
    settings: Record<string, unknown>;
};

const generateSessionChatId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `lw_card_${crypto.randomUUID()}`;
    }
    return `lw_card_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
};

const isCleanMessageArray = (val: unknown): val is CleanMessage[] => {
    if (!Array.isArray(val)) return false;
    return val.every(item => {
        if (!item || typeof item !== 'object') return false;
        const r = (item as { role?: unknown }).role;
        const c = (item as { content?: unknown }).content;
        return (r === 'user' || r === 'assistant' || r === 'system') && typeof c === 'string';
    });
};

export const useCardMakerStore = defineStore('lumina-card-maker', () => {
    const sessionChatId = ref<string>(generateSessionChatId());
    const presets = ref<BackendPresetMeta[]>([]);
    const selectedPresetId = ref<string>('');

    const input = ref<string>('');
    const messages = ref<CleanMessage[]>([]);

    const isGenerating = ref(false);
    const streamText = ref<string>('');
    const lastError = ref<string | null>(null);

    const activePreset = computed(() => presets.value.find(p => p.id === selectedPresetId.value) || null);

    const apiGet = async <T>(url: string): Promise<T> => {
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        return await res.json() as T;
    };

    const apiPost = async <T>(url: string, body: Record<string, unknown>): Promise<T> => {
        const csrfToken = await STClient.getCsrfToken();
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(text || `HTTP ${res.status}`);
        }
        return await res.json() as T;
    };

    const apiPut = async <T>(url: string, body: Record<string, unknown>): Promise<T> => {
        const csrfToken = await STClient.getCsrfToken();
        const res = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(text || `HTTP ${res.status}`);
        }
        return await res.json() as T;
    };

    const apiDelete = async (url: string): Promise<void> => {
        const csrfToken = await STClient.getCsrfToken();
        const res = await fetch(url, {
            method: 'DELETE',
            headers: {
                'X-CSRF-Token': csrfToken
            }
        });
        if (!res.ok && res.status !== 204) {
            const text = await res.text().catch(() => '');
            throw new Error(text || `HTTP ${res.status}`);
        }
    };

    const refreshPresets = async (): Promise<void> => {
        const data = await apiGet<{ presets: BackendPresetMeta[] }>('/api/plugins/luminaweave/presets');
        presets.value = Array.isArray(data.presets) ? data.presets : [];
        if (!selectedPresetId.value) {
            const def = presets.value.find(p => p.isDefault) || presets.value[0];
            selectedPresetId.value = def?.id || '';
        }
    };

    const importPreset = async (text: string, name?: string): Promise<void> => {
        let blob: unknown = text;
        try {
            blob = JSON.parse(text) as unknown;
        } catch {
            blob = text;
        }
        await apiPost('/api/plugins/luminaweave/presets/import', {
            name: typeof name === 'string' ? name : undefined,
            blob
        });
        await refreshPresets();
    };

    const exportPreset = async (presetId: string): Promise<string> => {
        const data = await apiGet<{ blob: unknown }>(`/api/plugins/luminaweave/presets/${encodeURIComponent(presetId)}/export`);
        return JSON.stringify(data.blob, null, 2);
    };

    const restoreDefaultPresets = async (): Promise<void> => {
        await apiPost('/api/plugins/luminaweave/presets/restore-defaults', {});
        await refreshPresets();
    };

    const compilePrompt = async (): Promise<CompiledPrompt> => {
        const compiled = await apiPost<CompiledPrompt>('/api/plugins/luminaweave/prompt/compile', {
            presetId: selectedPresetId.value,
            sessionType: 'card_maker',
            input: { text: input.value },
            messages: messages.value
        });
        if (!isCleanMessageArray(compiled.messages) || !compiled.settings || typeof compiled.settings !== 'object') {
            throw new Error('Invalid compiler response');
        }
        return compiled;
    };

    const generate = async (): Promise<void> => {
        lastError.value = null;
        streamText.value = '';

        const trimmed = input.value.trim();
        if (!trimmed) return;

        const userMsg: CleanMessage = { role: 'user', content: trimmed };
        messages.value = [...messages.value, userMsg];
        input.value = '';

        isGenerating.value = true;

        let compiled: CompiledPrompt;
        try {
            compiled = await compilePrompt();
        } catch (e) {
            isGenerating.value = false;
            lastError.value = e instanceof Error ? e.message : 'Prompt compile failed';
            return;
        }

        const assistantStartIndex = messages.value.length;
        messages.value = [...messages.value, { role: 'assistant', content: '' }];

        await llmEngine.generateCustomStream(compiled.messages, {
            chatId: sessionChatId.value,
            settings: compiled.settings,
            onChunk: (fullText) => {
                streamText.value = fullText;
                const next = [...messages.value];
                const current = next[assistantStartIndex];
                if (current && current.role === 'assistant') {
                    next[assistantStartIndex] = { ...current, content: fullText };
                    messages.value = next;
                }
            },
            onDone: (fullText) => {
                streamText.value = fullText;
                const next = [...messages.value];
                const current = next[assistantStartIndex];
                if (current && current.role === 'assistant') {
                    next[assistantStartIndex] = { ...current, content: fullText };
                    messages.value = next;
                }
                isGenerating.value = false;
            },
            onError: (error) => {
                isGenerating.value = false;
                lastError.value = error.message;
            }
        });
    };

    const abort = async (): Promise<void> => {
        if (!isGenerating.value) return;
        try {
            await apiPost('/api/plugins/luminaweave/nexus/abort', { chatId: sessionChatId.value });
        } catch (e) {
            lastError.value = e instanceof Error ? e.message : 'Abort failed';
        } finally {
            isGenerating.value = false;
        }
    };

    const resetSession = (): void => {
        sessionChatId.value = generateSessionChatId();
        messages.value = [];
        input.value = '';
        streamText.value = '';
        isGenerating.value = false;
        lastError.value = null;
    };

    const canGenerate = computed(() => !isGenerating.value && selectedPresetId.value && input.value.trim().length > 0);

    return {
        sessionChatId,
        presets,
        selectedPresetId,
        activePreset,
        input,
        messages,
        isGenerating,
        streamText,
        lastError,
        canGenerate,
        refreshPresets,
        importPreset,
        exportPreset,
        restoreDefaultPresets,
        generate,
        abort,
        resetSession
    };
});
