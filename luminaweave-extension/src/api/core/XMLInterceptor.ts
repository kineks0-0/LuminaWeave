import { globalXMLTagRegistry, type LifecycleType } from '../../../../shared/XMLTagRegistry.js';
import {
    BaseXMLInterceptor,
    BuiltinXMLTags as SharedBuiltinXMLTags,
    type StreamSemanticState,
    type StreamingPolicy
} from '@shared/BaseXMLInterceptor.js';
import { tokenize, extractBlocks, type Token, type TagBlock } from '@shared/TagTokenizer.js';

/**
 * 核心 XML 标签字典 (兼容导出)
 */
export const BuiltinXMLTags = SharedBuiltinXMLTags;

/**
 * 从 entry_update 内容中提取可读标题。
 * 支持 JSON（title/标题/name 字段）、YAML（title: 行）、TOML（title = 行）以及纯文本首行。
 */
function extractTitleFromEntryContent(content: string): string {
    const trimmed = content.trim();

    // JSON
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
            const obj = JSON.parse(trimmed);
            const src = Array.isArray(obj) ? obj[0] : obj;
            if (src && typeof src === 'object') {
                const t = src.title || src['标题'] || src.name || src.comment || src.description;
                if (t && typeof t === 'string') return t.trim();
            }
        } catch { /* ignore */ }
    }

    // YAML: `title: value` or `title: "value"`
    const yamlMatch = trimmed.match(/^title\s*:\s*["']?(.+?)["']?\s*$/im);
    if (yamlMatch) return yamlMatch[1].trim();

    // TOML: `title = "value"` or `title = 'value'`
    const tomlMatch = trimmed.match(/^title\s*=\s*["'](.+?)["']\s*$/im);
    if (tomlMatch) return tomlMatch[1].trim();

    // 纯文本：首行非空文本（最多 40 字）
    const firstLine = trimmed.split('\n').find(l => l.trim().length > 0) || '';
    return firstLine.slice(0, 40).trim();
}

export type InterceptorCallback = (tagContent: string, fullMatchText: string) => string | void;

export interface ParserRegistration {
    sourceId?: string;
    canonicalTag?: string;
    regex?: RegExp;
    lifecycle: LifecycleType;
    handler: InterceptorCallback;
}

export type { StreamSemanticState, LifecycleType };

/**
 * 核心 XML 拦截引擎
 *
 * 元数据来自 XMLTagRegistry，解析副作用由 handler 动态挂载。
 */
export class XMLInterceptor extends BaseXMLInterceptor {
    private extensionHandlers: ParserRegistration[] = [];
    private patternParsers: ParserRegistration[] = [];

    constructor() {
        super();
        this.registerDefaultExtensionParsers();
    }

    public registerXMLParser(
        tagName: string,
        lifecycle: LifecycleType,
        handler: InterceptorCallback,
        sourceId?: string
    ): void {
        const canonicalTag = globalXMLTagRegistry.resolveCanonical(tagName) || tagName;
        if (!globalXMLTagRegistry.getDefinition(canonicalTag)) {
            globalXMLTagRegistry.register({
                sourceId: sourceId || `xml-interceptor:${canonicalTag.toLowerCase()}`,
                tag: canonicalTag,
                lifecycle,
                exposeInProtocol: false
            });
        }
        this.registerHandler(canonicalTag, handler, sourceId);
        console.debug(`[XMLInterceptor] Registered extension parser for <${tagName}> (${lifecycle})`);
    }

    public registerHandler(canonicalTag: string, handler: InterceptorCallback, sourceId?: string): void {
        const normalizedCanonical = globalXMLTagRegistry.resolveCanonical(canonicalTag) || canonicalTag;
        const handlerSource = sourceId || `xml-handler:${normalizedCanonical.toLowerCase()}`;
        this.extensionHandlers = this.extensionHandlers.filter(item => !(item.sourceId === handlerSource && item.canonicalTag === normalizedCanonical));
        this.extensionHandlers.push({
            sourceId: handlerSource,
            canonicalTag: normalizedCanonical,
            lifecycle: this.getLifecycle(normalizedCanonical) || 'persistent',
            handler
        });
    }

    public unregisterHandler(canonicalTag: string, sourceId?: string): void {
        const normalizedCanonical = globalXMLTagRegistry.resolveCanonical(canonicalTag) || canonicalTag;
        this.extensionHandlers = this.extensionHandlers.filter(item => {
            if (item.canonicalTag !== normalizedCanonical) return true;
            if (!sourceId) return false;
            return item.sourceId !== sourceId;
        });
    }

    public registerPatternParser(
        regex: RegExp,
        lifecycle: LifecycleType,
        handler: InterceptorCallback
    ): void {
        this.patternParsers.push({ regex, lifecycle, handler });
        console.debug(`[XMLInterceptor] Registered pattern parser: ${regex.source}`);
    }

    public unregisterXMLParser(tagName: string): void {
        const canonicalTag = globalXMLTagRegistry.resolveCanonical(tagName) || tagName;
        this.extensionHandlers = this.extensionHandlers.filter(item => item.canonicalTag !== canonicalTag);
    }

    public override deriveStreamState(
        rawText: string,
        policyOrFilter: StreamingPolicy | boolean,
        argAllowTopLevel?: boolean,
        argImplicitThinking?: boolean,
        argAggressiveThinking?: boolean
    ): StreamSemanticState {
        const state = super.deriveStreamState(rawText, policyOrFilter, argAllowTopLevel, argImplicitThinking, argAggressiveThinking);
        const filterChatReply = typeof policyOrFilter === 'boolean' ? policyOrFilter : (policyOrFilter.filterChatReply ?? false);

        if (filterChatReply !== false) {
            const resolvedStatusText = this.resolveExtensionStatusText(state.activeTag, state.displayText.length > 0);
            state.statusText = state.activeTag ? resolvedStatusText : (state.statusText || resolvedStatusText);
        }

        const forgeTags = ['forge_skill', 'draft_plan', 'entry_update'];
        if (state.activeTag && forgeTags.includes(state.activeTag.toLowerCase())) {
            (window as any).LuminaWeave?.emit('FORGE_TRACE', {
                tag: state.activeTag,
                status: state.statusText,
                timestamp: Date.now()
            });
        }

        return state;
    }

    public processAndCleanText(rawText: string, executeHandlers: boolean = true): string {
        if (!rawText) return '';

        let cleanText = executeHandlers
            ? this.processXMLWithHandlers(rawText)
            : this.cleanText(rawText, { allowTopLevel: true });

        for (const reg of this.patternParsers) {
            cleanText = cleanText.replace(reg.regex!, (matchSubString: string, capturedContent: string) => {
                let handlerResult: string | void = undefined;
                if (executeHandlers) {
                    const content = capturedContent !== undefined ? capturedContent : matchSubString;
                    handlerResult = reg.handler(content, matchSubString);
                } else if (reg.lifecycle === 'persistent') {
                    return capturedContent !== undefined ? capturedContent : matchSubString;
                }
                return typeof handlerResult === 'string' ? handlerResult : '';
            });
        }

        return cleanText.trim();
    }

    private resolveExtensionStatusText(tagName: string | null, hasDisplayText: boolean): string {
        const normalizedTag = globalXMLTagRegistry.resolveCanonical(tagName || '')?.toLowerCase();
        if (hasDisplayText && (normalizedTag === 'thinking' || normalizedTag === 'think' || !normalizedTag)) {
            return '回复中...';
        }

        if (!normalizedTag) return hasDisplayText ? '回复中...' : '';

        const registryTag = globalXMLTagRegistry.getDefinition(normalizedTag);
        if (registryTag?.statusText) return registryTag.statusText;

        return super.resolveStatusText(tagName, hasDisplayText);
    }

    private processXMLWithHandlers(text: string): string {
        const tokens = tokenize(text);
        const outputParts: string[] = [];
        const stack: Array<{
            tagNameLower: string;
            openToken: Token;
            contentParts: string[];
            nestingDepth: number;
        }> = [];

        for (const token of tokens) {
            const top = stack.length > 0 ? stack[stack.length - 1] : null;

            if (token.type === 'open_tag') {
                const canonicalTag = this.resolveCanonicalTag(token.value);
                const lifecycle = this.getLifecycle(canonicalTag);

                if (top) {
                    if (canonicalTag && top.tagNameLower === canonicalTag) {
                        top.nestingDepth++;
                        top.contentParts.push(text.slice(token.start, token.end));
                    } else if (lifecycle && canonicalTag) {
                        stack.push({ tagNameLower: canonicalTag, openToken: token, contentParts: [], nestingDepth: 0 });
                    } else {
                        top.contentParts.push(text.slice(token.start, token.end));
                    }
                } else if (lifecycle && canonicalTag) {
                    stack.push({ tagNameLower: canonicalTag, openToken: token, contentParts: [], nestingDepth: 0 });
                } else {
                    outputParts.push(text.slice(token.start, token.end));
                }
            } else if (token.type === 'close_tag') {
                const canonicalTag = this.resolveCanonicalTag(token.value);
                if (canonicalTag && top && top.tagNameLower === canonicalTag) {
                    if (top.nestingDepth > 0) {
                        top.nestingDepth--;
                        top.contentParts.push(text.slice(token.start, token.end));
                    } else {
                        const finished = stack.pop()!;
                        const content = finished.contentParts.join('');
                        const fullMatch = text.slice(finished.openToken.start, token.end);
                        const lifecycle = this.getLifecycle(canonicalTag);
                        const result = this.resolveExtensionTagOutput(canonicalTag, lifecycle!, content, fullMatch);

                        if (stack.length > 0) stack[stack.length - 1].contentParts.push(result);
                        else outputParts.push(result);
                    }
                } else if (top) {
                    top.contentParts.push(text.slice(token.start, token.end));
                } else {
                    outputParts.push(text.slice(token.start, token.end));
                }
            } else if (token.type === 'self_closing_tag') {
                const canonicalTag = this.resolveCanonicalTag(token.value);
                const lifecycle = this.getLifecycle(canonicalTag);
                if (lifecycle && canonicalTag) {
                    const result = this.resolveExtensionTagOutput(canonicalTag, lifecycle, '', text.slice(token.start, token.end));
                    if (top) top.contentParts.push(result);
                    else outputParts.push(result);
                } else {
                    const fullMatch = text.slice(token.start, token.end);
                    if (top) top.contentParts.push(fullMatch);
                    else outputParts.push(fullMatch);
                }
            } else if (top) {
                top.contentParts.push(token.value);
            } else {
                outputParts.push(token.value);
            }
        }

        while (stack.length > 0) {
            const unclosed = stack.pop()!;
            const content = unclosed.contentParts.join('');
            const lifecycle = this.getLifecycle(unclosed.tagNameLower);
            if (lifecycle === 'presentational') {
                const result = text.slice(unclosed.openToken.start, unclosed.openToken.end) + content;
                if (stack.length > 0) stack[stack.length - 1].contentParts.push(result);
                else outputParts.push(result);
            } else {
                if (stack.length > 0) stack[stack.length - 1].contentParts.push(content);
                else outputParts.push(content);
            }
        }

        return outputParts.join('');
    }

    private resolveExtensionTagOutput(tagName: string, lifecycle: LifecycleType, content: string, fullMatch: string): string {
        if (lifecycle === 'presentational') return fullMatch;

        const canonicalTag = globalXMLTagRegistry.resolveCanonical(tagName) || tagName;
        const registration = [...this.extensionHandlers].reverse().find(item => item.canonicalTag === canonicalTag);
        if (registration) {
            const result = registration.handler(content, fullMatch);
            if (typeof result === 'string') return result;
        }

        return lifecycle === 'persistent' ? content : '';
    }

    private parseAttributes(xmlOpenTag: string): Record<string, string> {
        const attributes: Record<string, string> = {};
        const attributeRegex = /([a-zA-Z_][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;
        let match: RegExpExecArray | null = null;
        while ((match = attributeRegex.exec(xmlOpenTag)) !== null) {
            attributes[match[1]] = match[2] ?? match[3] ?? match[4] ?? '';
        }
        return attributes;
    }

    public static override extractTagContent(text: string, tagName: string): string[] {
        const definition = globalXMLTagRegistry.getDefinition(tagName);
        const canonicalTag = definition?.tag || tagName;
        const targetTags = new Set([canonicalTag.toLowerCase()]);
        for (const alias of definition?.aliases || []) {
            targetTags.add(alias.toLowerCase());
        }

        return extractBlocks(text, targetTags).map((block: TagBlock) => block.content);
    }

    private registerDefaultExtensionParsers(): void {
        this.registerXMLParser(BuiltinXMLTags.THINKING, 'transient', () => '', 'core-thinking-handler');
        this.registerXMLParser(BuiltinXMLTags.CHAT_REPLY, 'persistent', (content) => content, 'core-chat-reply-handler');
        this.registerXMLParser(BuiltinXMLTags.CHARACTER_ACTION, 'transient', () => '', 'core-character-action-handler');
        this.registerXMLParser(BuiltinXMLTags.STORY_SUMMARY, 'persistent', (content) => content, 'core-story-summary-handler');
        this.registerXMLParser(BuiltinXMLTags.VIEW, 'presentational', () => '', 'core-view-handler');

        this.registerXMLParser(BuiltinXMLTags.FORGE_SKILL, 'transient', (content, fullMatch) => {
            (window as any).LuminaWeave?.emit('FORGE_ACTION_COMPLETED', { type: 'skill', content, raw: fullMatch });
            return '';
        }, 'core-forge-skill-handler');
        this.registerXMLParser(BuiltinXMLTags.DRAFT_PLAN, 'ephemeral', (content, fullMatch) => {
            (window as any).LuminaWeave?.emit('FORGE_ACTION_COMPLETED', { type: 'plan', content, raw: fullMatch });
            return '';
        }, 'core-draft-plan-handler');
        this.registerXMLParser(BuiltinXMLTags.ENTRY_UPDATE, 'persistent', (content, fullMatch) => {
            (window as any).LuminaWeave?.emit('FORGE_ACTION_COMPLETED', { type: 'update', content, raw: fullMatch });
            const attrs = this.parseAttributes(fullMatch);
            const id = attrs.id || attrs.entry_id || `new_entry_${Date.now().toString(36)}`;
            const category = attrs.type || attrs.category || '';
            // title 优先取 XML 属性，其次从内容中提取（支持 JSON / YAML / TOML）
            const titleFromAttrs = attrs.title || attrs.description || '';
            const title = titleFromAttrs || extractTitleFromEntryContent(content) || id;
            return `<V>ForgeEntryProposal(${JSON.stringify(id)}, ${JSON.stringify(title)}, ${JSON.stringify(content)}, ${JSON.stringify(category)})</V>`;
        }, 'core-entry-update-handler');

        this.registerXMLParser((BuiltinXMLTags as any).FORGE_AUTO_LIST || 'forge_auto_list', 'persistent', (content, fullMatch) => {
            const escaped = content.replace(/`/g, '\\`').replace(/\$/g, '\\$');
            return `<V>ForgeAutoList(\`${escaped}\`)</V>`;
        }, 'core-forge-auto-list-handler');

        this.registerXMLParser(BuiltinXMLTags.MEMORY_UPDATE, 'ephemeral', (content, fullMatch) => {
            (window as any).LuminaWeave?.emit('FORGE_ACTION_COMPLETED', { type: 'memory', content, raw: fullMatch });
            const attrs = this.parseAttributes(fullMatch);
            const path = attrs.path || 'Forge Memory';
            const title = attrs.title || path.split('/').slice(-1)[0] || 'Memory Update';
            const escaped = content.replace(/`/g, '\\`').replace(/\$/g, '\\$');
            return `<V>ForgeMemoryProposal("${path}", "${title}", \`${escaped}\`)</V>`;
        }, 'core-memory-update-handler');
    }
}

export const globalXMLInterceptor = new XMLInterceptor();
