import { useForgeStore } from '../../stores/useForgeStore.js';

export interface Snippet {
    id: string;
    content: string;
    source: string;
    score: number;
}

/**
 * SeedHandler
 * 负责从原始素材（小说、设定片段）中萃取具有代表性的种子片段。
 */
export class SeedHandler {
    /**
     * 自动从长文本中提取候选片段
     * 算法：寻找包含对话最多的段落，或者长度适中的描述性段落
     */
    public static extractSnippets(text: string, sourceName: string = 'unknown'): Snippet[] {
        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 50);
        const candidates: Snippet[] = [];

        paragraphs.forEach((p, idx) => {
            let score = 0;
            const content = p.trim();

            // 对话权重 (引号数量)
            const quoteCount = (content.match(/["“'‘]/g) || []).length;
            score += quoteCount * 2;

            // 描述权重 (长度适中)
            if (content.length > 200 && content.length < 800) {
                score += 10;
            }

            // 关键词权重 (可选)
            if (content.match(/他|她|它|我|你/)) {
                score += 5;
            }

            candidates.push({
                id: `snippet-${idx}`,
                content,
                source: sourceName,
                score
            });
        });

        // 按评分排序并取前 10 个
        const best = candidates.sort((a, b) => b.score - a.score).slice(0, 10);
        return best;
    }

    /**
     * 将选中的片段作为基元种子
     */
    public applySeeds(selectedSnippetIds: string[]) {
        // TODO: 将选中的片段内容传递给 Planner，作为制卡的冷启动上下文
        console.log(`[SeedHandler] 应用了 ${selectedSnippetIds.length} 个种子片段`);
    }
}
