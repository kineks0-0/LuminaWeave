import { ModelMessage } from 'ai';
import { NexusOrchestrator, mapSTSettingsToAISdk } from '@shared/api/llm/NexusOrchestrator.js';
import { NexusApiConfig, NexusProviderType } from '@shared/api/llm/NexusTypes.js';

export { mapSTSettingsToAISdk };

/**
 * NexusService (Server Side)
 * 继承自共享的 NexusOrchestrator，并保留后端特有的扩展能力
 */
export class NexusService extends NexusOrchestrator {
    // 后端目前透传共享逻辑，如需增加后端特有的中间件或日志逻辑，可在此重写方法
}

