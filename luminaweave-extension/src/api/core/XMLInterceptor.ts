import { globalPromptRegistry } from './PromptRegistry.js';
import { tokenize, extractBlocks, detectTrailingPartialTag, type Token } from './TagTokenizer.js';

/**
 * 内置核心 XML 标签字典，供各模块统一引用以避免硬编码字面值
 */
export const BuiltinXMLTags = {
    THINKING: 'thinking',
    CHARACTER_ACTION: 'Character_Action', // [已废弃]
    CHAT_REPLY: 'Chat_Reply',
    MUTATION: 'Mutation',
    VIEW: 'V',
    STORY_SUMMARY: 'Story_Summary'
} as const;

/**
 * 核心生命周期级别 (Data Tagging Schema)
 *
 * - transient:      纯内部推理标签，剥离后丢弃（如 <thinking>）
 * - ephemeral:      短期状态标签，执行 handler 后丢弃（如 <Current_Plan>）
 * - persistent:     落库标签，执行 handler 后保留其内部文本内容（如 <Chat_Reply>）
 * - presentational: 纯展示层标签，原样保留在输出中（如 <V>），不执行 handler
 */
export type LifecycleType = 'transient' | 'ephemeral' | 'persistent' | 'presentational';

/**
 * 拦截器处理函数的返回值
 */
export type InterceptorCallback = (tagContent: string, fullMatchText: string) => string | void;

export interface ParserRegistration {
    tagName?: string;
    regex?: RegExp;
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
 * 核心 XML 拦截引擎 (v2 - TagTokenizer 驱动)
 *
 * 架构改进：
 * 1. 所有标签解析统一使用 TagTokenizer 单遍扫描
 * 2. 消除了三套独立正则解析逻辑的重复
 * 3. 新增 presentational 生命周期支持 <V> 标签
 */
export class XMLInterceptor {
    private parsers: ParserRegistration[] = [];

    constructor() {
        this.registerDefaultParsers();
    }

    // ──────────────────────────────────────────────
    // 公开 API（签名完全不变，内部替换为 Tokenizer）
    // ──────────────────────────────────────────────

    /**
     * 静态提纯工具：从原始文本中提取指定 XML 标签包裹的内容
     *
     * 行为保持不变：
     * - 大小写不敏感匹配
     * - 自动兼容 PromptRegistry 中注册的别名
     * - 支持嵌套同名标签、未闭合标签兜底、只有闭合标签的情况
     */
    public static extractTagContent(rawText: string, tagName: string): string[] {
        if (!rawText) return [];

        // 构建目标标签池（本体 + 别名，全部小写化）
        const targetTags = new Set<string>([tagName.toLowerCase()]);
        const registryTag = globalPromptRegistry.getAllXMLTags()
            .find(t => t.tag.toLowerCase() === tagName.toLowerCase());
        if (registryTag?.aliases) {
            registryTag.aliases.forEach(a => targetTags.add(a.toLowerCase()));
        }

        // 使用 Tokenizer 提取
        const blocks = extractBlocks(rawText, targetTags);
        return blocks.map(b => b.content);
    }

    /**
     * 开放扩展接口：给子插件注册自己的生命周期与解析器
     */
    public registerXMLParser(
        tagName: string,
        lifecycle: LifecycleType,
        handler: InterceptorCallback
    ): void {
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
    ): void {
        this.parsers.push({ regex, lifecycle, handler });
        console.debug(`[XMLInterceptor] Registered pattern parser: ${regex.source}`);
    }

    /**
     * 卸载指定的解析器
     */
    public unregisterXMLParser(tagName: string): void {
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

    /**
     * 流式语义状态推导
     *
     * 重构：使用 Tokenizer 单遍解析，替代原来的手动正则+栈遍历
     */
    public deriveStreamState(rawText: string, filterChatReply: boolean, allowTopLevel: boolean = true, implicitStartThinking: boolean = false): StreamSemanticState {
        if (!rawText) {
            return { rawText: '', displayText: '', filteredCount: 0, statusText: '', activeTag: null };
        }

        // 过滤模式关闭时，直接返回原始文本
        if (!filterChatReply) {
            return { rawText, displayText: rawText, filteredCount: 0, statusText: '', activeTag: null };
        }

        const tokens = tokenize(rawText);
        const stack: string[] = [];
        const displayParts: string[] = [];
        let lastMeaningfulTag: string | null = null;

        // 1. 预扫描：检测是否存在孤立的 transient 闭合标签（用于回溯屏蔽顶层文本）
        const orphanTransientCloseIndices = new Set<number>();
        const tempStack: string[] = [];
        for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i];
            if (t.type === 'open_tag') {
                tempStack.push(t.value.toLowerCase());
            } else if (t.type === 'close_tag') {
                const tagName = t.value.toLowerCase();
                const foundIdx = tempStack.lastIndexOf(tagName);
                if (foundIdx !== -1) {
                    tempStack.splice(foundIdx, 1);
                } else {
                    // 孤立闭合标签
                    const p = this.parsers.find(p => p.tagName?.toLowerCase() === tagName);
                    if (p?.lifecycle === 'transient') {
                        orphanTransientCloseIndices.add(i);
                        // console.log(`[XMLInterceptor] Found orphan transient close tag: </${tagName}> at index ${i}`);
                    }
                }
            }
        }

        // 2. 隐式起始处理：如果开启且首个 Token 为文本，则假定处于思考中
        let isImplicitThinking = false;
        if (implicitStartThinking && tokens.length > 0 && tokens[0].type === 'text') {
            isImplicitThinking = true;
            stack.push('thinking');
        }

        const hiddenPersistentTags = new Set<string>([
            BuiltinXMLTags.STORY_SUMMARY.toLowerCase(),
            BuiltinXMLTags.MUTATION.toLowerCase(),
            'm'
        ]);

        const hasDisplayPersistentTagInStack = () => {
            return stack.some(tag => {
                const tagLower = tag.toLowerCase();
                if (hiddenPersistentTags.has(tagLower)) return false;
                const p = this.parsers.find(p => p.tagName?.toLowerCase() === tagLower);
                return p?.lifecycle === 'persistent';
            });
        };

        // 辅助：检查当前栈是否处于“应当隐藏”的标签内 (Transient/Ephemeral)
        const isCurrentlyHidden = () => {
            if (stack.length === 0) return false;
            const topTag = stack[stack.length - 1];
            const p = this.parsers.find(p => p.tagName?.toLowerCase() === topTag.toLowerCase());
            return p?.lifecycle === 'transient' || p?.lifecycle === 'ephemeral';
        };

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const rawTagStr = rawText.slice(token.start, token.end);
            const tagName = token.value?.toLowerCase();
            const parser = tagName ? this.parsers.find(p => p.tagName?.toLowerCase() === tagName) : null;
            const isPresentational = parser?.lifecycle === 'presentational';

            if (token.type === 'text') {
                const inReply = hasDisplayPersistentTagInStack();
                const inPresentational = this.hasPresentationalInStack(stack);
                const inHidden = isCurrentlyHidden();
                const isTopLevel = stack.length === 0;

                // 核心增强：孤立标签回溯保护。如果后续存在孤立的思考闭合标签，当前顶层文本也应视为隐藏。
                let isPreOrphanZone = false;
                if (isTopLevel && allowTopLevel && orphanTransientCloseIndices.size > 0) {
                    for (const orphanIdx of orphanTransientCloseIndices) {
                        if (orphanIdx > i) {
                            isPreOrphanZone = true;
                            // console.log(`[XMLInterceptor] Text at index ${i} hidden by subsequent orphan tag at ${orphanIdx}`);
                            break;
                        }
                    }
                }

                // 核心过滤逻辑：
                // 1. 如果在回复标签或展示型标签内，展示。
                // 2. 如果在隐藏标签内（含隐式思考），绝对屏蔽。
                // 3. 如果在顶层，根据 allowTopLevel 决定，但受孤立标签回溯保护。
                const shouldShow = (inReply || inPresentational || (isTopLevel && allowTopLevel && !isPreOrphanZone)) && !inHidden;

                if (shouldShow) {
                    // 检查末尾是否有未完成的标签片段
                    const partialTag = detectTrailingPartialTag(token.value);
                    if (partialTag !== null) {
                        const ltIndex = token.value.lastIndexOf('<');
                        displayParts.push(token.value.slice(0, ltIndex));
                    } else {
                        displayParts.push(token.value);
                    }
                }
            } else if (token.type === 'open_tag') {
                // 如果当前处于隐式思考，而模型输出了新标签，则终结隐式思考
                if (isImplicitThinking) {
                    isImplicitThinking = false;
                    stack.pop();
                }
                stack.push(token.value);
                lastMeaningfulTag = token.value;
                // 如果是展示型标签，保留标签本身
                if (isPresentational) {
                    displayParts.push(rawTagStr);
                }
            } else if (token.type === 'close_tag') {
                // 如果当前处于隐式思考，且闭合的是思考标签，则正常终结
                if (isImplicitThinking && token.value.toLowerCase() === 'thinking') {
                    isImplicitThinking = false;
                    stack.pop();
                } else {
                    // 如果在隐式思考期间尝试闭合其他标签，先终结隐式思考（防错处理）
                    if (isImplicitThinking) {
                        isImplicitThinking = false;
                        stack.pop();
                    }
                    this.popMatchingTag(stack, token.value);
                }
                lastMeaningfulTag = token.value;
                // 如果是展示型标签，保留标签本身
                if (isPresentational) {
                    displayParts.push(rawTagStr);
                }
            } else if (token.type === 'self_closing_tag') {
                lastMeaningfulTag = token.value;
                // 如果是展示型标签，保留标签本身
                if (isPresentational) {
                    displayParts.push(rawTagStr);
                }
            }
        }

        // 尾部未完成标签片段处理（tailing text 中的部分标签）
        const lastToken = tokens[tokens.length - 1];
        if (lastToken?.type === 'text' && this.isTagInStack(stack, BuiltinXMLTags.CHAT_REPLY)) {
            const partialTag = detectTrailingPartialTag(lastToken.value);
            if (partialTag !== null) {
                lastMeaningfulTag = lastMeaningfulTag || partialTag;
            }
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
     * 核心切割流水线：将混合 XML 的原始字符串清洗提纯
     *
     * 重构：使用 Tokenizer 单遍构建标签块映射，再按生命周期处理
     *
     * @param rawText 原始文本
     * @param executeHandlers 是否执行拦截器回调（流式中间态应为 false）
     */
    public processAndCleanText(rawText: string, executeHandlers: boolean = true): string {
        if (!rawText) return '';

        if (executeHandlers) {
            console.group(`[XMLInterceptor] Processing Text (${rawText.length} chars)`);
        }

        let cleanText = rawText;

        // 阶段 1：处理 XML 标签类解析器（使用 Tokenizer）
        const xmlParsers = this.parsers.filter(p => p.tagName);
        if (xmlParsers.length > 0) {
            cleanText = this.processXMLTags(cleanText, xmlParsers, executeHandlers);
        }

        // 阶段 2：处理正则模式类解析器（保持原逻辑）
        const regexParsers = this.parsers.filter(p => p.regex);
        for (const reg of regexParsers) {
            cleanText = cleanText.replace(reg.regex!, (matchSubString: string, capturedContent: string) => {
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

        if (executeHandlers) {
            console.groupEnd();
        }

        return cleanText.trim();
    }

    // ──────────────────────────────────────────────
    // 内部实现
    // ──────────────────────────────────────────────

    /**
     * 使用 Tokenizer 处理所有 XML 标签
     *
     * 遍历 Token 流，根据每个标签的生命周期决定如何输出：
     * - transient / ephemeral → 整块丢弃（执行 handler 后不保留）
     * - persistent → 执行 handler，保留 handler 返回的文本（或标签内部内容）
     * - presentational → 原样保留（不执行 handler）
     */
    private processXMLTags(text: string, xmlParsers: ParserRegistration[], executeHandlers: boolean): string {
        // 构建标签名到解析器的查找表
        const parserMap = new Map<string, ParserRegistration>();
        for (const p of xmlParsers) {
            if (p.tagName) {
                parserMap.set(p.tagName.toLowerCase(), p);
            }
        }

        const tokens = tokenize(text);
        const outputParts: string[] = [];

        // 栈：追踪正在处理的标签层级
        const stack: Array<{
            tagNameLower: string;
            parser: ParserRegistration;
            openToken: Token;
            /** 收集标签内部内容 */
            contentParts: string[];
            /** 内部嵌套深度（防止同名标签嵌套导致的提前匹配） */
            nestingDepth: number;
        }> = [];

        for (const token of tokens) {
            // 获取当前栈顶（如果有）
            const top = stack.length > 0 ? stack[stack.length - 1] : null;

            if (token.type === 'open_tag') {
                const tagLower = token.value.toLowerCase();
                const parser = parserMap.get(tagLower);

                if (top) {
                    // 当已在某个标签块内部时
                    if (top.tagNameLower === tagLower) {
                        // 同名嵌套：增加深度计数
                        top.nestingDepth++;
                        top.contentParts.push(text.slice(token.start, token.end));
                    } else if (parser) {
                        // 异名的已注册标签：开启新的栈帧
                        stack.push({
                            tagNameLower: tagLower,
                            parser,
                            openToken: token,
                            contentParts: [],
                            nestingDepth: 0
                        });
                    } else {
                        // 无注册的标签：作为内容保留
                        top.contentParts.push(text.slice(token.start, token.end));
                    }
                } else if (parser) {
                    // 顶层的已注册标签：开启新的栈帧
                    stack.push({
                        tagNameLower: tagLower,
                        parser,
                        openToken: token,
                        contentParts: [],
                        nestingDepth: 0
                    });
                } else {
                    // 顶层未注册的标签：原样输出
                    outputParts.push(text.slice(token.start, token.end));
                }
            } else if (token.type === 'close_tag') {
                const tagLower = token.value.toLowerCase();

                if (top && top.tagNameLower === tagLower) {
                    if (top.nestingDepth > 0) {
                        // 闭合嵌套的同名标签
                        top.nestingDepth--;
                        top.contentParts.push(text.slice(token.start, token.end));
                    } else {
                        // 闭合当前栈顶标签
                        const finished = stack.pop()!;
                        const fullContent = finished.contentParts.join('');
                        const fullMatch = text.slice(finished.openToken.start, token.end);

                        const result = this.resolveTagOutput(finished.parser, fullContent, fullMatch, executeHandlers);

                        // 将结果推入父级（如果有）或顶层输出
                        if (stack.length > 0) {
                            stack[stack.length - 1].contentParts.push(result);
                        } else {
                            outputParts.push(result);
                        }
                    }
                } else {
                    // 没有匹配的开放标签：原样输出闭合标签
                    if (top) {
                        top.contentParts.push(text.slice(token.start, token.end));
                    } else {
                        outputParts.push(text.slice(token.start, token.end));
                    }
                }
            } else if (token.type === 'self_closing_tag') {
                const tagLower = token.value.toLowerCase();
                const parser = parserMap.get(tagLower);
                const fullMatch = text.slice(token.start, token.end);

                if (parser) {
                    const result = this.resolveTagOutput(parser, '', fullMatch, executeHandlers);
                    if (top) {
                        top.contentParts.push(result);
                    } else {
                        outputParts.push(result);
                    }
                } else {
                    // 无注册的自闭合标签：原样保留
                    if (top) {
                        top.contentParts.push(fullMatch);
                    } else {
                        outputParts.push(fullMatch);
                    }
                }
            } else {
                // text token
                if (top) {
                    top.contentParts.push(token.value);
                } else {
                    outputParts.push(token.value);
                }
            }
        }

        // 处理栈中残余的未闭合标签
        while (stack.length > 0) {
            const unclosed = stack.pop()!;
            const fullContent = unclosed.contentParts.join('');

            if (unclosed.parser.lifecycle === 'presentational') {
                // 展示型标签（如 <V>）：未闭合也应保留其原始标签头，供下游解析器（如 LVParser）处理流式内容
                const openTagStr = text.slice(unclosed.openToken.start, unclosed.openToken.end);
                const fullLiteral = openTagStr + fullContent;
                if (stack.length > 0) {
                    stack[stack.length - 1].contentParts.push(fullLiteral);
                } else {
                    outputParts.push(fullLiteral);
                }
            } else if (unclosed.parser.lifecycle === 'persistent') {
                // 持久型标签：剥离外壳，仅保留内部内容
                if (stack.length > 0) {
                    stack[stack.length - 1].contentParts.push(fullContent);
                } else {
                    outputParts.push(fullContent);
                }
            } else {
                // 临时/短暂型标签（如 <thinking>）：整块丢弃
                // 核心修复：如果模型被中断，或内容包含标签导致解析未闭合
                // 对于未闭合的 transient 标签，不论是执行提取还是非执行提取模式，
                // 由于它本身未闭合，直接吞噬后续所有内容风险极大，可能吞噬掉整个 Chat_Reply 的文本。
                // 因此针对未闭合的 transient 标签，我们选择剥离标签外壳让内部内容流出，
                // 以防止在获取 mesST 时因异常格式而导致 ST 侧截断和差异弹窗截断。
                if (stack.length > 0) {
                    stack[stack.length - 1].contentParts.push(fullContent);
                } else {
                    outputParts.unshift(fullContent);
                }
            }
        }

        return outputParts.join('');
    }

    /**
     * 根据生命周期决定标签块的输出结果
     */
    private resolveTagOutput(
        parser: ParserRegistration,
        content: string,
        fullMatch: string,
        executeHandlers: boolean
    ): string {
        // presentational 标签：无论如何都原样保留
        if (parser.lifecycle === 'presentational') {
            return fullMatch;
        }

        if (executeHandlers) {
            const handlerResult = parser.handler(content, fullMatch);
            if (typeof handlerResult === 'string') return handlerResult;
            // handler 未返回字符串：按默认规则
        }

        // 非执行模式下（流式中间态）
        if (!executeHandlers && parser.lifecycle === 'persistent') {
            return content; // 剥去外壳，保留内容
        }

        // 默认：transient/ephemeral 丢弃，persistent 在执行后也按 handler 结果决定
        return '';
    }

    // ──────────────────────────────────────────────
    // 辅助方法
    // ──────────────────────────────────────────────

    private isTagInStack(stack: string[], tagName: string): boolean {
        return stack.some(tag => tag.toLowerCase() === tagName.toLowerCase());
    }

    private popMatchingTag(stack: string[], tagName: string): void {
        const normalizedTag = tagName.toLowerCase();
        for (let index = stack.length - 1; index >= 0; index -= 1) {
            if (stack[index].toLowerCase() === normalizedTag) {
                stack.splice(index, 1);
                return;
            }
        }
    }

    private resolveActiveTag(stack: string[], lastMeaningfulTag: string | null): string | null {
        const activeTag = stack[stack.length - 1];
        if (activeTag) return activeTag;
        return lastMeaningfulTag;
    }

    private hasPresentationalInStack(stack: string[]): boolean {
        return stack.some(tagName => {
            const normalized = tagName.toLowerCase();
            return this.parsers.some(p => p.tagName?.toLowerCase() === normalized && p.lifecycle === 'presentational');
        });
    }

    private resolveStatusText(tagName: string | null): string {
        if (!tagName) {
            // 没有标签，可能是预思考导致模型回复没有 thinking 标签
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
            if (tag.tag.toLowerCase() === normalizedTag) return true;
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
    private registerDefaultParsers(): void {
        // 1. <thinking> (思维推演) - Transient
        this.registerXMLParser(BuiltinXMLTags.THINKING, 'transient', (_content) => {
            return ''; // 剥离并不显示内容
        });

        // 1.1 <Character_Action> (动作描述) - Transient [已废弃]
        this.registerXMLParser(BuiltinXMLTags.CHARACTER_ACTION, 'transient', (_content) => {
            return ''; // 强制剥离废弃标签
        });

        // 2. <Chat_Reply> (核心对话) - Persistent
        this.registerXMLParser(BuiltinXMLTags.CHAT_REPLY, 'persistent', (content) => {
            return content; // 剥去外壳，保留真实文本
        });

        // 3. <V> (LuminaView 展示块) - Presentational
        this.registerXMLParser(BuiltinXMLTags.VIEW, 'presentational', (_content) => {
            // presentational 标签不会执行此 handler
            // 在 resolveTagOutput 中已被拦截为原样保留
            return '';
        });
        
        // 4. <Story_Summary> (剧情概况) - Persistent
        this.registerXMLParser(BuiltinXMLTags.STORY_SUMMARY, 'persistent', (content) => {
            return content; // 剥去外壳，保留内容；后续由下游逻辑提取并更新至 mesSummary 字段
        });
    }
}

/**
 * 全局单例拦截器 (核心)
 */
export const globalXMLInterceptor = new XMLInterceptor();
