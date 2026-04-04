import { llmEngine } from '../../api/llmEngine';
import { useDirectorStore } from './DirectorStore';
import { globalXMLInterceptor } from '../../api/core/XMLInterceptor';
import { useTier1Store } from './Tier1Store';
import { SyncUtils } from '../../api/core/SyncUtils';
import { LuminaChatMessage } from '../../api/core/ChatManager';

export class AsyncGateway {
    private isProcessing: boolean = false;

    /**
     * 判断是否需要触发后台的剧情规划
     * 根据 PDR，条件可以是：间隔了 N 个节点，或者发生特定事件
     * 这里的入参 trace 是当前时间线上的一组连续节点
     */
    public shouldTriggerBackgroundPlanning(trace: LuminaChatMessage[]): boolean {
        // 非常简单的判定：假设每产生 10 句话，或者到达特定阈值，就总结一次
        // 为了避免频繁刷后台，这里定义每 10 条节点触发一次 summarizing
        if (trace.length === 0) return false;

        // 我们粗略用整个 trace 的长度作为判定基准即可
        // 在实际业务中可能需要在独立存储中保存一个 "last_summarize_count"
        return trace.length % 10 === 0;
    }

    /**
     * 触发独立的后台规划链路 (Async 模式)
     */
    public async triggerPlotPlanning(trace: LuminaChatMessage[]): Promise<void> {
        if (this.isProcessing) {
            console.log(`[AsyncGateway] 后台规划系统正在运行中，跳过本次触发。`);
            return;
        }

        console.log(`[AsyncGateway] 触发长期后台剧情规划 (Tier 3 Summarization)...`);
        this.isProcessing = true;

        try {
            // 1. 组装后台特供的 Payload
            const payload = this.buildAsyncPayload(trace);

            // 2. 发起静默的 API 生成请求
            let responseText = '';

            await new Promise<void>((resolve, reject) => {
                llmEngine.generateCustomStream(payload, {
                    onChunk: (chunk: string) => {
                        responseText = chunk; // llmEngine 的 onChunk 会传 fullText（从代码来看，有时可能传 delta，但 api/index.ts 里是 fullText）
                    },
                    onDone: (finalText: string) => {
                        // 利用拦截器过滤并触发副作用 (执行 SyncUtils)
                        const cleanedText = globalXMLInterceptor.processAndCleanText(finalText);
                        console.log(`[AsyncGateway] 后台规划归纳完成。模型可能已触发 Mutation。清理后的闲聊废话长度: ${cleanedText.length}`);
                        resolve();
                    },
                    onError: (err: any) => {
                        console.error(`[AsyncGateway] 后台 API 生成出错:`, err);
                        reject(err);
                    }
                });
            });

        } catch (e) {
            console.error(`[AsyncGateway] 后台规划执行失败:`, e);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 构建给予后台模型的特化提示词
     * 要求它阅读过去的对话，抽取出重点放入 Tier 3 记忆，然后规划长线剧情
     */
    private buildAsyncPayload(trace: LuminaChatMessage[]): any[] {
        const payload: any[] = [];
        const tier1Store = useTier1Store();
        const directorStore = useDirectorStore();

        // - 构建极高优先级的 System 指令
        let systemPrompt = `[System Directives for Async Director]\n`;
        systemPrompt += `You are an AI Narrative Director operating in the background. Your task is NOT to participate in the conversation, but to analyze the recent chat history and update the high-level story summary (Tier 3 Memory).\n\n`;

        if (tier1Store.getFormattedTier1State) {
            systemPrompt += `Current World State:\n${tier1Store.getFormattedTier1State}\n\n`;
        }

        if (directorStore.getFormattedMemoryState) {
            systemPrompt += `Previous Story Summary:\n${directorStore.getFormattedMemoryState}\n\n`;
        }

        systemPrompt += `You MUST strictly follow XML output formats to manipulate the Memory system. For example:\n`;
        systemPrompt += `- Update story outline: <Mutation>outline.update("The hero is now in the dark forest.")</Mutation>\n`;
        systemPrompt += `- Add a character profile: <Mutation>characters.add("Eldric: A veteran knight searching for his lost daughter.")</Mutation>\n`;
        systemPrompt += `- Add a structured memory: <Mutation>past_memories.add({"timeSpan": "Phase 1", "location": "Tavern", "summary": "Met the mysterious stranger.", "importantDialogue": "Watch your back.", "index": "M001"})</Mutation>\n`;
        systemPrompt += `If an older entry is outdated, use .delete(index) or .update(index, "new content").\n`;
        systemPrompt += `You may also output <Next_Plan>...</Next_Plan> to set a long-term goal.\n`;
        systemPrompt += `DO NOT generate character dialogue.\n`;

        payload.push({ role: 'system', content: systemPrompt });

        // - 构建最近 10 条的历史对话当作阅读素材
        const recentMessages = trace.slice(-10);
        let chatContext = `[Recent Chat Logs for Analysis]\n`;
        recentMessages.forEach(msg => {
            const roleName = msg.is_user ? 'User/Player' : (msg.name || 'Character');
            chatContext += `${roleName}: ${msg.mesRaw || msg.mes}\n`;
        });

        payload.push({ role: 'user', content: chatContext });

        payload.push({
            role: 'system',
            content: `Now, analyze the above chat logs and output your <thinking> initially, followed by any <Mutation> tags to update the story summary, and finally any <Next_Plan>.`
        });

        return payload;
    }
}

export const globalAsyncGateway = new AsyncGateway();
