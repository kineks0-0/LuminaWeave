import type { ResourceRef } from '@shared/resources/index.js';
import { lwStorage } from '../../api/storage.js';
import { PromptResourceBindingService, promptResourceBindingService } from '../../api/core/hal/resource/index.js';

const refKey = (ref: ResourceRef): string => `${ref.sourceId}:${ref.resourceType}:${ref.resourceId}`;

const currentChatOwner = (): ReturnType<typeof PromptResourceBindingService.sessionOwner> | null => {
    const chatId = lwStorage._getContextIds().chatId;
    return chatId ? PromptResourceBindingService.sessionOwner(chatId) : null;
};

/** 当前聊天是否启用了这本书（session binding 中是否存在该 worldbook ref）。 */
export const isWorldbookEnabledForCurrentChat = (ref: ResourceRef): boolean => {
    const owner = currentChatOwner();
    if (!owner) return false;
    return promptResourceBindingService.resolveBindings(owner).enabledRefs
        .some(item => refKey(item) === refKey(ref));
};

/** 按聊天启用/停用世界书：启用=加入 session bindings，停用=移除对应 worldbook ref。 */
export const setWorldbookEnabledForCurrentChat = (ref: ResourceRef, enabled: boolean): void => {
    const owner = currentChatOwner();
    if (!owner) return;
    if (enabled) {
        promptResourceBindingService.addBinding(owner, ref);
        return;
    }
    promptResourceBindingService.removeBinding(owner, {
        sourceId: ref.sourceId,
        resourceType: ref.resourceType,
        resourceId: ref.resourceId
    });
};
