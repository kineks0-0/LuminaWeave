<template>
  <section class="lw-terminal-root" aria-label="Lumina resource terminal">
    <header class="lw-terminal-toolbar">
      <div class="lw-terminal-heading">
        <h2>{{ title }}</h2>
        <span>{{ terminalStatus }}</span>
      </div>
      <div class="lw-terminal-actions">
        <label class="lw-terminal-theme">
          <span>Theme</span>
          <select v-model="themeLabel">
            <option v-for="themeOption in THEMES" :key="themeOption.value" :value="themeOption.value">
              {{ themeOption.value }}
            </option>
          </select>
        </label>
        <button type="button" @click="focusTerminal">Focus</button>
        <button type="button" @click="clearTerminal">Clear</button>
      </div>
    </header>

    <p v-if="lastError" class="lw-terminal-error" role="status">{{ lastError }}</p>

    <section
      v-if="pendingPermissionRequests.length || activePermissionGrants.length"
      class="lw-terminal-permissions"
      aria-labelledby="lw-terminal-permissions-title"
    >
      <div class="lw-terminal-permissions-header">
        <h3 id="lw-terminal-permissions-title">Shell permissions</h3>
        <p v-if="permissionStatus" role="status">{{ permissionStatus }}</p>
      </div>
      <ul v-if="pendingPermissionRequests.length" class="lw-terminal-permission-list" aria-label="Pending permission requests">
        <li v-for="request in pendingPermissionRequests" :key="request.requestId" class="lw-terminal-permission-item">
          <div>
            <strong>{{ request.operation }}</strong>
            <span>{{ formatPermissionScope(request.scope) }}</span>
            <small>{{ request.session.kind }} · {{ request.reason }}</small>
          </div>
          <div class="lw-terminal-permission-actions">
            <button type="button" @click="approvePermissionRequest(request.requestId)">Approve</button>
            <button type="button" @click="rejectPermissionRequest(request.requestId)">Reject</button>
          </div>
        </li>
      </ul>
      <ul v-if="activePermissionGrants.length" class="lw-terminal-permission-list" aria-label="Active permission grants">
        <li v-for="grant in activePermissionGrants" :key="grant.grantId" class="lw-terminal-permission-item">
          <div>
            <strong>{{ grant.operation }}</strong>
            <span>{{ formatPermissionScope(grant.scope) }}</span>
            <small>{{ grant.session.kind }} · grant {{ grant.grantId }}</small>
          </div>
          <div class="lw-terminal-permission-actions">
            <button type="button" @click="revokePermissionGrant(grant.grantId)">Revoke</button>
          </div>
        </li>
      </ul>
    </section>

    <div ref="terminalHostRef" class="lw-terminal-host" @pointerdown.stop @pointerup.stop @mousedown.stop @mouseup.stop
      @click.capture="handleTerminalClick" @selectstart.stop @contextmenu="handleTerminalContextMenu">
      <Terminal ref="terminalRef" class="lw-terminal" :theme="terminalTheme" :auto-resize="true" cursor-blink
        :wasm-url="wasmUrl"
        @ready="handleReady" @data="handleData" @resize="handleResize" @title="handleTitle"
        @error="handleTerminalError" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useTemplateRef } from 'vue';
import { Terminal, type WTerm } from '@wterm/vue';
import '@wterm/vue/css';
import { bashTerminalRuntime, shellPermissionService } from '../../api/core/hal/shell/index.js';
import { BashShell } from './BashShell.js';
import wasmUrlRaw from '@wterm/core/wasm?url';
import type { ShellPermissionGrant, ShellPermissionRequest, ShellPermissionScope } from '@shared/resources/index.js';

type TerminalComponent = InstanceType<typeof Terminal>;

interface WTermInputAdapter {
  textarea?: HTMLTextAreaElement;
}

interface WTermImeAdapter {
  element?: HTMLElement;
  input?: WTermInputAdapter;
}

interface ThemeOption {
  value: string;
  theme: string | undefined;
}

const THEMES: ThemeOption[] = [
  { value: 'Default', theme: undefined },
  { value: 'Solarized Dark', theme: 'solarized-dark' },
  { value: 'Monokai', theme: 'monokai' },
  { value: 'Light', theme: 'light' }
];

const terminalRef = useTemplateRef<TerminalComponent>('terminalRef');
const terminalHostRef = useTemplateRef<HTMLElement>('terminalHostRef');
const terminalReady = ref(false);
const lastError = ref('');
const shell = shallowRef<BashShell | null>(null);
const themeLabel = ref('Default');
const title = ref('WTERM 资源终端');
const terminalSize = ref({ cols: 80, rows: 24 });
const permissionRequests = ref<ShellPermissionRequest[]>([]);
const permissionGrants = ref<ShellPermissionGrant[]>([]);
const permissionStatus = ref('');
let imeAnchorTimer: number | null = null;
let imeAnchorFrame: number | null = null;
let imeAnchorSecondFrame: number | null = null;
let unsubscribePermissions: (() => void) | null = null;

const wasmUrl = wasmUrlRaw;

const terminalTheme = computed(() =>
  THEMES.find(themeOption => themeOption.value === themeLabel.value)?.theme
);

const terminalStatus = computed(() =>
  terminalReady.value
    ? `just-bash runtime ready · ${terminalSize.value.cols}x${terminalSize.value.rows}`
    : 'Starting wterm...'
);
const pendingPermissionRequests = computed(() =>
  permissionRequests.value.filter(request => request.status === 'pending')
);
const activePermissionGrants = computed(() => permissionGrants.value);

const write = (text: string) => {
  terminalRef.value?.write(text);
  scheduleImeAnchorUpdate();
};

const focusTerminal = () => {
  terminalRef.value?.focus();
  scheduleImeAnchorUpdate();
};

const clearTerminal = () => {
  shell.value?.clear();
  nextTick(focusTerminal);
};

const pasteFromClipboard = async () => {
  focusTerminal();
  if (!navigator.clipboard?.readText) {
    lastError.value = 'Clipboard paste is not available in this browser context.';
    return;
  }
  try {
    const text = await navigator.clipboard.readText();
    if (!text) return;
    await shell.value?.handleInput(text.replace(/\x1b/g, ''));
  } catch (error) {
    lastError.value = `Clipboard paste failed: ${formatError(error)}`;
  }
};

const getTerminalSelection = (): Selection | null => {
  const host = terminalHostRef.value;
  const root = host?.getRootNode();
  const shadowSelection = root instanceof ShadowRoot
    ? (root as ShadowRoot & { getSelection?: () => Selection | null }).getSelection?.()
    : null;
  if (shadowSelection && !shadowSelection.isCollapsed) {
    return shadowSelection;
  }
  return window.getSelection();
};

const getTerminalImeAdapter = (): WTermImeAdapter | null =>
  (terminalRef.value?.instance ?? null) as unknown as WTermImeAdapter | null;

const getTerminalTextarea = (): HTMLTextAreaElement | null =>
  getTerminalImeAdapter()?.input?.textarea ?? null;

const updateImeAnchor = () => {
  const terminal = getTerminalImeAdapter();
  const textarea = getTerminalTextarea();
  const terminalElement = terminal?.element;
  if (!textarea || !terminalElement) return;

  const cursor = terminalElement.querySelector<HTMLElement>('.term-cursor');
  const terminalRect = terminalElement.getBoundingClientRect();
  const cursorRect = cursor?.getBoundingClientRect();
  const rowHeight = parseFloat(getComputedStyle(terminalElement).getPropertyValue('--term-row-height')) || 18;

  const rawLeft = cursorRect ? cursorRect.left - terminalRect.left : 0;
  const rawTop = cursorRect ? cursorRect.top - terminalRect.top : 0;
  const left = Math.max(0, Math.min(rawLeft, Math.max(0, terminalElement.clientWidth - 1)));
  const top = Math.max(0, Math.min(rawTop, Math.max(0, terminalElement.clientHeight - rowHeight)));
  const width = Math.max(1, cursorRect?.width || 1);
  const height = Math.max(1, cursorRect?.height || rowHeight);

  Object.assign(textarea.style, {
    position: 'absolute',
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
    opacity: '0',
    overflow: 'hidden',
    border: '0',
    padding: '0',
    margin: '0',
    outline: 'none',
    resize: 'none',
    pointerEvents: 'none',
    caretColor: 'transparent',
    color: 'transparent',
    background: 'transparent'
  } satisfies Partial<CSSStyleDeclaration>);
};

const scheduleImeAnchorUpdate = () => {
  if (typeof window === 'undefined') return;
  if (imeAnchorTimer !== null) {
    window.clearTimeout(imeAnchorTimer);
  }
  if (imeAnchorFrame !== null) {
    window.cancelAnimationFrame(imeAnchorFrame);
    imeAnchorFrame = null;
  }
  if (imeAnchorSecondFrame !== null) {
    window.cancelAnimationFrame(imeAnchorSecondFrame);
    imeAnchorSecondFrame = null;
  }

  // wterm renders after a setTimeout + requestAnimationFrame. Mirror that cadence
  // so IME composition anchors follow the freshly rendered cursor span.
  imeAnchorTimer = window.setTimeout(() => {
    imeAnchorTimer = null;
    imeAnchorFrame = window.requestAnimationFrame(() => {
      imeAnchorFrame = null;
      updateImeAnchor();
      imeAnchorSecondFrame = window.requestAnimationFrame(() => {
        imeAnchorSecondFrame = null;
        updateImeAnchor();
      });
    });
  }, 0);
};

const terminalHasSelection = (): boolean => {
  const selection = getTerminalSelection();
  const host = terminalHostRef.value;
  if (!selection || !host || selection.isCollapsed || selection.rangeCount === 0) {
    return false;
  }

  const range = selection.getRangeAt(0);
  const selectedNode = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
    ? range.commonAncestorContainer
    : range.commonAncestorContainer.parentNode;
  return selectedNode instanceof Node && host.contains(selectedNode);
};

const handleTerminalContextMenu = (event: MouseEvent) => {
  event.stopPropagation();
  if (terminalHasSelection()) {
    return;
  }
  event.preventDefault();
  void pasteFromClipboard();
};

const handleTerminalClick = (event: MouseEvent) => {
  event.stopPropagation();
  if (!terminalHasSelection()) {
    focusTerminal();
  }
};

const formatError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const formatPermissionScope = (scope: ShellPermissionScope): string =>
  scope.pathPrefix || scope.urlPrefix || scope.resourceRef?.path || scope.sourceId || 'global scope';

const refreshPermissions = () => {
  permissionRequests.value = shellPermissionService.listRequests();
  permissionGrants.value = shellPermissionService.listGrants();
};

const approvePermissionRequest = (requestId: string) => {
  try {
    const grant = shellPermissionService.approveRequest(requestId);
    permissionStatus.value = `Approved ${grant.operation} for ${formatPermissionScope(grant.scope)}.`;
    refreshPermissions();
    focusTerminal();
  } catch (error) {
    permissionStatus.value = `Approval failed: ${formatError(error)}`;
  }
};

const rejectPermissionRequest = (requestId: string) => {
  try {
    const request = shellPermissionService.rejectRequest(requestId, 'Rejected by user');
    permissionStatus.value = `Rejected ${request.operation} for ${formatPermissionScope(request.scope)}.`;
    refreshPermissions();
    focusTerminal();
  } catch (error) {
    permissionStatus.value = `Reject failed: ${formatError(error)}`;
  }
};

const revokePermissionGrant = (grantId: string) => {
  try {
    const grant = shellPermissionService.revokeGrant(grantId, bashTerminalRuntime.getSession());
    permissionStatus.value = `Revoked ${grant.operation} for ${formatPermissionScope(grant.scope)}.`;
    refreshPermissions();
    focusTerminal();
  } catch (error) {
    permissionStatus.value = `Revoke failed: ${formatError(error)}`;
  }
};

const handleData = (chunk: string) => {
  const task = shell.value?.handleInput(chunk);
  if (task) {
    void task.finally(scheduleImeAnchorUpdate);
  } else {
    scheduleImeAnchorUpdate();
  }
};

const handleResize = (cols: number, rows: number) => {
  terminalSize.value = { cols, rows };
  scheduleImeAnchorUpdate();
};

const handleReady = (_wt: WTerm) => {
  terminalReady.value = true;
  if (!shell.value) {
    shell.value = new BashShell({
      runtime: bashTerminalRuntime,
      greeting: [
        'WTERM - Lumina Resource Shell',
        '\x1b[90mTry: ls /sources, cat /library/characters/<id>, help, lw-permission status\x1b[0m',
        ''
      ],
      onError: message => {
        lastError.value = message;
      }
    });
    shell.value.attach(write);
  }
  scheduleImeAnchorUpdate();
  nextTick(focusTerminal);
};

const handleTitle = (newTitle: string) => {
  title.value = newTitle || 'WTERM 资源终端';
};

const handleTerminalError = (error: unknown) => {
  lastError.value = `wterm failed: ${formatError(error)}`;
};

refreshPermissions();
unsubscribePermissions = shellPermissionService.subscribe(refreshPermissions);

onBeforeUnmount(() => {
  unsubscribePermissions?.();
  unsubscribePermissions = null;
  if (imeAnchorTimer !== null) {
    window.clearTimeout(imeAnchorTimer);
    imeAnchorTimer = null;
  }
  if (imeAnchorFrame !== null) {
    window.cancelAnimationFrame(imeAnchorFrame);
    imeAnchorFrame = null;
  }
  if (imeAnchorSecondFrame !== null) {
    window.cancelAnimationFrame(imeAnchorSecondFrame);
    imeAnchorSecondFrame = null;
  }
});
</script>

<style scoped>
.lw-terminal-root {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  gap: 14px;
  padding: 20px;
  overflow: hidden;
  background: #0a0a0a;
  color: #d4d4d4;
}

.lw-terminal-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.lw-terminal-heading {
  min-width: 0;
}

.lw-terminal-heading h2 {
  margin: 0;
  font-size: 15px;
  line-height: 22px;
  font-weight: 650;
  letter-spacing: 0;
}

.lw-terminal-heading span {
  display: block;
  color: #8a8a8a;
  font-size: 12px;
  line-height: 16px;
}

.lw-terminal-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.lw-terminal-theme {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #8a8a8a;
  font-size: 13px;
  line-height: 18px;
}

.lw-terminal-theme select {
  height: 32px;
  min-width: 144px;
  border: 1px solid #2c2c2c;
  border-radius: 8px;
  background: #1f1f1f;
  color: #d4d4d4;
  font: inherit;
  padding: 0 10px;
}

.lw-terminal-theme select:focus {
  outline: 2px solid rgba(86, 156, 214, 0.55);
  outline-offset: 2px;
}

.lw-terminal-actions button {
  border: 1px solid #2c2c2c;
  border-radius: 8px;
  background: #1f1f1f;
  color: #d4d4d4;
  cursor: pointer;
  font-size: 13px;
  line-height: 18px;
  padding: 6px 10px;
}

.lw-terminal-actions button:hover {
  border-color: #4a4a4a;
  background: #292929;
  color: #ffffff;
}

.lw-terminal-error {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid rgba(244, 71, 71, 0.45);
  border-radius: 8px;
  background: rgba(244, 71, 71, 0.08);
  color: #fca5a5;
  font-size: 13px;
  line-height: 18px;
}

.lw-terminal-permissions {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid rgba(86, 156, 214, 0.38);
  border-radius: 8px;
  background: rgba(86, 156, 214, 0.08);
}

.lw-terminal-permissions-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.lw-terminal-permissions h3,
.lw-terminal-permissions p {
  margin: 0;
}

.lw-terminal-permissions h3 {
  font-size: 13px;
  line-height: 18px;
  font-weight: 650;
}

.lw-terminal-permissions p {
  color: #b7d6f2;
  font-size: 12px;
  line-height: 16px;
}

.lw-terminal-permission-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.lw-terminal-permission-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.lw-terminal-permission-item strong,
.lw-terminal-permission-item span,
.lw-terminal-permission-item small {
  display: block;
}

.lw-terminal-permission-item strong {
  color: #ffffff;
  font-size: 13px;
  line-height: 18px;
}

.lw-terminal-permission-item span {
  overflow-wrap: anywhere;
  color: #d4d4d4;
  font-size: 12px;
  line-height: 16px;
}

.lw-terminal-permission-item small {
  color: #8a8a8a;
  font-size: 11px;
  line-height: 15px;
}

.lw-terminal-permission-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.lw-terminal-permission-actions button {
  min-height: 30px;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  background: #202020;
  color: #f5f5f5;
  cursor: pointer;
  font-size: 12px;
  line-height: 16px;
  padding: 5px 9px;
}

.lw-terminal-permission-actions button:hover {
  border-color: #569cd6;
  background: #263746;
}

.lw-terminal-permission-actions button:focus {
  outline: 2px solid rgba(86, 156, 214, 0.62);
  outline-offset: 2px;
}

.lw-terminal-host {
  box-sizing: border-box;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  background: #1e1e1e;
  user-select: text;
  -webkit-user-select: text;
}

.lw-terminal {
  width: 100%;
  height: 100%;
  min-height: 0;
  --term-bg: #1e1e1e;
  --term-fg: #d4d4d4;
  --term-cursor: #c586c0;
  --term-font-family: 'Menlo', 'Consolas', 'DejaVu Sans Mono', 'Courier New', monospace;
  --term-font-size: 14px;
  --term-row-height: 18px;
  --term-line-height: 1.25;
  box-shadow: none;
}

.lw-terminal :deep(.wterm),
:deep(.lw-terminal.wterm) {
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 24px;
  box-sizing: border-box;
  border-radius: 12px;
  box-shadow: none;
}

:deep(.lw-terminal.wterm ::selection),
.lw-terminal :deep(.wterm ::selection) {
  background: rgba(255, 255, 255, 0.9);
  color: #111111;
}

:deep(.lw-terminal.wterm),
.lw-terminal :deep(.wterm),
:deep(.lw-terminal.wterm .term-grid),
.lw-terminal :deep(.wterm .term-grid),
:deep(.lw-terminal.wterm .term-row),
.lw-terminal :deep(.wterm .term-row),
:deep(.lw-terminal.wterm .term-row > span),
.lw-terminal :deep(.wterm .term-row > span) {
  user-select: text !important;
  -webkit-user-select: text !important;
}
</style>
