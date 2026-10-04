/**
 * 宏运行时公共类型。
 *
 * 口径：
 * - 一期覆盖 ST 核心宏（角色/设定/时间/随机/变量/lastMessage 等）与 if 块扩展；
 *   TavernHelper 附加宏不在范围内，未知宏原样保留（与 ST 的未知宏行为一致）。
 * - 变量读写经由 `MacroVariableView` 抽象；组装期由暂存实现接管，
 *   成功提交 / 失败丢弃由管线负责，运行时本身不改动持久层。
 */

export type MacroVariableScope = 'local' | 'global';

export interface MacroVariableSnapshot {
    local: Record<string, string>;
    global: Record<string, string>;
}

export interface MacroVariableMutation {
    scope: MacroVariableScope;
    name: string;
    previous: string | null;
    value: string | null;
}

export interface MacroVariableView {
    get(scope: MacroVariableScope, name: string): string | null;
    set(scope: MacroVariableScope, name: string, value: string): void;
}

export interface MacroMessageLike {
    role: string;
    content: string;
}

export interface MacroContext {
    characterName?: string;
    userName?: string;
    persona?: string;
    description?: string;
    personality?: string;
    scenario?: string;
    input?: string;
    model?: string;
    original?: string;
    messages?: MacroMessageLike[];
    variables: MacroVariableView;
    /** 可注入时钟，便于测试；默认 `new Date()`。 */
    now?: Date;
    /** 可注入随机源，返回 [0, 1)；默认 `Math.random`。 */
    random?: () => number;
    /** `pick` 的稳定种子（通常是会话 id），保证同一会话内取值稳定。 */
    pickSeed?: string;
    /** `weekday` 的本地化 locale；默认 `en-US` 以对齐 ST 默认。 */
    locale?: string;
}

export interface MacroTrace {
    warnings: string[];
    usedMacros: string[];
    unresolvedMacros: string[];
}

export interface MacroResult {
    text: string;
    trace: MacroTrace;
}

export const createMacroTrace = (): MacroTrace => ({
    warnings: [],
    usedMacros: [],
    unresolvedMacros: []
});

export const createEmptyVariableSnapshot = (): MacroVariableSnapshot => ({
    local: {},
    global: {}
});
