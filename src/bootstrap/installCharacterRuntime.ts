import {
    CharacterChannelService,
    type CharacterChannelApiPort
} from '../api/core/conversation/CharacterChannelService.js';
import type { DesktopCharacterRuntime } from '../api/services/DesktopExperienceRuntime.js';
import { useConversationContextStore } from '../stores/useConversationContextStore.js';

export type CharacterRuntimeHost = CharacterChannelApiPort & {
    attachCharacterRuntime(runtime: DesktopCharacterRuntime): void;
};

/**
 * 创建应用级 character 单例并挂到 lwApi.services。
 * 必须在 app.use(pinia) 之后、mount 之前调用（store 依赖已安装的 Pinia）。
 * 服务随应用存活，不销毁。
 */
export const installCharacterRuntime = (api: CharacterRuntimeHost): DesktopCharacterRuntime => {
    const runtime = new CharacterChannelService(api, useConversationContextStore());
    api.attachCharacterRuntime(runtime);
    return runtime;
};
