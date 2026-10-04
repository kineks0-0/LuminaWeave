import { ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import type { DesktopCharacterRuntime } from '../DesktopExperienceRuntime.js';
import { CharacterRuntimeSlot } from '../CharacterRuntimeSlot.js';

const createRuntime = (): DesktopCharacterRuntime => ({
    state: ref({}) as DesktopCharacterRuntime['state'],
    defaultAvatar: '',
    resolveMessageAvatar: vi.fn(() => ''),
    refresh: vi.fn(async () => undefined),
    openSession: vi.fn(async () => undefined),
    createSession: vi.fn(async () => undefined),
    importCharacterCard: vi.fn(async () => undefined),
    renameSession: vi.fn(async () => undefined),
    deleteSession: vi.fn(async () => undefined),
    duplicateSession: vi.fn(async () => undefined),
    closeCurrentSession: vi.fn(async () => true),
    toggleGroup: vi.fn(),
    toggleGroupSessionExpansion: vi.fn(),
    dispose: vi.fn()
});

describe('CharacterRuntimeSlot', () => {
    it('throws a clear error when read before the runtime is attached', () => {
        expect(() => new CharacterRuntimeSlot().get()).toThrow('Character runtime is not installed yet');
    });

    it('returns the attached runtime', () => {
        const slot = new CharacterRuntimeSlot();
        const runtime = createRuntime();
        slot.attach(runtime);
        expect(slot.get()).toBe(runtime);
    });

    it('rejects a second attach and keeps the first runtime', () => {
        const slot = new CharacterRuntimeSlot();
        const first = createRuntime();
        slot.attach(first);
        expect(() => slot.attach(createRuntime())).toThrow(/already installed/);
        expect(slot.get()).toBe(first);
    });
});
