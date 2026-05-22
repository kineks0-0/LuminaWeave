# Terminal Plugin Runtime Boundary

The terminal plugin is split into three layers so wterm UI integration does not absorb shell or Resource Domain responsibilities.

## Layers

- `TerminalRoot.vue`
  - Owns the Vue surface, wterm component wiring, theme selection, resize status, Shadow DOM selection handling, clipboard behavior, and IME textarea anchoring.
  - Owns the visible shell permission approval panel for pending requests and active grants.
  - It may inspect wterm DOM for browser integration fixes such as candidate-window placement.
  - It must not implement command parsing, VFS semantics, shell permissions, or Resource Domain writes.

- `BashShell.ts`
  - Owns line editing, prompt rendering, history navigation, keyboard escape handling, tab-completion presentation, and shell-result printing.
  - It consumes only a runtime-shaped object with `getCwd()`, `exec()`, and `completeLine()`.
  - It must not import Vue, wterm DOM APIs, ResourceService, VirtualFileSystemService, or permission services directly.

- `src/api/core/hal/shell/BashTerminalRuntime.ts`
  - Owns just-bash execution, Resource-backed FS mounts, `/sources`, `/library`, `/workspaces`, permission checks, network policy, and command completion.
  - It must not import terminal Vue components or plugin UI.

## Test Focus

- `BashShell` tests cover keyboard editing behavior without mounting Vue or wterm.
- Resource runtime tests cover VFS, permissions, and just-bash integration.
- UI-specific behavior such as IME anchor placement should stay in `TerminalRoot.vue` and be validated with browser/manual checks unless a DOM harness is introduced.
