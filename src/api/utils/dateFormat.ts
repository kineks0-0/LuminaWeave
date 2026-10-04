const pad = (value: number): string => String(value).padStart(2, '0');

const shortDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
});

const dateTimeFormatter = new Intl.DateTimeFormat();

const clockSecondsFormatter = new Intl.DateTimeFormat(undefined, {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
});

export const padNumber = pad;

export const formatClockTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const formatClockSeconds = (timestamp: number): string => clockSecondsFormatter.format(timestamp);

export const formatShortDateTime = (timestamp: number): string => shortDateTimeFormatter.format(timestamp);

export const formatDateTime = (timestamp: number): string => dateTimeFormatter.format(timestamp);

export const formatTimeWithToday = (timestamp: number): string => {
    const date = new Date(timestamp);
    if (date.toDateString() === new Date().toDateString()) return formatClockTime(timestamp);
    return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${formatClockTime(timestamp)}`;
};
