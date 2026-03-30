/**
 * 兼容性声明文件
 * 将 TavernHelper@types/iframe 中的声明挂载到 window 对象上，并提供常用类型别名
 */

import '@st-iframe/exported.sillytavern';
import '@st-iframe/exported.tavernhelper';

declare global {
    interface Window {
        SillyTavern: typeof SillyTavern & { getContext?: () => typeof SillyTavern };
        TavernHelper: typeof TavernHelper;
        
        // 插件注入的全局变量
        LuminaWeave: {
            chatManager?: {
                persistence?: {
                    getIntegratedTxId: (chatId: string) => string | null;
                };
            };
            syncFromST: (options?: { forceIndependentLoad?: boolean; skipSave?: boolean }) => Promise<void>;
        };
        LuminaWeave_API: any; // 暂时保留一个 any 作为入口，或改为 Record
        
        // ST 原生全局变量
        name1: string;
        name2: string;
        this_chid: string | number;
        user_avatar: string;
        main_api: string;
        oai_settings: Record<string, unknown>;
        extension_settings: Record<string, any>;
        selected_chat: string;
        world_info: Record<string, unknown>;
        world_info_active: Array<Record<string, unknown>>;
        
        // ST 核心对象
        eventSource: {
            on: (event: string, callback: (...args: any[]) => void) => void;
            off: (event: string, callback: (...args: any[]) => void) => void;
            emit: (event: string, ...args: any[]) => void;
        };
        SlashCommandParser: {
            commands: Record<string, any>;
            addCommand: (name: string, callback: any, aliases?: string[], hint?: string, ...args: any[]) => void;
        };
        
        // 常用全局函数
        saveChat: () => Promise<void>;
        renderChat: () => void;
        getTokenCountAsync: (text: string) => Promise<number>;
        getThumbnailUrl: (type: string, file: string) => string;
        getCharacterAvatar: (avatar: string) => string;
        substituteParams: (text: string, options?: Record<string, unknown>) => string;
    }

    // 常用类型别名
    interface LuminaLorebookEntry {
        uid: string | number;
        comment: string;
        key: string[];
        keysecondary: string[];
        content: string;
        constant: boolean;
        selective: boolean;
        selectiveLogic: number;
        disable: boolean;
        enabled?: boolean;
        position: number | string;
        role?: number;
        depth: number;
        order: number;
        probability: number;
        scan_depth: number;
        [key: string]: any;
    }
    
    type LorebookData = SillyTavern.v2WorldInfoBook;
    type JQuery<T = unknown> = {
        [key: string]: unknown;
        length: number;
        [index: number]: T;
    };

    /** 
     * 补充 TavernHelper 类型定义中的缺失字段 
     * 注意：如果 TavernHelper@types 中已有定义，应尽量通过扩展接口而非直接重定义
     */
}

export {};
