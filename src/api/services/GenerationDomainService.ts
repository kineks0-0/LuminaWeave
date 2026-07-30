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
    pendingText?: string;
}

export interface GenerationRuntimePort {
    sendMessage(text: string, options?: SendMessageOptions): Promise<boolean>;
    regenerateLast(): Promise<unknown>;
    runEditedPrompt(text: string): Promise<void>;
    abortGenerate(): Promise<unknown>;
    isGenerating(): boolean;
    isSyncing(): boolean;
    getLastStreamState(): GenerationStreamState | null;
    getLastPromptPayload(): unknown;
    probePrompt(): Promise<unknown>;
    subscribe(listener: GenerationDomainEventListener): () => void;
    subscribePromptInspection(listener: PromptInspectionEventListener): () => void;
}

export type GenerationDomainEvent =
    | { type: 'started' }
    | { type: 'updated'; state: GenerationStreamState }
    | { type: 'ended'; finalText: string }
    | { type: 'failed'; message: string; status?: string };
export type GenerationDomainEventListener = (event: GenerationDomainEvent) => void;

export type PromptInspectionSource = 'st' | 'lumina';

export interface PromptInspectionEvent {
    source: PromptInspectionSource;
    payload: unknown;
}

export type PromptInspectionEventListener = (event: PromptInspectionEvent) => void;

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

    stop(): Promise<unknown> {
        return this.runtime.abortGenerate();
    }

    subscribe(listener: GenerationDomainEventListener): () => void {
        return this.runtime.subscribe(listener);
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

    getLastPromptPayload(): unknown {
        return this.runtime.getLastPromptPayload();
    }

    probePrompt(): Promise<unknown> {
        return this.runtime.probePrompt();
    }

    subscribePromptInspection(listener: PromptInspectionEventListener): () => void {
        return this.runtime.subscribePromptInspection(listener);
    }
}
