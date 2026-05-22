import { describe, expect, it } from 'vitest';
import { PromptAssemblyRouter } from '@/api/core/hal/prompt/PromptAssemblyRouter.js';
import type { PromptAssemblyResult } from '@/types/PromptAssemblyTypes.js';

describe('PromptAssemblyRouter', () => {
    it('routes explicit ST native chat continuation when the session is bound to ST', () => {
        const route = PromptAssemblyRouter.route({
            target: 'chat.continuation',
            sessionBinding: {
                kind: 'st-chat',
                chatId: 'chat_1',
                sourceId: 'chat'
            },
            policy: { engine: 'st-native' }
        });

        expect(route.engine).toBe('st-native');
        expect(route.diagnostics).toEqual([]);
    });

    it('defaults auto chat continuation to Lumina even when the session is bound to ST', () => {
        const route = PromptAssemblyRouter.route({
            target: 'chat.continuation',
            sessionBinding: {
                kind: 'st-chat',
                chatId: 'chat_1',
                sourceId: 'chat'
            },
            policy: { engine: 'auto' }
        });

        expect(route.engine).toBe('lumina');
        expect(route.reason).toContain('Auto policy defaults to Lumina');
    });

    it('accepts explicit lumina-assembly as Lumina-owned assembly route', () => {
        const route = PromptAssemblyRouter.route({
            target: 'chat.continuation',
            sessionBinding: {
                kind: 'st-chat',
                chatId: 'chat_1',
                sourceId: 'chat'
            },
            policy: { engine: 'lumina-assembly' }
        });

        expect(route.requestedEngine).toBe('lumina-assembly');
        expect(route.engine).toBe('lumina');
        expect(route.reason).toContain('Lumina prompt assembly was explicitly selected');
    });

    it('rejects ST native for plugin sessions and falls back to Lumina with diagnostics', () => {
        const route = PromptAssemblyRouter.route({
            target: 'chat.continuation',
            sessionBinding: {
                kind: 'plugin-session',
                sessionId: 'plugin_chat_1',
                sourceId: 'chat'
            },
            policy: { engine: 'st-native' }
        });

        expect(route.engine).toBe('lumina');
        expect(route.diagnostics[0]).toMatchObject({
            level: 'warning',
            code: 'PROMPT_ENGINE_ST_NATIVE_REQUIRES_ST_CHAT'
        });
    });

    it('forces Forge targets to Lumina even when ST native is requested', () => {
        const route = PromptAssemblyRouter.route({
            target: 'forge.planner',
            sessionBinding: {
                kind: 'st-chat',
                chatId: 'bound_chat',
                sourceId: 'forge'
            },
            policy: { engine: 'st-native', sourceMode: 'project' }
        });

        expect(route.engine).toBe('lumina');
        expect(route.sourceMode).toBe('project');
        expect(route.diagnostics[0]).toMatchObject({
            code: 'PROMPT_ENGINE_ST_NATIVE_UNSUPPORTED_TARGET'
        });
    });

    it('attaches route diagnostics before assembly diagnostics', () => {
        const route = PromptAssemblyRouter.route({
            target: 'forge.card',
            sessionBinding: {
                kind: 'plugin-session',
                sessionId: 'forge_1',
                sourceId: 'forge'
            },
            policy: { engine: 'st-native' }
        });

        const assembly: PromptAssemblyResult = {
            messages: [],
            sourceUnits: [],
            plannedUnits: [],
            trace: [],
            diagnostics: [{
                level: 'info' as const,
                code: 'ASSEMBLY_INFO',
                message: 'assembly info'
            }]
        };
        const result = PromptAssemblyRouter.attachRoute(assembly, route);

        expect(result.route?.engine).toBe('lumina');
        expect(result.diagnostics.map(diagnostic => diagnostic.code)).toEqual([
            'PROMPT_ENGINE_ST_NATIVE_UNSUPPORTED_TARGET',
            'ASSEMBLY_INFO'
        ]);
    });
});
