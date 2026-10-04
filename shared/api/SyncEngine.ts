import { LuminaChatMessage, MessageUtils } from '../LuminaMessage.js';
import { BaseXMLInterceptor } from '../BaseXMLInterceptor.js';

/**
 * 差异比对结果接口
 */
export interface DiffResult {
    onlyInIndependent: any[];
    onlyInST: any[];
    updated: any[];
    independentSequence: any[];
    stSequence: any[];
    diffCount: number;
    hasConflict: boolean;
    hasDivergence: boolean;
    divergenceIndex: number;
}

/**
 * 文本解析器 - 共享核心版
 */
export class SharedMessageTextResolver {
    public static resolveForFingerprint(msg: any, interceptor: BaseXMLInterceptor): string {
        const extra = (msg?.extra || {}) as Record<string, unknown>;
        const normalizedRole = typeof extra.role === 'string' ? extra.role : msg?.role;
        const isUser = msg?.is_user === true || normalizedRole === 'user';
        const pluginRaw =
            (typeof (extra as any).pluginRaw === 'string' ? (extra as any).pluginRaw : undefined)
            ?? (typeof msg?.pluginRaw === 'string' ? msg.pluginRaw : undefined);
        const mesRaw =
            (typeof (extra as any).mesRaw === 'string' ? (extra as any).mesRaw : undefined)
            ?? (typeof msg?.mesRaw === 'string' ? msg.mesRaw : undefined);
        const raw =
            (!isUser ? pluginRaw : undefined)
            ?? mesRaw
            ?? (typeof msg?.message === 'string' ? msg.message : undefined)
            ?? (typeof msg?.mes === 'string' ? msg.mes : undefined)
            ?? pluginRaw
            ?? '';

        // 使用传入的拦截器进行清洗
        const cleaned = interceptor.cleanText(raw, { allowTopLevel: true });
        return MessageUtils.normalizeForFingerprint(cleaned);
    }
}

/**
 * 核心同步引擎 (前后端共享)
 * 纯逻辑算法实现，不依赖特定平台的 I/O 或存储。
 */
export class SyncEngine {
    constructor(private interceptor: BaseXMLInterceptor) {}

    /**
     * 统一标识消息
     */
    public identifyMessage(m: any): { id: string; fingerprint: string } {
        if (!m) return { id: MessageUtils.generateNodeId(), fingerprint: 'fp_00000000' };

        const extra = m.extra || {};
        const rawContent = SharedMessageTextResolver.resolveForFingerprint(m, this.interceptor);
        const fingerprint = extra.fingerprint || m.fingerprint || MessageUtils.getFingerprint(rawContent);

        let id = extra.id as string | undefined || m.id as string | undefined;
        if (!id) id = MessageUtils.generateNodeId();

        return { id, fingerprint };
    }

    /**
     * 对比两个节点池的差异 (JSONL 增量同步用)
     */
    public comparePools(localNodes: LuminaChatMessage[], remoteNodes: LuminaChatMessage[]): {
        added: LuminaChatMessage[],
        updated: LuminaChatMessage[],
        deletedIds: string[]
    } {
        const remoteMap = new Map(remoteNodes.map(n => [n.id, n]));
        const localMap = new Map(localNodes.map(n => [n.id, n]));

        const added: LuminaChatMessage[] = [];
        const updated: LuminaChatMessage[] = [];
        const deletedIds: string[] = [];

        for (const local of localNodes) {
            const remote = remoteMap.get(local.id);
            if (!remote) {
                added.push(local);
            } else if (local.fingerprint !== remote.fingerprint) {
                updated.push(local);
            }
        }

        for (const remote of remoteNodes) {
            if (!localMap.has(remote.id)) {
                deletedIds.push(remote.id);
            }
        }

        return { added, updated, deletedIds };
    }
}
