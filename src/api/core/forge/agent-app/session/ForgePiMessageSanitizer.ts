import type { AgentMessage } from '@earendil-works/pi-agent-core';
import { isRecord } from '@shared/CommonUtils.js';

export interface ForgePiReplayTarget {
    providerId?: string | null;
    modelId?: string | null;
}

export interface ForgePiAssistantMessageClassification {
    visibleText: string;
    providerReasoningArtifacts: unknown[];
    toolProtocolParts: unknown[];
    unsafeInternalParts: unknown[];
    replayMessage: AgentMessage;
}

type AssistantLike = Extract<AgentMessage, { role: 'assistant' }>;

const hasSignature = (part: Record<string, unknown>): boolean =>
    [part.thinkingSignature, part.reasoningSignature, part.thoughtSignature]
        .some(value => typeof value === 'string' && value.length > 0);

const isProviderReasoningPart = (part: Record<string, unknown>): boolean =>
    (part.type === 'thinking' || part.type === 'reasoning') && hasSignature(part);

const isToolProtocolPart = (part: Record<string, unknown>): boolean =>
    part.type === 'toolCall';

const isVisibleTextPart = (part: Record<string, unknown>): part is { type: 'text'; text: string } =>
    part.type === 'text' && typeof part.text === 'string';

const matchesReplayTarget = (message: AssistantLike, target: ForgePiReplayTarget): boolean => {
    const providerMatches = !target.providerId || message.provider === target.providerId;
    const responseModel = message.responseModel ?? message.model;
    const modelMatches = !target.modelId || message.model === target.modelId || responseModel === target.modelId;
    return providerMatches && modelMatches;
};

export function classifyForgePiAssistantMessageForReplay(
    message: AssistantLike,
    target: ForgePiReplayTarget = {}
): ForgePiAssistantMessageClassification {
    const visibleTextParts: unknown[] = [];
    const providerReasoningArtifacts: unknown[] = [];
    const toolProtocolParts: unknown[] = [];
    const unsafeInternalParts: unknown[] = [];
    const replayContent: unknown[] = [];
    const canReplayProviderReasoning = matchesReplayTarget(message, target);

    for (const part of message.content) {
        if (!isRecord(part)) {
            unsafeInternalParts.push(part);
            continue;
        }
        if (isVisibleTextPart(part)) {
            visibleTextParts.push(part);
            replayContent.push(part);
            continue;
        }
        if (isToolProtocolPart(part)) {
            toolProtocolParts.push(part);
            replayContent.push(part);
            continue;
        }
        if (isProviderReasoningPart(part) && canReplayProviderReasoning) {
            providerReasoningArtifacts.push(part);
            replayContent.push(part);
            continue;
        }
        unsafeInternalParts.push(part);
    }

    return {
        visibleText: visibleTextParts
            .filter(isRecord)
            .map(part => typeof part.text === 'string' ? part.text : '')
            .join(''),
        providerReasoningArtifacts,
        toolProtocolParts,
        unsafeInternalParts,
        replayMessage: {
            ...message,
            content: replayContent as AssistantLike['content']
        }
    };
}

export function sanitizeForgePiAgentMessageForReplay(
    message: AgentMessage,
    target: ForgePiReplayTarget = {}
): AgentMessage | null {
    if (message.role !== 'assistant') return message;
    return classifyForgePiAssistantMessageForReplay(message, target).replayMessage;
}
