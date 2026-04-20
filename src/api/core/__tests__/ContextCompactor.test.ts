import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContextCompactor } from '../ContextCompactor';
import { ContextControlSettings } from '../types';
import { LuminaChatMessage } from '@shared/LuminaMessage.js';
import { STClient } from '../st-adapter/STClient';

vi.mock('../st-adapter/STClient', () => ({
    STClient: {
        getTokenCount: vi.fn(async (text) => text.length), // 简单模拟：1 字符 = 1 Token
        getResolvedCurrentCharacterId: vi.fn(() => '0'),
        getResolvedCurrentChatId: vi.fn(() => 'chat_1')
    }
}));

describe('ContextCompactor', () => {
    const settings: ContextControlSettings = {
        fullMode: 'count',
        fullValueCount: 2,
        summaryMode: 'count',
        summaryValueCount: 2, // 改为额外 2 条，总共 4 条非隐藏
        tokenSplitAllowed: false,
        tokenMaxFloat: 10,
        enableFallbackSummary: true
    };

    const createMsg = (id: string, text: string, summary?: string): LuminaChatMessage => ({
        id,
        mesRaw: text,
        mes: text,
        mesSummary: summary,
        fingerprint: `fp_${id}`,
        is_hidden: false,
        extra: {}
    } as any);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should apply count-based compaction correctly', async () => {
        const trace = [
            createMsg('1', 'Full 1'),
            createMsg('2', 'Full 2'),
            createMsg('3', 'Full 3'),
            createMsg('4', 'Full 4'),
            createMsg('5', 'Full 5'),
        ];

        // settings: full=2, summary=2 (additional 2 after full)
        // 5, 4 -> Full
        // 3, 2 -> Summary
        // 1 -> Hidden
        const compacted = await ContextCompactor.compact(trace, settings);

        expect(compacted[4].extra?.compressionState).toBe('full'); // Full 区
        expect(compacted[4].is_hidden).toBe(false);

        expect(compacted[3].extra?.compressionState).toBe('full'); // Full 区
        expect(compacted[2].extra?.compressionState).toBe('summary'); // Summary
        expect(compacted[1].extra?.compressionState).toBe('summary'); // Summary
        expect(compacted[0].is_hidden).toBe(true); // Hidden
    });

    it('should apply token-based compaction correctly', async () => {
        const tokenSettings: ContextControlSettings = {
            ...settings,
            fullMode: 'token',
            fullValueToken: 20, // 20 chars
            summaryMode: 'token',
            summaryValueToken: 40, // 额外 40 chars 概览预算
            tokenMaxFloat: 0 // 禁用容差以精确验证边界
        };

        const trace = [
            createMsg('1', 'Ten chars.', 'Summary 1'), // Raw: 10, Sum: 9
            createMsg('2', 'Ten chars.', 'Summary 2'), // Raw: 10, Sum: 9
            createMsg('3', 'Ten chars.', 'Summary 3'), // Raw: 10, Sum: 9
            createMsg('4', 'Ten chars.', 'Summary 4'), // Raw: 10, Sum: 9
            createMsg('5', 'Ten chars.', 'Summary 5'), // Raw: 10, Sum: 9
        ];

        const compacted = await ContextCompactor.compact(trace, tokenSettings);

        // Trace: (End to front)
        // 5 (10 tokens): Full. Budget used: 10.
        // 4 (10 tokens): Full. Budget used: 20. (Full hit)
        // 3 (10 tokens): Summary. Additional budget (Current 10) <= 40. OK.
        //   After 3, currentSummaryTokens += Summary_Content = 9.
        // 2 (10 tokens): Summary. Additional budget (Sum 9 + Msg 10) = 19 <= 40. OK.
        //   After 2, currentSummaryTokens += 9 = 18.
        // 1 (10 tokens): Summary. Additional budget (Sum 18 + Msg 10) = 28 <= 40. OK.

        expect(compacted[4].extra?.compressionState).toBe('full'); // Full 区
        expect(compacted[3].extra?.compressionState).toBe('full'); // Full 区
        expect(compacted[2].extra?.compressionState).toBe('summary'); // Summary
        expect(compacted[1].extra?.compressionState).toBe('summary'); // Summary
        expect(compacted[0].extra?.compressionState).toBe('summary'); // Summary
    });

    it('should resolve summary from different sources', async () => {
        const msgWithSummary = createMsg('s', 'Content', 'Specific Summary');
        const msgWithPlan = createMsg('p', 'Content');
        msgWithPlan.extra = { Current_Plan: 'Plan Content' };
        
        const trace = [msgWithPlan, msgWithSummary];
        const s: ContextControlSettings = { ...settings, fullMode: 'count', fullValueCount: 0, summaryMode: 'count', summaryValueCount: 10 }; // All summary
        
        const compacted = await ContextCompactor.compact(trace, s);
        
        expect(compacted[1].mesSummary).toBe('Specific Summary');
        expect(compacted[0].mesSummary).toBe('Plan Content');
    });

    it('should respect maxFloat for token-based windowing', async () => {
        const floatSettings: ContextControlSettings = {
            ...settings,
            fullMode: 'token',
            fullValueToken: 15,
            tokenMaxFloat: 10, // Max 25
            tokenSplitAllowed: false
        };

        const trace = [
            createMsg('1', '12345678901234567890'), // 20 tokens
        ];

        // 20 > 15 but < 15 + 10 = 25. Should be Full.
        const compacted = await ContextCompactor.compact(trace, floatSettings);
        expect(compacted[0].extra?.compressionState).toBe('full'); // 在 maxFloat 容差内，仍为 full

        // If it was 30
        const trace2 = [createMsg('2', '123456789012345678901234567890')]; // 30 tokens
        const compacted2 = await ContextCompactor.compact(trace2, floatSettings);
        expect(compacted2[0].extra?.compressionState).toBe('summary'); // Becomes summary or hidden
    });

    it('should apply character-based (char) compaction correctly', async () => {
        const charSettings: ContextControlSettings = {
            ...settings,
            fullMode: 'char',
            fullValueChar: 10,
            summaryMode: 'char',
            summaryValueChar: 10,
            tokenMaxFloat: 0
        };

        const trace = [
            createMsg('1', '1234567890'), // 10 chars
            createMsg('2', '1234567890'), // 10 chars
            createMsg('3', '1234567890'), // 10 chars
        ];

        const compacted = await ContextCompactor.compact(trace, charSettings);

        // Reverse:
        // Msg 3: 10 chars. OK (<=10). Full.
        // Msg 2: 10 chars. Not In Full Range. Summary check: 0 + 12 (fallback summary "1234567890...") > 10. Hidden.
        // Wait, fallback summary is 100 chars or text. If text < 100, it's the text.
        // If msg 2 text is "1234567890", length is 10.
        // Summary of Msg 2: 0 + 10 <= 10. OK. Summary.
        // Msg 1: Summary check: 10 + 10 > 10. Hidden.

        expect(compacted[2].extra?.compressionState).toBe('full'); // Full 区
        expect(compacted[1].extra?.compressionState).toBe('summary'); // Summary
        expect(compacted[0].is_hidden).toBe(true); // Hidden
    });

    it('should protect user messages from being summarized', async () => {
        const trace = [
            createMsg('1', 'User message content'),
        ];
        (trace[0] as any).is_user = true;
        
        // Force it into summary range by setting fullValueCount=0
        const s: ContextControlSettings = { ...settings, fullValueCount: 0, summaryValueCount: 5 };
        
        const compacted = await ContextCompactor.compact(trace, s);
        
        // 用户消息在概况区内无法被摘要化，降级为全量（full_in_summary）
        expect(compacted[0].extra?.compressionState).toBe('full_in_summary');
        expect(compacted[0].is_hidden).toBe(false); // Stays visible (full)
    });

    it('should follow summary priority: mesSummary > pluginRaw > Current_Plan > Fallback', async () => {
        const s: ContextControlSettings = { ...settings, fullValueCount: 0, summaryValueCount: 10, enableFallbackSummary: true };
        
        // 1. mesSummary Priority
        const m1 = createMsg('1', 'Original', 'Direct Summary');
        m1.pluginRaw = '<Story_Summary>XML Summary</Story_Summary>';
        m1.extra = { Current_Plan: 'Plan Summary' };
        
        const res1 = await ContextCompactor.compact([m1], s);
        expect(res1[0].mesSummary).toBe('Direct Summary');

        // 2. XML Tag Priority
        const m2 = createMsg('2', 'Original');
        m2.pluginRaw = '<Story_Summary>XML Summary</Story_Summary>';
        m2.extra = { Current_Plan: 'Plan Summary' };
        
        const res2 = await ContextCompactor.compact([m2], s);
        expect(res2[0].mesSummary).toBe('XML Summary');

        // 3. Plan Priority
        const m3 = createMsg('3', 'Original');
        m3.extra = { Current_Plan: 'Plan Summary' };
        
        const res3 = await ContextCompactor.compact([m3], s);
        expect(res3[0].mesSummary).toBe('Plan Summary');

        // 4. Fallback (Truncation)
        const longText = 'A'.repeat(150);
        const m4 = createMsg('4', longText);
        
        const res4 = await ContextCompactor.compact([m4], s);
        expect(res4[0].mesSummary).toHaveLength(103); // 100 + "..."
        expect(res4[0].mesSummary).toContain('...');
    });

    it('should respect tokenMaxFloat and tokenSplitAllowed correctly', async () => {
        // Mock getTokenCount behavior for precise tests
        (STClient.getTokenCount as any).mockImplementation(async (text: string) => text.length);

        const s: ContextControlSettings = {
            ...settings,
            fullMode: 'token',
            fullValueToken: 10,
            tokenMaxFloat: 5,   // Allowed up to 15 if not splitting
            tokenSplitAllowed: false
        };

        const trace = [
            createMsg('1', '12345678901234'), // 14 tokens
        ];

        const res1 = await ContextCompactor.compact(trace, s);
        expect(res1[0].extra?.compressionState).toBe('full'); // Stays full because 14 <= 10 + 5

        const trace2 = [
            createMsg('2', '1234567890123456'), // 16 tokens
        ];
        const res2 = await ContextCompactor.compact(trace2, s);
        expect(res2[0].extra?.compressionState).toBe('summary'); // Becomes summary because 16 > 15
    });

    it('should NOT allow multiple small messages to stack in maxFloat range', async () => {
        // Mock getTokenCount
        (STClient.getTokenCount as any).mockImplementation(async (text: string) => text.length);

        const s: ContextControlSettings = {
            ...settings,
            fullMode: 'token',
            fullValueToken: 10,
            tokenMaxFloat: 5,   // Allowed up to 15
            tokenSplitAllowed: false
        };

        const trace = [
            createMsg('1', '4 chars'),  // i=0
            createMsg('2', '4 chars'),  // i=1
            createMsg('3', '8 chars'),  // i=2. This one hits 8/10.
            createMsg('4', '4 chars'),  // i=3. This one hits 12/10. Within float (15). SHOULD BE LAST FULL.
            createMsg('5', '4 chars'),  // i=4. This one would hit 16/10. OVER TOTAL. MUST BE SUMMARY/HIDDEN.
        ];

        const res = await ContextCompactor.compact(trace, s);
        
        const stackSettings: ContextControlSettings = {
            ...settings,
            fullMode: 'token',
            fullValueToken: 10,
            tokenMaxFloat: 10,  // Max 20
        };
        const stackTrace = [
            createMsg('a', 'AA'), // 2
            createMsg('b', 'BB'), // 2
            createMsg('c', 'CC'), // 2
            createMsg('d', 'AAAAAAAAA'), // total 9
        ];
        
        const stackRes = await ContextCompactor.compact(stackTrace, stackSettings);
        expect(stackRes[3].extra?.compressionState).toBe('full'); // d: Full
        expect(stackRes[2].extra?.compressionState).toBe('full'); // c: Full (The only allowed overflow)
        
        // EXPECTATION: Once 'c' pushed us over 10, 'b' must NOT be Full.
        expect(stackRes[1].extra?.compressionState).toBe('summary'); // b: Summary
    });

    it('should correctly break sticky is_hidden bug from proxy extra', async () => {
        const s: ContextControlSettings = {
            ...settings,
            fullMode: 'count',
            fullValueCount: 1, // Only 1 full message
            summaryValueCount: 0,
        };

        // 模拟一个带有 sticky is_hidden: true 的历史消息
        const stickyMsg = createMsg('1', 'Sticky Hidden');
        stickyMsg.is_hidden = true;
        stickyMsg.extra = { is_hidden: true };

        const trace = [stickyMsg];
        
        // 压实计算，由于是最新且唯一的一条，它应该进入 Full Range，被标为 is_hidden: false
        const compacted = await ContextCompactor.compact(trace, s);
        
        expect(compacted[0].is_hidden).toBe(false);
        // extra 中的 is_hidden 和 compressionState 应该被清除
        expect(compacted[0].extra?.is_hidden).toBeUndefined();
        // 全量区消息应标记为 'full'（而非保留旧的 undefined）
        expect(compacted[0].extra?.compressionState).toBe('full');
    });

    it('should account for pluginRaw in cost calculation', async () => {
        // This test fails before the fix because ContextCompactor ignores pluginRaw
        (STClient.getTokenCount as any).mockImplementation(async (text: string) => text.length);

        const s: ContextControlSettings = {
            ...settings,
            fullMode: 'token',
            fullValueToken: 20,
            tokenMaxFloat: 0
        };

        const m1 = createMsg('1', 'Short'); // mesRaw is 'Short' (5)
        m1.pluginRaw = '<thinking>Very long thoughts...</thinking>Short'; // pluginRaw is much longer (43)
        m1.is_user = false;

        const res = await ContextCompactor.compact([m1], s);
        
        // Before fix: DCC sees 5 tokens, 5 <= 20, stays Full.
        // After fix: DCC sees pluginRaw content (cleaned or not, let's see how extractMessageText works)
        // SyncUtils.extractMessageText will keep <thinking> if it's not transient? 
        // Actually it cleans <thinking> by default. 
        // But it would at least account for the text if it was part of pluginRaw.
        
        // If extractMessageText is used, and it cleans <thinking>, then it might still be 'Short'.
        // But what if the text is in pluginRaw and NOT in mesRaw yet?
        
        const m2 = createMsg('2', 'short');
        m2.pluginRaw = 'This is a very long raw message that exceeds twenty tokens'; 
        m2.is_user = false;

        const res2 = await ContextCompactor.compact([m2], s);
        
        // Expectation: it should be summary because 58 > 20
        expect(res2[0].extra?.compressionState).toBe('summary');
    });
});
