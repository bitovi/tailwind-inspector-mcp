---
name: mode-button-behavior
description: Defines the interaction behavior of global mode buttons (Select, Insert) and component row buttons (Place, Replace). Use when modifying button states, colors, labels, tab visibility, or page interaction behavior. Must review and update these tables before making changes.
---

# Mode & Component Button Behavior

## Purpose

This skill documents the complete interaction flows for the global mode buttons and component row buttons. These two button systems work together but have independent state.

**Before modifying any button behavior, tab visibility, or page interaction logic:**
1. Review the flow tables below
2. Identify which flow(s) your change affects
3. Update the tables to reflect the proposed new behavior
4. Confirm the updated tables with the user
5. Only then implement the change

## Key Concepts

There are three button systems that stay in sync:

- **Panel mode buttons** (top-left of panel): Select and Insert. These control which tab is visible AND whether the page has an active interaction (crosshair, hover outlines, browse indicators).
- **Overlay toolbar buttons** (floating bar on the page, above selected element): Select, Insert, Design, Text, Replace, Place. These mirror the panel's mode and tab state. Clicking a button on either side syncs the other via WebSocket.
- **Component row buttons** (inside the Place/Replace tab): One per component. These arm a specific component for placement or replacement.

The panel and overlay toolbars stay in sync bidirectionally:
- Clicking a mode/tab button on the **panel** sends a message to the overlay, which rebuilds its toolbar to match.
- Clicking a mode/tab button on the **overlay** sends a message to the panel, which updates its state to match.
- The same state transitions apply regardless of which side the user clicks.

The panel mode buttons and overlay mode buttons do **two orthogonal things** that happen to be bundled together:
1. **Show a tab** — make the Place or Replace tab visible so the user sees the component list
2. **Activate a page interaction** — turn on the overlay's browse/crosshair mode

After a component is placed or replaced, the tab should stay visible but all page interactions stop and both buttons return to gray.

## Button Colors

### Panel mode buttons (Select, Insert)

| Color | Meaning |
|---|---|
| **Gray** | Inactive / idle |
| **Orange** | Actively waiting for user input on the page (crosshair, browse mode, or component armed for drop) |
| **Teal** | A target is locked — an element is selected or an insert point is chosen. Ready to act. |

#### Select button specifics

The Select button has **persistent selection mode** — selecting stays active after an element is chosen:

| State | Color | `selectModeActive` | `elementData` | Page behavior |
|---|---|---|---|---|
| **Idle** | Gray | `false` | `null` | No interaction |
| **Selecting (no element)** | Orange | `true` | `null` | Crosshair cursor, dashed teal hover outlines on all elements |
| **Selecting (element selected)** | Orange | `true` | set | Crosshair cursor; hover outlines only **outside** the selected element; clicks outside re-select; clicks inside pass through |
| **Locked (selecting off)** | Teal | `false` | set | No cursor change, no hover outlines |

**Re-click behavior (three-way toggle):**

| Current state | Re-click result | New state |
|---|---|---|
| **Orange + element** | Stop selecting, keep element | **Teal** (locked) |
| **Orange + no element** | Cancel selecting entirely | **Gray** (idle) |
| **Teal** (element locked) | Clear element, re-enter selecting | **Orange** (selecting) |
| **Gray** (idle) | Enter selecting | **Orange** (selecting) |

#### Insert button specifics

The Insert button has **persistent browse mode** — browsing stays active after an insertion point is chosen:

| State | Color | `insertBrowseActive` | `insertPoint` | Page behavior |
|---|---|---|---|---|
| **Idle** | Gray | `false` | `null` | No interaction |
| **Browsing (no point)** | Orange | `true` | `null` | Crosshair cursor, drop-zone hover indicators on all elements |
| **Browsing (point locked)** | Orange | `true` | set | Crosshair cursor; drop-zone indicators on all elements; locked point indicator visible; Describe change / Insert text buttons shown |
| **Locked (browsing off)** | Teal | `false` | set | No cursor change, no hover indicators; locked point indicator visible |

**Re-click behavior (three-way toggle):**

| Current state | Re-click result | New state |
|---|---|---|
| **Orange + point locked** | Stop browsing, keep point | **Teal** (locked) |
| **Orange + no point** | Cancel browsing entirely | **Gray** (idle) |
| **Teal** (point locked) | Clear point, re-enter browsing | **Orange** (browsing) |
| **Gray** (idle) | Enter browsing | **Orange** (browsing) |

### Overlay toolbar buttons (floating bar on page)

| Color | Meaning |
|---|---|
| **Gray** | Inactive / idle (text color `#aaa`) |
| **Orange** | Actively picking — waiting for user interaction (via `setToolOverrides`) |
| **Teal** | Active mode or active tab (background `#00464A`, text `#5fd4da`) |
| **Green** | Completed — a prior step finished successfully (e.g. Select after copy+paste) |
| **Dimmed** | Button for inactive mode (opacity 0.4) |

The overlay toolbar uses per-tool overrides (`setToolOverrides`) for states like paste where different buttons need different colors simultaneously. Normal mode transitions use `updateToolState` which clears overrides.

### Component row buttons (Place, Replace)

| Color | Meaning |
|---|---|
| **Gray** | Idle — available to click |
| **Orange** | Armed — this component is actively being placed/replaced on the page |
| **Teal** | Ready — a target location/element is already locked, clicking will act immediately |

## Overlay ↔ Panel Sync

The overlay toolbar and panel are kept in sync via WebSocket messages:

| User action | Message sent | Direction |
|---|---|---|
| Click Select/Insert on overlay | `MODE_CHANGED` | Overlay → Panel |
| Click Design/Replace/Place on overlay | `TAB_CHANGED` | Overlay → Panel |
| Click Select/Insert on panel | `MODE_CHANGED` | Panel → Overlay |
| Click a tab on panel | `TAB_CHANGED` | Panel → Overlay |
| Click Select button (deselect) on overlay | `DESELECT_ELEMENT` | Overlay → Panel |

When either side receives a sync message, it updates its own state to match. The overlay rebuilds its toolbar; the panel updates its mode/tab state. The flow tables below apply identically whether the user clicks on the panel or the overlay.

## Flow A: Place — pick component first, then find a spot

| Step | What the user does | Tab visible? | Panel mode button | Overlay toolbar | Component button | Page interaction |
|---|---|---|---|---|---|---|
| 1 | Before clicking anything | No tab | Gray | No toolbar | — | None |
| 2 | Click Insert (panel) | Place tab | Orange | No toolbar | Gray | Browse mode (hover indicators) |
| 3 | Click a component's Place | Place tab | Gray | No toolbar | Orange | Component drop mode (position indicators) |
| 4 | Place on page | Place tab | Gray | No toolbar | Gray | None |
| 5 | Click Insert again (repeat) | Place tab | Orange | No toolbar | Gray | Browse mode (hover indicators) |

## Flow B: Place — pick location first, then pick a component

| Step | What the user does | Tab visible? | Panel mode button | Overlay toolbar | Component button | Page interaction |
|---|---|---|---|---|---|---|
| 1 | Before clicking anything | No tab | Gray | No toolbar | — | None |
| 2 | Click Insert (panel) | Place tab | Orange | No toolbar | Gray | Browse mode (hover indicators) |
| 3 | Click a placement site | Place tab | Orange | Toolbar appears: Insert: Orange | Teal | Browse persists; locked point indicator visible; Describe change / Insert text shown |
| 3a | Click a different spot | Place tab | Orange | Insert: Orange | Teal | Locked point moves; browse continues |
| 4 | Click a component | Place tab | Gray | No toolbar | Gray | Component placed immediately, done |

## Flow C: Replace — pick element first, then pick component

| Step | What the user does | Tab visible? | Panel mode button | Overlay toolbar | Component button | Page interaction |
|---|---|---|---|---|---|---|
| 1 | Before clicking anything | No tab | Gray | No toolbar | — | None |
| 2 | Click Select (panel) | Design tab | Select: Orange | No toolbar | — | Crosshair, dashed hover outlines |
| 3 | Click an element on page | Design tab | Select: Orange | Toolbar appears: Select: Teal, Design: Teal | — | Element highlighted, crosshair persists, hover outlines outside selected |
| 4 | Click Select (panel) to lock | Design tab | Select: Teal | Select: Teal, Design: Teal | — | Element highlighted, no hover outlines |
| 5 | Click Replace (panel tab or overlay) | Replace tab | Select: Teal | Select: Teal, Replace: Teal | Teal | Element highlighted |
| 6 | Click a component | Replace tab | Gray | No toolbar | Gray | Element replaced, done |

## Flow D: Replace — pick component first, then pick element

| Step | What the user does | Tab visible? | Panel mode button | Overlay toolbar | Component button | Page interaction |
|---|---|---|---|---|---|---|
| 1 | Before clicking anything | No tab | Gray | No toolbar | — | None |
| 2 | Click Select (panel) | Design tab | Select: Orange | No toolbar | — | Crosshair, hover outlines |
| 3 | Click Replace (panel tab) | Replace tab | Select: Orange | No toolbar | Gray | Crosshair, hover outlines |
| 4 | Click a component's Replace | Replace tab | Gray | No toolbar | Orange | Element selection mode (dashed outlines on hover) |
| 5 | Click an element on page | Replace tab | Gray | No toolbar | Gray | Element replaced, done |

## Invariants

These rules always hold:

1. **Only one button is orange at a time.** If the global button is orange, no component button is orange, and vice versa. Orange means "waiting for the user to act on the page."
2. **After placing or replacing, both buttons go gray.** The action is complete. The tab stays visible.
3. **The tab never disappears after a place/replace.** The user stays on the component list so they can do another operation.
4. **Component button label matches the tab.** Place tab → "Place" button. Replace tab → "Replace" button. Never driven by whether an element is selected.
5. **Teal means a target is locked.** Both the global button and component buttons turn teal when an insert point or element is selected and the system is ready for the next step.

## Flow G: Paste — Copy Element, Then Place

When the user copies an element (Cmd+C) and pastes (Cmd+V), the toolbar enters a special state where Select is "completed" (green) and Insert is "picking" (orange). This uses per-tool visual overrides rather than the normal mode state machine.

| Step | Action | Select button | Insert button | Page behavior |
|---|---|---|---|---|
| 1 | User selects element | Teal (engaged) | Gray | Element locked |
| 2 | Cmd+C | Teal (engaged) | Gray | Element copied to VyBit clipboard; toast "Copied" |
| 3a | Cmd+V (locked insert) | — | — | Ghost placed immediately; toast "Pasted"; overrides clear |
| 3b | Cmd+V (no locked insert) | **Green (completed)** | **Orange (picking)** | Select mode turned off; crosshair drop-zone activated; toast "Click to place" |
| 4 | User clicks placement | Gray | Gray | Ghost placed; overrides cleared by mode reset |
| 4-esc | Escape instead of clicking | Gray | Gray | Crosshair cancelled; overrides cleared; toast cancelled |

### Implementation notes

- Toolbar overrides are set via `setToolOverrides({ select: 'completed', insert: 'picking' })` in `overlay/src/bottom-toolbar.ts`
- Overrides are automatically cleared whenever `updateToolState()` is called (normal mode transitions)
- Overrides are explicitly cleared on Escape from the drop-zone
- The `.completed` CSS class uses `--ov-green` / `--ov-green-bg` for both `.bt-combo.completed` and `.bt-group.completed`
- Select mode (`selectModeOn`) is turned off before arming insert, so the selecting crosshair doesn't interfere with the placement crosshair

## Escape Key Behavior

- **Component button is orange** (armed): Escape disarms the component (gray), returns to the tab with no page interaction active.
- **Select button is orange, element selected** (selecting + locked): Escape stops selecting but keeps the element → teal (locked). Escape again from teal deselects the element → gray.
- **Select button is orange, no element** (selecting): Escape turns off select mode entirely → gray.
- **Select button is teal** (element locked, not selecting): Escape deselects the element → gray.
- **Insert button is orange, point locked** (browsing + locked): Escape stops browsing but keeps the point → teal (locked). Escape again from teal clears the point → gray.
- **Insert button is orange, no point** (browsing): Escape turns off insert mode entirely → gray.
- **Insert button is teal** (insert point locked, not browsing): Escape clears the point → gray.
- **ReactNode field is teal** (receptive): Escape clears the receptive field, returns all buttons to normal Place/Replace labels.

## Flow E: Set ReactNode Prop — pick target field, then pick component

This flow is entirely within the panel — no page interaction or overlay involvement. It uses the Place/Replace tab's component list but redirects the action to a prop field instead of the page.

| Step | User action | ReactNode field | Component button label | Component button color | Page interaction |
|---|---|---|---|---|---|
| 1 | Expand Button, see `leftIcon` field | Gray input | Place | Gray | None |
| 2 | Click `leftIcon` field's arm button | **Teal** (locked target) | **Set Prop** | **Orange** | None |
| 3 | Click "Set Prop" on Icon | Chip: `Icon` with ✕ | Place | Gray | None |
| 4 | (Optional) Click ✕ on chip | Gray input | Place | Gray | None |

### Flow E cancel paths

| Cancel action | ReactNode field | Component button | Result |
|---|---|---|---|
| Press Escape | Returns to gray | Returns to Place/Replace (gray) | Receptive state cleared |
| Click outside the expanded drawer | Returns to gray | Returns to Place/Replace (gray) | Receptive state cleared |
| Click a different ReactNode field | Old field → gray, new field → **teal** | Stays **Set Prop** (orange) | Target switches |

### Flow E invariants

1. **Only one ReactNode field can be receptive (teal) at a time.** Clicking a second field deactivates the first.
2. **"Set Prop" mode does not involve the page.** No overlay messages, no crosshair, no browse mode.
3. **Global mode buttons are unaffected.** Select/Insert state does not change during Set Prop.
4. **Normal Place/Replace flows are unaffected** when no ReactNode field is receptive.
5. **"Set Prop" label appears on ALL component rows** when a field is receptive — any component can be assigned.

## Flow F: Select — persistent selection mode

The Select button supports a cycling state machine: **gray → orange → teal → orange → teal → …**. Selecting mode persists after an element is selected, allowing the user to quickly re-select a different element. From teal, clicking Select re-enables selecting (orange). Escape from teal deselects and goes to gray.

### State machine

```
GRAY    → click Select    → ORANGE (no element)
ORANGE  → click element   → ORANGE (element selected, selecting persists)
ORANGE  → click outside   → ORANGE (new element, selecting persists)
ORANGE  → click inside    → pass-through (no selection behavior)
ORANGE  → click Select    → TEAL (if element) or GRAY (if no element)
ORANGE  → Escape          → TEAL (if element) or GRAY (if no element)
TEAL    → click Select    → ORANGE (clear element, fresh selecting)
TEAL    → Escape          → GRAY (deselect everything)
ORANGE  → Describe change → TEAL (stop selecting, open describe textarea)
ORANGE  → Edit text       → TEAL (stop selecting, enter text editing)
```

### Flow table

| Step | What the user does | Select button | Page interaction |
|---|---|---|---|
| 1 | Before clicking anything | Gray | None |
| 2 | Click Select | Orange | Crosshair, dashed teal hover outlines on all elements |
| 3 | Click an element | Orange | Element highlighted; crosshair persists; hover outlines only outside selected element |
| 4a | Click a different element | Orange | New element highlighted; previous deselected; hover outlines continue outside |
| 4b | Click inside selected element | Orange (unchanged) | Click passes through to the element (no selection change) |
| 5 | Click Select (stop selecting) | Teal | Element highlighted; no crosshair; no hover outlines |
| 6 | Click Select (re-enable selecting) | Orange | Element cleared; crosshair reactivated; hover outlines on all elements |
| 7 | Click an element | Orange | Element highlighted; crosshair persists; hover outlines outside selected element |
| 8 | Click Select (stop selecting) | Teal | Element highlighted; no crosshair; no hover outlines |
| 9 | Escape (deselect) | Gray | None |
| alt-5a | Click "Describe change" (from orange) | Teal | Element highlighted; describe textarea shown; no crosshair |
| alt-5b | Click "Edit text" (from orange) | Teal | Element highlighted; inline text editing; no crosshair |

### Hover behavior

| State | Hover target | Outline shown? |
|---|---|---|
| Orange (no element) | Any element | Yes — dashed teal outline + tooltip |
| Orange (element selected) | Outside selected element | Yes — dashed teal outline + tooltip |
| Orange (element selected) | Inside selected element (or the element itself) | No — hover preview cleared |
| Teal | Any element | No |
| Gray | Any element | No |

## Flow H: Insert — persistent browse mode

The Insert button supports a cycling state machine: **gray → orange → teal → orange → teal → …**. Browse mode persists after an insertion point is chosen, allowing the user to quickly move the insertion point. From teal, clicking Insert re-enables browsing (orange). Escape from teal clears the point and goes to gray.

### State machine

```
GRAY    → click Insert    → ORANGE (no point)
ORANGE  → click spot      → ORANGE (point locked, browsing persists)
ORANGE  → click new spot  → ORANGE (point moves, browsing persists)
ORANGE  → click Insert    → TEAL (if point) or GRAY (if no point)
ORANGE  → Escape          → TEAL (if point) or GRAY (if no point)
TEAL    → click Insert    → ORANGE (clear point, fresh browsing)
TEAL    → Escape          → GRAY (cancel insert entirely)
```

### Flow table

| Step | What the user does | Insert button | Page interaction |
|---|---|---|---|
| 1 | Before clicking anything | Gray | None |
| 2 | Click Insert | Orange | Crosshair, drop-zone hover indicators on all elements |
| 3 | Click a spot | Orange | Point locked; locked indicator visible; browse persists; Describe change / Insert text shown |
| 4a | Click a different spot | Orange | Point moves; locked indicator updates; browse continues |
| 5 | Click Insert (stop browsing) | Teal | Point locked; no crosshair; no hover indicators |
| 6 | Click Insert (re-enable browsing) | Orange | Point cleared; crosshair reactivated; hover indicators on all elements |
| 7 | Click a spot | Orange | Point locked; locked indicator visible; browse persists |
| 8 | Click Insert (stop browsing) | Teal | Point locked; no crosshair; no hover indicators |
| 9 | Escape (clear point) | Gray | None |

## Drag Behavior (Panel → Page)

When a user drags a component or element from the panel onto the page, the drag behavior is determined by the current mode button state at the moment the drag starts. Mode is **preserved** through the drag and **persists** after the drop.

### Mode → Drag Mapping

| Mode at drag start | Button during drag | Drag visual | Drop behavior | `insertMode` on patch | Mode after drop |
|---|---|---|---|---|---|
| **Select active** | Select: Orange | Dashed teal outline on hover target | Replaces the element under cursor | `'replace'` | Select: Orange |
| **Insert active** | Insert: Orange | Positional line indicator | Inserts at cursor position | positional | Insert: Orange |
| **Both gray** | Insert: turns Orange | Positional line indicator | Inserts at cursor position | positional | Insert: Orange |

### Key rules

1. **Mode is never cleared on drag start.** Unlike button-click flows, drag does not reset mode state.
2. **When both buttons are gray**, Insert mode is activated at drag-start (overlay sends `MODE_CHANGED` to panel).
3. **Mode persists after drop.** The user stays in the same mode for subsequent drags. Invariant #2 ("both go gray after place/replace") applies only to button-click flows, not drag flows.
4. **Replace visual**: dashed teal outline (same as select-hover) around the element under the cursor. No positional line.
5. **Replace on drop**: the target element is hidden (`display: none`) and the ghost is inserted `beforebegin` — same as the button-click replace flow.
6. **Escape during drag** cancels the drag but does not change mode state.

### Implementation details

- `overlay/src/drag-drop.ts`: `DragSession.mode` stores `'replace' | 'insert'`, determined at drag-start from `state.selectModeOn`
- `overlay/src/index.ts`: `initDragDrop` `onStart` callback returns the mode and optionally activates Insert if idle
- Replace visual uses a separate `replaceOutline` DOM element (dashed teal border + light teal background)

## Modifying These Flows

If a change is needed:
1. Identify which flow table(s) are affected
2. Create the updated table showing the new behavior
3. Walk through the table with the user step by step
4. Confirm no invariants are broken
5. Implement the change
6. Update this skill file with the new tables
7. Update or add E2E tests in `test-app/e2e/` to match

## E2E Test Coverage

The flow tables above are covered by data-driven Playwright E2E tests:

- **Flow A**: `test-app/e2e/flow-a-place.spec.ts` — mirrors the Flow A table row-by-row (includes Step 5 repeat)
- **Flow B**: `test-app/e2e/flow-b-place.spec.ts` — mirrors the Flow B table row-by-row using `verifyFlowRow()` from `test-app/e2e/helpers.ts`
- **Flow F**: `test-app/e2e/flow-f-select.spec.ts` — mirrors the Flow F select state machine table

Shared helpers for flow table verification live in `test-app/e2e/helpers.ts`:
- `clickInsert()`, `clickPlacementSite()`, `clickComponentPlace()` — action helpers
- `clickSelectElementButton()` — clicks the Select button
- `getPanelButtonColor()`, `getComponentButtonColors()` — color state readers
- `isOverlayToolbarVisible()`, `getPageInteraction()` — overlay state readers
- `verifyFlowRow()` — asserts all columns of a `FlowTableRow` against the live UI
