import {
    configureHostRuntimePort,
    type HostRuntimeDiagnostics,
    type HostRuntimePort,
    type HostRuntimeWaitOptions,
    HOST_EVENT,
    type HostEventKey
} from '../../facade/HostRuntimePort.js';

/**
 * 独立模式下的运行时驱动
 * 用于在没有 SillyTavern 的环境下提供基础能力
 */
export class StandaloneFacadeRuntimeDriver implements HostRuntimePort {
    async waitForReady(_options: HostRuntimeWaitOptions = {}): Promise<boolean> {
        // 独立模式不需要等待环境，直接返回就绪
        return true;
    }

    setSilenceMode(_enabled: boolean): void {
        // 独立模式暂不实现静默模式
    }

    getDiagnostics(): HostRuntimeDiagnostics {
        return {
            hasHostCore: false,
            hasEventSource: false,
            hasEventTypes: false,
            source: 'standalone'
        };
    }

    on(_eventKey: HostEventKey, _handler: (...args: any[]) => void): boolean {
        // 独立模式暂不支持宿主事件监听
        return false;
    }

    getGenerationFlags(): { isGenerating: boolean; isTyping: boolean } {
        return { isGenerating: false, isTyping: false };
    }

    async getHostFunction(_funcName: string): Promise<Function | null> {
        return null;
    }

    applyRegex(
        text: string,
        _source: any,
        _destination: any,
        _options: any = {}
    ): string {
        return text;
    }

    getCore(): unknown {
        return null;
    }

    getCurrentChatMessages(): any[] {
        return [];
    }
}

let registered = false;

export function registerStandaloneFacadeRuntimeDriver(): void {
    if (registered) return;
    configureHostRuntimePort(new StandaloneFacadeRuntimeDriver());
    registered = true;
}
