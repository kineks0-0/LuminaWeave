import type { AgentMessage } from '@earendil-works/pi-agent-core';
import type { AgentSessionActiveTurn, AgentSessionTurnLogCursor } from './AgentSessionInternals.js';
import type { AgentSessionLog } from './AgentSessionLog.js';
import type { AgentSessionLogPayload } from './AgentSessionTypes.js';
import type { AgentSessionTurnContext } from './AgentTurnContext.js';

// 回合在日志中的写入检查点。无状态函数：游标挂在回合对象（或空闲操作的临时游标）上，日志由调用方传入。
// 日志是附属于会话的持久化旁路：写入失败只记录错误并返回 false，不得让回合卡死或改变回合结果。

export const createCursorAtHead = (log: AgentSessionLog): AgentSessionTurnLogCursor => ({
    tailId: log.getHeadId(),
    committed: 0
});

/** 沿游标链追加一条；仅在成功后推进 tailId，失败返回 false。 */
export const appendTurnLog = (
    log: AgentSessionLog | undefined,
    cursor: AgentSessionTurnLogCursor | undefined,
    payload: AgentSessionLogPayload
): boolean => {
    if (!log || !cursor) return false;
    try {
        cursor.tailId = log.append(payload, cursor.tailId);
        return true;
    } catch (error: unknown) {
        console.error({ error }, 'Agent session log append failed.');
        return false;
    }
};

/** runTurn 开始：写 turn:start 与本轮 user 消息（即交给 agent.prompt() 的对象），并建立游标。 */
export const startTurnLog = (
    log: AgentSessionLog | undefined,
    turn: AgentSessionActiveTurn,
    context: AgentSessionTurnContext
): void => {
    if (!log) return;
    const cursor = createCursorAtHead(log);
    turn.log = cursor;
    appendTurnLog(log, cursor, { kind: 'turn', turnId: turn.turnId, phase: 'start', model: context.model });
    // user 消息写失败时 committed 保持 0，后续检查点的 commitTurnMessages 会从 historyEnd 处重试。
    if (appendTurnLog(log, cursor, { kind: 'message', turnId: turn.turnId, message: context.userMessage })) {
        cursor.committed = 1;
    }
};

/**
 * 把本回合消息记录中 [historyEnd + committed, end) 提交到日志。
 * 日志里该回合的 message 条目始终是消息记录的前缀：写入失败即停止，committed 不推进，
 * 之后的检查点会从失败处自动重试。
 */
export const commitTurnMessages = (
    log: AgentSessionLog | undefined,
    turn: AgentSessionActiveTurn,
    end: number
): void => {
    const cursor = turn.log;
    if (!log || !cursor) return;
    const messages: AgentMessage[] = turn.agent.state.messages;
    for (let index = turn.historyEnd + cursor.committed; index < end; index += 1) {
        const written = appendTurnLog(log, cursor, { kind: 'message', turnId: turn.turnId, message: messages[index] });
        if (!written) return;
        cursor.committed = index + 1 - turn.historyEnd;
    }
};

/** 当前分支上有未解决的审批或未关闭的回合时拒绝开新回合：新回合会挂在它们之下，使日志含义混乱。 */
export const assertLogReadyForTurn = (log: AgentSessionLog | undefined, turnId: string): void => {
    if (!log) return;
    if (log.findPendingApproval() || log.findInterruptedTurn()) {
        throw new Error('AgentSession log has an unresolved turn; restore, discard or close it first');
    }
    if (log.getTurnStart(turnId)) throw new Error(`AgentSession turnId already exists in the log branch: ${turnId}`);
};
