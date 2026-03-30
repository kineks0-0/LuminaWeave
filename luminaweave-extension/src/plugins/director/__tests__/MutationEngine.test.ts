import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the engine
vi.mock('../../api/core/XMLInterceptor', () => ({
    globalXMLInterceptor: {
        registerXMLParser: vi.fn(),
    },
}));

vi.mock('../../api/core/PromptRegistry', () => ({
    globalPromptRegistry: {
        register: vi.fn(),
    },
    PromptSlot: {
        POST_CONTEXT: 'POST_CONTEXT',
    },
}));

import { IncrementalMutationEngine } from '../MutationEngine';

describe('IncrementalMutationEngine JS Execution', () => {
    let engine: IncrementalMutationEngine;
    const mockGlobalProxy = {
        description: 'global',
        onUpdate: vi.fn(),
    };
    const mockCharactersProxy = {
        onAdd: vi.fn(),
        onUpdate: vi.fn(),
    };
    const mockInventoryProxy = {
        onAdd: vi.fn(),
    };

    beforeEach(() => {
        engine = new IncrementalMutationEngine();
        engine.registerDataModel('global', mockGlobalProxy);
        engine.registerDataModel('characters', mockCharactersProxy);
        engine.registerDataModel('inventory', mockInventoryProxy);
        vi.clearAllMocks();
    });

    it('should handle top-level model assignment (update)', () => {
        engine.executeMutation('global = {time: "正午", location: "林间官道石亭"}');
        expect(mockGlobalProxy.onUpdate).toHaveBeenCalledWith(
            { time: "正午", location: "林间官道石亭" },
            undefined,
            undefined
        );
    });

    it('should handle method calls with objects', () => {
        engine.executeMutation('characters.add("师傅", {description: "雄狼", affinity: 85})');
        expect(mockCharactersProxy.onAdd).toHaveBeenCalledWith(
            { description: "雄狼", affinity: 85 },
            undefined,
            "师傅"
        );
    });

    it('should handle property assignment (update field)', () => {
        engine.executeMutation('global.time = "夜晚"');
        expect(mockGlobalProxy.onUpdate).toHaveBeenCalledWith(
            { time: "夜晚" },
            undefined,
            undefined
        );
    });

    it('should handle nested property assignment via KeyProxy', () => {
        engine.executeMutation('characters["师傅"].status = "忙碌"');
        expect(mockCharactersProxy.onUpdate).toHaveBeenCalledWith(
            { status: "忙碌" },
            undefined,
            "师傅"
        );
    });

    it('should handle multiple statements in one mutation', () => {
        engine.executeMutation('global.time = "晨曦"; inventory.add({item: "木剑"})');
        expect(mockGlobalProxy.onUpdate).toHaveBeenCalled();
        expect(mockInventoryProxy.onAdd).toHaveBeenCalledWith({ item: "木剑" }, undefined, undefined);
    });

    it('should fix Chinese quotes and execute correctly', () => {
        engine.executeMutation('characters[“师傅”].status = ‘发情’');
        expect(mockCharactersProxy.onUpdate).toHaveBeenCalledWith(
            { status: "发情" },
            undefined,
            "师傅"
        );
    });

    it('should correctly capture deltas into deltaCache', () => {
        engine.executeMutation('global.time = "黄昏"');
        const deltas = engine.flushDeltas();
        expect(deltas.length).toBe(1);
        expect(deltas[0]).toMatchObject({
            target: 'global',
            action: 'update',
            value: { time: "黄昏" }
        });
    });

    it('should be silent when executeMutation fails (graceful error handling)', () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        engine.executeMutation('illegal js syntax!!!');
        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(mockGlobalProxy.onUpdate).not.toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
    });

    it('should handle implicit update via function apply', () => {
        engine.executeMutation('global({weather: "晴朗"})');
        expect(mockGlobalProxy.onUpdate).toHaveBeenCalledWith({ weather: "晴朗" }, undefined, undefined);
    });
});
