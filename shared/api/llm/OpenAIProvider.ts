import { createParser } from 'eventsource-parser';
import { ILLMProvider, LLMMessage, GenerationOptions, IStreamingCallbacks } from './ILLMProvider.js';
import { LuminaFetch } from './LuminaFetch.js';

/**
 * OpenAIProvider
 * 兼容 OpenAI 格式的流式生成提供商
 */
export class OpenAIProvider implements ILLMProvider {
    private abortController: AbortController | null = null;

    public async generateStream(
        apiUrl: string,
        apiKey: string,
        messages: LLMMessage[],
        options: GenerationOptions,
        callbacks: IStreamingCallbacks
    ): Promise<void> {
        this.abortController = new AbortController();

        const endpoint = apiUrl.endsWith('/chat/completions') ? apiUrl : `${apiUrl.replace(/\/$/, '')}/chat/completions`;

        const body = {
            model: options.model,
            messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens,
            top_p: options.topP,
            stop: options.stop,
            stream: true
        };

        try {
            const stream = await LuminaFetch.stream(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(body),
                signal: this.abortController.signal
            });

            const reader = stream.getReader();
            const decoder = new TextDecoder();
            let completed = false;

            const parser = createParser({
                onEvent: (event) => {
                    if (event.data === '[DONE]') {
                        completed = true;
                        callbacks.onDone();
                        return;
                    }

                    try {
                        const json = JSON.parse(event.data);
                        const delta = json.choices?.[0]?.delta?.content;
                        if (delta) {
                            callbacks.onToken(delta);
                        }
                    } catch (e) {
                        console.warn('[OpenAIProvider] Failed to parse SSE line:', event.data);
                    }
                }
            });

            while (!completed) {
                const { done, value } = await reader.read();
                if (done) break;

                parser.feed(decoder.decode(value, { stream: true }));
            }

            if (completed) return;

            callbacks.onDone();

        } catch (err: any) {
            if (err.name === 'AbortError') {
                console.log('[OpenAIProvider] Generation aborted by user.');
            } else {
                callbacks.onError(err);
            }
        }
    }

    public abort(): void {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    }

    public async fetchModels(apiUrl: string, apiKey: string): Promise<string[]> {
        const endpoint = apiUrl.endsWith('/models') ? apiUrl : `${apiUrl.replace(/\/$/, '')}/models`;
        
        try {
            // 使用 LuminaFetch 发起标准非流式请求处理以获取模型列表
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch models: ${response.statusText}`);
            }

            const data = await response.json();
            // OpenAI 格式通常是 { data: [{ id: "model-name", ... }, ...] }
            return (data.data || [])
                .map((m: any) => m.id)
                .sort();
        } catch (err) {
            console.error('[OpenAIProvider] Model fetch failed:', err);
            return [];
        }
    }
}
