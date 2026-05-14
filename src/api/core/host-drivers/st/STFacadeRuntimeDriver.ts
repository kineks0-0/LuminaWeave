import { HOST_EVENT, configureHostRuntimePort, type HostEventKey, type HostRuntimeDiagnostics, type HostRuntimePort, type HostRuntimeWaitOptions } from '../../facade/HostRuntimePort.js';
import { ST_EVENT } from '../STEvent.js';
import { STEnvironmentDriver } from './STEnvironmentDriver.js';

export class STFacadeRuntimeDriver implements HostRuntimePort {
    async waitForReady(options: HostRuntimeWaitOptions = {}): Promise<boolean> {
        return STEnvironmentDriver.waitForReady(options);
    }

    setSilenceMode(enabled: boolean): void {
        STEnvironmentDriver.setSilenceMode(enabled);
    }

    getDiagnostics(): HostRuntimeDiagnostics {
        const core = STEnvironmentDriver.ctx as any;
        const main = STEnvironmentDriver.stMain as any;
        const source = STEnvironmentDriver.stEventSource;
        const eventTypes = STEnvironmentDriver.stEventTypes;
        return {
            hasHostCore: !!core,
            hasEventSource: !!source,
            hasEventTypes: !!eventTypes,
            source: core?.eventSource ? 'context' : (main?.eventSource ? 'main' : (source ? 'window' : 'null'))
        };
    }

    on(eventKey: HostEventKey, handler: (...args: any[]) => void): boolean {
        const source = STEnvironmentDriver.stEventSource as any;
        const eventTypes = STEnvironmentDriver.stEventTypes as Record<string, string> | undefined;
        const stEventKey = ST_EVENT[eventKey] ?? HOST_EVENT[eventKey];
        const eventName = eventTypes?.[stEventKey] ?? stEventKey;
        if (!source || !eventName || typeof source.on !== 'function') {
            return false;
        }
        source.on(eventName, handler);
        return true;
    }

    getGenerationFlags(): { isGenerating: boolean; isTyping: boolean } {
        return STEnvironmentDriver.getGenerationFlags();
    }

    getHostFunction(funcName: string): Promise<Function | null> {
        return STEnvironmentDriver.getHostFunction(funcName);
    }

    applyRegex(
        text: string,
        source: 'user_input' | 'ai_output' | 'slash_command' | 'world_info' | 'reasoning',
        destination: 'display' | 'prompt',
        options: Record<string, unknown> = {}
    ): string {
        return STEnvironmentDriver.applyRegex(text, source, destination, options);
    }

    getCore(): unknown {
        return STEnvironmentDriver.getCore();
    }

    getCurrentChatMessages(): any[] {
        const ctx = (STEnvironmentDriver.ctx || STEnvironmentDriver.stMain) as any;
        return Array.isArray(ctx?.chat) ? ctx.chat : [];
    }
}

let registered = false;

export function registerSTFacadeRuntimeDriver(): void {
    if (registered) return;
    configureHostRuntimePort(new STFacadeRuntimeDriver());
    registered = true;
}
