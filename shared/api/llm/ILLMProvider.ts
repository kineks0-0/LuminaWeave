/**
 * ILLMProvider
 * 标准化 LLM 生成接口
 */

export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface GenerationOptions {
    model: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    stop?: string[];
}

export interface IStreamingCallbacks {
    onToken: (token: string) => void;
    onError: (err: Error) => void;
    onDone: () => void;
}

export interface ILLMProvider {
    /**
     * 发起流式生成
     */
    generateStream(
        apiUrl: string,
        apiKey: string,
        messages: LLMMessage[],
        options: GenerationOptions,
        callbacks: IStreamingCallbacks
    ): void;

    /**
     * 中断生成
     */
    abort(): void;

    /**
     * 获取模型列表
     */
    fetchModels(apiUrl: string, apiKey: string): Promise<string[]>;
}
