import { LuminaChatMessage, MessageUtils } from '../LuminaMessage.js';
import { BaseXMLInterceptor, type StreamingPolicy } from '../BaseXMLInterceptor.js';

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
    public static resolveForSTWrite(msg: Partial<LuminaChatMessage>): string {
        const extraMesST = typeof msg.extra?.mesST === 'string' ? msg.extra.mesST : undefined;
        return msg.mesST ?? extraMesST ?? msg.mesRaw ?? msg.mes ?? '';
    }

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
 * 消息比较器 - 共享核心版
 */
export class SharedMessageComparator {
    public static getStateSnapshot(msg: Partial<LuminaChatMessage>): string {
        const text = SharedMessageTextResolver.resolveForSTWrite(msg);
        const normText = MessageUtils.normalize(text);
        const name = msg.name || '';
        const role = msg.role || '';
        const isHidden = msg.is_hidden ? '1' : '0';
        
        const rawString = `${name}|${role}|${isHidden}|${normText}`;
        return this.hash(rawString, 'snap');
    }

    private static hash(text: string, prefix: string): string {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) - hash) + text.charCodeAt(i);
            hash |= 0;
        }
        return `${prefix}_${Math.abs(hash).toString(16).substring(0, 8)}`;
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

    /**
     * 计算对话序列差异 (UI 同步用)
     */
    public compareStates(localChat: LuminaChatMessage[], stChat: LuminaChatMessage[]): DiffResult {
        const onlyInIndependent: any[] = [];
        const onlyInST: any[] = [];
        const updated: any[] = [];

        const localSequence = localChat.map((m) => this.toComparable(m, 'lumina'));
        const stSequence = stChat.map((m) => this.toComparable(m, 'st'));
        
        const stMsgMap = new Map(stSequence.map(m => [m.id, m]));
        const localMsgMap = new Map(localSequence.map(m => [m.id, m]));

        for (const local of localSequence) {
            const stNode = stMsgMap.get(local.id!);
            if (!stNode) {
                onlyInIndependent.push(local);
            } else {
                const metaDiff =
                    MessageUtils.normalize(local.name) !== MessageUtils.normalize(stNode.name)
                    || MessageUtils.normalize(local.role) !== MessageUtils.normalize(stNode.role)
                    || (!!local.is_hidden) !== (!!stNode.is_hidden);
                
                const isDiff = metaDiff || local.stFingerprint !== stNode.stFingerprint;
                
                if (isDiff) {
                    const baselineFp = stNode.stFingerprintStored || '';
                    const isSTEdit =
                        (baselineFp !== '' && baselineFp === local.stFingerprint && stNode.stFingerprint !== baselineFp)
                        || (local.fingerprint === stNode.fingerprint && local.stFingerprint !== stNode.stFingerprint);
                    
                    updated.push({ ...local, _isSTEdit: isSTEdit });
                }
            }
        }

        for (const st of stSequence) {
            if (!localMsgMap.has(st.id)) {
                onlyInST.push(st);
            }
        }

        let divergenceIndex = -1;
        const maxLen = Math.max(localSequence.length, stSequence.length);
        for (let i = 0; i < maxLen; i++) {
            const left = localSequence[i];
            const right = stSequence[i];
            if (!left || !right || left.id !== right.id) {
                divergenceIndex = i;
                break;
            }
        }

        const luminaOriginatedUpdates = updated.filter(u => !u._isSTEdit);

        return {
            onlyInIndependent,
            onlyInST,
            updated,
            independentSequence: localSequence,
            stSequence,
            diffCount: onlyInIndependent.length + onlyInST.length + updated.length,
            hasConflict: onlyInIndependent.length > 0 || onlyInST.length > 0 || updated.length > 0,
            hasDivergence: (onlyInIndependent.length > 0 || luminaOriginatedUpdates.length > 0) && onlyInST.length > 0,
            divergenceIndex
        };
    }

    private toComparable(msg: LuminaChatMessage, side: 'st' | 'lumina') {
        const { id, fingerprint } = this.identifyMessage(msg);
        const finalMes = MessageUtils.normalize(SharedMessageTextResolver.resolveForSTWrite(msg));

        const stFingerprintStored = (msg?.extra?.stFingerprint || msg.stFingerprint || '') as string;
        const compareText = side === 'st' 
            ? (msg.mes || SharedMessageTextResolver.resolveForSTWrite(msg)) 
            : (msg.mesST || msg?.extra?.mesST || SharedMessageTextResolver.resolveForSTWrite(msg));
        
        const stFingerprint = MessageUtils.getFingerprint(compareText);

        return {
            id,
            name: msg?.name || '',
            role: msg?.role || '',
            mes: finalMes,
            fingerprint,
            stFingerprint,
            stFingerprintStored,
            is_hidden: msg.is_hidden
        };
    }
}
