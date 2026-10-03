<template>
  <div class="settings-nav" :data-layout="props.layout">
    <label class="settings-nav__search">
      <Search :size="16" :stroke-width="2" aria-hidden="true" />
      <input
        v-model="query"
        type="search"
        placeholder="搜索设置"
        aria-label="搜索设置"
        @keydown.esc="query = ''"
        @keydown.enter.prevent="openFirstResult"
      >
    </label>

    <ul v-if="query.trim()" class="settings-nav__list" aria-label="搜索结果">
      <li v-for="result in results" :key="result.id">
        <button type="button" class="settings-nav__item is-result" @click="openResult(result)">
          <span class="settings-nav__copy">
            <strong>{{ result.title }}</strong>
            <small>{{ result.context }}</small>
          </span>
        </button>
      </li>
      <li v-if="results.length === 0" class="settings-nav__empty">没有找到“{{ query.trim() }}”相关的设置</li>
    </ul>

    <nav v-else class="settings-nav__list" aria-label="设置分类">
      <button
        v-for="item in navItems"
        :key="item.route"
        type="button"
        class="settings-nav__item"
        :class="{ 'is-active': props.activeRoute === item.route }"
        :aria-current="props.activeRoute === item.route ? 'page' : undefined"
        @click="emit('navigate', item.route)"
      >
        <span class="settings-nav__icon" :data-icon="item.icon" aria-hidden="true">
          <component :is="CATEGORY_ICONS[item.icon]" :size="props.layout === 'page' ? 20 : 16" :stroke-width="2" />
        </span>
        <span class="settings-nav__copy">
          <strong>{{ item.label }}</strong>
          <small v-if="props.layout === 'page'">{{ item.description }}</small>
        </span>
        <ChevronRight v-if="props.layout === 'page'" class="settings-nav__chevron" :size="18" :stroke-width="2" aria-hidden="true" />
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, type Component } from 'vue';
import { BrainCircuit, ChevronRight, Cpu, Database, Hammer, MessageSquareText, Palette, Search, Star, Wrench } from 'lucide-vue-next';
import { searchSettings, type SettingsSearchResult } from './settingsSearch.js';
import { SETTINGS_CATEGORIES, SETTINGS_OVERVIEW_ROUTE, type SettingsCategoryIcon } from './settingsTaxonomy.js';
import { useSettingsCatalog } from './useSettingsCatalog.js';

type NavIcon = SettingsCategoryIcon | 'star';

const props = defineProps<{
  layout: 'sidebar' | 'page';
  /** 当前高亮的路由（'overview' 或分类 id） */
  activeRoute: string | null;
}>();

const emit = defineEmits<{
  navigate: [route: string];
  openResult: [result: SettingsSearchResult];
}>();

const CATEGORY_ICONS: Record<NavIcon, Component> = {
  star: Star,
  palette: Palette,
  message: MessageSquareText,
  cpu: Cpu,
  brain: BrainCircuit,
  hammer: Hammer,
  database: Database,
  wrench: Wrench
};

const query = ref('');
const { searchDocuments } = useSettingsCatalog();
const results = computed(() => searchSettings(searchDocuments.value, query.value));

const navItems = computed<{ route: string; label: string; description: string; icon: NavIcon }[]>(() => [
  { route: SETTINGS_OVERVIEW_ROUTE, label: '常用设置', description: '外观、桌面模式、吐字效果与默认模型', icon: 'star' },
  ...SETTINGS_CATEGORIES.map(category => ({
    route: category.id,
    label: category.label,
    description: category.description,
    icon: category.icon
  }))
]);

const openResult = (result: SettingsSearchResult): void => {
  query.value = '';
  emit('openResult', result);
};

const openFirstResult = (): void => {
  const [first] = results.value;
  if (first) openResult(first);
};
</script>

<style scoped>
.settings-nav {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 8px;
}

.settings-nav__search {
  display: flex;
  height: 38px;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border: 1px solid var(--lw-border-base);
  border-radius: 999px;
  background: var(--lw-bg-subtle);
  color: var(--lw-text-muted);
  transition: border-color var(--lw-transition), box-shadow var(--lw-transition);
}

.settings-nav__search:focus-within {
  border-color: var(--lw-primary);
  box-shadow: 0 0 0 3px rgba(var(--lw-primary-rgb), 0.12);
}

.settings-nav[data-layout='page'] .settings-nav__search {
  height: 44px;
  padding: 0 16px;
}

.settings-nav__search input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--lw-text-main);
  font: inherit;
  font-size: var(--lw-type-body-medium-size);
}

.settings-nav__list {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.settings-nav[data-layout='page'] .settings-nav__list {
  overflow: hidden;
  border: 1px solid var(--lw-border-subtle, var(--lw-border-base));
  border-radius: 22px;
  background: color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent);
  padding: 6px 0;
}

.settings-nav__item {
  display: flex;
  width: 100%;
  min-height: 40px;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--lw-text-secondary);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--lw-transition), color var(--lw-transition);
}

.settings-nav__item:hover {
  background: var(--lw-bg-hover);
  color: var(--lw-text-main);
}

.settings-nav__item.is-active {
  background: var(--lw-bg-active, var(--lw-bg-hover));
  color: var(--lw-text-main);
}

.settings-nav[data-layout='page'] .settings-nav__item {
  min-height: 60px;
  gap: 14px;
  padding: 8px 14px;
  border-radius: 0;
  color: var(--lw-text-main);
}

.settings-nav__icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
}

.settings-nav[data-layout='page'] .settings-nav__icon {
  width: 36px;
  height: 36px;
  border-radius: 11px;
  background: color-mix(in srgb, var(--lw-primary) 14%, transparent);
  color: var(--lw-primary);
}

.settings-nav__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.settings-nav__copy strong,
.settings-nav__copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-nav__copy strong {
  font-size: var(--lw-type-label-large-size);
  font-weight: var(--lw-type-label-large-weight);
  line-height: var(--lw-type-label-large-line-height);
}

.settings-nav[data-layout='page'] .settings-nav__copy strong {
  font-size: var(--lw-type-title-small-size);
  font-weight: 500;
}

.settings-nav__copy small {
  color: var(--lw-text-muted);
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
}

.settings-nav__item.is-result .settings-nav__copy strong,
.settings-nav__item.is-result .settings-nav__copy small {
  white-space: normal;
}

.settings-nav__chevron {
  flex: 0 0 auto;
  color: var(--lw-text-muted);
}

.settings-nav__empty {
  padding: 16px 12px;
  color: var(--lw-text-muted);
  font-size: var(--lw-type-body-small-size);
}
</style>
