import { IHostResourceProvider } from '../../interfaces.js';
import { STClient } from '../../../host-drivers/st/STClient.js';

/**
 * SillyTavern 宿主的资源 Provider 实现
 */
export class STResourceProvider implements IHostResourceProvider {
    /**
     * 获取当前 ST 激活的世界书条目
     */
    getActiveLorebookEntries(): any[] {
        return STClient.getActiveWorldInfoItems();
    }

    /**
     * 获取宿主当前选中的角色 ID
     */
    getCurrentCharacterId(): string | number | null {
        return STClient.getResolvedCurrentCharacterId();
    }

    /**
     * 获取宿主当前选中的会话 ID
     */
    getCurrentChatId(): string | null {
        return STClient.getResolvedCurrentChatId();
    }

    /**
     * 获取 ST 特定类型的预设
     */
    async getPreset(name: string): Promise<Record<string, any> | null> {
        return STClient.getPreset(name);
    }
}
