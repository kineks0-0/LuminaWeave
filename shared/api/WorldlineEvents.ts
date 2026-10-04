/**
 * 世界线事件名契约（前后端与宿主驱动共享）。
 * WorldlineStore 负责发射；驱动层与 UI 只消费事件名，不依赖 Core 实现。
 */
export enum WorldlineEvent {
    SWITCHED = 'WORLDLINE_SWITCHED',
    BRANCHED = 'WORLDLINE_BRANCHED',
    ROLLED_BACK = 'WORLDLINE_ROLLED_BACK',
    UPDATED = 'WORLDLINE_UPDATED',
    NODE_UPDATED = 'WORLDLINE_NODE_UPDATED'
}
