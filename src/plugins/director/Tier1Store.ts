import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { globalMutationEngine } from './MutationEngine';
import { globalPromptRegistry, PromptSlot, PromptType } from '../../api/core/PromptRegistry';

/**
 * 动态表格元数据定义
 */
export interface TableMetadata {
    id: string;
    title: string;
    schema: string;        // 在提示词中展示的数据结构描述
    renderType: 'grid' | 'table' | 'relationships' | 'list' | 'text';
    icon?: string;
}

/**
 * Tier1Store: 负责管理结构化持久状态 (Tier 1 记忆)
 * 已实现解耦：所有表格作为动态表载入，提示词自说明。
 */
export const useTier1Store = defineStore('lumina-tier1', () => {
    // === 1. 动态表格数据池 ===
    const tables = ref<Record<string, any>>({
        global: {
            time: '未知时刻',
            location: '起始之地'
        },
        characters: {
            npcs: {} as Record<string, any>
        },
        inventory: [] as any[],
        skills: [] as string[],
        plot: {
            tasks: [] as string[],
            outline: '故事尚未开始'
        }
    });

    // === 2. 表格显示与提示词定义 (自说明结构) ===
    const tableRegistry = ref<Record<string, TableMetadata>>({
        global: {
            id: 'global',
            title: '全局环境',
            schema: 'global(time, location)',
            renderType: 'grid',
            icon: '🌍'
        },
        characters: {
            id: 'characters',
            title: '主要人物',
            schema: 'characters(npcs: { name: { description, affinity, status } })',
            renderType: 'relationships',
            icon: '👥'
        },
        inventory: {
            id: 'inventory',
            title: '物品清单',
            schema: 'inventory([{item, count, desc}])',
            renderType: 'table',
            icon: '🎒'
        },
        skills: {
            id: 'skills',
            title: '技能列表',
            schema: 'skills([string])',
            renderType: 'list',
            icon: '⚔️'
        },
        plot: {
            id: 'plot',
            title: '剧情追踪',
            schema: 'plot(tasks: [], outline)',
            renderType: 'text',
            icon: '📝'
        }
    });

    // === Getters (供 Prompt Builder 序列化展示给大模型) ===

    /**
     * 动态生成提示词文本。每个表都会描述自己的数据结构。
     */
    const getFormattedTier1State = computed(() => {
        let output = '';

        // 遍历所有注册的动态表
        for (const [id, meta] of Object.entries(tableRegistry.value)) {
            const data = tables.value[id];
            if (!data) continue;

            output += `[${meta.title}] ${meta.schema}\n`;

            // 根据 ID 进行特定的序列化输出
            if (id === 'global') {
                output += `- 当前: ${data.time}, ${data.location}\n`;
            }
            else if (id === 'characters') {
                const npcNames = Object.keys(data.npcs || {});
                if (npcNames.length > 0) {
                    output += npcNames.map(name => {
                        const npc = data.npcs[name];
                        return `${name}: ${npc.description || '暂无描述'} (好感: ${npc.affinity ?? 0}, 状态: ${npc.status || '活跃'})`;
                    }).join('\n') + '\n';
                } else {
                    output += `> [数据缺失] 目前人物表为空。请使用 characters.add("姓名", {...}) 初始化。\n`;
                }
            }
            else if (id === 'inventory') {
                if (Array.isArray(data) && data.length > 0) {
                    output += `- 物品: ` + data.map(i => `${i.item}x${i.count}`).join(', ') + '\n';
                } else {
                    output += `> [数据缺失] 目前物品栏为空。建议通过剧情发展添加物品。\n`;
                }
            }
            else if (id === 'skills') {
                if (Array.isArray(data) && data.length > 0) {
                    output += `- 技能: ` + data.join(', ') + '\n';
                } else {
                    output += `> [数据缺失] 技能列表暂空。\n`;
                }
            }
            else if (id === 'plot') {
                output += `- 大纲: ${data.outline || '尚未定义'}\n`;
                output += `- 任务: ${(data.tasks && data.tasks.join('; ')) || '暂无活跃任务(任务数据缺失)'}\n`;
            }

            // 处理可能由子插件注册的其他动态表
            const coreIds = ['global', 'characters', 'inventory', 'skills', 'plot'];
            if (!coreIds.includes(id)) {
                output += `- 数据: ${JSON.stringify(data)}\n`;
            }

            output += '\n';
        }

        // 检查是否有 MutationEngine 中注册了但 Store 这里没覆盖到的动态目标
        const allTargets = globalMutationEngine.getAvailableTargets();
        const extraTargets = allTargets.filter(t => !tableRegistry.value[t]);
        if (extraTargets.length > 0) {
            extraTargets.forEach(t => {
                const desc = globalMutationEngine.getModelDescription(t) || '自定义模型';
                output += `[动态扩展] ${t}(${desc})\n\n`;
            });
        }

        if (globalMutationEngine.models.size === 0)
            initializeModels();

        const availableTargets = globalMutationEngine.getAvailableTargets();
        output += `[初始化指令]\n`;
        output += `现在你需要初始化/更新以下表单：${availableTargets.join(', ')}\n\n`;

        output += `[操作指南]\n`;
        output += `当你需要更新上述世界线状态时，请在回复末尾使用以下指令之一：\n`;
        output += `1. **标准语法**：使用 <M> 标签包含 JS 表达式 (如 inventory.add({...}))\n`;
        output += `2. **自然语言快捷语法**：直接使用 [物品栏更新] 格式 (推荐用于多项物品变动)\n`;
        output += `   格式示例：\n`;
        output += `   [物品栏更新]：\n`;
        output += `   - 装备物：粗糙的猛兽坎肩（具备轻微的压制气息）\n`;
        output += `   - 消耗品：雪山特制雄精肉干（回补损耗过度的阳气）\n`;

        return output.trim();
    });

    // === 时空倒流 (Time Travel) 接口 ===

    /**
     * MemoryManager 接口实现
     */
    const exportSnapshot = () => {
        // 深度拷贝以确保快照隔离
        return JSON.parse(JSON.stringify(tables.value));
    };

    const importSnapshot = (snapshot: any) => {
        if (!snapshot) return;
        // 彻底覆盖现有数据，确保状态完全同步到快照点
        tables.value = JSON.parse(JSON.stringify(snapshot));
    };

    const reset = () => {
        tables.value = {
            global: { time: '未知时刻', location: '起始之地' },
            characters: { npcs: {} },
            inventory: [],
            skills: [],
            plot: { tasks: [], outline: '故事尚未开始' }
        };
    };

    /**
     * 为 MutationEngine 注册目标回调，绑定到动态 tables 结构
     */
    const initializeModels = () => {
        // 1. 全局环境
        globalMutationEngine.registerDataModel('global', {
            description: tableRegistry.value.global.schema,
            onUpdate: (val: any) => {
                if (val && typeof val === 'object') {
                    tables.value.global = { ...tables.value.global, ...val };
                }
            }
        });

        // 2. 人物档案
        globalMutationEngine.registerDataModel('characters', {
            description: tableRegistry.value.characters.schema,
            onAdd: (val: any, index?: number, key?: string) => {
                const name = key || (val && val.name);
                if (name) {
                    const { name: _unused, ...rest } = (typeof val === 'object' ? val : {});
                    tables.value.characters.npcs[name] = {
                        description: '',
                        affinity: 0,
                        status: '活跃',
                        experiences: [],
                        ...rest
                    };
                }
            },
            onUpdate: (val: any, index?: number, key?: string) => {
                if (key && tables.value.characters.npcs[key]) {
                    if (val && typeof val === 'object') {
                        tables.value.characters.npcs[key] = { ...tables.value.characters.npcs[key], ...val };
                    }
                }
            },
            onDelete: (index?: number, key?: string) => {
                if (key) delete tables.value.characters.npcs[key];
            }
        });

        // 3. 物品清单
        globalMutationEngine.registerDataModel('inventory', {
            description: tableRegistry.value.inventory.schema,
            onAdd: (val: any) => {
                if (val && typeof val === 'object' && (val.item || val.id)) {
                    tables.value.inventory.push({
                        item: val.item || val.id,
                        count: val.count || 1,
                        desc: val.desc || val.description || ''
                    });
                }
            },
            onUpdate: (val: any, index?: number) => {
                if (index !== undefined && tables.value.inventory[index] && val && typeof val === 'object') {
                    tables.value.inventory[index] = { ...tables.value.inventory[index], ...val };
                }
            },
            onDelete: (index?: number) => {
                if (index !== undefined) {
                    tables.value.inventory.splice(index, 1);
                }
            }
        });

        // 4. 技能列表
        globalMutationEngine.registerDataModel('skills', {
            description: tableRegistry.value.skills.schema,
            onAdd: (val: any) => {
                if (typeof val === 'string' && !tables.value.skills.includes(val)) {
                    tables.value.skills.push(val);
                }
            },
            onDelete: (index?: number) => {
                const idx = index !== undefined ? index : -1;
                if (idx >= 0) {
                    tables.value.skills.splice(idx, 1);
                }
            }
        });

        // 5. 剧情追踪
        globalMutationEngine.registerDataModel('plot', {
            description: tableRegistry.value.plot.schema,
            onUpdate: (val: any) => {
                if (val && typeof val === 'object') {
                    tables.value.plot = { ...tables.value.plot, ...val };
                }
            }
        });
    };

    // 暴露核心 Getter 和 Action
    return {
        id: 'tier1',
        tables,
        tableRegistry,
        global: computed(() => tables.value.global),
        characters: computed(() => tables.value.characters),
        resources: computed(() => ({
            inventory: tables.value.inventory,
            skills: tables.value.skills
        })),
        plot: computed(() => tables.value.plot),
        getFormattedTier1State,
        exportSnapshot,
        importSnapshot,
        reset,
        initializeModels
    };
});

