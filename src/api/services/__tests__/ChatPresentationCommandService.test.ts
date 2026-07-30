import { describe, expect, it, vi } from 'vitest';
import {
    ChatPresentationCommandService,
    type ChatPresentationCommand,
    type ChatPresentationCommandEventListener
} from '../ChatPresentationCommandService.js';

describe('ChatPresentationCommandService', () => {
    it('converts the two legacy UI events into typed chat presentation commands', () => {
        const listeners = new Map<string, ChatPresentationCommandEventListener>();
        const source = {
            on: vi.fn((eventName: string, listener: ChatPresentationCommandEventListener) => {
                listeners.set(eventName, listener);
            }),
            off: vi.fn((eventName: string, listener: ChatPresentationCommandEventListener) => {
                if (listeners.get(eventName) === listener) {
                    listeners.delete(eventName);
                }
            })
        };
        const service = new ChatPresentationCommandService(source);
        const commands: ChatPresentationCommand[] = [];
        const unsubscribe = service.subscribe(command => commands.push(command));

        listeners.get('SCROLL_TO_BOTTOM')?.({ force: true });
        listeners.get('FOCUS_MAIN_INPUT')?.({ text: 'Timeline message' });
        listeners.get('FOCUS_MAIN_INPUT')?.({});

        expect(commands).toEqual([
            { type: 'scroll_to_bottom', force: true },
            { type: 'focus_composer', text: 'Timeline message' },
            { type: 'focus_composer' }
        ]);

        unsubscribe();
        expect(source.off).toHaveBeenCalledTimes(2);
        expect(listeners.size).toBe(0);
    });

    it('stops delivering commands after unsubscribe', () => {
        const listeners = new Map<string, ChatPresentationCommandEventListener>();
        const source = {
            on: (eventName: string, listener: ChatPresentationCommandEventListener): void => {
                listeners.set(eventName, listener);
            },
            off: (eventName: string, listener: ChatPresentationCommandEventListener): void => {
                if (listeners.get(eventName) === listener) listeners.delete(eventName);
            }
        };
        const service = new ChatPresentationCommandService(source);
        const listener = vi.fn();
        const unsubscribe = service.subscribe(listener);
        const scrollListener = listeners.get('SCROLL_TO_BOTTOM');

        unsubscribe();
        scrollListener?.({ force: true });

        expect(listener).not.toHaveBeenCalled();
    });
});
