import {
    CharacterChannelService,
    type CharacterChannelApiPort
} from '../api/core/conversation/CharacterChannelService.js';
import type {
    DesktopCharacterRuntime
} from '../api/services/DesktopExperienceRuntime.js';
import type { HostConfirmHandler } from '../api/services/HostInteractionService.js';
import { useConversationContextStore } from '../stores/useConversationContextStore.js';
import { useModalStore } from '../stores/useModalStore.js';

export type CharacterRuntimeHost = CharacterChannelApiPort & {
    attachCharacterRuntime(runtime: DesktopCharacterRuntime): void;
};

export type HostInteractionRuntimeHost = {
    host: { setConfirmHandler(handler: HostConfirmHandler | null): void };
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

/**
 * 在 Pinia 安装后把确认弹窗端口注入 HostInteractionService；
 * Core API 不再直接依赖 useModalStore。
 */
export const installHostInteractionRuntime = (api: HostInteractionRuntimeHost): void => {
    api.host.setConfirmHandler((options) => useModalStore().confirm(options));
};
