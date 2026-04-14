<template>
  <section class="forge-aux-shell">
    <header class="forge-aux-shell__header">
      <div class="forge-aux-shell__copy">
        <span v-if="kicker" class="forge-aux-shell__kicker">{{ kicker }}</span>
        <h2 class="forge-aux-shell__title">{{ title }}</h2>
        <p v-if="subtitle" class="forge-aux-shell__subtitle">{{ subtitle }}</p>
      </div>
      <div v-if="$slots.actions" class="forge-aux-shell__actions">
        <slot name="actions" />
      </div>
    </header>

    <div class="forge-aux-shell__body">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  kicker?: string;
  subtitle?: string;
}>();
</script>

<style scoped>
.forge-aux-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 14px;
  padding: 16px;
}

.forge-aux-shell__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.forge-aux-shell__copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.forge-aux-shell__kicker {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lw-primary);
}

.forge-aux-shell__title {
  margin: 0;
  font-size: 17px;
  line-height: 1.2;
  color: var(--lw-text-main);
}

.forge-aux-shell__subtitle {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--lw-text-muted);
}

.forge-aux-shell__actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.forge-aux-shell__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
</style>
