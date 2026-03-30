import { globalPromptRegistry } from './PromptRegistry.js';

/**
 * 内置核心 XML 标签字典，供各模块统一引用以避免硬编码字面值
 */
export const BuiltinXMLTags = {
    THINKING: 'thinking',
    CHAT_REPLY: 'Chat_Reply',
    MUTATION: 'Mutation'
} as const;

/**
 * 核心生命周期级别 (Data Tagging Schema)
 */
export type LifecycleType = 'transient' | 'ephemeral' | 'persistent';

/**
 * 拦截器处理函数的返回?? */
export type InterceptorCallback = (tagContent: string, fullMatchText: string) => string | void;

export interface ParserRegistration {
    tagName?: string;
    regex?: RegExp; // 新增：支持直接使用正则匹配
    lifecycle: LifecycleType;
    handler: InterceptorCallback;
}

export interface StreamSemanticState {
    rawText: string;
    displayText: string;
    filteredCount: number;
    statusText: string;
    activeTag: string | null;
}

/**
 * 核心 XML 拦截引擎 (核心)
 * 负责从 AI 原始响应中提取并清洗 XML 标签或特定模式，支持插件化扩展
 */
export class XMLInterceptor {
    private parsers: ParserRegistration[] = [];

    constructor() {
        this.registerDefaultParsers();
    }

    /**
     * 静态提纯工具：独立于组件生命周期，快速从原始文本中提取指定 XML 标签包裹的内容
     * 避免别的模块去手写正则进行字面值查找
     * 
     * [特性提升]
     * 1. 摒弃单一正则，改为模拟堆栈的串行解析器，解决多层嵌套与非标准换行问题。
     * 2. 自动兼容 PromptRegistry 中所注册的别名体系 (如 Mutation 与 M 通用)。
     * 3. 支持提取并返回同一个标签的多个值数组。
     */
    public static extractTagContent(rawText: string, tagName: string): string[] {
        if (!rawText) return [];
        
        // 1. 获取要寻找的合法标签池 (本体 + Aliases)
        const targetTags = new Set<string>([tagName.toLowerCase()]);
        const registryTag = globalPromptRegistry.getAllXMLTags().find(t => t.tag.toLowerCase() === tagName.toLowerCase());
        if (registryTag?.aliases) {
            registryTag.aliases.forEach(a => targetTags.add(a.toLowerCase()));
        }

        const tagRegex = /<\/?([a-zA-Z0-9_]+)\b[^>]*?>/g;
        let match: RegExpExecArray | null;
        
        const stack: { tag: string, startContentIndex: number }[] = [];
        const results: string[] = [];

        // 2. 栈式解析文本流
        while ((match = tagRegex.exec(rawText)) !== null) {
            const fullTagStr = match[0];
            const parsedTag = match[1].toLowerCase();
            const isClosing = fullTagStr.startsWith('</');
            const isSelfClosing = fullTagStr.endsWith('/>');

            if (isClosing) {
                // 如果是闭合标签，尝试在栈里找最近匹配的开头
                let foundIndex = -1;
                for (let i = stack.length - 1; i >= 0; i--) {
                    if (stack[i].tag === parsedTag) {
                        foundIndex = i;
                        break;
                    }
                }

                if (foundIndex !== -1) {
                    const blockStart = stack[foundIndex];
                    if (targetTags.has(parsedTag)) {
                        // 我们找到了一个完整目标块
                        const content = rawText.substring(blockStart.startContentIndex, match.index);
                        results.push(content.trim());
                    }
                    // 出栈到匹配位置（自动隐式闭合内部未闭合的脏标签）
                    stack.splice(foundIndex, stack.length - foundIndex);
                } else if (targetTags.has(parsedTag)) {
                    // 未在栈中找到起始标签，说明起始部分早已在别处或被截断丢失
                    // 这种单侧闭合块，为了不丢失数据，我们保守地从文本开头提取至此
                    const content = rawText.substring(0, match.index);
                    results.push(content.trim());
                }
            } else if (!isSelfClosing) {
                // 开启标签
                stack.push({
                    tag: parsedTag,
                    startContentIndex: match.index + fullTagStr.length
                });
            }
        }

        // 3. 兜底策略：如果主栈里还残存有目标标签（模型被迫截断，缺少闭合标签）
        for (let i = 0; i < stack.length; i++) {
            if (targetTags.has(stack[i].tag)) {
                // 直接向后切到底
                const content = rawText.substring(stack[i].startContentIndex);
                results.push(content.trim());
            }
        }

        return results;
    }

    /**
     * 开放扩展接口：给子插件注册自己的生命周期与解析器
     */
    public registerXMLParser(
        tagName: string,
        lifecycle: LifecycleType,
        handler: InterceptorCallback
    ) {
        this.parsers.push({ tagName, lifecycle, handler });
        console.debug(`[XMLInterceptor] Registered parser for <${tagName}> (${lifecycle})`);
    }

    /**
     * 注册一种非 XML 的正则模式拦截器 (例如 [物品栏更新])
     */
    public registerPatternParser(
        regex: RegExp,
        lifecycle: LifecycleType,
        handler: InterceptorCallback
    ) {
        this.parsers.push({ regex, lifecycle, handler });
        console.debug(`[XMLInterceptor] Registered pattern parser: ${regex.source}`);
    }

    /**
     * 卸载指定的解析器
     */
    public unregisterXMLParser(tagName: string) {
        this.parsers = this.parsers.filter(p => p.tagName !== tagName);
    }

    /**
     * 获取指定生命周期的所有标签名
     */
    public getTagsByLifecycle(lifecycles: LifecycleType[]): string[] {
        return this.parsers
            .filter(p => p.tagName && lifecycles.includes(p.lifecycle))
            .map(p => p.tagName as string);
    }

    public deriveStreamState(rawText: string, filterChatReply: boolean): StreamSemanticState {
        if (!rawText) {
            return {
                rawText: '',
                displayText: '',
                filteredCount: 0,
                statusText: '',
                activeTag: null
            };
        }

        if (!filterChatReply) {
            return {
                rawText,
                displayText: rawText,
                filteredCount: 0,
                statusText: '',
                activeTag: null
            };
        }

        const stack: string[] = [];
        const displayParts: string[] = [];
        const tagRegex = /<\/?([a-zA-Z0-9_]+)\b[^>]*?>/g;
        let lastIndex = 0;
        let lastMeaningfulTag: string | null = null;

        for (const match of rawText.matchAll(tagRegex)) {
            const [fullMatch, tagName] = match;
            const matchIndex = match.index ?? 0;
            const textSegment = rawText.slice(lastIndex, matchIndex);

            if (this.isTagActive(stack, BuiltinXMLTags.CHAT_REPLY)) {
                displayParts.push(textSegment);
            }

            const isClosingTag = fullMatch.startsWith('</');
            const isSelfClosingTag = fullMatch.endsWith('/>');

            if (isClosingTag) {
                this.popMatchingTag(stack, tagName);
                lastMeaningfulTag = tagName;
            } else {
                if (!isSelfClosingTag) {
                    stack.push(tagName);
                }
                lastMeaningfulTag = tagName;
            }

            lastIndex = matchIndex + fullMatch.length;
        }

        const trailingSegment = rawText.slice(lastIndex);
        const trailingInfo = this.splitTrailingPartialTag(trailingSegment);
        if (this.isTagActive(stack, BuiltinXMLTags.CHAT_REPLY)) {
            displayParts.push(trailingInfo.visibleText);
        }

        const activeTag = this.resolveActiveTag(stack, lastMeaningfulTag);
        const displayText = displayParts.join('');

        return {
            rawText,
            displayText,
            filteredCount: Math.max(0, rawText.length - displayText.length),
            statusText: this.resolveStatusText(activeTag),
            activeTag
        };
    }

    /**
     * 核心切割流水线
     * 将包含混合 XML 的原始字符串塞入进行提纯
     * @param rawText 原始文本
     * @param executeHandlers 是否执行拦截器回调（默认为 true）。流式中间态应当为 false，防止重复触发副作用
     */
    public processAndCleanText(rawText: string, executeHandlers: boolean = true): string {
        if (!rawText) return '';

        if (executeHandlers) {
            console.group(`[XMLInterceptor] Processing Text (${rawText.length} chars)`);
        }

        let cleanText = rawText;

        // 遍历所有已注册的解析器（包含 XML 和正则模式）
        for (const reg of this.parsers) {
        if (reg.tagName) {
            const tagName = reg.tagName;
            // 1. 处理已闭合的完整标签
            const completeRegex = new RegExp(`<${tagName}\\b[^>]*?(?:/>|>(.*?)</${tagName}>)`, 'gis');
            cleanText = cleanText.replace(completeRegex, (matchSubString: string, capturedContent: string) => {
                let handlerResult: string | void = undefined;

                if (executeHandlers) {
                    const content = capturedContent !== undefined ? capturedContent : matchSubString;
                    handlerResult = reg.handler(content, matchSubString);
                } else if (reg.lifecycle === 'persistent') {
                    // 流式中间态：即便不执行 handler，persistent 标签也应当返回其内容（剥去外壳）
                    return capturedContent !== undefined ? capturedContent : '';
                }

                if (typeof handlerResult === 'string') return handlerResult;
                return ''; // Default: Transient / Ephemeral 毁掉原文
            });

            // 2. 处理未闭合的标签 (仅在流式过程中或作为兜底处理)
            // 匹配形如 <tag... 或 <tag>... 且后面没有闭合标签的情况
            // 增强正则：支持匹配部分标签名 (greedier matching at the end of string)
            const unclosedRegex = new RegExp(`<${tagName}(?:\\b[^>]*?|(?=>$))(?::?|>(?:(?!</${tagName}>).)*$)`, 'is');

            const unclosedMatch = cleanText.match(unclosedRegex);
            if (unclosedMatch) {
                const fullMatch = unclosedMatch[0];
                // 提取内容部分：如果是 <tag>content 则提取 content，如果是 <tag 则内容为空
                const contentMatch = fullMatch.match(new RegExp(`<${tagName}\\b[^>]*?>(.*)$`, 'is'));
                const content = contentMatch ? contentMatch[1] : '';

                if (reg.lifecycle === 'persistent') {
                    // Persistent：剥下还没写完的头，保留内容
                    cleanText = cleanText.replace(fullMatch, content);
                } else {
                    // Transient / Ephemeral：一旦露头，全部斩断
                    cleanText = cleanText.replace(fullMatch, '');
                }
            }

        } else if (reg.regex) {
            // 纯正则模式的处理 (通常不涉及流式未闭合状态，或者由各插件正则自行保证)
            cleanText = cleanText.replace(reg.regex, (matchSubString: string, capturedContent: string) => {
                let handlerResult: string | void = undefined;
                if (executeHandlers) {
                    const content = capturedContent !== undefined ? capturedContent : matchSubString;
                    handlerResult = reg.handler(content, matchSubString);
                } else if (reg.lifecycle === 'persistent') {
                    return capturedContent !== undefined ? capturedContent : matchSubString;
                }
                return (typeof handlerResult === 'string') ? handlerResult : '';
            });
        }
    }

    if(executeHandlers) {
        console.groupEnd();
    }
        return cleanText.trim();
    }

    private isTagActive(stack: string[], tagName: string): boolean {
    return stack.some(tag => tag.toLowerCase() === tagName.toLowerCase());
}

    private popMatchingTag(stack: string[], tagName: string): void {
    const normalizedTag = tagName.toLowerCase();
    for(let index = stack.length - 1; index >= 0; index -= 1) {
    if (stack[index].toLowerCase() === normalizedTag) {
        stack.splice(index, 1);
        return;
    }
}
    }

    private splitTrailingPartialTag(text: string): { visibleText: string; partialTagName: string | null } {
    const ltIndex = text.lastIndexOf('<');
    if (ltIndex === -1) {
        return { visibleText: text, partialTagName: null };
    }

    const trailingFragment = text.slice(ltIndex);
    if (trailingFragment.includes('>')) {
        return { visibleText: text, partialTagName: null };
    }

    const partialMatch = trailingFragment.match(/^<\/?([a-zA-Z0-9_]*)$/);
    if (!partialMatch) {
        return { visibleText: text, partialTagName: null };
    }

    return {
        visibleText: text.slice(0, ltIndex),
        partialTagName: partialMatch[1] || null
    };
}

    private resolveActiveTag(stack: string[], lastMeaningfulTag: string | null): string | null {
    const activeTag = stack[stack.length - 1];
    if (activeTag) {
        return activeTag;
    }
    return lastMeaningfulTag;
}

    private resolveStatusText(tagName: string | null): string {
    if (!tagName) {
        // 没有标签，有可能是预思考导致模型回复没有thinking标签
        return '思考中...';
    }

    const normalizedTag = tagName.toLowerCase();
    const knownStatuses: Record<string, string> = {
        think: '思考中...',
        thinking: '思考中...',
        character_action: '行动中...',
        chat_reply: '回复中...',
    };

    const registryTag = globalPromptRegistry.getAllXMLTags().find(tag => {
        if (tag.tag.toLowerCase() === normalizedTag) {
            return true;
        }
        return tag.aliases?.some(alias => alias.toLowerCase() === normalizedTag) || false;
    });

    if (registryTag?.statusText) {
        return registryTag.statusText;
    }

    return knownStatuses[normalizedTag] || `${tagName}处理中..`;
}

    /**
     * 内置基础系统解析器 (无插件依赖)
     */
    private registerDefaultParsers() {
        // 1. <thinking> (思维推演) - Transient
        this.registerXMLParser(BuiltinXMLTags.THINKING, 'transient', (content) => {
            console.debug(`[XMLInterceptor] System Intercepted thinking: ${content.substring(0, 50)}...`);
            return '';
        });

        // 2. <Chat_Reply> (核心对话) - Persistent
        this.registerXMLParser(BuiltinXMLTags.CHAT_REPLY, 'persistent', (content) => {
            return content; // 剥去外壳，保留真实文本
        });
    }
}

/**
 * 全局单例拦截器 (核心)
 */
export const globalXMLInterceptor = new XMLInterceptor();
