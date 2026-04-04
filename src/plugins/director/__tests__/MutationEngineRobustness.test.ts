import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IncrementalMutationEngine } from '../MutationEngine';

describe('MutationEngine Robustness (Sandbox)', () => {
    let engine: IncrementalMutationEngine;

    beforeEach(() => {
        // 禁用 console.warn 以保持测试输出整洁，但可以验证它是否被调用
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        engine = new IncrementalMutationEngine();
    });

    it('should NOT throw ReferenceError for unregistered core models', () => {
        // 'global' 是 coreModels 之一，本测试中故意不注册它
        expect(() => {
            engine.executeMutation('global.update({time: "night"})');
        }).not.toThrow();
        
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('模型 "global" 尚未注册'));
    });

    it('should NOT throw for method calls on unregistered core models (via Placeholder)', () => {
        expect(() => {
            // 模拟复杂的链式调用或赋值
            engine.executeMutation('characters["Unknown"].status = "test"; inventory.add({item: "test"})');
        }).not.toThrow();
    });

    it('should still throw for non-core unregistered variables (standard JS behavior)', () => {
        // 'unknownVar' 不在 coreModels 白名单中，应该正常触发 ReferenceError (被 engine 的 catch 捕获并 error log)
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        engine.executeMutation('unknownVar.doSomething()');
        
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Mutation 执行失败'), expect.any(TypeError));
    });

    it('should resolve registered models correctly', () => {
        const mockProxy = {
            onUpdate: vi.fn()
        };
        engine.registerDataModel('global', mockProxy);
        
        engine.executeMutation('global.update({time: "day"})');
        
        expect(mockProxy.onUpdate).toHaveBeenCalledWith({time: "day"}, undefined, undefined);
    });
});
