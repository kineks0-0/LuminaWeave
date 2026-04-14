import { tokenize, extractBlocks, detectTrailingPartialTag, type Token } from './TagTokenizer.js';
import {
    CoreXMLTagNames,
    globalXMLTagRegistry,
    type LifecycleType,
    type XMLTagDefinition
} from './XMLTagRegistry.js';

/**
 * 内置核心 XML 标签字典
 */
export const BuiltinXMLTags = {
    ...CoreXMLTagNames,
    MUTATION: 'Mutation'
} as const;

export interface ParserRegistration {
    tagName: string;
    lifecycle: LifecycleType;
}

export interface StreamingPolicy {
    filterChatReply?: boolean;      // 仅输出 Chat_Reply 内容 (流式过滤)
    allowTopLevel?: boolean;        // 展示非标签正文 (顶层文本保护)
    implicitThinking?: boolean;     // 起始非标签内容视为思考 (thinking)
    aggressiveThinking?: boolean;   // 激进模式：强制过滤直到首个 </thinking> 结束
}

export interface StreamSemanticState {
    rawText: string;
    displayText: string;
    filteredCount: number;
    statusText: string;
    activeTag: string | null;
    thinkingText: string;
}

/**
 * 共享的基础 XML 拦截逻辑
 * 不包含 UI 状态推导（如状态文本的具体解析）或外部单例依赖
 */
export class BaseXMLInterceptor {
    constructor() {}

    /**
     * 注册一个新的标签处理器
     */
    public registerParser(tagName: string, lifecycle: LifecycleType) {
        globalXMLTagRegistry.register({
            sourceId: `base-parser:${tagName.toLowerCase()}`,
            tag: tagName,
            lifecycle,
            exposeInProtocol: false,
            promptContexts: this.getTagDefinition(tagName)?.promptContexts
        });
    }

    /**
     * 标记特定标签在流式输出中不可见（即使是 persistent 也会被过滤）
     */
    public setTagHiddenFromUI(tagName: string, hidden: boolean = true) {
        const activeDefinition = this.getTagDefinition(tagName);
        globalXMLTagRegistry.register({
            sourceId: `base-ui-hidden:${tagName.toLowerCase()}`,
            tag: activeDefinition?.tag || tagName,
            aliases: activeDefinition?.aliases,
            lifecycle: activeDefinition?.lifecycle || 'persistent',
            description: activeDefinition?.description,
            statusText: activeDefinition?.statusText,
            anchor: activeDefinition?.anchor,
            position: activeDefinition?.position,
            priority: activeDefinition?.priority,
            parent: activeDefinition?.parent,
            exposeInProtocol: activeDefinition?.exposeInProtocol,
            promptContexts: activeDefinition?.promptContexts,
            uiHidden: hidden
        });
    }

    /**
     * 清洗文本：根据生命周期和策略移除或保留标签内容
     */
    public cleanText(text: string, policy?: StreamingPolicy): string {
        if (!text) return '';

        const filterChatReply = policy?.filterChatReply ?? false;
        const allowTopLevel = policy?.allowTopLevel ?? true;
        const implicitThinking = policy?.implicitThinking ?? false;
        const aggressiveThinking = policy?.aggressiveThinking ?? false;

        const tokens = tokenize(text);
        
        // 激进模式预扫描：只寻找首个 </thinking> 的 token 索引
        let firstThinkingCloseIdx = -1;
        if (aggressiveThinking) {
            for (let i = 0; i < tokens.length; i++) {
                if (tokens[i].type === 'close_tag' && this.resolveCanonicalTag(tokens[i].value) === BuiltinXMLTags.THINKING) {
                    firstThinkingCloseIdx = i;
                    break;
                }
            }
        }

        const outputParts: string[] = [];
        const stack: Array<{
            tagNameLower: string;
            lifecycle: LifecycleType;
            openToken: Token;
            contentParts: string[];
            nestingDepth: number;
        }> = [];

        let hasEncounteredTag = false;

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const top = stack.length > 0 ? stack[stack.length - 1] : null;

            if (token.type === 'open_tag') {
                const canonicalTag = this.resolveCanonicalTag(token.value);
                const lifecycle = canonicalTag ? this.getLifecycle(canonicalTag) : undefined;
                hasEncounteredTag = true;

                // 激进模式判断：如果在首个 </thinking> 之前（含），所有注册标签视为 transient（除非是现状展示类）
                const isAggressiveHidden = aggressiveThinking && firstThinkingCloseIdx !== -1 && i <= firstThinkingCloseIdx;

                if (top) {
                    if (canonicalTag && top.tagNameLower === canonicalTag) {
                        top.nestingDepth++;
                        top.contentParts.push(text.slice(token.start, token.end));
                    } else if (lifecycle) {
                        stack.push({
                            tagNameLower: canonicalTag!,
                            lifecycle,
                            openToken: token,
                            contentParts: [],
                            nestingDepth: 0
                        });
                    } else {
                        top.contentParts.push(text.slice(token.start, token.end));
                    }
                } else if (lifecycle && canonicalTag) {
                    // 如果在激进隐藏区，且不是 presentational，则强制按 transient 处理（即不放入 stack，从而不产生输出）
                    const effectiveLifecycle = isAggressiveHidden && lifecycle !== 'presentational' ? 'transient' : lifecycle;
                    
                    if (effectiveLifecycle === 'transient' || effectiveLifecycle === 'ephemeral') {
                        // 依然推入 stack 以便正确处理嵌套，但 resolveOutput 会处理隐藏
                         stack.push({
                            tagNameLower: canonicalTag,
                            lifecycle: effectiveLifecycle,
                            openToken: token,
                            contentParts: [],
                            nestingDepth: 0
                        });
                    } else {
                        stack.push({
                            tagNameLower: canonicalTag,
                            lifecycle: effectiveLifecycle,
                            openToken: token,
                            contentParts: [],
                            nestingDepth: 0
                        });
                    }
                } else {
                    // 未注册标签
                    if (allowTopLevel) {
                        outputParts.push(text.slice(token.start, token.end));
                    }
                }
            } else if (token.type === 'close_tag') {
                const canonicalTag = this.resolveCanonicalTag(token.value);
                hasEncounteredTag = true;

                if (canonicalTag && top && top.tagNameLower === canonicalTag) {
                    if (top.nestingDepth > 0) {
                        top.nestingDepth--;
                        top.contentParts.push(text.slice(token.start, token.end));
                    } else {
                        const finished = stack.pop()!;
                        const content = finished.contentParts.join('');
                        const result = this.resolveOutput(finished.lifecycle, content, text.slice(finished.openToken.start, token.end));

                        if (stack.length > 0) {
                            stack[stack.length - 1].contentParts.push(result);
                        } else {
                            outputParts.push(result);
                        }
                    }
                } else {
                    if (top) {
                        top.contentParts.push(text.slice(token.start, token.end));
                    } else if (allowTopLevel) {
                        outputParts.push(text.slice(token.start, token.end));
                    }
                }
            } else if (token.type === 'self_closing_tag') {
                const canonicalTag = this.resolveCanonicalTag(token.value);
                const lifecycle = canonicalTag ? this.getLifecycle(canonicalTag) : undefined;
                const fullMatch = text.slice(token.start, token.end);
                hasEncounteredTag = true;

                if (lifecycle === 'presentational') {
                    if (top) top.contentParts.push(fullMatch);
                    else outputParts.push(fullMatch);
                } else if (allowTopLevel && !lifecycle) {
                    if (top) top.contentParts.push(fullMatch);
                    else outputParts.push(fullMatch);
                }
            } else {
                // text
                // 隐式思考逻辑：首个标签前的内容视为思考则隐藏
                const isAggressiveHidden = aggressiveThinking && firstThinkingCloseIdx !== -1 && i <= firstThinkingCloseIdx;
                const isImplicitHidden = (implicitThinking && !hasEncounteredTag) || isAggressiveHidden;
                
                if (top) {
                    top.contentParts.push(token.value);
                } else if (allowTopLevel && !isImplicitHidden) {
                    outputParts.push(token.value);
                }
            }
        }

        // 处理未闭合标签
        while (stack.length > 0) {
            const unclosed = stack.pop()!;
            const content = unclosed.contentParts.join('');
            if (unclosed.lifecycle === 'presentational') {
                const full = text.slice(unclosed.openToken.start, unclosed.openToken.end) + content;
                if (stack.length > 0) stack[stack.length - 1].contentParts.push(full);
                else outputParts.push(full);
            } else if (unclosed.lifecycle === 'persistent') {
                if (stack.length > 0) stack[stack.length - 1].contentParts.push(content);
                else outputParts.push(content);
            } else {
                // 对于未闭合的 transient/ephemeral 标签，在持久化提纯模式下应当丢弃其内容
                // 这保证了如果模型在思考中途断开，mesRaw 中不会包含残缺的思考片段
                if (stack.length > 0) {
                    // 如果处于嵌套中，由于外层生命周期不明，保守起见仍让内容流出
                    stack[stack.length - 1].contentParts.push(content);
                } else {
                    // 如果是顶层未闭合的 transient/ephemeral，则直接丢弃
                    // (不再执行 outputParts.push(content))
                }
            }
        }

        return outputParts.join('').trim();
    }

    /**
     * 流式状态推导 (后端共用版)
     * 支持对象参数 (StreamingPolicy) 或 旧版位移参数 (filterChatReply, allowTopLevel, ...)
     */
    public deriveStreamState(
        rawText: string, 
        policyOrFilter: StreamingPolicy | boolean, 
        argAllowTopLevel?: boolean, 
        argImplicitThinking?: boolean, 
        argAggressiveThinking?: boolean
    ): StreamSemanticState {
        if (!rawText) {
            return { rawText: '', displayText: '', filteredCount: 0, statusText: '', activeTag: null, thinkingText: '' };
        }

        // 参数归一化
        let policy: StreamingPolicy;
        if (typeof policyOrFilter === 'boolean') {
            policy = {
                filterChatReply: policyOrFilter,
                allowTopLevel: argAllowTopLevel ?? true,
                implicitThinking: argImplicitThinking ?? false,
                aggressiveThinking: argAggressiveThinking ?? false
            };
        } else {
            policy = policyOrFilter;
        }

        const { filterChatReply, allowTopLevel, implicitThinking, aggressiveThinking } = policy;

        // 核心修复：只要 filterChatReply 为 false，且没有任何其他隐藏标记 (thinking 等) 被强制开启，则不应执行任何过滤
        // 如果用户显式禁用了过滤网关，我们尊重其意愿返回原始文本
        if (filterChatReply === false) {
            return {
                rawText,
                displayText: rawText,
                filteredCount: 0,
                statusText: '',
                activeTag: null,
                thinkingText: this.extractThinkingText(rawText)
            };
        }

        const tokens = tokenize(rawText);
        
        // 激进模式预扫描：只寻找首个 </thinking> 的 token 索引
        let firstThinkingCloseIdx = -1;
        if (aggressiveThinking) {
            for (let i = 0; i < tokens.length; i++) {
                if (tokens[i].type === 'close_tag' && this.resolveCanonicalTag(tokens[i].value) === BuiltinXMLTags.THINKING) {
                    firstThinkingCloseIdx = i;
                    break;
                }
            }
        }

        const stack: string[] = [];
        const displayParts: string[] = [];
        let lastMeaningfulTag: string | null = null;
        let hasEncounteredTag = false;

        // 1. 预扫描：检测是否存在孤立的 transient 闭合标签
        const orphanTransientCloseIndices = new Set<number>();
        const tempStack: string[] = [];
        for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i];
            if (t.type === 'open_tag') {
                const canonicalOpenTag = this.resolveCanonicalTag(t.value) || t.value.toLowerCase();
                tempStack.push(canonicalOpenTag.toLowerCase());
            } else if (t.type === 'close_tag') {
                const tagName = (this.resolveCanonicalTag(t.value) || t.value).toLowerCase();
                const foundIdx = tempStack.lastIndexOf(tagName);
                if (foundIdx !== -1) {
                    tempStack.splice(foundIdx, 1);
                } else {
                    const lc = this.getLifecycle(tagName);
                    if (lc === 'transient' || lc === 'ephemeral') {
                        orphanTransientCloseIndices.add(i);
                    }
                }
            }
        }

        // 2. 隐式起始处理
        let activeImplicitThinking = false;
        if (implicitThinking && tokens.length > 0 && tokens[0].type === 'text') {
            activeImplicitThinking = true;
            stack.push(BuiltinXMLTags.THINKING);
        }

        const isCurrentlyHidden = () => {
            return stack.some(tag => {
                const lc = this.getLifecycle(tag);
                return lc === 'transient' || lc === 'ephemeral';
            });
        };

        const hasDisplayPersistentInStack = () => {
            return stack.some(tag => {
                if (this.isTagHiddenFromUI(tag)) return false;
                const definition = this.getTagDefinition(tag);
                if (definition?.tag !== BuiltinXMLTags.CHAT_REPLY && definition?.anchor === BuiltinXMLTags.CHAT_REPLY && definition?.position === 'before') {
                    return false;
                }
                return this.getLifecycle(tag) === 'persistent';
            });
        };

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const rawTagStr = rawText.slice(token.start, token.end);
            const tagName = token.value?.toLowerCase();
                const canonicalTag = this.resolveCanonicalTag(token.value);
                const lifecycle = canonicalTag ? this.getLifecycle(canonicalTag) : null;

            if (token.type === 'text') {
                const inPersistent = hasDisplayPersistentInStack();
                const inPresentational = stack.some(t => this.getLifecycle(t) === 'presentational');
                const inHidden = isCurrentlyHidden();
                const isTopLevel = stack.length === 0;

                let isPreOrphanZone = false;
                if (isTopLevel && allowTopLevel && orphanTransientCloseIndices.size > 0) {
                    for (const orphanIdx of orphanTransientCloseIndices) {
                        if (orphanIdx > i) {
                            isPreOrphanZone = true;
                            break;
                        }
                    }
                }

                const isAggressiveHidden = aggressiveThinking && firstThinkingCloseIdx !== -1 && i <= firstThinkingCloseIdx;

                // 核心过滤逻辑：只有满足显示条件且不在隐藏区时才展示
                const shouldShow = (inPersistent || inPresentational || (isTopLevel && allowTopLevel && !isPreOrphanZone)) && !inHidden && !isAggressiveHidden;

                if (shouldShow) {
                    const partialTag = detectTrailingPartialTag(token.value);
                    if (partialTag !== null) {
                        const ltIndex = token.value.lastIndexOf('<');
                        displayParts.push(token.value.slice(0, ltIndex));
                    } else {
                        displayParts.push(token.value);
                    }
                }
            } else if (token.type === 'open_tag') {
                hasEncounteredTag = true;
                if (activeImplicitThinking) {
                    let hasImplicitClose = false;
                    for (const orphanIdx of orphanTransientCloseIndices) {
                        if (orphanIdx > i && tokens[orphanIdx].value?.toLowerCase() === BuiltinXMLTags.THINKING) {
                            hasImplicitClose = true;
                            break;
                        }
                    }
                    if (!hasImplicitClose) {
                        activeImplicitThinking = false;
                        this.popMatchingTag(stack, BuiltinXMLTags.THINKING);
                    }
                }
                stack.push(canonicalTag || token.value);
                lastMeaningfulTag = canonicalTag || token.value;
                if (lifecycle === 'presentational' && !isCurrentlyHidden()) {
                    displayParts.push(rawTagStr);
                }
            } else if (token.type === 'close_tag') {
                hasEncounteredTag = true;
                const normalizedCloseTag = canonicalTag || token.value;
                const isThinkingClose = normalizedCloseTag === BuiltinXMLTags.THINKING;
                if (activeImplicitThinking && isThinkingClose) {
                    activeImplicitThinking = false;
                    this.popMatchingTag(stack, BuiltinXMLTags.THINKING);
                } else {
                    if (activeImplicitThinking) {
                         let hasImplicitClose = false;
                         for (const orphanIdx of orphanTransientCloseIndices) {
                             if (orphanIdx > i && tokens[orphanIdx].value?.toLowerCase() === BuiltinXMLTags.THINKING) {
                                 hasImplicitClose = true;
                                 break;
                             }
                         }
                         if (!hasImplicitClose) {
                             activeImplicitThinking = false;
                             this.popMatchingTag(stack, BuiltinXMLTags.THINKING);
                         }
                    }
                    this.popMatchingTag(stack, normalizedCloseTag);
                }
                lastMeaningfulTag = normalizedCloseTag;
                if (lifecycle === 'presentational' && !isCurrentlyHidden()) {
                    displayParts.push(rawTagStr);
                }
            } else if (token.type === 'self_closing_tag') {
                hasEncounteredTag = true;
                lastMeaningfulTag = canonicalTag || token.value;
                if (lifecycle === 'presentational' && !isCurrentlyHidden()) {
                    displayParts.push(rawTagStr);
                }
            }
        }

        const activeTag = stack.length > 0 ? (stack[stack.length - 1] || null) : null;
        const residualStatusTag = !activeTag && lastMeaningfulTag && this.isTagHiddenFromUI(lastMeaningfulTag)
            ? lastMeaningfulTag
            : null;
        const displayText = displayParts.join('');

        return {
            rawText,
            displayText,
            filteredCount: Math.max(0, rawText.length - displayText.length),
            statusText: this.resolveStatusText(activeTag || residualStatusTag, displayText.length > 0),
            activeTag,
            thinkingText: this.extractThinkingText(rawText)
        };
    }

    protected resolveStatusText(tagName: string | null, hasDisplayText: boolean): string {
        const canonicalTag = this.resolveCanonicalTag(tagName);
        const tagLower = canonicalTag?.toLowerCase();
        
        // 核心修正：只有在当前没有明确业务标签（或处于思考中）时，才根据是否有可见正文强制显示为“回复中”
        if (hasDisplayText && (!tagLower || tagLower === 'thinking' || tagLower === 'think')) {
            return '回复中...';
        }

        if (!tagName) return hasDisplayText ? '回复中...' : '';
        
        if (tagLower === 'thinking' || tagLower === 'think') return '思考中...';
        const statusText = canonicalTag ? this.getTagDefinition(canonicalTag)?.statusText : undefined;
        if (statusText) return statusText;
        
        return `${tagName}处理中..`;
    }

    protected popMatchingTag(stack: string[], tagName: string): void {
        const normalizedTag = this.resolveCanonicalTag(tagName) || tagName.toLowerCase();
        for (let index = stack.length - 1; index >= 0; index -= 1) {
            if (stack[index].toLowerCase() === normalizedTag.toLowerCase()) {
                stack.splice(index);
                return;
            }
        }
    }

    private resolveOutput(lifecycle: LifecycleType, content: string, fullMatch: string): string {
        switch (lifecycle) {
            case 'presentational': return fullMatch;
            case 'persistent': return content;
            case 'transient':
            case 'ephemeral':
            default: return '';
        }
    }

    /**
     * 静态提取工具
     */
    public static extractTagContent(text: string, tagName: string): string[] {
        const definition = globalXMLTagRegistry.getDefinition(tagName);
        const canonicalTag = definition?.tag || tagName;
        const targetTags = new Set([canonicalTag.toLowerCase()]);
        for (const alias of definition?.aliases || []) {
            targetTags.add(alias.toLowerCase());
        }
        return extractBlocks(text, targetTags).map(b => b.content);
    }

    /**
     * 获取指定生命周期的所有标签名
     */
    public getTagsByLifecycle(lifecycles: LifecycleType[]): string[] {
        return globalXMLTagRegistry.getAllDefinitions()
            .filter(definition => lifecycles.includes(definition.lifecycle))
            .map(definition => definition.tag);
    }

    protected getTagDefinition(tagName: string | null | undefined): XMLTagDefinition | undefined {
        return globalXMLTagRegistry.getDefinition(tagName);
    }

    protected resolveCanonicalTag(tagName: string | null | undefined): string | null {
        if (!tagName) return null;
        return globalXMLTagRegistry.resolveCanonical(tagName) || tagName.toLowerCase();
    }

    protected getLifecycle(tagName: string | null | undefined): LifecycleType | undefined {
        return this.getTagDefinition(tagName)?.lifecycle;
    }

    protected isTagHiddenFromUI(tagName: string | null | undefined): boolean {
        return Boolean(this.getTagDefinition(tagName)?.uiHidden);
    }

    protected extractThinkingText(rawText: string): string {
        const tokens = tokenize(rawText);
        const thinkingBlocks: string[] = [];
        const thinkingStack: Token[] = [];
        let capturedLoosePrelude = false;
        let capturedExplicitBlock = false;

        for (const token of tokens) {
            const canonicalTag = this.resolveCanonicalTag(token.value);
            const isThinkingTag = canonicalTag === BuiltinXMLTags.THINKING;

            if (!isThinkingTag) {
                continue;
            }

            if (token.type === 'open_tag') {
                thinkingStack.push(token);
                continue;
            }

            if (token.type === 'close_tag') {
                if (thinkingStack.length > 0) {
                    const openToken = thinkingStack.pop()!;
                    const content = rawText.slice(openToken.end, token.start).trim();
                    if (content) {
                        thinkingBlocks.push(content);
                    }
                    capturedExplicitBlock = true;
                    continue;
                }

                if (!capturedExplicitBlock && !capturedLoosePrelude) {
                    const loosePrelude = rawText.slice(0, token.start).trim();
                    if (loosePrelude) {
                        thinkingBlocks.push(loosePrelude);
                    }
                    capturedLoosePrelude = true;
                }
            }
        }

        while (thinkingStack.length > 0) {
            const openToken = thinkingStack.shift()!;
            const content = rawText.slice(openToken.end).trim();
            if (content) {
                thinkingBlocks.push(content);
            }
        }

        return thinkingBlocks.join('\n\n');
    }
}
