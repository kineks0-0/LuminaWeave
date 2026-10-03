import { describe, expect, it, vi } from 'vitest';
import { PluginRegistrationScope } from '../PluginRegistrationScope.js';

describe('PluginRegistrationScope', () => {
    it('disposes registrations in reverse order exactly once', () => {
        const scope = new PluginRegistrationScope('demo');
        const calls: string[] = [];
        scope.add(() => calls.push('first'));
        scope.add(() => calls.push('second'));
        scope.add(() => calls.push('third'));
        expect(scope.size).toBe(3);
        scope.dispose();
        scope.dispose();
        expect(calls).toEqual(['third', 'second', 'first']);
        expect(scope.isDisposed).toBe(true);
        expect(scope.size).toBe(0);
    });

    it('keeps disposing when one disposer throws', () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const scope = new PluginRegistrationScope('demo');
        const calls: string[] = [];
        scope.add(() => calls.push('first'));
        scope.add(() => {
            throw new Error('boom');
        });
        scope.add(() => calls.push('third'));
        scope.dispose();
        expect(calls).toEqual(['third', 'first']);
        expect(errorSpy).toHaveBeenCalledTimes(1);
        errorSpy.mockRestore();
    });

    it('runs registrations added after dispose immediately', () => {
        const scope = new PluginRegistrationScope('demo');
        scope.dispose();
        const disposer = vi.fn();
        scope.add(disposer);
        expect(disposer).toHaveBeenCalledTimes(1);
        expect(scope.size).toBe(0);
    });
});
