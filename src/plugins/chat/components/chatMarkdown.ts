import { marked } from 'marked';

export const renderChatMarkdown = (text: string): string => {
    return marked.parse(text || '', { async: false }) as string;
};
