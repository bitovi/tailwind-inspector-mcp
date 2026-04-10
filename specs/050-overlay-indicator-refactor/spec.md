# 050 — Overlay Indicator Lifecycle Refactor

## Problem

The overlay has five independent indicator systems (selection highlights, hover preview, drop-zone hover indicator, locked insertion indicator, element-select outline) spread across three files (`element-highlight.ts`, `element-toolbar.ts`, `drop-zone.ts`). Each has its own positioning, show/hide, cleanup, and scroll-reposition logic — but they all follow the same lifecycle:

1. **Track** a target element
2. **Render** a visual tied to its `getBoundingClientRect()`
3. **Reposition** on scroll/resize
4. **Clear** when the mode changes

Because these lifecycles are independent, bugs emerge from the gaps:
- Insertion indicators didn't reposition on scroll (fixed by adding `repositionOnScroll`)
- Insertion indicators didn't reposition on resize (fixed by unifying scroll/resize into `repositionAll`)
- Selection highlights appeared under the insertion indicator on scroll (fixed by checking DOM presence)
- The `repositionAll` function needed branching (`if getLockedInsert()`) that was error-prone

Every new indicator added in the future will need to be wired into scroll, resize, and mode-transition cleanup manually — and forgetting any one of those is a bug.

The root cause is **imperative show/hide** — code must remember to call the right combination of `clearHighlights()`, `clearLockedInsert()`, `clearHoverPreview()`, etc. at every transition point. Miss one and you have a visual artifact.

## Goal

Replace imperative show/hide with a **declarative state → render** pattern. You describe *what should be visible*, and a single render function diffs against the DOM. Scroll, resize, and mode transitions all just re-render the current state.

## Design: Declarative overlay state

### The state type

A discriminated union describing every possible visual configuration:

```ts
type OverlayVisualState =
  | { kind: 'idle' }
  | { kind: 'selecting';
      hoverTarget?: HTMLElement;
      componentName?: string; }
  | { kind: 'selected';
      targets: HTMLElement[];       // equivalent nodes (multi-select)
      primaryTarget: HTMLElement;
      boundary: { componentName: string };
      showToolbar: boolean; }
  | { kind: 'browsing';
      hoverTarget?: HTMLElement;
      hoverPosition?: DropPosition;
      hoverAxis?: 'vertical' | 'horizontal'; }
  | { kind: 'insert-locked';
      target: HTMLElement;
      position: DropPosition;
      axis: 'vertical' | 'horizontal';
      showToolbar: boolean; }
  | { kind: 'component-armed';
      componentName: string;
      hoverTarget?: HTMLElement;
      hoverPosition?: DropPosition;
      hoverAxis?: 'vertical' | 'horizontal'; }
  | { kind: 'element-select';
      label: string;                // "Replace: Button", etc.
      hoverTarget?: HTMLElement; }
```

This replaces the scattered flags (`state.selectModeOn`, `state.addMode`, `state.currentMode`, the `DropZoneMode` union, `locked.target`, etc.) with a single source of truth.

### The render function

```ts
let current: OverlayVisualState = { kind: 'idle' };

function renderOverlay(next: OverlayVisualState): void {
  // Each helper is idempotent — shows/hides/repositions based on
  // whether the new state needs that visual.

  renderSelectionHighlights(next);   // show rects if kind === 'selected'
  renderHoverPreview(next);          // show outline+tooltip if selecting + hoverTarget
  renderDropIndicator(next);         // show line/box if browsing/armed + hoverTarget
  renderLockedIndicator(next);       // show pulsing indicator if insert-locked
  renderElementSelectOutline(next);  // show dashed outline if element-select + hoverTarget
  renderToolbar(next);               // show/reposition toolbar if selected/insert-locked
  renderCursorLabel(next);           // show label if browsing/armed/element-select

  current = next;
}
```

Each `render*` function checks whether its visual is needed in `next`. If yes, it creates or repositions. If no, it removes. No external code needs to know which visuals exist.

### Scroll and resize

Trivial — just re-render the same state:

```ts
function repositionAll(): void {
  renderOverlay(current);
}
window.addEventListener('scroll', repositionAll, { capture: true, passive: true });
window.addEventListener('resize', repositionAll);
```

No branching, no per-system reposition functions, no risk of forgetting one. Every visual that exists gets fresh coordinates.

### Mode transitions

Instead of calling a bespoke combination of clear functions, transitions just set the next state:

```ts
// Select mode activated:
renderOverlay({ kind: 'selecting' });

// Element clicked:
renderOverlay({
  kind: 'selected',
  targets: [targetEl],
  primaryTarget: targetEl,
  boundary: { componentName },
  showToolbar: true,
});

// Switch to insert mode:
renderOverlay({ kind: 'browsing' });

// Insertion point locked:
renderOverlay({
  kind: 'insert-locked',
  target: lockedEl,
  position: 'before',
  axis: 'vertical',
  showToolbar: true,
});

// Component placed, back to idle:
renderOverlay({ kind: 'idle' });
```

The render function handles all cleanup. If the previous state had selection highlights and the next state doesn't, they're removed. No explicit `clearHighlights()` call needed.

### Mouse move updates

Hover state updates on mousemove are lightweight — the state object is shallow, and each render helper can bail early if its relevant fields haven't changed:

```ts
// In select mode, mouse moves over an element:
renderOverlay({ kind: 'selecting', hoverTarget: el, componentName: 'Button' });

// Mouse leaves, or target is too small:
renderOverlay({ kind: 'selecting' });  // no hoverTarget → hover preview removed

// In browse mode, mouse moves:
renderOverlay({
  kind: 'browsing',
  hoverTarget: el,
  hoverPosition: 'before',
  hoverAxis: 'vertical',
});
```

### Diffing strategy

Each `render*` function can be as simple or smart as needed:

**Simple (current approach):** Remove old DOM elements, create new ones at fresh positions. Works well for highlights and indicators that are just positioned divs.

**Smart (for toolbar):** Check if the target changed. If same target, just reposition via floating-ui. If different target, rebuild. This avoids re-creating the entire toolbar (with its buttons, event listeners, etc.) on every scroll.

```ts
function renderToolbar(next: OverlayVisualState): void {
  const shouldShow = next.kind === 'selected' || next.kind === 'insert-locked';

  if (!shouldShow) {
    // Remove toolbar if it exists
    if (toolbarEl) { toolbarEl.remove(); toolbarEl = null; }
    return;
  }

  const target = next.kind === 'selected' ? next.primaryTarget : next.target;

  if (toolbarEl && toolbarTarget === target) {
    // Same target — just reposition
    if (!isToolbarDragged()) positionBothMenus(target, toolbarEl, msgRowEl);
  } else {
    // Different target — rebuild
    showDrawButton(target);
    toolbarTarget = target;
  }
}
```

## Relationship to mode-button-behavior

The flows in `.github/skills/mode-button-behavior/SKILL.md` map directly to state values:

| Flow step | `OverlayVisualState` |
|-----------|-----------------------|
| Idle (no mode active) | `{ kind: 'idle' }` |
| Select: crosshair active | `{ kind: 'selecting' }` |
| Select: hovering over element | `{ kind: 'selecting', hoverTarget, componentName }` |
| Select: element clicked | `{ kind: 'selected', targets, primaryTarget, ... }` |
| Insert: browse active | `{ kind: 'browsing' }` |
| Insert: hovering over drop site | `{ kind: 'browsing', hoverTarget, hoverPosition, hoverAxis }` |
| Insert: point locked | `{ kind: 'insert-locked', target, position, axis }` |
| Insert: component armed | `{ kind: 'component-armed', componentName, ... }` |
| Replace: element-select armed | `{ kind: 'element-select', label }` |
| Replace: hovering element | `{ kind: 'element-select', label, hoverTarget }` |
| Action complete | `{ kind: 'idle' }` |

The mode-button-behavior invariant #2 ("After placing or replacing, both buttons go gray") is just `renderOverlay({ kind: 'idle' })`.

## What stays the same

- **`DropZoneMode` in drop-zone.ts** — still manages click handling, arm/cleanup, keyboard. It just calls `renderOverlay()` instead of directly manipulating DOM.
- **Toolbar internal UI** — buttons, tabs, drag, message input. `renderToolbar()` delegates to existing `showDrawButton()` / `positionBothMenus()`.
- **Panel ↔ overlay WebSocket sync** — unchanged. Messages still arrive, handlers just call `renderOverlay(newState)`.
- **`overlay-state.ts`** — still holds selection data (`currentEquivalentNodes`, `currentTargetEl`, `currentBoundary`). Over time these could migrate into `OverlayVisualState`, but that's a separate step.

## File plan

```
overlay/src/
  overlay-visuals.ts     — OverlayVisualState type + renderOverlay() + render helpers
  overlay-visuals/       — (optional) split render helpers into sub-files if too large
    render-highlights.ts
    render-hover.ts
    render-drop-indicator.ts
    render-locked.ts
    render-outline.ts
    render-toolbar.ts
    render-cursor-label.ts
```

This is a single new file (or small folder) rather than a class-per-indicator hierarchy. The render helpers are plain functions, not classes.

## Migration strategy

1. Create `overlay-visuals.ts` with the `OverlayVisualState` type and a `renderOverlay()` that initially just delegates to the existing functions (`highlightElement`, `showDropIndicator`, etc.)
2. Replace `repositionAll()` in `index.ts` with `renderOverlay(current)`
3. One mode at a time, replace imperative show/hide calls with `renderOverlay(newState)`:
   - Start with `idle` and `selecting` (simplest)
   - Then `selected` (involves toolbar)
   - Then `browsing` / `insert-locked` (drop zone indicators)
   - Then `component-armed` / `element-select`
4. After each step, verify the relevant flow from mode-button-behavior works
5. Once all transitions go through `renderOverlay`, remove the scattered `clear*` functions
6. Run E2E tests (flow-a, flow-b) to verify no regressions

## Risks

- **Toolbar rebuild cost:** The toolbar is expensive to create (many buttons, event listeners). The render function must diff intelligently — only rebuild when the target element changes, not on every scroll.
- **mousemove frequency:** `renderOverlay` will be called on every throttled mousemove (~60fps). Each render helper must bail early if its relevant fields haven't changed. A shallow equality check on the previous vs. next state fields keeps this cheap.
- **State migration scope:** `overlay-state.ts` has selection state that overlaps with `OverlayVisualState`. Initially both exist — `overlay-state` for data (what's selected, config cache) and `OverlayVisualState` for visuals (what's rendered). Merging them is a follow-up.
- **drop-zone click handling:** The drop-zone's `onClick`, `onKeyDown`, and `arm()` logic is interleaved with indicator management. Extracting the rendering into `renderOverlay` while keeping the event handling in `drop-zone.ts` requires clean boundaries.

## Non-goals

- Changing the mode-button-behavior flows or toolbar UI
- Changing how the panel ↔ overlay WebSocket sync works
- Refactoring the toolbar's internal button/tab logic
- Merging `overlay-state.ts` into `OverlayVisualState` (follow-up)
- Adding new indicator types (this spec is about unifying existing ones)
