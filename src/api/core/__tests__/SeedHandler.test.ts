import { describe, it, expect } from 'vitest';
import { SeedHandler } from '../SeedHandler';

describe('SeedHandler', () => {
    it('应该能从文本中萃取出高分对话片段', () => {
        const mockText = `
        "这是我的家，" 艾莉森低声说道，她的目光扫过那些落满灰尘的家具，每一个角落都承载着过去十年的记忆。那些细碎的阳光穿过破损的窗帘，在大理石地面上投下斑驳的光影。
        
        "不，这已经不是了，" 塞缪尔看着远方的火光，语气中充满了决绝。他知道在这片废墟之上，新的秩序正在破繭而出，而旧日的温情早已被时代的洪流淹没。
        
        天空已经变得阴沉。云层厚得仿佛要压跨这个疲惫的世界。每个人都在等待那一声最终的惊雷，预示着风暴的降临。
        `;

        const snippets = SeedHandler.extractSnippets(mockText);
        
        expect(snippets.length).toBeGreaterThan(0);
        // 对话片段应该比普通叙述分数高
        expect(snippets[0].score).toBeGreaterThan(0);
        expect(snippets[0].content).toContain('艾莉森');
    });

    it('如果没有找到显著片段，应返回评分较高的叙述句', () => {
        const mockText = `
        早晨是一个安静的时间，整座城市还沉浸在深沉的梦乡之中。街道空无一人，只有偶尔飞过的飞鸟在空中划出一道道优美的弧线。那种宁静仿佛能洗涤人的灵魂。
        
        太阳缓缓升起，金色的光辉渐渐覆盖了屋檐和树梢，将寒霜一点点溶解。这是一个充满希望的开始，尽管之前的黑夜曾经那样漫长且令人绝望。
        
        空气中弥漫着花香，那是庭院里早已盛开的茉莉，它们在微风中摇曳生姿，诉说着不为人知的秘密。所有生命都在这一刻苏醒，迎接着第一缕曙光。
        `;

        const snippets = SeedHandler.extractSnippets(mockText);
        expect(snippets.length).toBeGreaterThan(0);
        expect(snippets[0].content).toContain('花香');
    });

    it('支持默认最大片段数量为 10', () => {
        // 生成 15 个长段落
        const mockText = Array(15).fill('这是一个超过五十个字符的长句子以触发提取逻辑，确保能够生成足够的候选片段。事实上，我们需要这种长度来通过评分器的长度过滤机制，从而验证最大数量限制是否生效。').join('\n\n');
        const snippets = SeedHandler.extractSnippets(mockText);
        expect(snippets.length).toBeLessThanOrEqual(10);
    });
});
