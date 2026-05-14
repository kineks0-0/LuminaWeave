import { getHostRuntimePort } from '../../facade/HostRuntimePort.js';

export interface PromptProbeCallbacks {
    syncPromptWorldInfo(): Promise<void>;
    startSilentStream(): void;
    onPromptIntercept(handler: (payload: any) => void): void;
    offPromptIntercept(handler: (payload: any) => void): void;
    emitPromptBuilt(payload: any): void;
    getProbeEvents(): Array<{ name: string; hasData: boolean; keys: string[] }>;
}

export interface PromptProbeResult {
    payload: any;
    timedOut: boolean;
}

export class PromptProbeService {
    async probe(callbacks: PromptProbeCallbacks): Promise<PromptProbeResult> {
        await callbacks.syncPromptWorldInfo();

        const generate = await getHostRuntimePort().getHostFunction('generate');
        if (!generate) {
            return { payload: null, timedOut: false };
        }

        const probePromise = new Promise<PromptProbeResult>((resolve) => {
            const handler = (payload: any) => {
                callbacks.offPromptIntercept(handler);
                resolve({ payload, timedOut: false });
            };
            callbacks.onPromptIntercept(handler);
            setTimeout(() => {
                callbacks.offPromptIntercept(handler);
                resolve({ payload: null, timedOut: true });
            }, 15000);
        });

        try {
            callbacks.startSilentStream();
            (generate as any)('quiet', {
                should_silence: true,
                is_quiet: true,
                dry_run: true
            }, true);
        } catch (error) {
            console.error('[PromptProbeService] Host dry-run prompt probe crashed:', error);
        }

        const result = await probePromise;
        const stop = (await getHostRuntimePort().getHostFunction('stopGeneration'))
            || (await getHostRuntimePort().getHostFunction('stopGenerating'));
        if (stop) {
            try {
                await stop();
            } catch (error) {
                console.warn('[PromptProbeService] Failed to stop host prompt probe:', error);
            }
        }

        if (Array.isArray(result.payload)) {
            callbacks.emitPromptBuilt(result.payload);
        }

        void callbacks.getProbeEvents;
        return result;
    }
}

export const promptProbeService = new PromptProbeService();
