<template>
  <div class="weather-chip">
    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"
      stroke-linecap="round" stroke-linejoin="round">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-5h1.79a4.5 4.5 0 1 1 0 9Z"></path>
    </svg>
    酒馆
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.weather-chip {
  font-size: 13px;
  font-weight: 500;
  color: #475569;
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f8fafc;
  padding: 6px 14px;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
}
</style>
