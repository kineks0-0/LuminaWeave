import type {
    PromptAssemblyEnginePolicy,
    PromptAssemblyPolicy,
    PromptSessionBinding
} from '../../types/PromptAssemblyTypes.js';

export interface SendMessageOptions {
    chatType?: 'st' | 'plugin';
    promptAssembly?: PromptAssemblyPolicy & {
        engine?: PromptAssemblyEnginePolicy;
        sessionBinding?: PromptSessionBinding;
    };
}

export interface GenerationStreamState {
    processed: string;
    text: string;
    filteredCount: number;
    statusText?: string;
    thinkingText?: string;
}

export interface GenerationRuntimePort {
    sendMessage(text: string, options?: SendMessageOptions): Promise<boolean>;
    regenerateLast(): Promise<unknown>;
    runEditedPrompt(text: string): Promise<void>;
    isGenerating(): boolean;
    isSyncing(): boolean;
    getLastStreamState(): GenerationStreamState | null;
}

export class GenerationDomainService {
    constructor(private readonly runtime: GenerationRuntimePort) {}

    sendMessage(text: string, options: SendMessageOptions = {}): Promise<boolean> {
        return this.runtime.sendMessage(text, options);
    }

    regenerateLast(): Promise<unknown> {
        return this.runtime.regenerateLast();
    }

    runEditedPrompt(text: string): Promise<void> {
        return this.runtime.runEditedPrompt(text);
    }

    isGenerating(): boolean {
        return this.runtime.isGenerating();
    }

    isSyncing(): boolean {
        return this.runtime.isSyncing();
    }

    getLastStreamState(): GenerationStreamState | null {
        return this.runtime.getLastStreamState();
    }
}
