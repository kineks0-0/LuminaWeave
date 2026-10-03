import { effectScope } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { luminaWeaveApi } from '../../api/index.js';
import {
    DesktopActivityRuntime,
    DesktopTimelineRuntime,
    type DesktopCharacterRuntime
} from '../../api/services/DesktopExperienceRuntime.js';
import { useDesktopExperienceRuntime } from '../useDesktopExperienceRuntime.js';

const characterStub: DesktopCharacterRuntime = {
    state: ref({}) as DesktopCharacterRuntime['state'],
    defaultAvatar: '',
    resolveMessageAvatar: vi.fn(() => ''),
    refresh: vi.fn(async () => undefined),
    openSession: vi.fn(async () => undefined),
    createSession: vi.fn(async () => undefined),
    renameSession: vi.fn(async () => undefined),
    deleteSession: vi.fn(async () => undefined),
    closeCurrentSession: vi.fn(async () => true),
    toggleGroup: vi.fn(),
    toggleGroupSessionExpansion: vi.fn(),
    dispose: vi.fn()
};

describe('shared desktop timeline / activity runtimes', () => {
    beforeAll(() => {
        // 生产环境由 installCharacterRuntime 在 pinia 安装后挂载；这里直接挂一个桩。
        luminaWeaveApi.attachCharacterRuntime(characterStub);
    });

    it('exposes timeline and activity on lwApi.services', () => {
        expect(luminaWeaveApi.services.timeline).toBeInstanceOf(DesktopTimelineRuntime);
        expect(luminaWeaveApi.services.activity).toBeInstanceOf(DesktopActivityRuntime);
    });

    it('reuses the shared instances (timeline, activity, character) and does not tear them down with the app scope', () => {
        setActivePinia(createPinia());
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const scope = effectScope();
        const composition = scope.run(() => useDesktopExperienceRuntime());

        expect(composition?.runtime.timeline).toBe(luminaWeaveApi.services.timeline);
        expect(composition?.runtime.activity).toBe(luminaWeaveApi.services.activity);
        expect(composition?.runtime.character).toBe(luminaWeaveApi.services.character);

        scope.stop();

        expect(luminaWeaveApi.services.timeline).toBeInstanceOf(DesktopTimelineRuntime);
        expect(luminaWeaveApi.services.activity.launch).toBeTypeOf('function');
        expect(luminaWeaveApi.services.character).toBe(characterStub);
        expect(characterStub.dispose).not.toHaveBeenCalled();
        vi.restoreAllMocks();
    });
});
