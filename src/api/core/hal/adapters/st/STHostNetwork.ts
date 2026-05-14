import { IHostNetwork } from '../../interfaces.js';
import { STClient } from '../../../host-drivers/st/STClient.js';

/**
 * SillyTavern 宿主的网络实现
 */
export class STHostNetwork implements IHostNetwork {
    async generateStream(_payload: any, _options?: any): Promise<ReadableStream<any>> {
        // P1 阶段将迁移 NexusClient 或 ST 原生生成请求到此处
        throw new Error('[STHostNetwork] generateStream not implemented yet.');
    }

    async fetchWithAuth(input: string, init?: RequestInit): Promise<Response> {
        return STClient.fetchWithCsrf(input, init);
    }
}
