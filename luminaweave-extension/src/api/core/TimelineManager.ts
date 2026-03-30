import { LuminaWeaveAPIBase } from './LuminaWeaveAPIBase.js';
import { SyncEngine } from './SyncEngine.js';
import { LuminaChatMessage as LuminaChatMessage } from './ChatManager.js';

export interface TimelineNode extends LuminaChatMessage {
    text: string; // ���ݾɰ� UI �ֶ�
    timestamp: number; // ���ݾɰ� UI �ֶ�
    _original?: LuminaChatMessage;
}

/**
 * TimelineManager (�����߹�����)
 * ������� ST ��Ϣ��·��������ѭ��ͼ��
 */
export class TimelineManager extends LuminaWeaveAPIBase {
    private parentApi: { chatManager: { localChatData: LuminaChatMessage[], activeLeafId: string | null } };
    public chatGraph: Record<string, TimelineNode> = {};
    public activeLeafId: string | null = null;
    public isSyncing: boolean = false;

    constructor(parentApi: any) {
        super();
        this.parentApi = parentApi;
    }

    /**
     * ͬ����ǰ�����֧
     */
    async syncTimelineWithCurrentChat(): Promise<void> {
        this.isSyncing = true;
        try {
            // �����޸����Ա���Ӱ��ϵͳ�Ľڵ��Ϊ��׼����ȫ��ͼ�ף������ǽ����� ST �������ӽ�
            const localPool = this.parentApi.chatManager.localChatData || [];

            this.chatGraph = {};

            // ���Ƚ����нڵ��������
            localPool.forEach((msg: LuminaChatMessage) => {
            const id = msg.id || msg.fingerprint;
            if (!id) return;

            const node: TimelineNode = {
                ...msg,
                id: id,
                fingerprint: id,
                parentId: msg.parentId || null,
                role: msg.role,
                text: msg.mes || msg.mesRaw || '',
                timestamp: msg.send_date || Date.now(),
                _original: msg
            };
            this.chatGraph[id] = node;
        });

        this.activeLeafId = this.parentApi.chatManager.activeLeafId;

        // �����޸�����³���ָ���һػ���
        // ��� activeLeafId ��Ч��Ϊ�գ���ͼ�������ݣ��Զ��ع鵽����ĩβ���ĩβ�Է����հ�
        const hasData = Object.keys(this.chatGraph).length > 0;
        if (hasData && (!this.activeLeafId || !this.chatGraph[this.activeLeafId])) {
            console.warn('[TimelineManager] activeLeafId ��ʧ����Ч�����ڳ����Զ�У׼');
                // ����Ѱ�ҳ������һ���ڵ㣬��Ϊ��ͨ���������ӵ�
                if (localPool.length > 0) {
                const lastMsgId = localPool[localPool.length - 1].id;
                if (this.chatGraph[lastMsgId]) {
                    this.activeLeafId = lastMsgId;
                    this.parentApi.chatManager.activeLeafId = this.activeLeafId;
                    console.log('[TimelineManager] ��У׼ָ����ĩβ�ڵ�:', this.activeLeafId);
                }
            }
        }

        this.emit('TIMELINE_UPDATED', { graph: this.chatGraph, activeId: this.activeLeafId });
    } finally {
        this.isSyncing = false;
    }
    }


    /**
     * ����������Ϊ������Ϣ�������������ȶ�ָ��
     */
    public generateStableIds(messages: LuminaChatMessage[]): string[] {
    return messages.map((msg) => SyncEngine.getFingerprint(msg.mesRaw || msg.mes || ''));
}

/**
 * ��ȡָ����֧��������·
 */
getTrace(leafId: string): TimelineNode[] {
    const trace: TimelineNode[] = [];
    let currId: string | number | null = leafId;
    const visited = new Set<string | number>();

    while (currId !== null) {
        const node: TimelineNode | undefined = this.chatGraph[currId.toString()];
        if (!node || visited.has(currId)) break;

        visited.add(currId);
        trace.unshift(node);
        currId = node.parentId;
    }
    return trace;
}
}
