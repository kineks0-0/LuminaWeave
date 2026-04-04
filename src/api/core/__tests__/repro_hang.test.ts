import { describe, it, expect, beforeEach } from 'vitest';
import { globalXMLInterceptor } from '../XMLInterceptor';
import { globalPromptRegistry, PromptSlot, STIdentifier } from '../PromptRegistry';

describe('XMLInterceptor Hang Reproduction', () => {
    beforeEach(() => {
        // 模拟注册 Director 的标签
        globalPromptRegistry.register({
            id: 'test-director',
            slot: PromptSlot.ST_MAIN,
            targetIdentifier: STIdentifier.MAIN,
            priority: 10,
            xmlTags: [{
                tag: 'Current_Plan',
                description: 'test',
                statusText: '制定意图中...',
                anchor: 'Chat_Reply',
                position: 'before',
                priority: 10
            }],
            getFragment: () => null
        });
    });

    it('should stay in "制定意图中..." when tag is open', () => {
        const state = globalXMLInterceptor.deriveStreamState('<Current_Plan>我准备说点什么', true);
        expect(state.statusText).toBe('制定意图中...');
        expect(state.displayText).toBe('');
    });

    it.skip('should NOT stay in "制定意图中..." when tag is closed', () => {
        const state = globalXMLInterceptor.deriveStreamState('<Current_Plan>我准备说点什么</Current_Plan>', true);
        // 这是预期的行为，或者我们认为这是 bug？此时 stack 为空。
        // 目前的代码会返回 lastMeaningfulTag，即 'Current_Plan'。
        // 如果这里仍然是“制定意图中...”，且正文为空，UI 就会显示该状态。
        expect(state.statusText).not.toBe('制定意图中...');
    });

    it.skip('should transition to "思考中..." (default) when between tags', () => {
        const state = globalXMLInterceptor.deriveStreamState('<Current_Plan>我准备说点什么</Current_Plan>  ', true);
        expect(state.statusText).toBe('思考中...');
    });
});
