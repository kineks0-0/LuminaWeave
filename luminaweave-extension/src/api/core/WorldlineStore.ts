import { LuminaWeaveAPIBase } from './LuminaWeaveAPIBase.js';
import { LuminaChatMessage } from './ChatManager.js';

export enum WorldlineEvent {
    SWITCHED = 'WORLDLINE_SWITCHED',
    BRANCHED = 'WORLDLINE_BRANCHED',
    ROLLED_BACK = 'WORLDLINE_ROLLED_BACK',
    UPDATED = 'WORLDLINE_UPDATED'
}

/**
 * WorldlineStore
 * 负责管理消息图谱，节点池，分支指针等数据
 */
export class WorldlineStore extends LuminaWeaveAPIBase {
    private nodes: Map<string, LuminaChatMessage> = new Map();
    private childrenMap: Map<string | null, string[]> = new Map();
    private parentMap: Map<string, string | null> = new Map();
    private _activeLeafId: string | null = null;

    constructor() {
        super();
    }

    private _addChild(node: LuminaChatMessage) {
        const pId = node.parentId || null;
        if (!this.childrenMap.has(pId)) {
            this.childrenMap.set(pId, []);
        }
        const children = this.childrenMap.get(pId)!;
        if (!children.includes(node.id)) {
            children.push(node.id);
        }
        this.parentMap.set(node.id, pId);
    }

    private _removeChild(nodeId: string) {
        const oldPId = this.parentMap.get(nodeId);
        if (oldPId !== undefined) {
            const children = this.childrenMap.get(oldPId);
            if (children) {
                const idx = children.indexOf(nodeId);
                if (idx !== -1) children.splice(idx, 1);
            }
            this.parentMap.delete(nodeId);
        }
    }

    // --- 状态管理 ---

    public get activeLeafId(): string | null {
        return this._activeLeafId;
    }

    public set activeLeafId(id: string | null) {
        if (this._activeLeafId !== id) {
            this._activeLeafId = id;
            this.emit(WorldlineEvent.SWITCHED, id);
        }
    }

    public get nodePool(): LuminaChatMessage[] {
        return Array.from(this.nodes.values());
    }

    // --- 节点管理 ---

    /**
     * 设置全部节点
     */
    public setNodes(nodes: LuminaChatMessage[]): void {
        this.nodes.clear();
        this.childrenMap.clear();
        this.parentMap.clear();
        nodes.forEach(n => {
            this.nodes.set(n.id, n);
            this._addChild(n);
        });
        this.emit(WorldlineEvent.UPDATED);
    }

    /**
     * 插入或更新节点
     */
    public upsertNode(node: LuminaChatMessage, silent: boolean = false): void {
        const existing = this.nodes.get(node.id);
        if (existing) {
            this._removeChild(node.id);
        }
        this.nodes.set(node.id, node);
        this._addChild(node);
        if (!silent) this.emit(WorldlineEvent.UPDATED);
    }

    /**
     * 合并节点
     */
    public mergeNodes(newNodes: LuminaChatMessage[]): void {
        let changed = false;
        newNodes.forEach(n => {
            if (!this.nodes.has(n.id)) {
                this.nodes.set(n.id, n);
                this._addChild(n);
                changed = true;
            }
        });
        if (changed) this.emit(WorldlineEvent.UPDATED);
    }

    /**
     * 获取指定节点
     */
    public getNode(id: string): LuminaChatMessage | undefined {
        return this.nodes.get(id);
    }

    // --- 图谱算法 ---

    /**
     * 获取指定节点的完整链
     */
    public getTrace(leafId: string | null): LuminaChatMessage[] {
        if (!leafId) return [];
        const trace: LuminaChatMessage[] = [];
        let currId: string | null = leafId;
        const visited = new Set<string>();

        while (currId !== null) {
            if (visited.has(currId)) {
                console.warn('[WorldlineStore] 发现循环:', currId);
                break;
            }
            const node = this.nodes.get(currId);
            if (!node) break;

            visited.add(currId);
            trace.unshift(node);
            currId = node.parentId || null;
        }
        return trace;
    }

    /**
     * 删除指定节点
     */
    public removeNode(id: string, silent: boolean = false): void {
        const node = this.nodes.get(id);
        if (node) {
            this._removeChild(id);
            this.nodes.delete(id);
            if (!silent) this.emit(WorldlineEvent.UPDATED);
        }
    }

    /**
     * 删除指定节点
     * 优化：通过childrenMap直接获取子节点，避免O(N^2)遍历
     */
    public removeSubtree(rootId: string): void {
        const toDelete = new Set<string>();
        
        // 2. 递归收集所有子节点
        const collect = (pid: string) => {
            const children = this.childrenMap.get(pid);
            if (children) {
                // 复制数组，避免在遍历时修改原数组
                [...children].forEach(id => {
                    toDelete.add(id);
                    collect(id);
                });
            }
        };

        collect(rootId);
        
        // 3. 批量删除
        toDelete.forEach(id => {
            const node = this.nodes.get(id);
            if (node) {
                this._removeChild(id);
                this.nodes.delete(id);
            }
        });
        
        this.emit(WorldlineEvent.ROLLED_BACK, { rootId, deletedCount: toDelete.size });
        this.emit(WorldlineEvent.UPDATED);
    }
    
    /**
     * 获取指定节点
     */
    public getChildren(parentId: string | null): LuminaChatMessage[] {
        const childrenIds = this.childrenMap.get(parentId);
        if (!childrenIds) return [];
        return childrenIds.map(id => this.nodes.get(id)).filter((n): n is LuminaChatMessage => n !== undefined);
    }

    /**
     * 节点是否存在于图中
     */
    public hasNode(id: string): boolean {
        return this.nodes.has(id);
    }

    /**
     * 清空存储
     */
    public clear(): void {
        this.nodes.clear();
        this.childrenMap.clear();
        this.parentMap.clear();
        this._activeLeafId = null;
        this.emit(WorldlineEvent.UPDATED);
    }
}
