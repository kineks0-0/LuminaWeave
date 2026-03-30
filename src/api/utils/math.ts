/**
 * 向量数学工具函数库
 */

/**
 * 计算两个向量之间的余弦相似度
 * @param vecA 向量 A
 * @param vecB 向量 B
 * @returns 相似度分值 (-1 到 1 之间)
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
        return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    
    // 容错处理：处理 NaN (例如其中一个向量全为 0 时)
    return isNaN(similarity) ? 0 : similarity;
}

/**
 * 归一化向量 (可选)
 */
export function normalize(vec: number[]): number[] {
    const magnitude = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) return vec;
    return vec.map(val => val / magnitude);
}
