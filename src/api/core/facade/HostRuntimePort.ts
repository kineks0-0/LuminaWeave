export const HOST_EVENT = {
    CHAT_CHANGED: 'CHAT_CHANGED',
    CHAT_LOADED: 'CHAT_LOADED',
    CHAT_CREATED: 'CHAT_CREATED',
    CHAT_DELETED: 'CHAT_DELETED',
    MESSAGE_RECEIVED: 'MESSAGE_RECEIVED',
    MESSAGE_EDITED: 'MESSAGE_EDITED',
    MESSAGE_DELETED: 'MESSAGE_DELETED',
    MESSAGE_UPDATED: 'MESSAGE_UPDATED',
    MESSAGE_SWIPED: 'MESSAGE_SWIPED',
    MORE_MESSAGES_LOADED: 'MORE_MESSAGES_LOADED',
    GENERATE_AFTER_DATA: 'GENERATE_AFTER_DATA',
    CHAT_COMPLETION_PROMPT_READY: 'CHAT_COMPLETION_PROMPT_READY',
    GENERATE_AFTER_COMBINE_PROMPTS: 'GENERATE_AFTER_COMBINE_PROMPTS',
    GENERATION_ENDED: 'GENERATION_ENDED',
    GENERATION_STARTED: 'GENERATION_STARTED',
    GENERATION_STOPPED: 'GENERATION_STOPPED',
    STREAM_TOKEN_RECEIVED: 'STREAM_TOKEN_RECEIVED',
    SMOOTH_STREAM_TOKEN_RECEIVED: 'SMOOTH_STREAM_TOKEN_RECEIVED',
    CHARACTER_PAGE_LOADED: 'CHARACTER_PAGE_LOADED'
} as const;

export type HostEventKey = keyof typeof HOST_EVENT;

export interface HostRuntimeDiagnostics {
    hasHostCore: boolean;
    hasEventSource: boolean;
    hasEventTypes: boolean;
    source: string;
}

export interface HostRuntimeWaitOptions {
    timeoutMs?: number;
    onProgress?: (message: string) => void;
    /** 宿主强依赖未就绪时直接抛错，而不是带病降级运行 */
    requireReady?: boolean;
}

export interface HostRuntimePort {
    waitForReady(options?: HostRuntimeWaitOptions): Promise<boolean>;
    setSilenceMode(enabled: boolean): void;
    getDiagnostics(): HostRuntimeDiagnostics;
    on(eventKey: HostEventKey, handler: (...args: any[]) => void): boolean;
    getGenerationFlags(): { isGenerating: boolean; isTyping: boolean };
    getHostFunction(funcName: string): Promise<Function | null>;
    applyRegex(
        text: string,
        source: 'user_input' | 'ai_output' | 'slash_command' | 'world_info' | 'reasoning',
        destination: 'display' | 'prompt',
        options?: Record<string, unknown>
    ): string;
    getCore(): unknown;
    getCurrentChatMessages(): any[];
}

class EmptyHostRuntimePort implements HostRuntimePort {
    async waitForReady(): Promise<boolean> {
        return false;
    }

    setSilenceMode(_enabled: boolean): void {}

    getDiagnostics(): HostRuntimeDiagnostics {
        return {
            hasHostCore: false,
            hasEventSource: false,
            hasEventTypes: false,
            source: 'none'
        };
    }

    on(_eventKey: HostEventKey, _handler: (...args: any[]) => void): boolean {
        return false;
    }

    getGenerationFlags(): { isGenerating: boolean; isTyping: boolean } {
        return { isGenerating: false, isTyping: false };
    }

    async getHostFunction(_funcName: string): Promise<Function | null> {
        return null;
    }

    applyRegex(text: string): string {
        return text;
    }

    getCore(): unknown {
        return null;
    }

    getCurrentChatMessages(): any[] {
        return [];
    }
}

let hostRuntimePort: HostRuntimePort = new EmptyHostRuntimePort();

export function configureHostRuntimePort(port: HostRuntimePort): void {
    hostRuntimePort = port;
}

export function getHostRuntimePort(): HostRuntimePort {
    return hostRuntimePort;
}
