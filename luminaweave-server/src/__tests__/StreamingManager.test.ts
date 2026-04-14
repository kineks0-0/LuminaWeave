import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StreamingManager } from '../StreamingManager.js';

describe('StreamingManager', () => {
    let manager: StreamingManager;

    beforeEach(() => {
        manager = new StreamingManager();
    });

    it('should initialize correctly with empty state', () => {
        const state = manager.getState('chat_1');
        expect(state.buffer).toBe('');
        expect(state.isGenerating).toBe(false);
        expect(state.status).toBe('idle');
    });

    it('should update buffer correctly using chunks', () => {
        manager.setGenerating('chat_1', true);
        manager.updateBuffer('chat_1', 'Hello ', false, 'Hello ');
        manager.updateBuffer('chat_1', 'World', false, 'World');

        const state = manager.getState('chat_1');
        expect(state.buffer).toEqual('Hello World');
        expect(state.rawBuffer).toEqual('Hello World');
    });

    it('should replace buffer completely if isFull is true', () => {
        manager.setGenerating('chat_1', true);
        manager.updateBuffer('chat_1', 'Initial', false, 'Initial');
        manager.updateBuffer('chat_1', 'Replacement', true, 'Replacement');

        const state = manager.getState('chat_1');
        expect(state.buffer).toEqual('Replacement');
        expect(state.rawBuffer).toEqual('Replacement');
    });

    it('should set generation status successfully', () => {
        manager.setGenerating('chat_2', true, undefined, undefined, undefined, 'gen_custom_1');
        
        let state = manager.getState('chat_2');
        expect(state.isGenerating).toBe(true);
        expect(state.status).toBe('running');
        expect(state.generationId).toBe('gen_custom_1');
        expect(state.buffer).toBe(''); // Automatically cleared

        // Finish generation
        manager.setGenerating('chat_2', false, 'success', null, 'tx_999');
        state = manager.getState('chat_2');
        
        expect(state.isGenerating).toBe(false);
        expect(state.status).toBe('success');
        expect(state.lastTransactionId).toBe('tx_999');
        expect(state.finishedAt).toBeGreaterThan(0);
    });

    it('should handle setGenerating error states', () => {
        manager.setGenerating('chat_3', true);
        manager.setGenerating('chat_3', false, 'error', 'Network failure');
        
        const state = manager.getState('chat_3');
        expect(state.isGenerating).toBe(false);
        expect(state.status).toBe('error');
        expect(state.errorMessage).toBe('Network failure');
    });
});
