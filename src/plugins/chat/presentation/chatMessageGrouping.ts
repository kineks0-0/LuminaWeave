import type { LuminaChatMessage } from '@shared/LuminaMessage.js';

/** 同一作者相邻消息归为一组的最大时间间隔 */
const GROUP_WINDOW_MS = 7 * 60 * 1000;

export interface ChatMessageGroupInfo {
    /** 发言组第一条：显示名称、头像（Discord / classic） */
    groupStart: boolean;
    /** 发言组最后一条：显示头像与气泡尾巴（Telegram） */
    groupEnd: boolean;
    /** HH:mm；无可用时间时为空串 */
    timeLabel: string;
    /** 与上一条消息不在同一天时的日期分隔标签 */
    dayLabel: string | null;
}

const parseSendDate = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
    if (typeof value !== 'string' || !value.trim()) return null;
    // SillyTavern 的人类可读格式如 "October 4, 2026 2:59am"，在时间与 am/pm 之间补空格后可被 Date 解析
    const normalized = value.trim().replace(/(\d)(am|pm)$/i, '$1 $2');
    const parsed = Date.parse(normalized);
    return Number.isFinite(parsed) ? parsed : null;
};

export const resolveChatMessageTimestamp = (message: LuminaChatMessage): number | null => {
    if (typeof message.createdAt === 'number' && Number.isFinite(message.createdAt) && message.createdAt > 0) {
        return message.createdAt;
    }
    return parseSendDate(message.extra?.send_date);
};

const pad = (value: number): string => String(value).padStart(2, '0');

const startOfDay = (timestamp: number): number => {
    const date = new Date(timestamp);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

const formatDayLabel = (timestamp: number, now: number): string => {
    const dayDiff = Math.round((startOfDay(now) - startOfDay(timestamp)) / 86_400_000);
    if (dayDiff === 0) return '今天';
    if (dayDiff === 1) return '昨天';
    const date = new Date(timestamp);
    const sameYear = date.getFullYear() === new Date(now).getFullYear();
    return sameYear
        ? `${date.getMonth() + 1}月${date.getDate()}日`
        : `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
};

const authorKey = (message: LuminaChatMessage): string => `${message.is_user ? 'user' : 'other'}:${message.name}`;

export const buildChatMessageGroups = (
    messages: readonly LuminaChatMessage[],
    now: number = Date.now()
): ChatMessageGroupInfo[] => {
    const timestamps = messages.map(resolveChatMessageTimestamp);

    const startsGroup = messages.map((message, index) => {
        if (index === 0) return true;
        if (authorKey(message) !== authorKey(messages[index - 1])) return true;
        const current = timestamps[index];
        const previous = timestamps[index - 1];
        if (current === null || previous === null) return false;
        return current - previous > GROUP_WINDOW_MS || startOfDay(current) !== startOfDay(previous);
    });

    return messages.map((_message, index) => {
        const timestamp = timestamps[index];
        const previousTimestamp = index > 0 ? timestamps[index - 1] : null;
        const showDay = timestamp !== null
            && (previousTimestamp === null || startOfDay(previousTimestamp) !== startOfDay(timestamp));
        return {
            groupStart: startsGroup[index],
            groupEnd: index === messages.length - 1 || startsGroup[index + 1],
            timeLabel: timestamp === null ? '' : `${pad(new Date(timestamp).getHours())}:${pad(new Date(timestamp).getMinutes())}`,
            dayLabel: showDay ? formatDayLabel(timestamp, now) : null
        };
    });
};
