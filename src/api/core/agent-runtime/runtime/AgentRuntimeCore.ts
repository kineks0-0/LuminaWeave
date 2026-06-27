import { AgentRuntimeEventBus } from '../events/AgentRuntimeEventBus.js';

export interface AgentRuntimeManagedSession<TTurnInput, TRunResult, TPreviewResult, TApprovalResult> {
    runTurn(input: TTurnInput): Promise<TRunResult>;
    previewPrompt(input: TTurnInput): Promise<TPreviewResult>;
    continue?(): Promise<void>;
    resolveToolApproval?(toolCallId: string, approved: boolean, message?: string, options?: unknown): Promise<TApprovalResult>;
    abort?(): void;
}

export interface AgentRuntimeSessionFactoryInput<TTurnInput> {
    sessionId: string;
    firstInput: TTurnInput;
    events: AgentRuntimeEventBus;
}

export interface AgentRuntimeCoreOptions<TTurnInput, TRunResult, TPreviewResult, TApprovalResult> {
    resolveSessionId: (input: TTurnInput) => string;
    events?: AgentRuntimeEventBus;
    createSession: (input: AgentRuntimeSessionFactoryInput<TTurnInput>) => AgentRuntimeManagedSession<TTurnInput, TRunResult, TPreviewResult, TApprovalResult>;
}

export class AgentRuntimeCore<TTurnInput, TRunResult, TPreviewResult, TApprovalResult> {
    readonly events: AgentRuntimeEventBus;
    private readonly sessions = new Map<string, AgentRuntimeManagedSession<TTurnInput, TRunResult, TPreviewResult, TApprovalResult>>();

    constructor(private readonly options: AgentRuntimeCoreOptions<TTurnInput, TRunResult, TPreviewResult, TApprovalResult>) {
        this.events = options.events ?? new AgentRuntimeEventBus();
    }

    runTurn(input: TTurnInput): Promise<TRunResult> {
        return this.getSession(input).runTurn(input);
    }

    previewPrompt(input: TTurnInput): Promise<TPreviewResult> {
        return this.getSession(input).previewPrompt(input);
    }

    async continue(sessionId: string): Promise<void> {
        await this.sessions.get(sessionId)?.continue?.();
    }

    async resolveToolApproval(toolCallId: string, approved: boolean, message?: string, options?: unknown): Promise<TApprovalResult | null> {
        for (const session of this.sessions.values()) {
            const result = options === undefined
                ? await session.resolveToolApproval?.(toolCallId, approved, message)
                : await session.resolveToolApproval?.(toolCallId, approved, message, options);
            if (result) return result;
        }
        return null;
    }

    abortActiveGeneration(): void {
        for (const session of this.sessions.values()) {
            session.abort?.();
        }
    }

    protected getSession(input: TTurnInput): AgentRuntimeManagedSession<TTurnInput, TRunResult, TPreviewResult, TApprovalResult> {
        const sessionId = this.options.resolveSessionId(input);
        const existing = this.sessions.get(sessionId);
        if (existing) return existing;
        const created = this.options.createSession({
            sessionId,
            firstInput: input,
            events: this.events
        });
        this.sessions.set(sessionId, created);
        return created;
    }
}
