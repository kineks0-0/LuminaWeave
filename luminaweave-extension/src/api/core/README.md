# Core Runtime Layout

`src/api/core` is organized by runtime capability. Files in these directories are Core services, not plugin UI or desktop-mode code.

## Functional Modules

- `conversation/`: conversation context, chat gateways, session index, message lists, and character-channel state assembly.
- `storage/`: persistence, worldline storage, timeline state helpers, and shared storage-facing core types.
- `generation/`: generation sessions, streaming tasks, Nexus clients, and local Nexus runtime.
- `prompt/`: PromptBuilder, prompt registry, preset composition, assembly trace, information planning, DCC, and system prompt helpers.
- `forge/`: Forge runtime orchestration, gateways, repositories, workflow graph, workspace sessions, and test chat services.
- `lorebook/`: lorebook manager, lorebook timeline view resolution, and prompt world-info mounting.
- `xml-view/`: XML interception, LuminaView parsing, and view component/render registries.
- `host/`: host environment detection and ST event bridge helpers.
- `st-adapter/`: ST protocol/client/sync adapters and ST-facing sync utilities.
- `hal/`: Hardware Abstraction Layer including `resource/` (VFS, resource sources) and `shell/` (just-bash runtime, permissions, workspaces).
- `runtime-utils/`: non-UI runtime helpers such as memory views, measuring, fonts, and seed handling.
- `facade/`: LuminaWeave API base/facade support.
- `utils/`: small pure helpers that do not own runtime state.

## Dependency Direction

- UI, stores, plugins, and desktop modes may call Core services.
- Core services must not import Vue components, Pinia stores, plugin views, shell code, or desktop-mode implementations.
- Domain modules may depend on lower-level host/storage/resource adapters when required, but should avoid circular module coupling.
- `hal/` (specifically `resource/`) keeps its stricter boundary documented in its subdirectories.

## Migration Rule

New Core files should be added to the functional module that owns their runtime responsibility. Do not add new root-level service files under `src/api/core`.
