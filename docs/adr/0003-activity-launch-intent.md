# ADR 0003: Activity LaunchIntent for Desktop Surfaces

## Status

Accepted

## Context

LuminaWeave historically passed `mode: large | small` into plugin pages and let business UI decide whether an entry should open as a main tab, side panel, temporary mobile tab, or freeform workspace window. That leaked shell placement into plugin code and made mobile/Telegram/freeform behavior diverge.

The product direction is to treat component pages like Android-style Activity instances: the business layer declares the target and page metadata, while the desktop mode decides how that page is mounted.

## Decision

Introduce Activity metadata and Activity LaunchIntent as the public launch contract between Plugin/Surface Runtime and Desktop Mode Runtime.

- `Activity.size`: `default` or `small`.
- `Activity.pageType`: `nested` or `standalone`.
- `Activity.statusBar`, `titleBar`, and `secondaryMenu` describe page chrome metadata for mobile and freeform shells.
- `ActivityLaunchIntent.target` identifies a surface, plugin, registered panel, or legacy component.
- `ActivityLaunchIntent.role` identifies primary, support, auxiliary, or dialog intent.
- Desktop Mode Runtime resolves the intent to main area, right panel, temporary mobile page, Telegram mobile stack, freeform workspace window, or modal.

`mode: large | small` remains a compatibility input only:

- `large` maps to `Activity.size = default`, `Activity.pageType = nested`.
- `small` maps to `Activity.size = small`, `Activity.pageType = nested`.

## Consequences

- Business components should call `launchActivity(intent)` instead of directly emitting `SWITCH_WIDGET_PANEL`, `OPEN_TAB`, or opening workspace apps.
- `DesktopSurfaceService.openTab/openPanel` remain compatibility wrappers that produce Activity intents where possible.
- Surface renderer runtime bridge opens other surfaces through Activity LaunchIntent.
- Lumina Android native clients may consume Activity status bar metadata. TauriTavern keeps its current ABI; status bar icon color is a no-op there.
