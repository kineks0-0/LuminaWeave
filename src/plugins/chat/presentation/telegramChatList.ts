import type { CharacterChannelGroup } from '../../../types/ConversationContextTypes.js';

export interface TelegramChatListRow {
    sessionId: string;
    characterKey: string;
    characterId: string | number | null;
    name: string;
    /** 同一角色有多个会话时用于区分，否则为空串 */
    sessionTitle: string;
    avatarUrl: string | null;
    initial: string;
    preview: string;
    updatedAt: number;
    dateLabel: string;
    isActive: boolean;
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const pad = (value: number): string => String(value).padStart(2, '0');

const startOfDay = (timestamp: number): number => {
    const date = new Date(timestamp);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

/** 与 Telegram 列表一致：今天显示时间，一周内显示星期，同年显示月日，更早显示 yy.mm.dd。 */
export const formatChatListDate = (timestamp: number, now: number = Date.now()): string => {
    if (!Number.isFinite(timestamp) || timestamp <= 0) return '';
    const date = new Date(timestamp);
    const dayDiff = Math.round((startOfDay(now) - startOfDay(timestamp)) / 86_400_000);
    if (dayDiff <= 0) return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    if (dayDiff < 7) return WEEKDAYS[date.getDay()];
    if (date.getFullYear() === new Date(now).getFullYear()) return `${date.getMonth() + 1}月${date.getDate()}日`;
    return `${pad(date.getFullYear() % 100)}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
};

export const buildTelegramChatListRows = (
    groups: readonly CharacterChannelGroup[],
    { query, activeSessionId, now = Date.now() }: { query: string; activeSessionId: string | null; now?: number }
): TelegramChatListRow[] => {
    const needle = query.trim().toLowerCase();
    const rows = groups.flatMap(group => group.sessions
        .filter(session => !needle || [group.characterName, session.title, session.recentHistoryPreview, session.previewMessage]
            .some(value => (value || '').toLowerCase().includes(needle)))
        .map((session): TelegramChatListRow => ({
            sessionId: session.id,
            characterKey: group.key,
            characterId: group.characterId,
            name: group.characterName,
            sessionTitle: group.sessions.length > 1 ? session.title : '',
            avatarUrl: group.characterAvatarUrl,
            initial: group.characterInitial,
            preview: session.recentHistoryPreview || session.previewMessage || session.summary || '',
            updatedAt: session.updatedAt,
            dateLabel: formatChatListDate(session.updatedAt, now),
            isActive: session.id === activeSessionId
        })));
    return rows.sort((left, right) => right.updatedAt - left.updatedAt);
};

/** 无头像时按名字给出稳定色相 */
export const resolveAvatarHue = (name: string): number => {
    let hash = 0;
    for (const char of name) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 360;
    return hash;
};
