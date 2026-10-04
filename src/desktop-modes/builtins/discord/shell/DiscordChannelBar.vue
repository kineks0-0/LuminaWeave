<template>
  <div class="discord-channel-bar">
    <button
      class="discord-channel-mark"
      :class="{ active: guildRailVisible !== false }"
      type="button"
      :title="guildRailVisible !== false ? '收起侧栏与角色列表' : '展开侧栏与角色列表'"
      :aria-label="guildRailVisible !== false ? '收起侧栏与角色列表' : '展开侧栏与角色列表'"
      :aria-pressed="guildRailVisible !== false"
      @click="emit('toggleGuildRail')"
    >
      #
    </button>
    <div class="discord-channel-copy">
      <strong>{{ activeTabLabel || '频道' }}</strong>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  activeTabLabel?: string;
  guildRailVisible?: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggleGuildRail'): void;
}>();
</script>
