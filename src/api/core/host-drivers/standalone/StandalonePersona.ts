import { lwStorage } from '../../../storage.js';

const USER_NAME_KEY = 'lumina-chat.userName';
const PERSONA_DESCRIPTION_KEY = 'lumina-chat.personaDescription';

const readGlobalString = (key: string, fallback: string): string => {
    try {
        const value = lwStorage.get(key, fallback, 'Global');
        return typeof value === 'string' && value.trim() ? value.trim() : fallback;
    } catch {
        return fallback;
    }
};

/** 本地 persona：ST 模式由 ST persona 覆盖，standalone 读取本地设置。 */
export const readStandaloneUserName = (fallback = 'User'): string =>
    readGlobalString(USER_NAME_KEY, fallback);

export const readStandalonePersonaDescription = (): string =>
    readGlobalString(PERSONA_DESCRIPTION_KEY, '');
