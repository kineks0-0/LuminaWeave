import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest';
import { XMLInterceptor, BuiltinXMLTags } from '../XMLInterceptor';
import { globalPromptRegistry, PromptSlot, STIdentifier } from '../PromptRegistry';
import { globalXMLTagRegistry } from '../../../../../shared/XMLTagRegistry.js';

describe('XMLInterceptor stream semantics', () => {
    it('should derive stable prelude and reply states from the same raw buffer', () => {
        const interceptor = new XMLInterceptor();
        const thinkState = interceptor.deriveStreamState('<think>abc', true);
        const actionState = interceptor.deriveStreamState('<think>abc</think><Character_Action>挥剑', true);
        const replyState = interceptor.deriveStreamState('<think>abc</think><Character_Action>挥剑</Character_Action><Chat_Reply>你好', true);

        expect(thinkState).toMatchObject({
            displayText: '',
            statusText: '思考中...',
            filteredCount: '<think>abc'.length,
            thinkingText: 'abc'
        });
        expect(actionState).toMatchObject({
            displayText: '',
            statusText: '行动中...',
            filteredCount: '<think>abc</think><Character_Action>挥剑'.length
        });
        expect(replyState).toMatchObject({
            displayText: '你好',
            statusText: '回复中...',
            filteredCount: '<think>abc</think><Character_Action>挥剑</Character_Action><Chat_Reply>你好'.length - '你好'.length
        });
    });

    it('should stop reporting thinking state after an explicit closing tag', () => {
        const interceptor = new XMLInterceptor();
        const state = interceptor.deriveStreamState('<thinking>先想一下</thinking>', true);

        expect(state.displayText).toBe('');
        expect(state.activeTag).toBeNull();
        expect(state.statusText).toBe('');
        expect(state.thinkingText).toBe('先想一下');
    });

    it('should not append post-thinking reply content into thinkingText after duplicate closing tags', () => {
        const interceptor = new XMLInterceptor();
        const state = interceptor.deriveStreamState('<thinking>先想一下</thinking><Chat_Reply>正常回复</Chat_Reply></thinking>', true);

        expect(state.displayText).toBe('正常回复');
        expect(state.thinkingText).toBe('先想一下');
    });

    it('should use the first closing thinking tag as aggressive boundary', () => {
        const interceptor = new XMLInterceptor();
        const state = interceptor.deriveStreamState('<thinking>分析</thinking>正文', {
            filterChatReply: true,
            allowTopLevel: true,
            implicitThinking: false,
            aggressiveThinking: true
        });

        expect(state.displayText).toBe('正文');
        expect(state.statusText).toBe('回复中...');
    });

    it('should drop trailing partial tags from filtered reply text', () => {
        const interceptor = new XMLInterceptor();
        const raw = '<think>abc</think><Chat_Reply>Hello<Cha';
        const state = interceptor.deriveStreamState(raw, true);

        expect(state.displayText).toBe('Hello');
        expect(state.statusText).toBe('回复中...');
        expect(state.filteredCount).toBe(raw.length - 'Hello'.length);
    });

    it('should drop trailing "<" or "</" fragments from filtered reply text', () => {
        const interceptor = new XMLInterceptor();

        const raw1 = '<think>abc</think><Chat_Reply>Hello<';
        const state1 = interceptor.deriveStreamState(raw1, true);
        expect(state1.displayText).toBe('Hello');

        const raw2 = '<think>abc</think><Chat_Reply>Hello</';
        const state2 = interceptor.deriveStreamState(raw2, true);
        expect(state2.displayText).toBe('Hello');
    });

    it('should drop trailing partial tags with attributes from filtered reply text', () => {
        const interceptor = new XMLInterceptor();
        const raw = '<think>abc</think><Chat_Reply>Hello<Chat_Reply foo="1"';
        const state = interceptor.deriveStreamState(raw, true);

        expect(state.displayText).toBe('Hello');
        expect(state.statusText).toBe('回复中...');
        expect(state.filteredCount).toBe(raw.length - 'Hello'.length);
    });

    it('should not display Story_Summary content when filtering is enabled', () => {
        const interceptor = new XMLInterceptor();
        const raw = '<Story_Summary>SUM</Story_Summary><Chat_Reply>Hello</Chat_Reply>';
        const state = interceptor.deriveStreamState(raw, true);
        expect(state.displayText).toBe('Hello');
    });

    it('should not display Mutation/M/m content when filtering is enabled', () => {
        const interceptor = new XMLInterceptor();
        const raw = '<m>add({\"target\":\"inventory\"})</m><Chat_Reply>Hello</Chat_Reply>';
        const state = interceptor.deriveStreamState(raw, true);
        expect(state.displayText).toBe('Hello');
    });

    it('should keep raw text untouched when filter is disabled', () => {
        const interceptor = new XMLInterceptor();
        const raw = '<Chat_Reply>Hello</Chat_Reply>';
        const state = interceptor.deriveStreamState(raw, false);

        expect(state).toMatchObject({
            displayText: raw,
            filteredCount: 0,
            statusText: ''
        });
    });

    it('should normalize <think> alias to canonical thinking and expose thinkingText separately', () => {
        const interceptor = new XMLInterceptor();
        const state = interceptor.deriveStreamState('<think>先想想</think><Chat_Reply>答复</Chat_Reply>', true);

        expect(globalXMLTagRegistry.resolveCanonical('think')).toBe('thinking');
        expect(state.thinkingText).toBe('先想想');
        expect(state.displayText).toBe('答复');
    });
});

describe('XMLInterceptor.extractTagContent()', () => {
    beforeAll(() => {
        globalPromptRegistry.register({
            id: 'test-aliased-mutation',
            slot: PromptSlot.ST_MAIN,
            targetIdentifier: STIdentifier.MAIN,
            priority: 0,
            xmlTags: [
                {
                    tag: 'Mutation',
                    aliases: ['M', 'm'],
                    description: 'Test Mutation Tag',
                    priority: 1
                }
            ],
            getFragment: () => ''
        });
    });

    afterAll(() => {
        globalPromptRegistry.unregister('test-aliased-mutation');
    });

    it('should extract simple complete tag content', () => {
        const raw = '<think>I am thinking</think><Chat_Reply>Hello there</Chat_Reply>';
        const result = XMLInterceptor.extractTagContent(raw, BuiltinXMLTags.CHAT_REPLY);
        expect(result).toEqual(['Hello there']);
    });

    it('should resolve tag alias automatically using PromptRegistry', () => {
        const raw = 'Some text <M>First mutation</M> then <Mutation>Second mutation</Mutation>';
        const result = XMLInterceptor.extractTagContent(raw, 'Mutation');
        // 'M' and 'Mutation' are registered aliases, both should be matched and extracted
        expect(result).toEqual(['First mutation', 'Second mutation']);
    });

    it('should handle nested identical tags appropriately', () => {
        // Nested identical tags can happen if the model messes up or wraps its output weirdly
        const raw = '<M>Outer <M>Inner</M> End</M>';
        const result = XMLInterceptor.extractTagContent(raw, 'Mutation');

        // Internal block is closed first, then the outer block is closed
        expect(result).toEqual(['Inner', 'Outer <M>Inner</M> End']);
    });

    it('should auto-close trailing tags that are cut off by max tokens', () => {
        const raw = '<Mutation>This is suddenly cut off by t';
        const result = XMLInterceptor.extractTagContent(raw, 'Mutation');
        expect(result).toEqual(['This is suddenly cut off by t']);
    });


    it('只有闭合标签的情况', () => {
        const raw = 'This is suddenly cut off by t</thinking><Chat_Reply>Hello there</Chat_Reply>';
        const result = XMLInterceptor.extractTagContent(raw, BuiltinXMLTags.THINKING);
        expect(result).toEqual(['This is suddenly cut off by t']);
    });

    it('大小写混合的标签', () => {
        const raw = 'This is suddenly cut off by t</Thinking><Thinking>Hello there</Thinking>';
        const result = XMLInterceptor.extractTagContent(raw, BuiltinXMLTags.THINKING);
        expect(result).toEqual(['This is suddenly cut off by t', 'Hello there']);
    });

    it('should ignore unclosed loose `<` inside texts safely', () => {
        const raw = '<Chat_Reply>This is 1 < 3 and 5 > 4! <br/> Also <fake> tags.</Chat_Reply>';
        const result = XMLInterceptor.extractTagContent(raw, BuiltinXMLTags.CHAT_REPLY);
        expect(result).toEqual(['This is 1 < 3 and 5 > 4! <br/> Also <fake> tags.']);
    });

    it('should allow plugin metadata registration and cleanup without touching core constants', () => {
        globalXMLTagRegistry.register({
            sourceId: 'xml-interceptor-test-plugin',
            tag: 'Dice_Roll',
            aliases: ['Roll'],
            lifecycle: 'ephemeral',
            description: '掷骰结果',
            statusText: '掷骰中...',
            exposeInProtocol: true
        });

        expect(globalXMLTagRegistry.resolveCanonical('Roll')).toBe('Dice_Roll');
        expect(globalPromptRegistry.getAllXMLTags().some(tag => tag.tag === 'Dice_Roll')).toBe(true);

        globalXMLTagRegistry.unregister('xml-interceptor-test-plugin', 'Dice_Roll');

        expect(globalXMLTagRegistry.resolveCanonical('Roll')).toBeNull();
        expect(globalPromptRegistry.getAllXMLTags().some(tag => tag.tag === 'Dice_Roll')).toBe(false);
    });

    it('should filter protocol tags by prompt context', () => {
        const chatTags = globalPromptRegistry.getAllXMLTags('chat').map(tag => tag.tag);
        const forgeTags = globalPromptRegistry.getAllXMLTags('forge').map(tag => tag.tag);

        expect(chatTags).toContain('Chat_Reply');
        expect(chatTags).not.toContain('forge_skill');
        expect(forgeTags).toContain('forge_skill');
        expect(forgeTags).toContain('V');
        expect(forgeTags).not.toContain('Chat_Reply');
    });
});
