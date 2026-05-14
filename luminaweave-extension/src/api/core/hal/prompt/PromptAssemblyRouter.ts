import type { ResourceDiagnostic } from '@shared/resources/index.js';
import type {
    PromptAssemblyRequest,
    PromptAssemblyRouteDecision,
    PromptAssemblyTarget,
    PromptSourceMode
} from '../../../../types/PromptAssemblyTypes.js';

const CHAT_CONTINUATION_TARGET: PromptAssemblyTarget = 'chat.continuation';

const createDiagnostic = (
    level: ResourceDiagnostic['level'],
    code: string,
    message: string
): ResourceDiagnostic => ({
    level,
    code,
    message
});

export class PromptAssemblyRouter {
    static route(request: PromptAssemblyRequest): PromptAssemblyRouteDecision {
        const requestedEngine = request.policy?.engine ?? 'auto';
        const sourceMode: PromptSourceMode = request.policy?.sourceMode ?? 'bound-session';
        const diagnostics: ResourceDiagnostic[] = [];

        if (request.target !== CHAT_CONTINUATION_TARGET) {
            if (requestedEngine === 'st-native') {
                diagnostics.push(createDiagnostic(
                    'warning',
                    'PROMPT_ENGINE_ST_NATIVE_UNSUPPORTED_TARGET',
                    `ST native prompt engine only supports ${CHAT_CONTINUATION_TARGET}; ${request.target} will use Lumina prompt assembly.`
                ));
            }
            return {
                target: request.target,
                requestedEngine,
                engine: 'lumina',
                sessionBinding: request.sessionBinding,
                sourceMode,
                reason: `${request.target} is a Lumina-owned assembly target.`,
                diagnostics
            };
        }

        if (requestedEngine === 'st-native') {
            if (request.sessionBinding.kind === 'st-chat') {
                return {
                    target: request.target,
                    requestedEngine,
                    engine: 'st-native',
                    sessionBinding: request.sessionBinding,
                    sourceMode,
                    reason: 'ST native was explicitly selected for an ST-bound chat continuation.',
                    diagnostics
                };
            }

            diagnostics.push(createDiagnostic(
                'warning',
                'PROMPT_ENGINE_ST_NATIVE_REQUIRES_ST_CHAT',
                'ST native prompt engine requires an st-chat binding; plugin sessions will use Lumina prompt assembly.'
            ));
            return {
                target: request.target,
                requestedEngine,
                engine: 'lumina',
                sessionBinding: request.sessionBinding,
                sourceMode,
                reason: 'Plugin sessions cannot use ST native prompt assembly.',
                diagnostics
            };
        }

        return {
            target: request.target,
            requestedEngine,
            engine: 'lumina',
            sessionBinding: request.sessionBinding,
            sourceMode,
            reason: requestedEngine === 'lumina' || requestedEngine === 'lumina-assembly'
                ? 'Lumina prompt assembly was explicitly selected.'
                : 'Auto policy defaults to Lumina unless ST native is explicitly selected.',
            diagnostics
        };
    }

    static attachRoute<T extends { diagnostics: ResourceDiagnostic[]; route?: PromptAssemblyRouteDecision }>(
        result: T,
        route: PromptAssemblyRouteDecision
    ): T {
        return {
            ...result,
            route,
            diagnostics: [...route.diagnostics, ...result.diagnostics]
        };
    }
}
