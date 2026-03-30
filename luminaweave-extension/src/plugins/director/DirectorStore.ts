import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { globalPromptRegistry, PromptSlot, PromptType, STIdentifier } from '../../api/core/PromptRegistry';
import { globalMutationEngine } from './MutationEngine';
import { MemoryFragment } from './MemoryVectorService';

/**
 * 结构化记忆条目 (长效记忆)
 */
export interface MemoryEntry {
    timeSpan: string;
    location: string;
    summary: string;
    importantDialogue: string;
    index: string;
}

/**
 * DirectorStore (核心导演与长效记忆仓库)
 * 管理剧情规划 (Ephemeral) 与 世界大纲/记忆备份 (Long-term)。
 */
export const useDirectorStore = defineStore('lumina-director', () => {
    // === 1. 剧情规划状态 (Ephemeral) ===
    const currentPlan = ref<string | null>(null);
    const nextPlan = ref<string | null>(null);

    // === 2. 长期记忆状态 (Long-term, 原 MemoryStore 迁移) ===
    const overallOutline = ref<string>('');
    const characterProfiles = ref<string[]>([]);
    const pastMemories = ref<MemoryEntry[]>([]);
    const vectorMemories = ref<MemoryFragment[]>([]);

    // === 自动注册提示词集成 ===
    
    // 注册：剧情规划指导
    globalPromptRegistry.register({
        id: 'director-next-plan',
        slot: PromptSlot.ST_MAIN,
        targetIdentifier: STIdentifier.MAIN,
        label: 'Director Plan',
        priority: 200,
        getFragment: () => {
            if (!nextPlan.value) return null;
            return `[Plot Continuity Guide]\n` +
                   `You MUST follow this plan for your current response:\n` +
                   `${nextPlan.value}\n` +
                   `IMPORTANT: If the plan involves state changes, use <M> tags for synchronization.`;
        }
    });

    // 注册：长期记忆 (用于同步至世界书或直接注入)
    globalPromptRegistry.register({
        id: 'director-long-term-memory',
        slot: PromptSlot.ST_MAIN,
        targetIdentifier: STIdentifier.MAIN,
        label: 'Director Memory',
        priority: 150,
        getFragment: () => getFormattedMemoryState.value
    });

    // 注册：向量召唤插槽 (Tier 4)
    globalPromptRegistry.register({
        id: 'tier4-vector-recall',
        slot: PromptSlot.ST_STORY_STRING,
        targetIdentifier: STIdentifier.STORY_STRING,
        type: PromptType.SCENARIO,
        label: 'Vector Recall',
        priority: 70,
        getFragment: () => {
            const recent = vectorMemories.value.slice(-3).map(m => m.content).join('\n');
            return recent ? `[Relevant Memories]\n${recent}` : '';
        }
    });

    // === Mutation Engine 模型绑定 ===
    const initializeModels = () => {
        globalMutationEngine.registerDataModel('outline', {
            description: "故事核心脉络与大纲 (Tier 3)。建议在每章结束时更新。",
            onUpdate: (val: any) => {
                if (typeof val === 'string') overallOutline.value = val;
            }
        });
    };

    // === MemoryManager 接口实现 ===

    const exportSnapshot = () => ({
        currentPlan: currentPlan.value,
        nextPlan: nextPlan.value,
        overallOutline: overallOutline.value,
        characterProfiles: [...characterProfiles.value],
        pastMemories: [...pastMemories.value],
        vectorMemories: JSON.parse(JSON.stringify(vectorMemories.value))
    });

    const importSnapshot = (snapshot: any) => {
        if (!snapshot) return;
        currentPlan.value = snapshot.currentPlan || null;
        nextPlan.value = snapshot.nextPlan || null;
        overallOutline.value = snapshot.overallOutline || '';
        characterProfiles.value = Array.isArray(snapshot.characterProfiles) ? [...snapshot.characterProfiles] : [];
        pastMemories.value = Array.isArray(snapshot.pastMemories) ? [...snapshot.pastMemories] : [];
        vectorMemories.value = Array.isArray(snapshot.vectorMemories) ? JSON.parse(JSON.stringify(snapshot.vectorMemories)) : [];
    };

    const reset = () => {
        currentPlan.value = null;
        nextPlan.value = null;
        overallOutline.value = '';
        characterProfiles.value = [];
        pastMemories.value = [];
        vectorMemories.value = [];
    };

    // === Actions ===

    function setNextPlan(plan: string) { nextPlan.value = plan; }
    function clearNextPlan() { nextPlan.value = null; }
    function setCurrentPlan(plan: string) { currentPlan.value = plan; }
    function clearCurrentPlan() { currentPlan.value = null; }

    /**
     * 添加向量记忆片段
     */
    function addVectorMemory(fragment: MemoryFragment) {
        vectorMemories.value.push(fragment);
        if (vectorMemories.value.length > 200) vectorMemories.value.shift();
    }

    /**
     * 格式化 Tier 3 记忆状态 (用于 Tier 1 Unified)
     */
    const getFormattedMemoryState = computed(() => {
        let output = '';
        output += `[档案备份] characters_history(...)\n`;
        if (characterProfiles.value.length > 0) {
            characterProfiles.value.forEach((p, i) => { output += `${i}: ${p}\n`; });
        } else {
            output += `> [指令] 暂无角色备份记录。人设会自动在此同步。\n`;
        }
        output += `\n[长效记忆] past_memories(...)\n`;
        if (pastMemories.value.length > 0) {
            pastMemories.value.forEach(m => {
                output += `${m.index}: ${m.timeSpan} | ${m.location} | ${m.summary}\n`;
            });
        }
        return output.trim();
    });

    return {
        id: 'director',
        // State
        currentPlan, nextPlan, overallOutline, characterProfiles, pastMemories, vectorMemories,
        // Getters
        getFormattedMemoryState,
        // Actions
        setCurrentPlan, clearCurrentPlan, setNextPlan, clearNextPlan, addVectorMemory,
        // Core API
        initializeModels, exportSnapshot, importSnapshot, reset
    };
});
