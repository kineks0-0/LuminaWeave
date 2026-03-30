import { globalPromptRegistry, PromptSlot, PromptType, STIdentifier } from './PromptRegistry';
import { useDirectorStore } from '../../plugins/director/DirectorStore';
import { globalMutationEngine } from '../../plugins/director/MutationEngine';
import { useTier1Store } from '../../plugins/director/Tier1Store';
import { p } from './PromptUtils';

/**
 * 系统级提示词提供者
 * 负责注册核心 XML 协议、元数据标签以及全局世界观上下文
 */
export class SystemPromptProvider {
    public static registerAll(): void {
        this.registerXMLMetadata();
        this.registerWorldContext();
    }

    /**
     * 注册核心 XML 标签元数据 (用于排序和协议生成)
     */
    private static registerXMLMetadata(): void {
        globalPromptRegistry.register({
            id: 'core-thinking-metadata',
            slot: PromptSlot.ST_MAIN,
            targetIdentifier: STIdentifier.MAIN,
            priority: 0,
            xmlTags: [{
                tag: 'thinking',
                description: '你的内心思考过程和对当前局势的分析。必须最先输出，且不会展示给用户',
                statusText: '思考中...',
                anchor: '__START__',
                priority: 1
            }],
            getFragment: () => null
        });

        // 该字段对内容质量没有优化，暂时注释掉
        /* globalPromptRegistry.register({
            id: 'core-character-action-metadata',
            slot: PromptSlot.ST_MAIN,
            targetIdentifier: STIdentifier.MAIN,
            priority: 0,
            xmlTags: [{
                tag: 'Character_Action',
                description: '角色在当前回合采取的物理或环境动作',
                statusText: '行动中..',
                priority: 2
            }],
            getFragment: () => null
        }); */

        globalPromptRegistry.register({
            id: 'core-chat-reply-metadata',
            slot: PromptSlot.ST_MAIN,
            targetIdentifier: STIdentifier.MAIN,
            priority: 0,
            xmlTags: [{
                tag: 'Chat_Reply',
                description: '角色对话与旁白。这是用户将看到的核心剧情内容对话',
                statusText: '回复中..',
                priority: 50
            }],
            getFragment: () => null
        });
    }

    /**
     * 注册统一的世界拓扑、记忆与数据协议
     */
    private static registerWorldContext(): void {
        globalPromptRegistry.register({
            id: 'director-world-context-unified',
            slot: PromptSlot.ST_MAIN,
            type: PromptType.WORLD_VIEW,
            targetIdentifier: STIdentifier.WORLD_INFO_BEFORE,
            label: '记忆系统-导演推演',
            priority: 100,
            getFragment: () => {
                const directorStore = useDirectorStore();
                const tier1Store = useTier1Store();

                const memState = directorStore.getFormattedMemoryState;
                const tier1State = tier1Store.getFormattedTier1State;

                let parts: string[] = [];
                if (tier1State) parts.push(tier1State);
                if (memState) parts.push(memState);

                if (parts.length === 0) return null;

                let output = '';
                output += '你必须使用标准指令实时同步世界线状态 根据 <Chat_Reply> 内的对话内容。\n';
                output += '如果没有任何内容的表格，请必须进行一次初始化内容更新。\n\n';
                output += parts.join('\n\n').trim();
                output += '\n\n';
                output += globalMutationEngine.getDocumentation();

                return output;
            }
        });
    }
}
