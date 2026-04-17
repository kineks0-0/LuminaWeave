import { LuminaChatMessage, MessageUtils } from '../LuminaMessage.js';
import { BaseXMLInterceptor, StreamingPolicy } from '../BaseXMLInterceptor.js';

/**
 * 持久化委托接口
 * 由宿主环境 (后端 StorageService 或 前端 LocalStorage) 实现
 */
export interface PersistenceDelegate {
    /**
     * 追加或更新一个完整的消息记录
     */
    appendChatRecord(chatId: string, node: LuminaChatMessage): Promise<void>;
    
    /**
     * 更新对话元数据 (如 activeLeafId)
     */
    updateChatMetadata(chatId: string, metadata: { activeLeafId: string }): Promise<void>;
    
    /**
     * 提交事务并获取其元数据
     */
    commitTransaction?(chatId: string, scope: string, payload: any, idempotencyKey: string): Promise<{ id: string; seq?: number }>;
}

/**
 * Nexus 生成任务配置
 */
export interface GenerationFlowContext {
    chatId: string;
    parentId: string | null;
    charName: string;
    characterId?: string | number;
    policy: StreamingPolicy;
}

/**
 * 共享的 Nexus 生成流程管理类
 * 确保后端在线生成与前端离线生成在业务逻辑、XML 处理和节点结构上完全对等
 */
export class NexusGenerationFlow {
    private fullText: string = '';
    private chunkCount: number = 0;
    private startTime: number;

    constructor(
        private context: GenerationFlowContext,
        private interceptor: BaseXMLInterceptor,
        private delegate: PersistenceDelegate
    ) {
        this.startTime = Date.now();
    }

    /**
     * 处理收到的增量 Token
     */
    public pushToken(delta: string): void {
        this.fullText += delta;
        this.chunkCount++;
    }

    /**
     * 获取当前累加的完整原始文本
     */
    public getFullText(): string {
        return this.fullText;
    }

    /**
     * 完成生成流程，执行节点构建与持久化
     * @returns 返回生成的完整消息节点
     */
    public async finalize(status: 'success' | 'aborted' | 'error' = 'success'): Promise<LuminaChatMessage> {
        const nodeId = MessageUtils.generateNodeId();
        
        // 1. 构建基础节点
        const newNode: LuminaChatMessage = {
            id: nodeId,
            parentId: this.context.parentId,
            name: this.context.charName,
            role: 'assistant',
            is_user: false,
            pluginRaw: this.fullText, // 设置为权威源码
            mesRaw: '', // 由 syncCore 填充
            mes: '',    // 由 syncCore 填充
            fingerprint: '', // 由 syncCore 填充
            characterId: this.context.characterId,
            extra: {
                role: 'assistant',
                gen_finished: Date.now(),
                status: status
            }
        };

        // 2. 核心同步逻辑 (XML 提取、清污、指纹计算)
        // 使用 shared 层统一的 syncCore 逻辑，确保双端行为一致
        MessageUtils.syncCore(newNode, this.interceptor, { force: true });

        // 如果生成失败或中断，标记状态
        if (status !== 'success') {
            newNode.extra.status = status;
        }

        // 3. 执行持久化委托逻辑
        // A. 写入消息记录
        await this.delegate.appendChatRecord(this.context.chatId, newNode);

        // B. 更新 Metadata (始终同步 activeLeafId 到最新生成的节点)
        await this.delegate.updateChatMetadata(this.context.chatId, { activeLeafId: nodeId });

        // C. 处理事务 (如果实现支持)
        if (this.delegate.commitTransaction) {
            const txId = await this.delegate.commitTransaction(
                this.context.chatId,
                'nexus.generate',
                this.fullText,
                `gen_${nodeId}`
            );
            newNode.extra.transactionId = txId;
        }

        return newNode;
    }

    /**
     * 获取辅助统计信息
     */
    public getStats() {
        return {
            chunkCount: this.chunkCount,
            duration: Date.now() - this.startTime,
            charCount: this.fullText.length
        };
    }
}
