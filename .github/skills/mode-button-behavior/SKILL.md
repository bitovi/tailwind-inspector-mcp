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

### Overlay toolbar buttons (floating bar on page)

| Color | Meaning |
|---|---|
| **Gray** | Inactive / idle (text color `#aaa`) |
| **Teal** | Active mode or active tab (background `#00464A`, text `#5fd4da`) |
| **Dimmed** | Button for inactive mode (opacity 0.4) |

The overlay toolbar does not currently use orange. Its Select/Insert buttons show teal when in that mode. The action buttons (Design, Text, Replace, Place) show teal when that tab is active.

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
| 3 | Click a placement site | Place tab | Teal | Toolbar appears: Insert: Teal, Place: Teal | Teal | Insert point locked |
| 4 | Click a component | Place tab | Gray | No toolbar | Gray | Component placed immediately, done |

## Flow C: Replace — pick element first, then pick component

| Step | What the user does | Tab visible? | Panel mode button | Overlay toolbar | Component button | Page interaction |
|---|---|---|---|---|---|---|
| 1 | Before clicking anything | No tab | Gray | No toolbar | — | None |
| 2 | Click Select (panel) | Design tab | Select: Orange | No toolbar | — | Crosshair, hover outlines |
| 3 | Click an element on page | Design tab | Select: Teal | Toolbar appears: Select: Teal, Design: Teal | — | Element highlighted |
| 4 | Click Replace (panel tab or overlay) | Replace tab | Select: Teal | Select: Teal, Replace: Teal | Teal | Element highlighted |
| 5 | Click a component | Replace tab | Gray | No toolbar | Gray | Element replaced, done |

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

## Escape Key Behavior

- **Component button is orange** (armed): Escape disarms the component (gray), returns to the tab with no page interaction active.
- **Global button is orange** (browse/crosshair): Escape turns off the mode entirely, returns to landing page.
- **Global button is teal** (insert point or element locked): Escape unlocks the target, returns to orange (browse/crosshair mode).
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

Shared helpers for flow table verification live in `test-app/e2e/helpers.ts`:
- `clickInsert()`, `clickPlacementSite()`, `clickComponentPlace()` — action helpers
- `getPanelButtonColor()`, `getComponentButtonColors()` — color state readers
- `isOverlayToolbarVisible()`, `getPageInteraction()` — overlay state readers
- `verifyFlowRow()` — asserts all columns of a `FlowTableRow` against the live UI
