import {
  computed,
  getCurrentScope,
  inject,
  onScopeDispose,
  provide,
  shallowRef,
  toValue,
  watch,
  type InjectionKey,
  type MaybeRefOrGetter,
  type ShallowRef
} from 'vue';

export interface RootSafeAreaBackdropSnapshot {
  sourceId: string | null;
  topBackground: string | null;
}

export interface RootSafeAreaBackdropOverride {
  sourceId: string;
  topBackground?: string | null;
  enabled?: boolean;
}

export interface RootSafeAreaBackdropRegistration {
  update(patch: Partial<RootSafeAreaBackdropOverride>): void;
  unregister(): void;
}

export interface RootSafeAreaBackdropController {
  readonly snapshot: ShallowRef<RootSafeAreaBackdropSnapshot>;
  register(override: RootSafeAreaBackdropOverride): RootSafeAreaBackdropRegistration;
}

export interface RootSafeAreaBackdropOverrideOptions {
  sourceId: MaybeRefOrGetter<string>;
  topBackground?: MaybeRefOrGetter<string | null | undefined>;
  enabled?: MaybeRefOrGetter<boolean | undefined>;
}

interface BackdropEntry {
  id: symbol;
  sourceId: string;
  topBackground: string | null;
  enabled: boolean;
}

export const ROOT_SAFE_AREA_BACKDROP_CONTROLLER_KEY: InjectionKey<RootSafeAreaBackdropController> =
  Symbol('RootSafeAreaBackdropController');

const normalizeTopBackground = (value: string | null | undefined): string | null => {
  const background = String(value ?? '').trim();
  return background.length > 0 ? background : null;
};

const normalizeEnabled = (value: boolean | undefined): boolean => value !== false;

export const createRootSafeAreaBackdropController = (): RootSafeAreaBackdropController => {
  const entries: BackdropEntry[] = [];
  const snapshot = shallowRef<RootSafeAreaBackdropSnapshot>({
    sourceId: null,
    topBackground: null
  });

  const recompute = () => {
    const activeEntry = [...entries]
      .reverse()
      .find(entry => entry.enabled && entry.topBackground);

    snapshot.value = activeEntry
      ? {
          sourceId: activeEntry.sourceId,
          topBackground: activeEntry.topBackground
        }
      : {
          sourceId: null,
          topBackground: null
        };
  };

  const register = (override: RootSafeAreaBackdropOverride): RootSafeAreaBackdropRegistration => {
    const entry: BackdropEntry = {
      id: Symbol(override.sourceId),
      sourceId: override.sourceId,
      topBackground: normalizeTopBackground(override.topBackground),
      enabled: normalizeEnabled(override.enabled)
    };

    entries.push(entry);
    recompute();

    return {
      update(patch) {
        if (patch.sourceId !== undefined) {
          entry.sourceId = patch.sourceId;
        }
        if (patch.topBackground !== undefined) {
          entry.topBackground = normalizeTopBackground(patch.topBackground);
        }
        if (patch.enabled !== undefined) {
          entry.enabled = normalizeEnabled(patch.enabled);
        }
        recompute();
      },
      unregister() {
        const index = entries.findIndex(item => item.id === entry.id);
        if (index >= 0) {
          entries.splice(index, 1);
          recompute();
        }
      }
    };
  };

  return {
    snapshot,
    register
  };
};

export const provideRootSafeAreaBackdropController = (
  controller: RootSafeAreaBackdropController = createRootSafeAreaBackdropController()
) => {
  provide(ROOT_SAFE_AREA_BACKDROP_CONTROLLER_KEY, controller);
  return controller;
};

export const useRootSafeAreaBackdropController = () =>
  inject(ROOT_SAFE_AREA_BACKDROP_CONTROLLER_KEY, null);

export const useRootSafeAreaBackdropOverride = (
  options: RootSafeAreaBackdropOverrideOptions
): RootSafeAreaBackdropRegistration | null => {
  const controller = useRootSafeAreaBackdropController();
  if (!controller) {
    return null;
  }

  const normalizedOverride = computed<RootSafeAreaBackdropOverride>(() => ({
    sourceId: toValue(options.sourceId),
    topBackground: normalizeTopBackground(toValue(options.topBackground)),
    enabled: normalizeEnabled(toValue(options.enabled))
  }));

  const registration = controller.register(normalizedOverride.value);
  const stop = watch(
    normalizedOverride,
    nextOverride => registration.update(nextOverride),
    { flush: 'sync' }
  );

  if (getCurrentScope()) {
    onScopeDispose(() => {
      stop();
      registration.unregister();
    });
  }

  return registration;
};
