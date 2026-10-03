import { marked } from 'marked';

// breaks: true 让单个换行渲染为 <br>，取代此前依赖 white-space: pre-wrap 保留换行的做法。
export const renderChatMarkdown = (text: string): string => {
    return marked.parse(text || '', { async: false, gfm: true, breaks: true }) as string;
};
