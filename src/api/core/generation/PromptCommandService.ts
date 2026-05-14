import { promptProbeService, type PromptProbeService } from '../hal/prompt/PromptProbeService.js';

export interface PromptProbeEventTrace {
    name: string;
    hasData: boolean;
    keys: string[];
}

export interface PromptCandidateResult {
    prompt: any;
    isDryRun: boolean;
    shouldEmitPrompt: boolean;
}

export interface PromptCommandServiceDependencies {
    syncPromptWorldInfo(): Promise<void>;
    startSilentStream(): void;
    onPromptIntercept(handler: (payload: any) => void): void;
    offPromptIntercept(handler: (payload: any) => void): void;
    emitPromptBuilt(payload: any): void;
    shouldEmitDryRunPrompt(fingerprint: string | null): boolean;
    probeService?: PromptProbeService;
}

export class PromptCommandService {
    private readonly syncPromptWorldInfo: () => Promise<void>;
    private readonly startSilentStream: () => void;
    private readonly onPromptIntercept: (handler: (payload: any) => void) => void;
    private readonly offPromptIntercept: (handler: (payload: any) => void) => void;
    private readonly emitPromptBuilt: (payload: any) => void;
    private readonly shouldEmitDryRunPrompt: (fingerprint: string | null) => boolean;
    private readonly probeService: PromptProbeService;
    private probing = false;
    private probeEvents: PromptProbeEventTrace[] = [];
    private promptPayload: any = null;

    constructor(dependencies: PromptCommandServiceDependencies) {
        this.syncPromptWorldInfo = dependencies.syncPromptWorldInfo;
        this.startSilentStream = dependencies.startSilentStream;
        this.onPromptIntercept = dependencies.onPromptIntercept;
        this.offPromptIntercept = dependencies.offPromptIntercept;
        this.emitPromptBuilt = dependencies.emitPromptBuilt;
        this.shouldEmitDryRunPrompt = dependencies.shouldEmitDryRunPrompt;
        this.probeService = dependencies.probeService ?? promptProbeService;
    }

    get isProbing(): boolean {
        return this.probing;
    }

    get lastPromptPayload(): any {
        return this.promptPayload;
    }

    set lastPromptPayload(payload: any) {
        this.promptPayload = payload;
    }

    getProbeEvents(): PromptProbeEventTrace[] {
        return this.probeEvents;
    }

    recordPromptCandidate(evtName: string, data: any, isDryRunArg: any = undefined): PromptCandidateResult {
        if (this.probing) {
            this.probeEvents.push({
                name: evtName,
                hasData: Boolean(data),
                keys: data && typeof data === 'object' ? Object.keys(data) : []
            });
        }

        const prompt = this.extractPromptPayload(data);
        const isDryRun = data && typeof data.dryRun === 'boolean'
            ? data.dryRun
            : (typeof isDryRunArg === 'boolean' ? isDryRunArg : this.probing);
        const promptFingerprint = prompt ? this.buildPromptFingerprint(prompt) : null;
        const shouldEmitPrompt = Boolean(prompt)
            && (isDryRun || this.probing)
            && (
                !isDryRun
                || this.probing
                || this.shouldEmitDryRunPrompt(promptFingerprint)
            );

        if (shouldEmitPrompt) {
            this.promptPayload = prompt;
        }

        return { prompt, isDryRun, shouldEmitPrompt };
    }

    async probePrompt(): Promise<any> {
        console.log('[LuminaWeave] [Probe] 启动提示词探测流程...');
        this.probing = true;
        this.probeEvents = [];
        this.promptPayload = null;

        try {
            const result = await this.probeService.probe({
                syncPromptWorldInfo: this.syncPromptWorldInfo,
                startSilentStream: this.startSilentStream,
                onPromptIntercept: this.onPromptIntercept,
                offPromptIntercept: this.offPromptIntercept,
                emitPromptBuilt: (payload) => {
                    this.promptPayload = payload;
                    this.emitPromptBuilt(payload);
                },
                getProbeEvents: () => this.probeEvents
            });

            console.log('[LuminaWeave] [Probe] 探测 Promise 已解决, 有效负载:', Boolean(result.payload));
            if (result.timedOut) {
                this.logTimeoutDiagnostics();
            }

            if (Array.isArray(result.payload)) {
                return { messages: result.payload, settings: {} };
            }
            return result.payload;
        } finally {
            this.probing = false;
        }
    }

    private extractPromptPayload(data: any): any {
        if (Array.isArray(data)) return data;
        if (data && typeof data === 'object') {
            return data.prompt || data.chat || data.messages || data.fullPrompt || null;
        }
        return null;
    }

    private buildPromptFingerprint(prompt: unknown): string | null {
        if (Array.isArray(prompt)) {
            const first = prompt[0];
            const last = prompt[prompt.length - 1];
            return JSON.stringify({
                length: prompt.length,
                first,
                last
            });
        }
        if (prompt && typeof prompt === 'object') {
            return JSON.stringify(prompt);
        }
        return typeof prompt === 'string' ? prompt : null;
    }

    private logTimeoutDiagnostics(): void {
        console.error('[LuminaWeave] [Probe] 15秒探测超时！');
        console.error('[LuminaWeave] [Probe] [DIAGNOSTIC] 探测期间捕获到的事件轨迹:', this.probeEvents);
        if (this.probeEvents.length === 0) {
            console.warn('[LuminaWeave] [Probe] [DIAGNOSTIC] 期间未收到任何提示词相关事件。请确认 host runtime 是否绑定了 GENERATE_AFTER_DATA 等事件。');
        } else {
            console.warn('[LuminaWeave] [Probe] [DIAGNOSTIC] 收到了事件但未提取到 Prompt。请检查上述轨迹中的 keys 是否包含预期的提示词字段。');
        }
    }
}
