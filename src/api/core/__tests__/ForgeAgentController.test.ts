import { describe, it, expect, vi, beforeEach } from 'vitest';
import { XMLInterceptor } from '../XMLInterceptor';

describe('ForgeAgentController & XMLInterceptor integration', () => {
    let interceptor: XMLInterceptor;
    const mockEmit = vi.fn();

    beforeEach(() => {
        interceptor = new XMLInterceptor();
        vi.clearAllMocks();
        
        // Mock global LuminaWeave emitter
        (window as any).LuminaWeave = {
            emit: mockEmit
        };
    });

    it('流式输出过程中应正确触发 FORGE_TRACE 事件', () => {
        const rawText = '<forge_skill name="搜索资料">正在检索背景...';
        
        interceptor.deriveStreamState(rawText, { filterChatReply: true });

        expect(mockEmit).toHaveBeenCalledWith('FORGE_TRACE', expect.objectContaining({
            tag: 'forge_skill',
            status: 'Agent 正在执行技能...'
        }));
    });

    it('标签闭合时应触发 FORGE_ACTION_COMPLETED 事件', () => {
        const rawText = '<forge_skill name="搜索">检索完成</forge_skill>';
        
        // 执行带 Handler 的清洗
        interceptor.processAndCleanText(rawText, true);

        expect(mockEmit).toHaveBeenCalledWith('FORGE_ACTION_COMPLETED', expect.objectContaining({
            type: 'skill',
            content: '检索完成'
        }));
    });

    it('draft_plan 标签应触发正确的活动完成事件', () => {
        const rawText = '<draft_plan>1. A\n2. B</draft_plan>';
        
        interceptor.processAndCleanText(rawText, true);

        expect(mockEmit).toHaveBeenCalledWith('FORGE_ACTION_COMPLETED', expect.objectContaining({
            type: 'plan',
            content: '1. A\n2. B'
        }));
    });

    it('entry_update 标签在 UI 主流中应保留其内容 (persistent)', () => {
        const rawText = '开始重写：<entry_update id="item1">新背景</entry_update>';
        
        const cleaned = interceptor.processAndCleanText(rawText, true);

        // 验证事件触发
        expect(mockEmit).toHaveBeenCalledWith('FORGE_ACTION_COMPLETED', expect.objectContaining({
            type: 'update',
            content: '新背景'
        }));
        
        // 验证组件化输出 (由于 entry_update 现在会被处理为组件指令)
        expect(cleaned).toContain('开始重写：<V>ForgeEntryProposal("item1"');
        expect(cleaned).toContain('新背景');
    });
});
