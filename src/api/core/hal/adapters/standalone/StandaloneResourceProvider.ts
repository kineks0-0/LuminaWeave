import type { IHostResourceProvider } from '../../interfaces.js';
import { getStandaloneChatContext } from '../../../host-drivers/standalone/StandaloneChatContext.js';

/**
 * standalone 宿主资源状态：当前角色 / 会话来自本地指针，世界书与预设不存在宿主侧来源。
 */
export class StandaloneResourceProvider implements IHostResourceProvider {
    getActiveLorebookEntries(): any[] {
        return [];
    }

    getCurrentCharacterId(): string | number | null {
        return getStandaloneChatContext()?.characterId ?? null;
    }

    getCurrentChatId(): string | null {
        return getStandaloneChatContext()?.chatId ?? null;
    }

    async getPreset(_name: string): Promise<Record<string, any> | null> {
        return null;
    }
}
