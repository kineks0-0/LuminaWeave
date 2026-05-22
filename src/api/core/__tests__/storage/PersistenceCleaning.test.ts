import { describe, expect, it } from 'vitest';
import { BaseXMLInterceptor } from '@shared/BaseXMLInterceptor.js';

describe('BaseXMLInterceptor Persistence Cleaning (持久化提纯测试)', () => {
    it('应该丢弃已闭合的 transient 标签内容', () => {
        const interceptor = new BaseXMLInterceptor();
        const raw = '<thinking>Internal thought</thinking>Hello world';
        const cleaned = interceptor.cleanText(raw);
        expect(cleaned).toBe('Hello world');
    });

    it('应该丢弃未闭合的 transient 标签内容 (核心修复验证)', () => {
        const interceptor = new BaseXMLInterceptor();
        // 模拟生成中途断开，thinking 标签未闭合
        const raw = 'Starting... <thinking>I am still thinking and never finished';
        const cleaned = interceptor.cleanText(raw, { allowTopLevel: true });
        
        // 预期：由于 thinking 是 transient，且未闭合，在最终提纯时应被丢弃
        // 只有 "Starting... " 被保留
        expect(cleaned).toBe('Starting...');
    });

    it('应该保留未闭合的 persistent 标签内容', () => {
        const interceptor = new BaseXMLInterceptor();
        const raw = '<Chat_Reply>Hello, this is a partial reply';
        const cleaned = interceptor.cleanText(raw);
        
        // 预期：虽然标签未闭合，但作为 persistent，其内容应保留
        expect(cleaned).toBe('Hello, this is a partial reply');
    });

    it('在嵌套情况下应正确处理', () => {
        const interceptor = new BaseXMLInterceptor();
        // 思考中嵌套了持久化内容（虽然这不符合常规逻辑，但需验证稳健性）
        const raw = '<thinking>Outer <Chat_Reply>Inner</Chat_Reply> still outer</thinking>Final';
        const cleaned = interceptor.cleanText(raw);
        
        // 预期：整个 thinking 块都被丢弃
        expect(cleaned).toBe('Final');
    });

    it('验证激进模式 (aggressiveThinking) 在 cleanText 中的表现', () => {
        const interceptor = new BaseXMLInterceptor();
        const raw = 'Filler text <thinking>Thought</thinking> <Chat_Reply>Actual content</Chat_Reply>';
        
        // 模式 A: 普通清洗
        const cleanedNormal = interceptor.cleanText(raw, { 
            allowTopLevel: true, 
            aggressiveThinking: false 
        });
        expect(cleanedNormal).toBe('Filler text  Actual content');

        // 模式 B: 激进清洗 (丢弃首个 </thinking> 之前的所有内容)
        const cleanedAggressive = interceptor.cleanText(raw, { 
            allowTopLevel: true, 
            aggressiveThinking: true 
        });
        expect(cleanedAggressive).toBe('Actual content');
    });
});
