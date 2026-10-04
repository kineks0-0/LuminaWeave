<template>
  <TraditionalShell
    :runtime-context="runtimeContext"
    :runtime-surfaces="runtimeSurfaces"
    :runtime-actions="runtimeActions"
    :runtime-frame="runtimeFrame"
    :main-surface-extra-style="discordMobileMainStyle"
    :main-surface-extra-class="{ 'has-mobile-shell-padding': isDiscordMobileMode }"
  >
    <template #composition="compositionProps">
      <slot name="composition" v-bind="compositionProps" />
    </template>

    <template #lead>
      <DiscordGuildRail
        v-if="shouldShowDiscordGuildRail"
        :items="discordGuildEntries"
        :activeMainTab="runtimeContext.activeMainTab"
        @switchMainView="runtimeActions.navigation.switchMainView"
        @toggleSettings="runtimeActions.navigation.openSettingsPanel"
        @close="runtimeActions.navigation.close"
      />

      <DiscordMobileShell
        :isDiscordMobileMode="isDiscordMobileMode"
        :shouldShowDiscordMobileShell="shouldShowDiscordMobileShell"
        :discordGuildEntries="discordGuildEntries"
        :activeMainTab="runtimeContext.activeMainTab"
        :guildRailPosition="discordMobileGuildRailPosition"
        :characterEntryPosition="discordMobileCharacterEntryPosition"
        :showDiscordMobileCharacterRail="showDiscordMobileCharacterRail"
        :characterEntryStyle="discordMobileCharacterEntryStyle"
        :activeDesktopModeId="runtimeContext.activeDesktopModeId"
        @switchMainView="handleDiscordMobileMainViewSwitch"
        @toggleSettings="runtimeActions.navigation.openSettingsPanel"
        @close="runtimeActions.navigation.close"
        @updateShowDiscordMobileCharacterRail="showDiscordMobileCharacterRail = $event"
      />
    </template>
  </TraditionalShell>
</template>

<script setup lang="ts">
import TraditionalShell from '../../../../shell/traditional/TraditionalShell.vue';
import { createDesktopModeShellRuntime } from '../../../../platform/desktop-mode-runtime/shellContracts.js';
import type { DesktopModeShellProps } from '../../../../platform/desktop-mode-runtime/shellContracts.js';
import DiscordGuildRail from './DiscordGuildRail.vue';
import DiscordMobileShell from './DiscordMobileShell.vue';
import { useDiscordShell } from './useDiscordShell.js';

const props = defineProps<DesktopModeShellProps>();
const shell = createDesktopModeShellRuntime(props);

const {
  isDiscordMobileMode,
  shouldShowDiscordMobileShell,
  shouldShowDiscordGuildRail,
  discordMobileGuildRailPosition,
  discordMobileCharacterEntryPosition,
  showDiscordMobileCharacterRail,
  discordMobileMainStyle,
  discordMobileCharacterEntryStyle,
  discordGuildEntries,
  handleDiscordMobileMainViewSwitch
} = useDiscordShell(shell);
</script>
