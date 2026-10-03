import { effectScope } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it, vi } from 'vitest';
import { luminaWeaveApi } from '../../api/index.js';
import { DesktopActivityRuntime, DesktopTimelineRuntime } from '../../api/services/DesktopExperienceRuntime.js';
import { useDesktopExperienceRuntime } from '../useDesktopExperienceRuntime.js';

describe('shared desktop timeline / activity runtimes', () => {
    it('exposes timeline and activity on lwApi.services', () => {
        expect(luminaWeaveApi.services.timeline).toBeInstanceOf(DesktopTimelineRuntime);
        expect(luminaWeaveApi.services.activity).toBeInstanceOf(DesktopActivityRuntime);
    });

    it('reuses the shared instances and does not tear them down with the app scope', () => {
        setActivePinia(createPinia());
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const scope = effectScope();
        const composition = scope.run(() => useDesktopExperienceRuntime());

        expect(composition?.runtime.timeline).toBe(luminaWeaveApi.services.timeline);
        expect(composition?.runtime.activity).toBe(luminaWeaveApi.services.activity);

        scope.stop();

        expect(luminaWeaveApi.services.timeline).toBeInstanceOf(DesktopTimelineRuntime);
        expect(luminaWeaveApi.services.activity.launch).toBeTypeOf('function');
        vi.restoreAllMocks();
    });
});
