import { STBridge } from './STBridge';
import type { LuminaChatMessage } from './ChatManager';

/**
 * ״̬�ṩ�߽ӿ�
 * ���ͨ��ʵ�ִ˽ӿ�������ȫ��״̬�Ŀ�����ָ�
 */
export interface StateProvider {
    id: string; // Ψһ��ʶ���� 'director-store'
    exportSnapshot: () => unknown;
    importSnapshot: (snapshot: unknown) => void;
    reset: () => void;
}

/**
 * ����״̬�ṩ�߽ӿ�
 * ����֧�� Mutation �Ȼ���ָ������������߼�
 */
export interface IncrementalProvider extends StateProvider {
    flushDeltas: () => unknown[];
    applyDelta: (delta: unknown) => void;
}

/**
 * ȫ�ּ�������� (����)
 * �����ڵ㣨�����֧����״̬���ա��������ز��߼�
 */
export class MemoryManager {
    private providers: Map<string, StateProvider | IncrementalProvider> = new Map();

    /**
     * ע��һ��״̬�ṩ��
     */
    public registerProvider(provider: StateProvider | IncrementalProvider) {
        this.providers.set(provider.id, provider);
        console.log(`[MemoryManager] Registered state provider: ${provider.id}`);
    }

    /**
     * ����ǰ״̬���󶨵���Ϣ�ڵ� (onMessageAdding ����)
     * @param msg ��ǰ������ӵ���Ϣ����
     * @param trace ��ǰ��Ϣ����Դ�� (��������ǰ��Ϣ)
     * @param forceSnapshot �Ƿ�ǿ��ִ��ȫ������ (����ʱ�����صȳ���)
     */
    public captureState(msg: LuminaChatMessage, trace: LuminaChatMessage[], forceSnapshot: boolean = false) {
        const nodeDepth = trace.length;

        // 1. �������� (Deltas) - ��Ȼ onMessageAdding ��Ҫ��Ϊ�˳�ʼ���ڵ㣬��������л������Գ�ˢһ��
        this.commitDeltas(msg);

        // 2. �ж��Ƿ�ִ��ȫ������ (Snapshots)
        // ���Ĺ��򣺽���ǿ��ģʽ���⵽�ǡ���֧���ε㡱ʱִ�п���
        // ȥ�� nodeDepth === 0 �� nodeDepth % 10 === 0��ʵ�ּ���洢��ȫ���ع�
        const isBranchPoint = msg.parentId && trace.length > 0 && trace[trace.length - 1].id !== msg.parentId;
        const shouldSnapshot = forceSnapshot || isBranchPoint;

        if (shouldSnapshot) {
            this.providers.forEach(provider => {
                const snapshot = provider.exportSnapshot();
                if (snapshot !== undefined) {
                    if (!msg.extra) msg.extra = {};
                    msg.extra[`${provider.id}_snapshot`] = snapshot;
                }
            });
            console.log(`[MemoryManager] Snapshot captured at node ${msg.id} (depth ${nodeDepth}).`);
        }
    }

    /**
     * �������������������䶯�ύ��ָ����Ϣ
     * ���ó����������ɽ��� (onGenerationEnded) ʱ�������ɹ����в�����ָ����
     */
    public commitDeltas(msg: LuminaChatMessage) {
        this.providers.forEach(provider => {
            if ('flushDeltas' in provider) {
                const deltas = (provider as IncrementalProvider).flushDeltas();
                if (deltas.length > 0) {
                    if (!msg.extra) msg.extra = {};
                    // ����Ѵ��� delta�����ټ����������ƴ��
                    const existing = msg.extra[`${provider.id}_delta`] || [];
                    msg.extra[`${provider.id}_delta`] = [...existing, ...deltas];
                    console.debug(`[MemoryManager] Committed ${deltas.length} deltas to node ${msg.id} for provider ${provider.id}.`);
                }
            }
        });
    }

    /**
     * ���ݽڵ���·�ָ�״̬ (onMessageSelected ����)
     * @param nodeId Ŀ��ڵ� ID
     * @param trace Ŀ��ڵ����Դ�� (����Ŀ��ڵ㱾��)
     */
    public restoreState(nodeId: string, trace: LuminaChatMessage[]) {
        console.log(`[MemoryManager] Restoring state for node ${nodeId}, trace length: ${trace.length}`);

        // 1. ��ʼ�������������ṩ�ߵ��ɾ�״̬
        this.providers.forEach(p => p.reset());

        // 2. Ѱ������Ŀ��յ�
        let snapshotIndex = -1;
        for (let i = trace.length - 1; i >= 0; i--) {
            const hasSnapshot = Array.from(this.providers.keys()).some(id => trace[i].extra?.[`${id}_snapshot`]);
            if (hasSnapshot) {
                snapshotIndex = i;
                break;
            }
        }

        // 3. �������
        if (snapshotIndex !== -1) {
            const extra = trace[snapshotIndex].extra;
            this.providers.forEach(provider => {
                const snapshot = extra?.[`${provider.id}_snapshot`];
                if (snapshot) {
                    provider.importSnapshot(snapshot);
                }
            });
            console.log(`[MemoryManager] Base snapshot loaded from depth ${snapshotIndex}.`);
        }

        // 4. �ӿ��յ������ز����� (Deltas)
        const replayStartIndex = snapshotIndex !== -1 ? snapshotIndex + 1 : 0;
        for (let i = replayStartIndex; i < trace.length; i++) {
            const extra = trace[i].extra;
            if (!extra) continue;

            this.providers.forEach(provider => {
                const deltas = extra[`${provider.id}_delta`];
                if (Array.isArray(deltas) && 'applyDelta' in provider) {
                    deltas.forEach(d => (provider as IncrementalProvider).applyDelta(d));
                }
            });
        }

        console.log(`[MemoryManager] State restoration complete.`);
    }

    /**
     * ����������ע���״̬�ṩ��
     */
    public resetAll() {
        this.providers.forEach(p => p.reset());
        console.log(`[MemoryManager] All providers reset.`);
    }
}

/**
 * ȫ�ּ������������
 */
export const globalMemoryManager = new MemoryManager();
