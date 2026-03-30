<template>
  <div class="lorebook-root" :data-mode="props.mode" :data-view="displayMode">
    <!-- 顶部状态栏 -->
    <div class="lore-header">
      <div class="header-content">
        <div class="book-selector-trigger" :title="currentBookName">
          <h2 class="header-title">{{ currentBookName }}</h2>
          <svg class="title-chevron" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
          <select v-model="currentSelectedBookName" @change="handleBookChange" class="hidden-select">
            <option v-for="book in allBooks" :key="book.id" :value="book.id">
              {{ book.name }}
            </option>
          </select>
        </div>
      </div>
      <div class="lore-actions">
        <!-- 视图模式切换按钮组 -->
        <div class="view-toggle-group">
          <button class="view-toggle-btn" :class="{ 'is-active': displayMode === 'list' }" @click="setDisplayMode('list')" title="列表视图">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2">
              <line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line>
              <line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>
            </svg>
          </button>
          <button class="view-toggle-btn" :class="{ 'is-active': displayMode === 'grid' }" @click="setDisplayMode('grid')" title="卡片视图">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2">
              <rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect>
              <rect x="3" y="14" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect>
            </svg>
          </button>
          <button class="view-toggle-btn" :class="{ 'is-active': displayMode === 'table' }" @click="setDisplayMode('table')" title="表格视图">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2">
              <line x1="3" y1="5" x2="21" y2="5"></line><line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="3" y1="13" x2="21" y2="13"></line><line x1="3" y1="17" x2="21" y2="17"></line>
            </svg>
          </button>
        </div>
        <button class="lw-btn lw-btn-primary" @click="createNewEntry">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          新建条目
        </button>
      </div>
    </div>

    <!-- 搜索栏 -->
    <div class="lore-search">
      <div class="search-input-wrapper">
        <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" class="lw-input search-input" v-model="searchQuery" placeholder="搜索关键词、注释或内容..." />
      </div>
    </div>

    <!-- ====== 列表区域 ====== -->
    <div class="lore-list scroll-container" @wheel.stop :class="'view-' + displayMode">
      <div v-if="filteredEntries.length === 0" class="empty-state">
        <div class="empty-icon">📖</div>
        <p>未发现符合条件的条目</p>
      </div>

      <!-- ===== 表格模式：表格头 ===== -->
      <div v-if="displayMode === 'table'" class="table-view-header">
        <span class="table-col-status"></span>
        <span class="table-col-name">名称</span>
        <span class="table-col-keys">关键词</span>
        <span class="table-col-depth">深度</span>
        <span class="table-col-order">顺序</span>
        <span class="table-col-prob">概率%</span>
      </div>

      <template v-if="filteredEntries.length > 0">
        <!-- ===== 列表模式 (默认) ===== -->
        <template v-if="displayMode === 'list'">
          <div v-for="(entry, index) in filteredEntries" :key="entry.uid" class="lore-item"
            :class="{ 'is-editing': editingUid === entry.uid, 'is-disabled': entry.disable }" :style="{ '--index': index }"
            @click="selectEntry(entry)">
            <div class="item-header-row">
              <div class="item-left-group">
                <span class="item-status-dot" :class="getStatusClass(entry)"></span>
                <span class="item-id">#{{ entry.uid ? entry.uid.toString().slice(-5) : 'NEW' }}</span>
              </div>
              <span class="item-meta">
                <span class="meta-tag pos" :title="getFullPositionName(entry)">{{ getPositionLabel(entry) }}</span>
                <span class="meta-tag" v-if="entry.position === 4">D:{{ entry.depth ?? 0 }}</span>
                <span class="meta-tag">O:{{ entry.order ?? 100 }}</span>
                <span class="meta-tag prob">{{ entry.probability ?? 100 }}%</span>
              </span>
            </div>
            <div class="item-title">{{ entry.comment || '未命名条目' }}</div>
            <div class="item-summary">{{ truncate(entry.content, 80) }}</div>
            <div class="item-tags" v-if="entry.key && entry.key.length">
              <span v-for="key in entry.key.slice(0, 3)" :key="key" class="tag-chip">{{ key }}</span>
            </div>
          </div>
        </template>

        <!-- ===== 卡片模式 ===== -->
        <template v-else-if="displayMode === 'grid'">
          <div class="grid-container">
            <div v-for="(entry, index) in filteredEntries" :key="entry.uid" class="grid-card"
              :class="{ 'is-editing': editingUid === entry.uid, 'is-disabled': entry.disable }" :style="{ '--index': index }"
              @click="selectEntry(entry)">
              <div class="grid-card-header">
                <span class="item-status-dot" :class="getStatusClass(entry)"></span>
                <span class="grid-card-title">{{ entry.comment || '未命名条目' }}</span>
              </div>
              <div class="grid-card-body">{{ truncate(entry.content, 60) }}</div>
              <div class="grid-card-footer">
                <span class="grid-card-meta">
                  <span class="meta-tag pos">{{ getPositionLabel(entry) }}</span>
                  <span class="meta-tag">O:{{ entry.order ?? 100 }}</span>
                </span>
                <div class="grid-card-tags" v-if="entry.key && entry.key.length">
                  <span v-for="key in entry.key.slice(0, 2)" :key="key" class="tag-chip">{{ key }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- ===== 表格模式 ===== -->
        <template v-else-if="displayMode === 'table'">
          <div v-for="(entry, index) in filteredEntries" :key="entry.uid" class="table-row"
            :class="{ 'is-editing': editingUid === entry.uid, 'is-disabled': entry.disable, 'is-even': index % 2 === 0 }"
            @click="selectEntry(entry)">
            <span class="table-col-status">
              <span class="item-status-dot table-dot" :class="getStatusClass(entry)"></span>
            </span>
            <span class="table-col-name" :title="entry.comment || '未命名条目'">
              {{ entry.comment || '未命名条目' }}
            </span>
            <span class="table-col-keys" :title="entry.key?.join(', ')">
              {{ entry.key?.slice(0, 2).join(', ') || '—' }}
            </span>
            <span class="table-col-depth">
              <span class="table-pos-badge" :class="{ 'is-dynamic': entry.position === 4 }">
                {{ getPositionLabel(entry) }}{{ entry.position === 4 ? ':' + (entry.depth ?? 0) : '' }}
              </span>
            </span>
            <span class="table-col-order">{{ entry.order ?? 100 }}</span>
            <span class="table-col-prob">{{ entry.probability ?? 100 }}%</span>
          </div>
        </template>
      </template>
    </div>

    <transition name="editor-slide">
      <div v-if="editingEntry" class="lore-editor-overlay"
        :class="{ 'is-sidebar': props.mode === 'small', 'is-full': isFullWindowActive }">
        <LorebookEditor :entry="editingEntry" :mode="props.mode" v-model:is-full-window="isFullWindowActive"
          @close="closeEditor" @save="handleSave" @delete="handleDelete" @swap="handleSwap" />
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, inject, watch } from 'vue';
import { LuminaWeaveAPI } from '../../api/index';
import { lwStorage } from '../../api/storage';
import LorebookEditor from './LorebookEditor.vue';

const props = defineProps<{
  mode?: 'large' | 'small',
  isMobile?: boolean
}>();

const lwApi = inject('lwApi') as LuminaWeaveAPI;
const searchQuery = ref('');

// 本地编辑器状态 (用于 Overlay)
const editingUid = ref<string | number | null>(null);
const editingEntry = ref<LuminaLorebookEntry | null>(null);
const isFullWindowActive = ref(false);

// 侧边栏/全局编辑器状态同步 (响应式)
const globalEditingEntry = ref<LuminaLorebookEntry | null>(lwApi.lorebookManager.activeEditingEntry);
const onEditingEntryChanged = (entry: LuminaLorebookEntry | null) => {
  // 无论什么模式，都同步 UID 以确保列表高亮正确 (用于跨窗口高亮同步)
  editingUid.value = entry?.uid ?? null;

  if (props.mode === 'small') {
    globalEditingEntry.value = entry;
    editingEntry.value = entry ? JSON.parse(JSON.stringify(entry)) : null;
  }
};

const allBooks = computed(() => lwApi.lorebookManager.books || []);
const currentSelectedBookName = ref(lwApi.lorebookManager.selectedBook);

const currentBookName = computed(() => {
  if (!allBooks.value.length) return '选择世界书';
  const book = allBooks.value.find(b => b.id === currentSelectedBookName.value);
  return book ? book.name : '选择世界书';
});

// 插件设置
const interactMode = computed(() => lwStorage.get('lumina-lorebook.interactMode', 'none', 'Global'));
const autoOpenSidebar = computed(() => lwStorage.get('lumina-lorebook.autoOpenSidebar', true, 'Global'));

// 显示模式：list（列表）| grid（卡片）| table（表格）
const displayMode = ref(lwStorage.get('lumina-lorebook.displayMode', 'list', 'Global'));
const setDisplayMode = (mode: string): void => {
  displayMode.value = mode;
  lwStorage.set('lumina-lorebook.displayMode', mode, 'Global');
};

// 统一条目状态样式类的辅助函数
const getStatusClass = (entry: LuminaLorebookEntry): Record<string, boolean> => ({
  'is-permanent': !entry.disable && !!entry.constant,
  'is-keyword': !entry.disable && !entry.constant,
  'is-disabled': !!entry.disable
});

const getPositionLabel = (entry: LuminaLorebookEntry): string => {
  const p = entry.position ?? 0;
  const roleMap: Record<number, string> = { 0: '[Sys]', 1: '[Usr]', 2: '[AI]' };
  
  switch (p) {
    case 0: return '↑Char';
    case 1: return '↓Char';
    case 5: return '↑EM';
    case 6: return '↓EM';
    case 2: return '↑AN';
    case 3: return '↓AN';
    case 4: {
      const roleText = roleMap[entry.role as number] || '[? ]';
      return `@D ${roleText}`;
    }
    case 7: return 'Anchor';
    default: return `P-${p}`;
  }
};

const getFullPositionName = (entry: LuminaLorebookEntry): string => {
  const p = entry.position ?? 0;
  const roleMap: Record<number, string> = { 0: '[系统]', 1: '[用户]', 2: '[AI]' };
  const names: Record<number, string> = {
    0: '角色定义之前 (↑Char)',
    1: '角色定义之后 (↓Char)',
    5: '示例消息之前 (↑EM)',
    6: '示例消息之后 (↓EM)',
    2: '作者注释之前 (↑AN)',
    3: '作者注释之后 (↓AN)',
    4: `@Depth ${roleMap[entry.role as number] || ''} (在深度注入)`,
    7: '锚点 (Anchor)'
  };
  return names[Number(p)] || '固定位置';
};

const localEntries = ref<LuminaLorebookEntry[]>([]);
const filteredEntries = computed(() => {
  if (!localEntries.value.length) return [];
  const query = searchQuery.value.toLowerCase();
  if (!query) return localEntries.value;

  return localEntries.value.filter(e =>
    e.comment?.toLowerCase().includes(query) ||
    e.key?.some((k: string) => typeof k === 'string' && k.toLowerCase().includes(query)) ||
    e.content?.toLowerCase().includes(query)
  );
});

const handleBookChange = async () => {
  if (currentSelectedBookName.value) {
    // 确保传递的是书籍 ID
    const bookId = typeof currentSelectedBookName.value === 'string'
      ? currentSelectedBookName.value
      : (currentSelectedBookName.value as any).id;
    await lwApi.lorebookManager.loadLorebook(bookId);
  }
};

const forceRefresh = async () => {
  await lwApi.lorebookManager.syncFromST();
};

const selectEntry = (entry: LuminaLorebookEntry) => {
  const mode = interactMode.value;
  const isLarge = props.mode === 'large';

  // 决定是否触发跨窗编辑
  const shouldGotoSidebar = isLarge && mode === 'large-to-sidebar';
  const shouldGotoLarge = !isLarge && mode === 'sidebar-to-large';

  if (shouldGotoSidebar) {
    // 触发全局侧边栏编辑逻辑
    lwApi.lorebookManager.setEditingEntry(entry);
    editingUid.value = entry.uid !== undefined ? entry.uid : null; // 大窗口也高亮
    if (autoOpenSidebar.value) {
      lwApi.emit('SWITCH_WIDGET_PANEL', 'lumina-lorebook');
    }
  } else if (shouldGotoLarge) {
    // 触发大窗口 Overlay 编辑逻辑
    lwApi.emit('OPEN_LOREBOOK_OVERLAY', JSON.parse(JSON.stringify(entry)));
    editingUid.value = entry.uid !== undefined ? entry.uid : null; // 侧边栏也高亮
  } else {
    // 本地编辑 (同窗口)
    editingEntry.value = JSON.parse(JSON.stringify(entry));
    editingUid.value = entry.uid !== undefined ? entry.uid : null;

    // 如果是在侧栏模式下的本地编辑，也同步给全局，让其他可能的监听者知道
    if (props.mode === 'small') {
      lwApi.lorebookManager.setEditingEntry(entry);
    }
  }
};

const closeEditor = () => {
  editingEntry.value = null;
  editingUid.value = null;
  isFullWindowActive.value = false;
  // 如果当前是侧边栏模式，也同步清理全局状态
  if (props.mode === 'small') {
    lwApi.lorebookManager.setEditingEntry(null);
  }
};

// 移除旧的不可靠 watch

const createNewEntry = () => {
  const newEntry: LuminaLorebookEntry = {
    uid: '', // 表示新建
    key: [],
    keysecondary: [],
    comment: '新条目',
    content: '',
    order: 100,
    disable: false,
    constant: false,
    selective: false,
    selectiveLogic: 0,
    position: 0,
    depth: 0,
    probability: 100,
    scan_depth: 0
  };
  editingEntry.value = newEntry;
};

const handleSave = async (updatedEntry: LuminaLorebookEntry) => {
  const success = await lwApi.lorebookManager.saveEntry(updatedEntry.uid || null, updatedEntry);
  if (success) {
    closeEditor();
  }
};

const handleDelete = async (uid: string | number) => {
  if (confirm('确定要删除这个世界书条目吗？此操作不可恢复。')) {
    const success = await lwApi.lorebookManager.deleteEntry(uid);
    if (success) {
      closeEditor();
    }
  }
};

const truncate = (text: string | null | undefined, length: number) => {
  if (!text) return '';
  return text.length > length ? text.substring(0, length) + '...' : text;
};

const syncData = (payload?: any) => {
  // 仅从 manager 同步状态到组件，不主动触发 API 拉取
  if (payload && payload.book) {
    currentSelectedBookName.value = payload.book;
  } else {
    currentSelectedBookName.value = lwApi.lorebookManager.selectedBook;
  }
  // 同步列表数据以触发响应式更新
  localEntries.value = [...lwApi.lorebookManager.entries];
};

const handleSwap = () => {
  if (!editingEntry.value) return;
  const entry = JSON.parse(JSON.stringify(editingEntry.value));

  if (props.mode === 'large') {
    // 从大窗口 Overlay 切换到侧边栏
    lwApi.lorebookManager.setEditingEntry(entry);
    closeEditor();
    lwApi.emit('SWITCH_WIDGET_PANEL', 'lumina-lorebook');
  } else {
    // 从侧边栏切换到大窗口 Overlay
    lwApi.emit('OPEN_LOREBOOK_OVERLAY', entry);
    // 侧边栏保持打开，但本地编辑器可以关闭或隐藏
    closeEditor();
  }
};

onMounted(async () => {
  lwApi.lorebookManager.on('EDITING_ENTRY_CHANGED', onEditingEntryChanged);

  // 核心修复：挂载时根据当前全局状态初始化，防止错过挂载前的事件
  if (props.mode === 'small' && lwApi.lorebookManager.activeEditingEntry) {
    onEditingEntryChanged(lwApi.lorebookManager.activeEditingEntry);
  }

  if (props.mode === 'large') {
    lwApi.on('OPEN_LOREBOOK_OVERLAY', (entry: LuminaLorebookEntry) => {
      editingEntry.value = entry;
      editingUid.value = entry.uid || null;
    });
  }

  // 初始拉取
  await lwApi.lorebookManager.syncFromST();
  syncData();
  lwApi.on('LOREBOOK_SYNCED', syncData);
  lwApi.lorebookManager.on('UPDATED', syncData); // 增加对 UPDATED 的监听

  // 监听显示模式变更 (用于设置页面修改后的同步)
  lwStorage.on('lumina-lorebook.displayMode', (val: string) => {
    displayMode.value = val;
  });
});

onUnmounted(() => {
  lwApi.lorebookManager.off('EDITING_ENTRY_CHANGED', onEditingEntryChanged);
  lwApi.off('LOREBOOK_SYNCED', syncData);
  lwApi.lorebookManager.off('UPDATED', syncData);
});
</script>

<style scoped>
.lorebook-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--lw-bg-app);
  position: relative;
  font-family: inherit;
}

.lorebook-root[data-mode="small"] .lore-header {
  padding: 12px 16px;
}

.lorebook-root[data-mode="small"] .book-select {
  font-size: 15px;
}

.lorebook-root[data-mode="small"] .lore-search {
  padding: 8px 16px;
}

.lorebook-root[data-mode="small"] .lore-list {
  padding: 0 12px 12px;
}

.lorebook-root[data-mode="small"] .lore-item {
  padding: 10px 12px;
  border-radius: 10px;
}

/* 侧边栏详情页适配 */
.lorebook-root[data-mode="small"] .lore-editor-overlay {
  background: var(--lw-bg-surface);
  /* 侧边栏不需要那种透明模糊感，直接白底 */
  backdrop-filter: none;
}

.lore-header {
  padding: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--lw-bg-app);
  position: sticky;
  top: 0;
  z-index: 10;
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.header-title {
  font-size: 24px;
  font-weight: 800;
  font-family: 'Manrope', sans-serif;
  color: var(--lw-text-main);
}

.book-selector-trigger {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: var(--lw-transition);
}

.book-selector-trigger:hover .header-title {
  color: var(--lw-primary);
}

.book-selector-trigger:hover .title-chevron {
  color: var(--lw-primary);
  transform: translateY(2px);
}

.title-chevron {
  color: var(--lw-text-muted);
  transition: var(--lw-transition);
}

.hidden-select {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  appearance: none;
}

.lore-actions {
  display: flex;
  gap: 12px;
}

.lore-search {
  padding: 0 24px 16px;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  color: var(--lw-text-muted);
}

.search-input {
  padding-left: 40px !important;
  background: var(--lw-surface-container-lowest) !important;
  border: none !important;
  border-radius: var(--lw-radius-xl) !important;
  height: 48px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
}

.lore-list {
  flex: 1;
  padding: 0 24px 24px;
  overflow-y: auto;
}

.lore-item {
  background: var(--lw-surface-container-lowest);
  border-radius: var(--lw-radius-xl);
  padding: 20px;
  margin-bottom: 16px;
  cursor: pointer;
  transition: var(--lw-transition);
  position: relative;
  border-left: 4px solid transparent;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
  outline: 1px solid rgba(0, 0, 0, 0.02);
}

.lore-item:hover {
  transform: translateX(4px);
  background: var(--lw-bg-hover);
}

.lore-item.is-editing {
  border-left-color: var(--lw-primary);
  box-shadow: var(--lw-shadow-card);
  z-index: 1;
}

.item-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.item-left-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.item-status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--lw-text-soft);
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.05);
  transition: var(--lw-transition);
}

.item-status-dot.is-permanent {
  background: #3b82f6;
  /* box-shadow: 0 0 8px rgba(59, 130, 246, 0.5); */
}

.item-status-dot.is-keyword {
  background: #10b981;
  /* box-shadow: 0 0 8px rgba(16, 185, 129, 0.5); */
}

.item-status-dot.is-disabled {
  background: #94a3b8;
  opacity: 0.6;
}

.item-id {
  font-size: 11px;
  font-weight: 700;
  color: var(--lw-primary);
  letter-spacing: 0.02em;
  font-family: var(--lw-font-mono);
}

.item-meta {
  display: flex;
  gap: 6px;
  align-items: center;
}

.meta-tag {
  font-size: 10px;
  font-family: var(--lw-font-mono);
  font-weight: 700;
  color: var(--lw-text-muted);
  background: var(--lw-surface-container-high);
  padding: 1px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}

.meta-tag.pos {
  color: var(--lw-primary);
  background: var(--lw-bg-subtle);
}

.meta-tag.prob {
  color: var(--lw-text-secondary);
  opacity: 0.8;
}

.table-pos-badge {
  font-size: 10px;
  font-weight: 800;
  padding: 2px 6px;
  background: var(--lw-surface-container-low);
  border-radius: 4px;
  color: var(--lw-text-muted);
}

.table-pos-badge.is-dynamic {
  background: var(--lw-bg-subtle);
  color: var(--lw-primary);
}

.item-title {
  font-size: 16px;
  font-weight: 800;
  font-family: 'Manrope', sans-serif;
  color: var(--lw-text-main);
  margin-bottom: 8px;
}

.item-summary {
  font-size: 13px;
  color: var(--lw-text-secondary);
  line-height: 1.5;
  margin-bottom: 16px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.item-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tag-chip {
  padding: 2px 8px;
  background: var(--lw-surface-container-high);
  border-radius: 8px;
  font-size: 10px;
  font-weight: 600;
  color: var(--lw-text-secondary);
}

/* 按钮样式已由全局 lw-btn 接管，此处仅保留必要的微调 */

/* 编辑器 Overlay：平滑滑入 */
.lore-editor-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 100;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: var(--lw-glass-blur);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.lore-editor-overlay.is-full {
  background: var(--lw-bg-surface);
  backdrop-filter: none;
  z-index: 9999;
}

/* 过渡动画 */
.editor-slide-enter-active,
.editor-slide-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.editor-slide-enter-from,
.editor-slide-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  text-align: center;
}

.empty-icon {
  font-size: 80px;
  margin-bottom: 24px;
  filter: grayscale(1);
  opacity: 0.1;
  transition: all 0.5s ease;
}

.empty-state:hover .empty-icon {
  opacity: 0.2;
  transform: scale(1.1) rotate(5deg);
}

.empty-state p {
  color: var(--lw-text-muted);
  font-weight: 700;
  font-size: 15px;
  letter-spacing: -0.01em;
}

/* ========================================
   视图模式切换按钮组
   ======================================== */
.view-toggle-group {
  display: flex;
  gap: 2px;
  background: var(--lw-surface-container-lowest);
  border-radius: var(--lw-radius);
  padding: 3px;
  border: 1px solid var(--lw-border-base);
}

.view-toggle-btn {
  background: transparent;
  border: none;
  color: var(--lw-text-muted);
  cursor: pointer;
  padding: 5px 8px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--lw-transition);
}

.view-toggle-btn:hover {
  color: var(--lw-text-main);
  background: var(--lw-bg-hover);
}

.view-toggle-btn.is-active {
  color: var(--lw-primary);
  background: var(--lw-bg-subtle);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

/* ========================================
   卡片模式 (Grid)
   ======================================== */
.grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.grid-card {
  background: var(--lw-surface-container-lowest);
  border-radius: var(--lw-radius-xl);
  padding: 16px;
  cursor: pointer;
  transition: var(--lw-transition);
  border: 1px solid transparent;
  display: flex;
  flex-direction: column;
  gap: 10px;
  outline: 1px solid rgba(0, 0, 0, 0.02);
}

.grid-card:hover {
  border-color: var(--lw-border-base);
  background: var(--lw-bg-hover);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

.grid-card.is-editing {
  border-color: var(--lw-primary);
  box-shadow: var(--lw-shadow-card);
}

.grid-card.is-disabled {
  opacity: 0.5;
}

.grid-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.grid-card-title {
  font-size: 14px;
  font-weight: 700;
  font-family: 'Manrope', sans-serif;
  color: var(--lw-text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.grid-card-body {
  font-size: 12px;
  color: var(--lw-text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
}

.grid-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.grid-card-meta {
  font-size: 10px;
  font-family: var(--lw-font-mono);
  color: var(--lw-text-muted);
  letter-spacing: 0.03em;
}

.grid-card-tags {
  display: flex;
  gap: 4px;
}

/* ========================================
   表格模式 (Table) —— 表格行布局
   ======================================== */

/* 表格模式下减少列表容器内边距 */
.lore-list.view-table {
  padding: 0 16px 16px;
}

/* 表格头 */
.table-view-header {
  display: grid;
  grid-template-columns: 28px 1fr minmax(100px, 0.6fr) 56px 56px 56px;
  gap: 0;
  padding: 6px 12px;
  font-size: 10px;
  font-weight: 700;
  font-family: var(--lw-font-mono);
  color: var(--lw-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-bottom: 1px solid var(--lw-border-base);
  position: sticky;
  top: 0;
  z-index: 5;
  background: var(--lw-bg-app);
}

/* 表格数据行 */
.table-row {
  display: grid;
  grid-template-columns: 28px 1fr minmax(100px, 0.6fr) 56px 56px 56px;
  gap: 0;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.12s ease;
  border-bottom: 1px solid var(--lw-border-base);
  align-items: center;
  font-size: 13px;
  color: var(--lw-text-main);
}

/* 斑马纹 */
.table-row.is-even {
  background: var(--lw-surface-container-lowest);
}

.table-row:hover {
  background: var(--lw-bg-hover);
}

.table-row.is-editing {
  background: var(--lw-bg-selection);
  box-shadow: inset 3px 0 0 0 var(--lw-primary);
}

.table-row.is-disabled {
  opacity: 0.45;
}

/* 表格模式列样式 */
.table-col-status {
  display: flex;
  align-items: center;
  justify-content: center;
}

.table-dot {
  width: 8px;
  height: 8px;
  box-shadow: none;
}

.table-col-name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding-right: 12px;
}

.table-col-keys {
  font-size: 12px;
  color: var(--lw-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding-right: 8px;
}

.table-col-depth,
.table-col-order,
.table-col-prob {
  font-size: 12px;
  font-family: var(--lw-font-mono);
  color: var(--lw-text-secondary);
  text-align: center;
}

/* 表格模式下的表格头对齐 */
.table-view-header .table-col-depth,
.table-view-header .table-col-order,
.table-view-header .table-col-prob {
  text-align: center;
}

/* ========================================
   侧边栏模式 (Small) 下的表格模式适配
   ======================================== */
.lorebook-root[data-mode="small"] .table-view-header,
.lorebook-root[data-mode="small"] .table-row {
  /* 侧边栏空间有限，隐藏关键词列 */
  grid-template-columns: 24px 1fr 44px 44px 44px;
}

.lorebook-root[data-mode="small"] .table-col-keys {
  display: none;
}

.lorebook-root[data-mode="small"] .table-view-header {
  padding: 4px 8px;
}

.lorebook-root[data-mode="small"] .table-row {
  padding: 6px 8px;
  font-size: 12px;
}

.lorebook-root[data-mode="small"] .table-col-name {
  font-size: 12px;
}

/* 侧边栏下卡片模式适配 */
.lorebook-root[data-mode="small"] .grid-container {
  grid-template-columns: 1fr;
  gap: 8px;
}

.lorebook-root[data-mode="small"] .grid-card {
  padding: 12px;
}

/* 侧边栏下视图切换组紧凑化 */
.lorebook-root[data-mode="small"] .lore-actions {
  gap: 8px;
}

.lorebook-root[data-mode="small"] .view-toggle-group {
  padding: 2px;
}

.lorebook-root[data-mode="small"] .view-toggle-btn {
  padding: 4px 6px;
}
</style>
