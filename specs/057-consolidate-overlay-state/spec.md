# 057 — Consolidate Overlay State

**Status:** Proposed
**Date:** 2026-05-05
**Depends on:** 054 (overlay state machine — partially implemented)

---

## Problem

The overlay has two parallel state systems that both control the same behavior:

1. **Legacy** — `overlay-state.ts` exports a mutable `state` object with ~30 fields, imported by 11 files, mutated freely from any call site.
2. **New SM** — `overlay-state-machine/` provides a pure reducer with typed state, actions, and effects. It was introduced in spec 054.

The SM is ~30% wired up. Only 7 of its 25 action handlers are ever dispatched. The remaining 18 are dead code — the legacy paths still handle those flows directly. A subscriber bridge syncs SM → legacy for mode/phase/tab, but selection and interaction state are never synced. Three places patch the SM state via unsafe `(getState() as any)` casts.

This causes real bugs. Example: pressing Escape mutates `state.selectModeOn` via the legacy handler without updating the SM's `selectPhase`. The next toolbar click reads stale SM state and produces the wrong transition.

### Current state audit

**Actions dispatched vs. dead code:**

| Dispatched (7) | Dead code (18) |
|---|---|
| `TOOLBAR_TOOL_CLICK` | `ELEMENT_SELECTED`, `ELEMENT_DESELECTED` |
| `CMD_MODE_CHANGED` | `ESCAPE` |
| `CMD_TOGGLE_SELECT_MODE` | `INSERT_POINT_LOCKED`, `INSERT_POINT_CLEARED` |
| `CMD_TOGGLE_INSERT_BROWSE` | `DRAG_MOVE_START`, `DRAG_MOVE_THRESHOLD_MET` |
| `CMD_CANCEL_MODE` | `DRAG_MOVE_DROPPED`, `DRAG_MOVE_CANCELLED` |
| `CMD_TAB_CHANGED` | `COMPONENT_DRAG_START`, `COMPONENT_DRAG_DROPPED`, `COMPONENT_DRAG_CANCELLED` |
| `CMD_EDIT_TOOL_CHANGED` | `TEXT_EDIT_START`, `TEXT_EDIT_END` |
| | `PASTE_INITIATED`, `ACTIVATE`, `DEACTIVATE`, `NAVIGATION_RESET`, `CMD_COLOR_SCHEME` |

**Legacy bypass points in index.ts:**

| Code path | What it does | SM action it should use |
|---|---|---|
| Escape handler (line ~856) | Mutates `state.selectModeOn`, patches SM via cast | `dispatch({ type: 'ESCAPE' })` |
| `clickHandler()` | Reads `state.selectModeOn`, calls `finalizeSelection` | `dispatch({ type: 'ELEMENT_SELECTED', ... })` |
| `setSelectMode()` | Mutates `state.selectModeOn`, manages cursor/listeners | SM effect: `set-select-mode` |
| `finalizeSelection()` | Patches SM via cast, mutates legacy selection fields | `dispatch({ type: 'ELEMENT_SELECTED', ... })` |
| `toggleInspect()` | Mutates `state.active` directly | `dispatch({ type: 'ACTIVATE' })` / `dispatch({ type: 'DEACTIVATE' })` |

**Files directly writing `state.exclusiveInteraction`:**
- `text-edit.ts` — should dispatch `TEXT_EDIT_START` / `TEXT_EDIT_END`
- `drag-move.ts` — should dispatch `DRAG_MOVE_START` / `DRAG_MOVE_DROPPED` / `DRAG_MOVE_CANCELLED`
- `drag-drop.ts` — should dispatch `COMPONENT_DRAG_START` / `COMPONENT_DRAG_DROPPED` / `COMPONENT_DRAG_CANCELLED`

**Files importing `overlay-state.ts` (11 total):**

| File | Uses mode/phase state? | Uses DOM infrastructure? | Uses selection state? |
|---|---|---|---|
| `index.ts` | Yes | Yes | Yes |
| `element-highlight.ts` | Yes (`exclusiveInteraction`) | Yes (`shadowRoot`, hover refs) | Yes (`currentEquivalentNodes`) |
| `element-toolbar.ts` | No | Yes (`shadowRoot`, toolbar refs) | Yes (`currentTargetEl`, `cachedNearGroups`) |
| `element-drawer.ts` | No | Yes (`shadowRoot`) | Yes (`currentTargetEl`, `currentBoundary`, `equivalentNodes`) |
| `bottom-toolbar.ts` | No | Yes (`shadowRoot`) | Yes (`currentEquivalentNodes`) |
| `design-canvas-manager.ts` | No | Yes (`shadowRoot`, `designCanvasWrappers`) | Yes (`currentTargetEl`, `currentBoundary`) |
| `drop-zone.ts` | No | Yes (`shadowHost`) | No |
| `drag-move.ts` | Yes (`exclusiveInteraction`, `selectModeOn`) | Yes (`shadowHost`) | Yes (`currentTargetEl`, `currentBoundary`) |
| `drag-drop.ts` | Yes (`exclusiveInteraction`) | No | Yes (`currentTargetEl`, `currentBoundary`) |
| `text-edit.ts` | Yes (`exclusiveInteraction`) | No | No |
| `depth-picker.ts` | No | Yes (`shadowHost`, `shadowRoot`, `depthPickerEl`) | No |

---

## Goals

| # | Goal |
|---|---|
| G1 | Every overlay state transition flows through `dispatch()` — no direct mutation of state fields |
| G2 | Remove `overlay-state.ts` as a module — split remaining fields into purpose-specific locations |
| G3 | Remove the SM ↔ legacy sync subscriber bridge |
| G4 | Remove all `(getState() as any)` unsafe casts |
| G5 | No behavior changes — all existing flows stay identical |

## Non-goals

- Changing the panel's `useModeStateMachine` (it's already good)
- Making the panel the single source of truth for mode (that's a future optimization from spec 054 Phase 2)
- Changing WS message formats
- Adding new modes or tools

---

## Design

### Split legacy state into two categories

The ~30 fields in `overlay-state.ts` fall into two groups:

**A. Mode/interaction state** (belongs in the SM's `OverlayState`):
- `active`, `currentMode`, `selectModeOn`, `currentTab`, `tabPreference`
- `exclusiveInteraction`
- `currentTargetEl`, `currentEquivalentNodes`, `currentBoundary`
- `addMode`, `manuallyAddedNodes`
- `replaceDirection`

**B. DOM infrastructure** (not mode state — stays in a separate bag):
- `shadowRoot`, `shadowHost` — injected at init, never changes
- `containers`, `activeContainer` — panel container management
- `hoverOutlineEl`, `hoverTooltipEl`, `lastHoveredEl`, `lastMoveTime` — hover preview DOM
- `toolbarEl`, `msgRowEl`, `pickerEl`, `pickerCloseHandler`, `pickerRefreshCallback` — toolbar DOM refs
- `depthPickerEl` — depth picker DOM ref
- `designCanvasWrappers` — canvas tracking
- `tailwindConfigCache` — fetch cache
- `cachedNearGroups`, `cachedExactMatches` — lazy computation caches
- `currentInstances` — instance metadata
- `wasConnected` — WS connection tracking

Category A fields get absorbed into `OverlayState` (most already have equivalents). Category B fields move to a new `overlay-dom.ts` module — a plain object that holds DOM references and caches, clearly separate from state-machine state.

### What changes in the SM

The SM's `OverlayState` already has `selectedEl`, `equivalentNodes`, `boundary`, `interaction`, `selectPhase`, `insertPhase`, etc. The additions needed:

```typescript
interface OverlayState {
  // ... existing fields stay ...

  // New: add-mode multi-select (from legacy state.addMode / manuallyAddedNodes)
  addMode: boolean;
  manuallyAddedNodes: Set<HTMLElement>;
}
```

Most fields already exist — the work is wiring dispatches, not adding state.

---

## Migration Phases

### Phase 1: Wire Escape through SM

**Risk:** Low — the reducer's `ESCAPE` handler already exists and was tested.
**Impact:** Fixes the teal→orange bug.

| Step | What | Files |
|---|---|---|
| 1a | Replace legacy Escape handler with `dispatch({ type: 'ESCAPE' })` | `index.ts` |
| 1b | Remove the `(getState() as any).selectPhase` casts from Escape handler | `index.ts` |
| 1c | Ensure the SM's ESCAPE effects call `setSelectMode()`, `revertPreview()`, etc. via effect executor | `effect-executor.ts` |
| 1d | Verify: no add-mode escape path is lost (the SM doesn't handle add-mode yet — keep that as a pre-check before dispatch) | `index.ts` |

**Validation:** Manual test of the full Escape ladder (selected → selecting → off). E2E flow-f-select tests.

### Phase 2: Wire element selection through SM

**Risk:** Medium — `finalizeSelection()` is the most called function and touches ~15 state fields.
**Impact:** Removes the `(smState as any).selectedEl` casts and ~50 direct `state.currentTargetEl` reads.

| Step | What | Files |
|---|---|---|
| 2a | Dispatch `ELEMENT_SELECTED` from `finalizeSelection()` instead of patching SM state | `index.ts` |
| 2b | Move highlight/toolbar/panel-messaging into the `ELEMENT_SELECTED` effect list | `reducer.ts`, `effect-executor.ts` |
| 2c | Read selection state from `getState()` instead of `state.currentTargetEl` in: | |
| | — `clickHandler()` (inside-click pass-through check) | `index.ts` |
| | — `element-highlight.ts` (hover outline gating) | `element-highlight.ts` |
| | — `bottom-toolbar.ts` (instance count) | `bottom-toolbar.ts` |
| | — `element-drawer.ts` (draw target) | `element-drawer.ts` |
| | — `element-toolbar.ts` (toolbar positioning) | `element-toolbar.ts` |
| | — `design-canvas-manager.ts` (canvas target) | `design-canvas-manager.ts` |
| | — `drag-move.ts` (drag source) | `drag-move.ts` |
| | — `drag-drop.ts` (replace target) | `drag-drop.ts` |
| 2d | Remove `state.currentTargetEl`, `state.currentEquivalentNodes`, `state.currentBoundary` from legacy state | `overlay-state.ts` |

**Validation:** Select an element, scrub a value, see preview. Shift+click multi-select. Drag-move. E2E tutorial tests.

### Phase 3: Wire interactions through SM

**Risk:** Medium — drag-move and text-edit have complex save/restore.
**Impact:** Removes direct `state.exclusiveInteraction` writes from 3 files.

| Step | What | Files |
|---|---|---|
| 3a | `drag-move.ts`: dispatch `DRAG_MOVE_START` on mousedown, `DRAG_MOVE_DROPPED`/`CANCELLED` on end | `drag-move.ts` |
| 3b | `drag-drop.ts`: dispatch `COMPONENT_DRAG_START`/`DROPPED`/`CANCELLED` | `drag-drop.ts` |
| 3c | `text-edit.ts`: dispatch `TEXT_EDIT_START`/`END` | `text-edit.ts` |
| 3d | Remove `state.exclusiveInteraction` from legacy state; readers check `getState().interaction.kind` | `overlay-state.ts`, `element-highlight.ts`, `index.ts` |
| 3e | Remove manual `wasSelectModeOn` save/restore in `drag-move.ts` — SM's `Interaction.savedSelectPhase` handles it | `drag-move.ts` |

**Validation:** Drag an element to a new position, verify select phase restored. Start text edit, escape, verify toolbar restored. Component drag-drop.

### Phase 4: Wire remaining bypasses through SM

**Risk:** Low — smaller, independent items.

| Step | What | Files |
|---|---|---|
| 4a | `toggleInspect()`: dispatch `ACTIVATE`/`DEACTIVATE` instead of mutating `state.active` | `index.ts` |
| 4b | `setSelectMode()`: becomes an effect handler only — never called directly from flow logic, only from effect executor | `index.ts`, `effect-executor.ts` |
| 4c | `setAddMode()`: dispatch new `ADD_MODE_TOGGLED` action | `index.ts` |
| 4d | Shift+click multi-select: dispatch through SM with new `SHIFT_CLICK_ELEMENT` action or handle via `ADD_MODE_TOGGLED` | `index.ts` |

**Validation:** Toggle overlay open/close, enter/exit add mode, shift+click multi-select.

### Phase 5: Extract DOM infrastructure and delete legacy state

**Risk:** Low — mechanical moves, no logic changes.

| Step | What | Files |
|---|---|---|
| 5a | Create `overlay-dom.ts` with category B fields (`shadowRoot`, `shadowHost`, hover refs, toolbar refs, caches, containers) | New: `overlay-dom.ts` |
| 5b | Update all 11 importing files to read DOM infrastructure from `overlay-dom.ts` instead of `overlay-state.ts` | All 11 files |
| 5c | Remove `overlay-state.ts` entirely | `overlay-state.ts` |
| 5d | Remove the SM ↔ legacy subscriber bridge in `index.ts` | `index.ts` |
| 5e | Remove `resolveTab()`, `clearSelectionState()`, `setGrabCursor()`, `clearGrabCursor()` from deleted module — they're now effect handlers | `index.ts` |

**Validation:** Full E2E test suite. Manual smoke test of all flows.

---

## Phase dependencies

```
Phase 1 (Escape)
    ↓
Phase 2 (Selection)  ←  largest, most impactful
    ↓
Phase 3 (Interactions)  — can be done in parallel with Phase 4
    ↓
Phase 4 (Remaining bypasses)
    ↓
Phase 5 (Delete legacy state)  — only after all above complete
```

Phases 1–4 are independently shippable. Phase 5 is cleanup that depends on all prior phases.

---

## Testing strategy

### Unit tests (already exist for the reducer)

The reducer in `overlay-state-machine/reducer.test.ts` already has tests for the dead-code actions. As we wire dispatches, those tests become active coverage rather than theoretical.

### E2E tests

| Test file | Covers |
|---|---|
| `flow-f-select.spec.ts` | Select three-way toggle, Escape ladder |
| `tutorial.spec.ts` | Full selection + editing flow |
| `tutorial-smoke.spec.ts` | Quick end-to-end smoke |

### Manual smoke checklist (per phase)

Each phase must pass before merging:

- [ ] Gray → click Select → orange (crosshair, outlines on hover)
- [ ] Orange → click element → orange (element selected, selecting persists)
- [ ] Orange + element → Escape → teal (stop selecting, keep element)
- [ ] Teal → click Select → orange (re-enter selecting, clear element)
- [ ] Teal → Escape → gray (deselect, back to landing)
- [ ] Orange + no element → Escape → gray
- [ ] Drag-move: select phase restored after drop
- [ ] Drag-move: select phase restored after cancel
- [ ] Text edit: toolbar locked during edit, restored after
- [ ] Component drag-drop: place + replace flows
- [ ] Toggle overlay open/close
- [ ] Shift+click multi-select
- [ ] Panel ↔ overlay button sync (click Select on panel, overlay matches)

---

## Risk mitigation

| Risk | Mitigation |
|---|---|
| Regression in selection — ~50 reads of `state.currentTargetEl` | Phase 2 is the largest phase; break step 2c into sub-PRs per file |
| Drag-move save/restore breaks | The SM already has `Interaction.savedSelectPhase`; the reducer tests already verify restore |
| Missing effect handler | Each phase adds effect handlers incrementally; the effect executor has a default `console.warn` for unhandled effects |
| WS message from panel arrives before dispatch completes | SM dispatch is synchronous — effects execute immediately after state update, same as today |

---

## Success criteria

| Metric | Before | After |
|---|---|---|
| Files importing `overlay-state.ts` | 11 | 0 (deleted) |
| SM actions dispatched / total defined | 7 / 25 | 25 / 25 |
| `(getState() as any)` unsafe casts | 3 | 0 |
| Direct `state.selectModeOn` mutations | 3 | 0 |
| Direct `state.exclusiveInteraction` mutations | 3 | 0 |
| Subscriber sync bridge code | ~15 lines | 0 (deleted) |
