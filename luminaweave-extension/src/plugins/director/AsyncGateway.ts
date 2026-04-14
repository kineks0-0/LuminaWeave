import { llmEngine } from '../../api/llmEngine';
import { LuminaGenerationTask } from '../../api/core/LuminaGenerationTask';
import { lwStorage } from '../../api/storage';
import { useDirectorStore } from './DirectorStore';
import { globalXMLInterceptor } from '../../api/core/XMLInterceptor';
import { useTier1Store } from './Tier1Store';
import { SyncUtils } from '../../api/core/SyncUtils';
import { LuminaChatMessage } from '../../../../shared/LuminaMessage.js';

export class AsyncGateway {
    private isProcessing: boolean = false;

    /**
     * 判断是否需要触发后台的剧情规划
     * 根据 PDR，条件可以是：间隔了 N 个节点，或者发生特定事件
     * 这里的入参 trace 是当前时间线上的一组连续节点
     */
    public shouldTriggerBackgroundPlanning(trace: LuminaChatMessage[]): boolean {
        if (trace.length === 0) return false;
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
            const nexusPresetId = lwStorage.get('lumina-chat.nexusPreset', 'Global', 'Global');
            const nodes = llmEngine.resolveNodesFromPreset(nexusPresetId);
            const session = llmEngine.createSession({
                chatId: 'director_async',
                charName: 'Director',
                parentId: null,
                nodes
            });

            const task = new LuminaGenerationTask(session);
            await task.run(llmEngine.cleanMessages(payload), {
                onDone: (finalText: string) => {
                    // 利用拦截器过滤并触发副作用 (执行 SyncUtils)
                    const cleanedText = globalXMLInterceptor.processAndCleanText(finalText);
                    console.log(`[AsyncGateway] 后台规划归纳完成。模型可能已触发 Mutation。清理后的闲聊废话长度: ${cleanedText.length}`);
                },
                onError: (err: any) => {
                    console.error(`[AsyncGateway] 后台 API 生成出错:`, err);
                }
            });

        } catch (e) {
            console.error(`[AsyncGateway] 后台规划执行失败:`, e);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 构建给予后台模型的特化提示词
     */
    private buildAsyncPayload(trace: LuminaChatMessage[]): any[] {
        const payload: any[] = [];
        const tier1Store = useTier1Store();
        const directorStore = useDirectorStore();

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
        systemPrompt += `DO NOT generate character dialogue.\n`;

        payload.push({ role: 'system', content: systemPrompt });

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
