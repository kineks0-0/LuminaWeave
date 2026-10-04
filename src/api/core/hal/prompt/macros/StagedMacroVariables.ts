import type {
    MacroVariableMutation,
    MacroVariableScope,
    MacroVariableSnapshot,
    MacroVariableView
} from './MacroTypes.js';

const cloneScope = (source: Record<string, string>): Record<string, string> => ({ ...source });

/**
 * 组装期变量暂存。
 *
 * - 读取：暂存值优先，其次基线快照，最后 `null`。
 * - 写入：只写暂存，不碰基线；每次写入记录 mutation 供审计。
 * - 提交 / 丢弃：由管线在生成成功 / 失败时决定是否调用 `toSnapshot` 落库；
 *   预览与 dry-run 直接丢弃实例即可。
 */
export class StagedMacroVariables implements MacroVariableView {
    private readonly base: MacroVariableSnapshot;
    private readonly staged: MacroVariableSnapshot;
    private readonly mutationList: MacroVariableMutation[] = [];

    constructor(base: MacroVariableSnapshot) {
        this.base = {
            local: cloneScope(base.local),
            global: cloneScope(base.global)
        };
        this.staged = { local: {}, global: {} };
    }

    public get(scope: MacroVariableScope, name: string): string | null {
        const staged = this.staged[scope][name];
        if (staged !== undefined) return staged;
        const baseValue = this.base[scope][name];
        return baseValue !== undefined ? baseValue : null;
    }

    public set(scope: MacroVariableScope, name: string, value: string): void {
        const previous = this.get(scope, name);
        this.staged[scope][name] = value;
        this.mutationList.push({ scope, name, previous, value });
    }

    public add(scope: MacroVariableScope, name: string, delta: number): void {
        const current = Number(this.get(scope, name) ?? '0');
        const base = Number.isFinite(current) ? current : 0;
        this.set(scope, name, String(base + delta));
    }

    public getMutations(): readonly MacroVariableMutation[] {
        return this.mutationList;
    }

    public hasChanges(): boolean {
        return this.mutationList.length > 0;
    }

    /** 基线 + 暂存的最终快照；生成成功时交给持久层。 */
    public toSnapshot(): MacroVariableSnapshot {
        return {
            local: { ...this.base.local, ...this.staged.local },
            global: { ...this.base.global, ...this.staged.global }
        };
    }
}
