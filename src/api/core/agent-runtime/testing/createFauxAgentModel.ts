import { createFauxCore, type FauxResponseStep } from '@earendil-works/pi-ai';
import type { StreamFn } from '@earendil-works/pi-agent-core';

/** 测试辅助：基于 pi-ai faux provider 的模型与 streamFn，供 AgentSession 等用真实 pi Agent 做确定性测试。 */
export const createFauxAgentModel = (options: { tokensPerSecond?: number } = {}) => {
    const core = createFauxCore({
        api: 'faux',
        provider: 'faux',
        models: [{ id: 'faux-model' }],
        ...(options.tokensPerSecond ? { tokensPerSecond: options.tokensPerSecond } : {})
    });
    const streamFn: StreamFn = core.streamSimple;
    return {
        model: core.getModel(),
        streamFn,
        setResponses: (responses: FauxResponseStep[]) => core.setResponses(responses),
        state: core.state
    };
};
