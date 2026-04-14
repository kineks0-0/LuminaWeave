import { LuminaChatMessage } from '../../../../shared/LuminaMessage.js';
import { NexusNode } from '../../types/nexus.js';

export interface GenerationSessionOptions {
    chatId: string;
    charName: string;
    parentId: string | null;
    nodes?: NexusNode[];
}

/**
 * GenerationSession
 * 封装单次生成任务的状态、数据与核心生命周期。
 * 用于解决 Facade 层 (LuminaWeaveAPI) 状态散乱、生命周期管理不严谨的问题。
 */
export class GenerationSession {
    public readonly chatId: string;
    public readonly charName: string;
    public readonly parentId: string | null;
    public readonly nodes: NexusNode[];
    
    private _finalText: string | null = null;
    private _committedInfo: { 
        lastTransactionId: string; 
        activeLeafId?: string | null; 
        generationId?: string | null;
        node?: any; 
        seq?: number;
    } | null = null;
    private _isFinalizing = false;
    private _isCompleted = false;
    private _isAborted = false;
    private _error: Error | null = null;

    constructor(options: GenerationSessionOptions) {
        this.chatId = options.chatId;
        this.charName = options.charName;
        this.parentId = options.parentId;
        this.nodes = options.nodes || [];
    }

    get finalText(): string | null { return this._finalText; }
    set finalText(val: string | null) { this._finalText = val; }

    get committedInfo() { return this._committedInfo; }
    set committedInfo(val) { this._committedInfo = val; }

    get error(): Error | null { return this._error; }
    set error(val: Error | null) { this._error = val; }

    get isFinalizing(): boolean { return this._isFinalizing; }
    set isFinalizing(val: boolean) { this._isFinalizing = val; }

    get isCompleted(): boolean { return this._isCompleted; }
    get isAborted(): boolean { return this._isAborted; }

    /**
     * 检查是否已达到“可提交”状态：
     * 具备最终文本 + 后端事务确认信息
     */
    public canFinalize(): boolean {
        return this._finalText !== null && this._committedInfo !== null && !this._isFinalizing;
    }

    public markCompleted(): void {
        this._isCompleted = true;
    }

    public markAborted(): void {
        this._isAborted = true;
        this._isCompleted = true;
    }
}
