# 054 — Overlay State Machine Refactor

**Status:** Proposed  
**Date:** 2026-05-03  
**Priority:** High (addresses the #1 maintainability risk in the codebase)

---

## Problem Statement

The overlay manages mode, selection, drag, and insert state via **~15 mutable variables spread across 5 files**, mutated by **~20 different code paths** with no formalized transitions. Meanwhile the panel has a well-structured `useReducer`-based state machine (`useModeStateMachine`) that models the same concepts cleanly. The two sides stay in sync via **bidirectional WebSocket messages**, but both independently compute the same transitions, leading to:

1. **Duplicated logic** — the three-way toggle (gray→orange→teal) is implemented 3 times (panel reducer `MODE_CHANGE`, overlay `onToolChange` callback, Escape key handler).
2. **Duplicated state** — `mode`, `selectModeOn`, `tabPreference`, `currentTab` exist in both the panel reducer and `overlay-state.ts`, synced by ~10 message types that can desync.
3. **Copy-pasted cleanup** — the sequence `revertPreview(); clearHighlights(); cancelInsert(); clearLockedInsert(); clearSelectionState()` appears in ~8 places across `index.ts`.
4. **Fragile save/restore** — `drag-move.ts` captures `wasSelectModeOn` at drag start and manually restores on drop/cancel. Missing any path leaves the UI stuck.
5. **Manual mutex** — `exclusiveInteraction` is set/cleared by hand in 3 files. A missed clear makes the overlay unresponsive.

### Scope

This spec covers the **overlay side only**. The panel's `useModeStateMachine` is good — we model the overlay after the same pattern and make the panel the single source of truth for mode.

---

## Goals

| # | Goal |
|---|------|
| G1 | **Single state object** — all overlay interaction state lives in one typed struct |
| G2 | **Pure reducer** — every transition is a `(state, action) → { state, effects }` function, unit-testable without DOM |
| G3 | **Declarative effects** — cleanup sequences are encoded as effect lists returned by the reducer, executed by a single effect runner |
| G4 | **Panel-as-source-of-truth** — the overlay never originates mode transitions; it sends intent messages and the panel decides |
| G5 | **Phase-based interactions** — drag-move, component-drag, and text-edit become explicit phases with saved/restored context |
| G6 | **No behavior change** — all existing flows (per `mode-button-behavior` skill) remain identical |

---

## Architecture

### Overview

```
┌─────────────────────┐                    ┌────────────────────────┐
│  Panel               │                    │  Overlay               │
│                      │   WS messages      │                        │
│  useModeStateMachine │◄──────────────────▶│  overlayReducer        │
│  (source of truth)   │                    │  (follower + local)    │
│                      │                    │                        │
│  Owns:               │                    │  Owns:                 │
│  - mode              │  ◄── authoritative │  - selectPhase         │
│  - selectModeActive  │                    │  - insertPhase         │
│  - insertBrowseActive│                    │  - interaction         │
│  - tabPreference     │                    │  - selection (DOM)     │
│  - elementData       │                    │  - toolbar visual      │
│  - insertPoint       │                    │  - locked insert (DOM) │
└─────────────────────┘                    └────────────────────────┘
```

**Key principle:** The panel owns mode/tool state. The overlay owns DOM-level state (which element is highlighted, where the insert indicator is, what phase of a drag we're in). The overlay sends **intents** (user clicked, user pressed Escape, user started dragging) and the panel sends **commands** (enter select mode, cancel mode, toggle browse off).

### Current message flow (bidirectional — causes desync)

```
Overlay user action → overlay computes new mode → mutates state → sends MODE_CHANGED to panel
Panel user action   → reducer computes new mode → sends MODE_CHANGED to overlay
```

### Proposed message flow (unidirectional for mode)

```
Overlay user action → sends INTENT to panel (e.g. USER_CLICKED_SELECT, USER_PRESSED_ESCAPE)
Panel reducer handles intent → computes new mode → sends COMMAND to overlay (e.g. MODE_CHANGED, CANCEL_MODE)
Overlay reducer handles command → transitions local phases → executes effects
```

For latency-sensitive interactions (hover preview, drop indicators), the overlay still acts locally and syncs the result.

---

## State Model

### `OverlayState`

```typescript
// overlay/src/overlay-state-machine/types.ts

/** Phases for the Select tool (three-way toggle) */
type SelectPhase =
  | 'off'              // Gray — no crosshair, no element
  | 'picking'          // Orange — crosshair active, hovering shows outlines
  | 'engaged';         // Teal — element selected, crosshair off

/** Phases for the Insert tool (three-way toggle) */
type InsertPhase =
  | 'off'              // Gray — no browse mode
  | 'browsing'         // Orange — drop-zone indicators on hover
  | 'locked';          // Teal — insert point locked, browse off

/** Exclusive interaction — at most one active at a time */
type Interaction =
  | { kind: 'none' }
  | { kind: 'drag-moving'; savedSelectPhase: SelectPhase; sourceEl: HTMLElement }
  | { kind: 'component-drag'; mode: 'replace' | 'insert' }
  | { kind: 'text-editing'; targetEl: HTMLElement };

/** Toolbar visual state for each tool button */
type ToolbarVisual = {
  select: 'gray' | 'picking' | 'engaged' | 'completed';
  insert: 'gray' | 'picking' | 'engaged';
  text: 'gray' | 'picking' | 'engaged';
};

interface OverlayState {
  active: boolean;                   // VyBit is open
  mode: AppMode;                     // from panel (source of truth)
  editTool: EditTool;                // from panel (source of truth)

  selectPhase: SelectPhase;
  insertPhase: InsertPhase;

  interaction: Interaction;

  // Selection (DOM-level, overlay-owned)
  selectedEl: HTMLElement | null;
  equivalentNodes: HTMLElement[];
  boundary: { componentName: string } | null;

  // Insert (DOM-level, overlay-owned)
  lockedTarget: HTMLElement | null;
  lockedPosition: DropPosition | null;

  // Tab (synced from panel)
  currentTab: string;
  tabPreference: 'design' | 'component';

  // Toolbar
  toolbar: ToolbarVisual;
}
```

### Key design decisions

| Decision | Rationale |
|----------|-----------|
| `SelectPhase` / `InsertPhase` replace `selectModeOn` + `currentTargetEl` truthiness checks | Makes the three-way toggle an explicit enum — impossible to be "picking + engaged" simultaneously |
| `Interaction` is a discriminated union with saved context | `drag-moving` carries `savedSelectPhase` — no separate `wasSelectModeOn` variable. Phase is restored automatically when the interaction ends. |
| `toolbar` is derived state | Computed by the reducer from `selectPhase`, `insertPhase`, and `interaction` — no separate `isPicking` / `isEngaged` / `toolOverrides` |
| `mode` and `editTool` are read-only mirrors | Set only by `COMMAND_*` actions from the panel. The overlay never mutates them directly. |

---

## Actions

### Intent actions (overlay → panel via WS)

These are sent by the overlay when the user does something. The overlay does **not** transition its own mode — it waits for the panel's command response.

```typescript
type OverlayIntent =
  // Tool clicks
  | { type: 'INTENT_TOOL_CLICK'; tool: EditTool }
  // Element interactions
  | { type: 'INTENT_ELEMENT_CLICKED'; elementData: ElementData }
  | { type: 'INTENT_INSERT_POINT_LOCKED'; target: HTMLElement; position: DropPosition }
  | { type: 'INTENT_ESCAPE' }
  | { type: 'INTENT_DESELECT' }
  // Drag
  | { type: 'INTENT_DRAG_MOVE_START' }
  | { type: 'INTENT_DRAG_MOVE_END' }
  | { type: 'INTENT_COMPONENT_DRAG_START' }
  | { type: 'INTENT_COMPONENT_DRAG_END' }
  // Text
  | { type: 'INTENT_TEXT_EDIT_START' }
  | { type: 'INTENT_TEXT_EDIT_END' };
```

### Command actions (panel → overlay via WS)

These are received from the panel and directly drive overlay state transitions.

```typescript
type OverlayCommand =
  | { type: 'CMD_MODE_CHANGED'; mode: AppMode }
  | { type: 'CMD_SELECT_PHASE'; phase: SelectPhase }
  | { type: 'CMD_INSERT_PHASE'; phase: InsertPhase }
  | { type: 'CMD_CANCEL_MODE' }
  | { type: 'CMD_TAB_CHANGED'; tab: string }
  | { type: 'CMD_EDIT_TOOL_CHANGED'; tool: EditTool }
  | { type: 'CMD_COLOR_SCHEME'; scheme: 'dark' | 'light' };
```

### Local actions (overlay internal, no WS)

These handle DOM-level state that doesn't need panel involvement.

```typescript
type OverlayLocalAction =
  | { type: 'DRAG_MOVE_THRESHOLD_MET' }
  | { type: 'DRAG_MOVE_DROPPED'; target: HTMLElement; position: DropPosition }
  | { type: 'DRAG_MOVE_CANCELLED' }
  | { type: 'COMPONENT_DRAG_DROPPED'; target: HTMLElement; position: DropPosition }
  | { type: 'COMPONENT_DRAG_CANCELLED' }
  | { type: 'TEXT_EDIT_COMMITTED'; newHtml: string }
  | { type: 'ADD_MODE_TOGGLED'; on: boolean }
  | { type: 'PREVIEW_APPLIED'; oldClass: string; newClass: string }
  | { type: 'PREVIEW_REVERTED' };

type OverlayAction = OverlayIntent | OverlayCommand | OverlayLocalAction;
```

---

## Effects

Instead of imperative cleanup scattered across 8 call sites, the reducer returns an effect list.

```typescript
type OverlayEffect =
  // DOM effects
  | { kind: 'revert-preview' }
  | { kind: 'clear-highlights' }
  | { kind: 'clear-hover-preview' }
  | { kind: 'highlight-element'; el: HTMLElement }
  | { kind: 'show-draw-button'; el: HTMLElement }
  | { kind: 'remove-draw-button' }
  | { kind: 'set-grab-cursor'; el: HTMLElement }
  | { kind: 'clear-grab-cursor'; el: HTMLElement }
  // Drop-zone effects
  | { kind: 'start-browse' }
  | { kind: 'cancel-insert' }
  | { kind: 'clear-locked-insert' }
  | { kind: 'arm-component-insert'; componentName: string; storyId: string; ghostHtml: string; ghostCss: string }
  // Toolbar effects
  | { kind: 'show-toolbar' }
  | { kind: 'hide-toolbar' }
  | { kind: 'update-toolbar'; visual: ToolbarVisual }
  // WS effects
  | { kind: 'send-to-panel'; message: Record<string, unknown> }
  // Crosshair / cursor
  | { kind: 'set-crosshair'; on: boolean }
  // Container
  | { kind: 'open-panel' };
```

### Effect executor

A single function processes the effect list after each state transition:

```typescript
// overlay/src/overlay-state-machine/effect-executor.ts

function executeEffects(effects: OverlayEffect[], deps: EffectDeps): void {
  for (const effect of effects) {
    switch (effect.kind) {
      case 'revert-preview':    deps.revertPreview(); break;
      case 'clear-highlights':  deps.clearHighlights(); break;
      case 'cancel-insert':     deps.cancelInsert(); break;
      case 'clear-locked-insert': deps.clearLockedInsert(); break;
      case 'start-browse':      deps.startBrowse(); break;
      case 'set-crosshair':     deps.setCrosshair(effect.on); break;
      case 'send-to-panel':     deps.sendToPanel(effect.message); break;
      // ... etc
    }
  }
}
```

### Cleanup consolidation

The ~8 call sites that currently do:

```typescript
revertPreview();
clearHighlights();
cancelInsert();
clearLockedInsert();
clearSelectionState();
```

Become a single reducer transition returning the standard cleanup effect list. The reducer has a helper:

```typescript
const FULL_CLEANUP: OverlayEffect[] = [
  { kind: 'revert-preview' },
  { kind: 'clear-highlights' },
  { kind: 'cancel-insert' },
  { kind: 'clear-locked-insert' },
  { kind: 'clear-hover-preview' },
];
```

---

## Reducer: Key Transitions

### `CMD_MODE_CHANGED` (panel tells overlay to change mode)

```typescript
case 'CMD_MODE_CHANGED': {
  const effects: OverlayEffect[] = [...FULL_CLEANUP];

  if (action.mode === 'select') {
    return {
      state: {
        ...prev,
        mode: 'select',
        editTool: 'select',
        selectPhase: 'picking',
        insertPhase: 'off',
        selectedEl: null,
        equivalentNodes: [],
        lockedTarget: null,
        lockedPosition: null,
      },
      effects: [
        ...effects,
        { kind: 'set-crosshair', on: true },
        { kind: 'show-toolbar' },
        { kind: 'update-toolbar', visual: { select: 'picking', insert: 'gray', text: 'gray' } },
      ],
    };
  }

  if (action.mode === 'insert') {
    return {
      state: {
        ...prev,
        mode: 'insert',
        editTool: 'insert',
        selectPhase: 'off',
        insertPhase: 'browsing',
        selectedEl: null,
        equivalentNodes: [],
      },
      effects: [
        ...effects,
        { kind: 'start-browse' },
        { kind: 'show-toolbar' },
        { kind: 'update-toolbar', visual: { select: 'gray', insert: 'picking', text: 'gray' } },
      ],
    };
  }

  // mode === null — cancel everything
  return {
    state: {
      ...prev,
      mode: null,
      editTool: null,
      selectPhase: 'off',
      insertPhase: 'off',
      selectedEl: null,
      equivalentNodes: [],
      lockedTarget: null,
      lockedPosition: null,
    },
    effects: [...effects, { kind: 'update-toolbar', visual: { select: 'gray', insert: 'gray', text: 'gray' } }],
  };
}
```

### `CMD_SELECT_PHASE` (panel tells overlay to change select phase)

```typescript
case 'CMD_SELECT_PHASE': {
  if (action.phase === 'picking') {
    // Orange: crosshair on, clear element
    return {
      state: { ...prev, selectPhase: 'picking', selectedEl: null, equivalentNodes: [] },
      effects: [
        { kind: 'clear-highlights' },
        { kind: 'revert-preview' },
        { kind: 'set-crosshair', on: true },
        { kind: 'update-toolbar', visual: { ...prev.toolbar, select: 'picking' } },
      ],
    };
  }
  if (action.phase === 'engaged') {
    // Teal: crosshair off, keep element
    return {
      state: { ...prev, selectPhase: 'engaged' },
      effects: [
        { kind: 'set-crosshair', on: false },
        { kind: 'update-toolbar', visual: { ...prev.toolbar, select: 'engaged' } },
      ],
    };
  }
  // 'off'
  return {
    state: { ...prev, selectPhase: 'off', selectedEl: null, equivalentNodes: [] },
    effects: [
      { kind: 'clear-highlights' },
      { kind: 'revert-preview' },
      { kind: 'set-crosshair', on: false },
      { kind: 'update-toolbar', visual: { ...prev.toolbar, select: 'gray' } },
    ],
  };
}
```

### Drag-move lifecycle

```typescript
case 'DRAG_MOVE_THRESHOLD_MET': {
  // Interaction kind must already be set by the mousedown handler
  // (which dispatches this only after the 5px threshold)
  return {
    state: {
      ...prev,
      interaction: {
        kind: 'drag-moving',
        savedSelectPhase: prev.selectPhase,
        sourceEl: prev.selectedEl!,
      },
      selectPhase: 'off',
    },
    effects: [
      { kind: 'set-crosshair', on: false },
      { kind: 'clear-grab-cursor', el: prev.selectedEl! },
      { kind: 'update-toolbar', visual: { select: 'gray', insert: 'picking', text: 'gray' } },
    ],
  };
}

case 'DRAG_MOVE_DROPPED': {
  const saved = prev.interaction.kind === 'drag-moving'
    ? prev.interaction.savedSelectPhase
    : prev.selectPhase;

  return {
    state: {
      ...prev,
      interaction: { kind: 'none' },
      selectPhase: saved,
    },
    effects: [
      { kind: 'set-crosshair', on: saved === 'picking' },
      { kind: 'set-grab-cursor', el: prev.selectedEl! },
      { kind: 'highlight-element', el: prev.selectedEl! },
      { kind: 'show-draw-button', el: prev.selectedEl! },
      { kind: 'update-toolbar', visual: {
        select: saved === 'picking' ? 'picking' : saved === 'engaged' ? 'engaged' : 'gray',
        insert: 'gray',
        text: 'gray',
      }},
    ],
  };
}

case 'DRAG_MOVE_CANCELLED': {
  // Identical to DRAG_MOVE_DROPPED minus the patch creation
  const saved = prev.interaction.kind === 'drag-moving'
    ? prev.interaction.savedSelectPhase
    : prev.selectPhase;

  return {
    state: {
      ...prev,
      interaction: { kind: 'none' },
      selectPhase: saved,
    },
    effects: [
      { kind: 'set-crosshair', on: saved === 'picking' },
      { kind: 'set-grab-cursor', el: prev.selectedEl! },
      { kind: 'highlight-element', el: prev.selectedEl! },
      { kind: 'update-toolbar', visual: {
        select: saved === 'picking' ? 'picking' : saved === 'engaged' ? 'engaged' : 'gray',
        insert: 'gray',
        text: 'gray',
      }},
    ],
  };
}
```

The `savedSelectPhase` is now **part of the interaction phase data**, not a separate `wasSelectModeOn` boolean. It's impossible to forget to restore it because the reducer always reads it from the interaction struct on exit.

---

## Migration Plan

### Phase 1: Overlay reducer + effect executor (no behavior changes)

**Goal:** Replace mutable `overlay-state.ts` with a reducer, keeping all existing WS messages intact.

| Step | Change | Files touched |
|------|--------|---------------|
| 1a | Create `overlay/src/overlay-state-machine/` module | New: `types.ts`, `reducer.ts`, `effect-executor.ts`, `index.ts`, `reducer.test.ts` |
| 1b | Create `OverlayState`, `OverlayAction`, `OverlayEffect` types | `types.ts` |
| 1c | Implement `overlayReducer` — pure function, same transitions as today | `reducer.ts` |
| 1d | Implement `executeEffects` — maps effect objects to imperative calls | `effect-executor.ts` |
| 1e | Create `dispatch()` function that runs reducer + effect executor | `index.ts` |
| 1f | Unit tests for every reducer transition | `reducer.test.ts` |
| 1g | Wire `dispatch()` into overlay `index.ts` — replace direct state mutations with `dispatch(action)` calls | `overlay/src/index.ts` |
| 1h | Remove redundant state from `overlay-state.ts` | `overlay-state.ts` |
| 1i | Update `bottom-toolbar.ts` to read from reducer state instead of local `isPicking`/`isEngaged`/`toolOverrides` | `bottom-toolbar.ts` |

**Validation:** All existing unit tests pass. Manual smoke test of all flows in `mode-button-behavior` skill. E2E tests pass.

**Note:** During this phase, the overlay still processes the same WS messages (`MODE_CHANGED`, `TOGGLE_SELECT_MODE`, etc.) as today. The reducer handles them as `CMD_*` actions internally, but the WS message format doesn't change. Panel code is untouched.

### Phase 2: Unidirectional mode flow

**Goal:** Overlay stops originating mode transitions. Sends intents, panel responds with commands.

| Step | Change | Files touched |
|------|--------|---------------|
| 2a | Add new WS message types for overlay intents (`OVERLAY_INTENT_TOOL_CLICK`, `OVERLAY_INTENT_ESCAPE`, etc.) | `shared/types.ts` |
| 2b | Panel's `useModeStateMachine` handles new intent actions (`WS_OVERLAY_INTENT_*`) | `useModeStateMachine.ts`, `types.ts` |
| 2c | Overlay's tool click handler sends `INTENT_TOOL_CLICK` instead of computing mode + sending `MODE_CHANGED` | `overlay/src/index.ts` |
| 2d | Overlay's Escape handler sends `INTENT_ESCAPE` instead of computing transitions locally | `overlay/src/index.ts` |
| 2e | Remove overlay-side three-way toggle logic (now handled by panel) | `overlay/src/index.ts` |
| 2f | Remove duplicate mode computation from `bottom-toolbar.ts` `setTool()` | `bottom-toolbar.ts` |

**Validation:** Same as Phase 1. The WS message surface shrinks — `TOGGLE_SELECT_MODE`, `TOGGLE_INSERT_BROWSE`, `SELECT_MODE_CHANGED` from overlay become unnecessary because the panel computes the phase and sends `CMD_SELECT_PHASE` / `CMD_INSERT_PHASE`.

### Phase 3: Phase-based interactions

**Goal:** Replace `exclusiveInteraction` mutex + manual save/restore with interaction phases.

| Step | Change | Files touched |
|------|--------|---------------|
| 3a | `drag-move.ts` dispatches `DRAG_MOVE_THRESHOLD_MET` instead of setting `state.exclusiveInteraction = 'drag-moving'` | `drag-move.ts` |
| 3b | `drag-move.ts` dispatches `DRAG_MOVE_DROPPED` / `DRAG_MOVE_CANCELLED` instead of manually restoring `wasSelectModeOn` + clearing mutex | `drag-move.ts` |
| 3c | `drag-drop.ts` dispatches `COMPONENT_DRAG_*` actions instead of mutex manipulation | `drag-drop.ts` |
| 3d | `text-edit.ts` dispatches `TEXT_EDIT_*` actions instead of mutex manipulation | `text-edit.ts` |
| 3e | All hover/click guards check `state.interaction.kind !== 'none'` instead of `state.exclusiveInteraction` | `index.ts`, `element-highlight.ts` |
| 3f | Remove `exclusiveInteraction` from `overlay-state.ts` | `overlay-state.ts` |

**Validation:** Same. Specifically test: start drag → drop on invalid target → verify select phase restored. Start text edit → Escape → verify toolbar restored.

### Phase 4: Consolidate toolbar state

**Goal:** Toolbar visual state is derived by the reducer, not maintained separately.

| Step | Change | Files touched |
|------|--------|---------------|
| 4a | Reducer computes `toolbar` visual state as part of every transition | `reducer.ts` |
| 4b | `bottom-toolbar.ts` reads from `state.toolbar` instead of maintaining `currentTool`, `isPicking`, `isEngaged`, `toolOverrides` | `bottom-toolbar.ts` |
| 4c | Remove `setToolOverrides`, `clearToolOverrides`, `clearTransientOverrides`, `updateToolState` from `bottom-toolbar.ts` exports | `bottom-toolbar.ts` |
| 4d | Paste flow uses reducer action (`PASTE_INITIATED`) that sets toolbar visual to `{ select: 'completed', insert: 'picking' }` | `reducer.ts`, `index.ts` |

**Validation:** Paste flow visual states (green Select, orange Insert) still work per Flow G.

---

## File Structure

```
overlay/src/overlay-state-machine/
  types.ts              ← OverlayState, OverlayAction, OverlayEffect
  reducer.ts            ← Pure overlayReducer function
  reducer.test.ts       ← Unit tests for every transition
  effect-executor.ts    ← Maps effect objects → imperative calls
  index.ts              ← dispatch(), getState(), subscribe()
```

---

## Testing Strategy

### Unit tests (reducer)

The reducer is a pure function — test every transition in isolation:

```typescript
// overlay/src/overlay-state-machine/reducer.test.ts

describe('overlayReducer', () => {
  describe('CMD_MODE_CHANGED', () => {
    it('null → select: sets selectPhase=picking, emits crosshair + toolbar effects', () => {
      const { state, effects } = overlayReducer(INITIAL, { type: 'CMD_MODE_CHANGED', mode: 'select' });
      expect(state.selectPhase).toBe('picking');
      expect(state.insertPhase).toBe('off');
      expect(effects).toContainEqual({ kind: 'set-crosshair', on: true });
    });

    it('select → insert: clears selection, starts browse', () => { /* ... */ });
    it('select → null: full cleanup', () => { /* ... */ });
  });

  describe('DRAG_MOVE_THRESHOLD_MET', () => {
    it('saves selectPhase in interaction, sets selectPhase=off', () => {
      const prev = { ...INITIAL, selectPhase: 'picking' as const, selectedEl: div };
      const { state } = overlayReducer(prev, { type: 'DRAG_MOVE_THRESHOLD_MET' });
      expect(state.interaction).toEqual({
        kind: 'drag-moving',
        savedSelectPhase: 'picking',
        sourceEl: div,
      });
      expect(state.selectPhase).toBe('off');
    });
  });

  describe('DRAG_MOVE_DROPPED', () => {
    it('restores savedSelectPhase from interaction', () => {
      const prev = {
        ...INITIAL,
        selectPhase: 'off' as const,
        interaction: { kind: 'drag-moving' as const, savedSelectPhase: 'engaged' as const, sourceEl: div },
      };
      const { state } = overlayReducer(prev, { type: 'DRAG_MOVE_DROPPED', target: div, position: 'before' });
      expect(state.selectPhase).toBe('engaged');
      expect(state.interaction.kind).toBe('none');
    });
  });

  describe('three-way toggle via CMD_SELECT_PHASE', () => {
    it('off → picking: enables crosshair', () => { /* ... */ });
    it('picking → engaged: disables crosshair, keeps element', () => { /* ... */ });
    it('engaged → picking: clears element, re-enables crosshair', () => { /* ... */ });
    it('picking (no element) → off: cancels', () => { /* ... */ });
  });

  describe('Escape handling (via CMD_* from panel)', () => {
    // The overlay itself doesn't handle Escape logic anymore —
    // it sends INTENT_ESCAPE to panel, panel computes next state,
    // sends CMD_SELECT_PHASE or CMD_CANCEL_MODE back.
    // But we test that the overlay reducer handles those commands correctly.
  });
});
```

### Integration tests

- All existing panel unit tests for `useModeStateMachine` must still pass
- E2E tests for all flows in `mode-button-behavior` skill

### Smoke test checklist

For each flow (A through G in `mode-button-behavior` skill):
- [ ] Button colors match expected states at every step
- [ ] Escape key ladder works correctly
- [ ] Tab visibility matches expected state
- [ ] Page interactions (crosshair, outlines, browse indicators) match expected state

Drag-specific:
- [ ] Drag-move: select phase restored to original value after drop
- [ ] Drag-move: select phase restored after cancel (Escape during drag)
- [ ] Component drag: toolbar returns to correct state after drop
- [ ] Component drag: toolbar returns to correct state after cancel

Text-edit specific:
- [ ] Toolbar locked during text editing
- [ ] Toolbar restored after text edit committed or cancelled

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Latency from round-trip for intents | User perceives delay on tool click | Phase 2 can add optimistic local updates that are confirmed/corrected by the panel response. Most interactions (hover, drag indicators) remain local. |
| Large diff touches many files at once | Hard to review, easy to introduce bugs | Four-phase rollout — each phase is independently shippable and testable. Phase 1 is pure refactor with no behavior change. |
| `overlay-state.ts` is imported everywhere | Changing its shape breaks many modules | Phase 1 keeps the old `state` object as a thin facade over the reducer state during migration. Modules are updated one at a time. |
| Drop-zone has its own discriminated union (`DropZoneMode`) | Two state machines could conflict | Drop-zone's `DropZoneMode` becomes driven by `insertPhase` — the reducer dispatches `start-browse` / `cancel-insert` effects, and the drop-zone module reads from the reducer state. The `DropZoneMode` type can stay as an internal implementation detail of the drop-zone DOM management. |

---

## Metrics

How we'll know this worked:

| Metric | Before | Target |
|--------|--------|--------|
| Files touched to add a new mode | 5+ (index.ts, overlay-state.ts, bottom-toolbar.ts, reducer, drop-zone.ts) | 2 (reducer.ts + effect-executor.ts) |
| Places three-way toggle is implemented | 3 | 1 (panel reducer — overlay follows) |
| Places cleanup sequence is copy-pasted | ~8 | 0 (reducer returns `FULL_CLEANUP` effect list) |
| State variables tracking mode/interaction | ~15 across 5 files | 1 struct (`OverlayState`) |
| Lines of pure-function unit tests for overlay transitions | 0 | 200+ |
| `exclusiveInteraction` manual set/clear sites | 6 | 0 (interaction is a reducer phase) |

---

## Non-Goals

- Changing the panel's `useModeStateMachine` reducer (it's already well-structured)
- Changing the WebSocket transport layer
- Changing the MCP tool interface
- Changing any user-visible behavior or button flow
- Adding new modes or tools (that's a separate spec)

---

## References

- [mode-button-behavior skill](/.github/skills/mode-button-behavior/SKILL.md) — canonical flow tables
- [spec 040 — Select Mode State Machine](/specs/040-select-mode-state-machine/spec.md) — original three-state model for Select
- [spec 026 — Refactor ComponentGroupItem State Machine](/specs/026-refactor-componentgroupitem-state-machine/SPEC.md) — prior art on reducer-based state machines in this project
- [`useModeStateMachine`](/panel/src/hooks/useModeStateMachine/) — the pattern to follow
- [`overlay-state.ts`](/overlay/src/overlay-state.ts) — current mutable state to replace
- [`bottom-toolbar.ts`](/overlay/src/bottom-toolbar.ts) — toolbar state to consolidate
- [`drop-zone.ts`](/overlay/src/drop-zone.ts) — drop-zone discriminated union to integrate
- [`drag-move.ts`](/overlay/src/drag-move.ts) — save/restore pattern to replace
- [`drag-drop.ts`](/overlay/src/drag-drop.ts) — component drag session to integrate
