import { llmEngine } from '../../api/llmEngine';
import { useDirectorStore } from './DirectorStore';
import { lwStorage } from '../../api/storage';
import { cosineSimilarity } from '../../api/utils/math';

/**
 * 记忆片段结构 (Vectorized Fragment)
 */
export interface MemoryFragment {
    id: string;
    content: string;
    vector?: number[];
    timestamp: number;
    metadata: {
        location?: string;
        involvedCharacters?: string[];
        category: 'plot' | 'character' | 'world';
    };
}

/**
 * MemoryVectorService: 负责类人记忆的向量化分割、存储与精准召回
 */
export class MemoryVectorService {
    private static instance: MemoryVectorService;

    private constructor() {}

    public static getInstance(): MemoryVectorService {
        if (!MemoryVectorService.instance) {
            MemoryVectorService.instance = new MemoryVectorService();
        }
        return MemoryVectorService.instance;
    }

    /**
     * 对新生成的剧情“短总结”进行向量化处理
     * @param summary 短总结内容
     */
    public async vectorizeAndStore(summary: string, location?: string): Promise<void> {
        // 检查开关
        const enabled = lwStorage.get('lumina-director.enableVectorMemory', true);
        if (!enabled) return;

        if (!summary || summary.trim().length === 0) return;

        console.log(`[MemoryVectorService] 开始处理记忆片段: "${summary.substring(0, 30)}..."`);

        try {
            // 1. 获取向量 (通过 llmEngine 桥接 ST 的 embedding 接口)
            const vector = await (llmEngine as any).getEmbedding?.(summary);

            const fragment: MemoryFragment = {
                id: crypto.randomUUID(),
                content: summary,
                vector,
                timestamp: Date.now(),
                metadata: {
                    location,
                    category: 'plot'
                }
            };

            // 2. 存储至 DirectorStore
            const directorStore = useDirectorStore();
            directorStore.addVectorMemory(fragment);

            console.log(`[MemoryVectorService] 记忆碎片已成功向量化并归档。`);
        } catch (e) {
            console.error(`[MemoryVectorService] 向量化失败:`, e);
        }
    }

    /**
     * 根据查询语义召回最相关的记忆
     * @param query 查询句子 (例如 "我之前见过那个戴面具的人吗？")
     * @param topK 返回前几个最相关的片段
     */
    public async recall(query: string, topK: number = 3): Promise<MemoryFragment[]> {
        // 检查开关
        const enabled = lwStorage.get('lumina-director.enableVectorMemory', true);
        if (!enabled) return [];

        const queryVector = await (llmEngine as any).getEmbedding?.(query);
        if (!queryVector) return [];

        // 获取所有向量片段
        const directorStore = useDirectorStore();
        const allFragments: MemoryFragment[] = directorStore.vectorMemories || [];
        
        // 计算余弦相似度并排序
        const results = allFragments
            .map(f => ({
                fragment: f,
                similarity: f.vector ? cosineSimilarity(queryVector, f.vector) : 0
            }))
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK)
            .map(r => r.fragment);

        return results;
    }
}

export const globalMemoryVectorService = MemoryVectorService.getInstance();
