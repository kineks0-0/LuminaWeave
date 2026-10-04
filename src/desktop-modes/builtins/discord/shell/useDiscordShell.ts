import { computed, ref, watch, type CSSProperties } from 'vue';
import { getDesktopModeSettingStorageKey, getDesktopModeSettingValue } from '../../../core/registry.js';
import { useSettings } from '../../../../plugins/settings/useSettings.js';
import type { DesktopModeShellRuntime } from '../../../../platform/desktop-mode-runtime/shellContracts.js';

type DiscordMobileEdge = 'top' | 'bottom' | 'left' | 'right';

const resolveDiscordMobileEdge = (value: unknown, fallback: DiscordMobileEdge): DiscordMobileEdge => {
  return value === 'top' || value === 'bottom' || value === 'left' || value === 'right'
    ? value
    : fallback;
};

/** Discord 模式自有导航状态与移动端安全区，只通过通用 shell runtime 读写平台状态。 */
export const useDiscordShell = (shell: DesktopModeShellRuntime) => {
  const { activeSettings, updateSetting } = useSettings();
  const activeDesktopModeId = computed(() => shell.context.value.activeDesktopModeId);
  const layoutMode = computed(() => shell.context.value.shellKind);
  const isMobile = computed(() => shell.context.value.isMobile);
  const activeMainTab = computed(() => shell.context.value.activeMainTab);
  const showDiscordMobileCharacterRail = ref(false);

  const discordChannelMarkVisible = computed(() =>
    getDesktopModeSettingValue(activeSettings, activeDesktopModeId.value, 'discord-channel-mark', true) !== false
  );

  const isDiscordMobileMode = computed(() =>
    layoutMode.value === 'traditional'
    && activeDesktopModeId.value === 'discord'
    && isMobile.value
  );

  const shouldShowDiscordMobileShell = computed(() =>
    isDiscordMobileMode.value && discordChannelMarkVisible.value
  );

  const shouldShowDiscordGuildRail = computed(() =>
    layoutMode.value === 'traditional'
    && activeDesktopModeId.value === 'discord'
    && discordChannelMarkVisible.value
    && !isMobile.value
  );

  const discordMobileGuildRailPosition = computed<DiscordMobileEdge>(() =>
    resolveDiscordMobileEdge(
      getDesktopModeSettingValue(activeSettings, activeDesktopModeId.value, 'mobileGuildRailPosition', 'top'),
      'top'
    )
  );

  const discordMobileCharacterEntryPosition = computed<DiscordMobileEdge>(() =>
    resolveDiscordMobileEdge(
      getDesktopModeSettingValue(activeSettings, activeDesktopModeId.value, 'mobileCharacterEntryPosition', 'top'),
      'top'
    )
  );

  const discordGuildEntries = computed(() => {
    const pluginEntries = shell.surfaces.value.traditional.mainPlugins
      .filter((plugin) => plugin.id !== 'lumina-launcher')
      .map((plugin) => ({
        id: plugin.id,
        name: plugin.name,
        icon: plugin.icon
      }));
    const dynamicEntries = shell.surfaces.value.dynamicTabs.map((tab) => ({
      id: tab.id,
      name: tab.name,
      icon: tab.icon || ''
    }));
    return [...pluginEntries, ...dynamicEntries];
  });

  const getDiscordMobileSafeArea = (edge: DiscordMobileEdge) => {
    let total = 0;

    if (shouldShowDiscordMobileShell.value && discordMobileGuildRailPosition.value === edge) {
      total += edge === 'left' || edge === 'right' ? 76 : 82;
    }

    if (discordMobileCharacterEntryPosition.value === edge) {
      total += edge === 'left' || edge === 'right' ? 78 : 74;
    }

    return total;
  };

  const discordMobileMainStyle = computed<CSSProperties>(() => {
    if (!shouldShowDiscordMobileShell.value) {
      return {};
    }

    return {
      '--lw-shell-mobile-safe-top': `${getDiscordMobileSafeArea('top')}px`,
      '--lw-shell-mobile-safe-bottom': `${getDiscordMobileSafeArea('bottom')}px`,
      '--lw-shell-mobile-safe-left': `${getDiscordMobileSafeArea('left')}px`,
      '--lw-shell-mobile-safe-right': `${getDiscordMobileSafeArea('right')}px`
    };
  });

  const discordMobileCharacterEntryStyle = computed<CSSProperties>(() => {
    if (!shouldShowDiscordMobileShell.value) {
      return {};
    }

    const style: CSSProperties = {};
    if (discordMobileCharacterEntryPosition.value === discordMobileGuildRailPosition.value) {
      const edge = discordMobileCharacterEntryPosition.value;
      const offset = edge === 'left' || edge === 'right' ? '82px' : '88px';
      style[`--lw-discord-mobile-entry-offset-${edge}`] = offset;
    }

    return style;
  });

  const handleDiscordMobileMainViewSwitch = (tabId: string) => {
    showDiscordMobileCharacterRail.value = false;
    shell.actions.navigation.switchMainView(tabId);
  };

  const toggleDiscordGuildRail = async () => {
    await updateSetting(
      getDesktopModeSettingStorageKey(activeDesktopModeId.value, 'discord-channel-mark'),
      !discordChannelMarkVisible.value
    );
  };

  watch(isMobile, (mobile) => {
    if (mobile) {
      showDiscordMobileCharacterRail.value = false;
    }
  });

  watch(activeMainTab, () => {
    showDiscordMobileCharacterRail.value = false;
  });

  return {
    discordChannelMarkVisible,
    isDiscordMobileMode,
    shouldShowDiscordMobileShell,
    shouldShowDiscordGuildRail,
    discordMobileGuildRailPosition,
    discordMobileCharacterEntryPosition,
    showDiscordMobileCharacterRail,
    discordMobileMainStyle,
    discordMobileCharacterEntryStyle,
    discordGuildEntries,
    handleDiscordMobileMainViewSwitch,
    toggleDiscordGuildRail
  };
};
