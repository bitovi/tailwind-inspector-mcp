# 063 — Drag/Drop Insertion Point Disambiguation

## Problem

When a user drags a component and drops it on a location where multiple valid insertion points overlap — nested same-rect wrappers, tightly-packed sibling boundaries, edge-child ambiguity — the system currently picks one position silently. This can result in the component landing in the wrong place without the user understanding why.

We already solve this exact problem for **click-to-insert** (browse mode) via the Slot Picker (`slot-picker.ts`). The question is how to bring that same disambiguation into the **drag-and-drop** interaction, which has fundamentally different timing constraints: the user is mid-gesture, holding a pointer down, and expects fluid real-time feedback.

## Existing Systems

### Slot Picker (browse mode — click-based)

- User clicks in insert/browse mode → `findAmbiguousSlots()` detects overlapping insertion points
- If multiple slots exist, `showSlotPicker()` renders a floating menu near the click
- Rows show position badge + element tag + classes, indented by depth
- Hover over a row → preview indicator appears at that slot
- Click a row → slot is selected and locked
- Escape dismisses

### Drag/Drop (component insert)

- Drag starts from panel → `DRAG_START` message → overlay enters drag session
- `DRAG_MOVE` → `updateDragPosition()` → hit-test → `computeDropPosition()` → render indicator line
- After 500ms idle on a target, `dropPreview` inserts ghost HTML into the DOM at 0.6 opacity
- `DRAG_END` → `executeDrop()` → inserts element, builds patch, notifies server
- No ambiguity check exists in this path today

## Design Analysis

## Design: "Hover-to-Reveal, Release-to-Interact" Menu

### Core Interaction

When the user drags over an ambiguous location, the disambiguation menu appears _instead of_ the drop preview. The menu signals "this spot has multiple options." The user then has two choices:

1. **Release** to interact with the menu — hover rows to see live previews, click a row to drop there
2. **Keep dragging** away — the menu disappears instantly, back to normal drag behavior

### Why This Works

The drop preview normally tells the user "this is what will happen if you release here." When a location is ambiguous, a single preview can't do that honestly — there are multiple possible outcomes. The menu replaces the preview as the "what will happen" feedback, and releasing becomes "I want to explore these options" rather than "confirm placement."

| User intent | What happens |
|-------------|-------------|
| "I want to drop somewhere around here" | Drags to zone → sees menu → releases → browses options → clicks one |
| "Not here, let me keep looking" | Drags to zone → sees menu → keeps dragging → menu vanishes → continues drag elsewhere |
| "I dragged to an unambiguous spot" | Normal behavior — preview shows, release drops. No menu ever appears. |

### Detailed Flow

```
drag move → cursor enters ambiguous zone
                    ↓
        findAmbiguousSlots() returns 2+ slots
                    ↓
        drop preview is SUPPRESSED
        disambiguation menu appears near the cursor
        (positioned to not occlude the drop zone)
                    ↓
        ┌───────────┴───────────┐
        │                       │
  user RELEASES            user KEEPS DRAGGING
  (pointer up)             (cursor moves away)
        │                       │
  drag session PAUSES      menu DISAPPEARS instantly
  menu stays open          drop preview resumes
  cursor is now free       normal drag continues
        │                       │
  ┌─────┴──────┐          (if cursor re-enters
  │            │           ambiguous zone later,
  │            │           menu reappears)
  │            │
hover row    press Esc / click outside
  │            │
preview at   CANCEL drop
that slot    (no insertion,
(ghost HTML   clean up)
 0.6 opacity)
  │
click row
  │
INSERT at that slot
build patch, notify server
clean up drag session
```

### Menu Appearance During Drag

When the cursor enters an ambiguous zone during drag:

- The normal drop indicator line and drop preview are **suppressed** — showing them would be misleading since there are multiple valid placements
- The disambiguation menu fades in, positioned offset from the cursor (same `@floating-ui/dom` placement as the existing Slot Picker: `bottom-start` with flip/shift)
- The menu follows the cursor loosely (repositions on significant movement within the ambiguous zone, but not jittering on every pixel)
- The drag cursor label stays visible, showing the component name

If the cursor **leaves the ambiguous zone** while still dragging (pointer still down):
- Menu disappears immediately (no fade-out — must feel instant)
- Normal drop indicator / preview system resumes
- If cursor re-enters the same or different ambiguous zone, menu reappears with the new candidates

### After Release: Free-Cursor Menu Interaction

Once the user releases inside the ambiguous zone:

- The drag session **pauses** — no more pointer tracking
- The drag cursor label is removed
- The menu stays open and the cursor is now free for normal mouse interaction
- **Hover a row** → ghost HTML is inserted at that slot (0.6 opacity, dashed teal outline) as a live preview; leaving the row removes it
- **Click a row** → component is placed at that slot; patch built; menu dismissed; drag session cleaned up
- **Press Escape** → cancel entirely; no insertion; menu dismissed; drag session cleaned up  
- **Click outside the menu** → same as Escape (cancel)

### Visual Design

Reuse the existing Slot Picker styles (`slot-picker.ts`):

- Dark panel (`#1a1a1a`), positioned via `@floating-ui/dom`
- Row layout: position badge (`↑ before`, `↳ start`, etc.) + `<tag .class1 .class2>`
- Depth indentation for nested candidates
- Header: **"Drop where?"** (short, action-oriented)
- `Esc` to dismiss hint at bottom

During the **drag phase** (pointer still down, menu visible):
- Menu has a subtle visual state indicating "release to interact" — e.g., slightly reduced opacity (0.85) or a top-bar hint text: "release to pick"
- Rows are **not** hover-interactive while pointer is down (avoids accidental selection from drag motion passing over rows)

After **release** (pointer up, menu interactive):
- Menu transitions to full opacity
- Rows become hover/click interactive
- Standard Slot Picker behavior

### Ambiguity Detection Timing

Call `findAmbiguousSlots()` during `DRAG_MOVE`, debounced (e.g., re-check when the resolved `(target, position)` changes, not on every pixel move):

1. `updateDragPosition()` computes `target` + `position` as usual
2. If `(target, position)` changed from last check → call `findAmbiguousSlots()`
3. If 2+ candidates → suppress preview, show menu
4. If 0-1 candidates → dismiss menu if open, resume normal preview

This keeps the ambiguity check cheap — it only runs when the logical drop target changes.

### Menu Positioning During Drag

The menu must stay visible and not occlude the drop zone:

- Position the menu **offset from the cursor** (e.g., 20px right and 10px below)
- Use `@floating-ui/dom` with `flip()` and `shift()` to keep it on-screen
- During drag (pointer down), the menu repositions if the cursor moves significantly (>30px from the menu's anchor point) to stay near the action
- After release (pointer up), the menu stays put — no more repositioning

### Handling the Transition: Drag → Menu → Resume Drag

A subtle UX question: what if the user releases to interact with the menu, then changes their mind and wants to resume dragging?

**Answer: they can't resume the same drag session.** Once they release, the drag session is paused. They can:
- Pick a slot (click a row)
- Cancel (Escape / click outside) — which ends the drag entirely

If they want to try a different location, they cancel and start a new drag. This is simpler than trying to re-enter drag state from the menu, and avoids complex state management.

## Implementation Plan

### Phase 1: Ambiguity detection during drag

**File:** `overlay/src/drag-drop.ts`

In `updateDragPosition()`, after computing `target` + `position`:

```ts
// Check for ambiguous drop when the logical target changes
const slots = findAmbiguousSlots(clientX, clientY, target, position);
if (slots.length > 0) {
  // Suppress normal drop indicator + preview
  dropPreview?.clear();
  hideIndicator();
  // Show disambiguation menu near cursor
  showDragDisambiguator(slots, clientX, clientY, session);
} else {
  // Dismiss menu if it was showing, resume normal preview
  dismissDragDisambiguator();
  // ... existing indicator + preview logic
}
```

### Phase 2: Drag disambiguator UI

**File:** `overlay/src/slot-picker.ts` (extend existing module)

New functions:

- `showDragDisambiguator(slots, x, y, session)` — renders the menu in the overlay shadow DOM, positioned near the cursor. During drag (pointer down), rows are non-interactive (visual only). Tracks drag state internally.
- `handleDragDisambiguatorRelease()` — called on `DRAG_END` while menu is open. Transitions menu to interactive mode: enables row hover (with ghost preview) and click (to confirm placement).
- `dismissDragDisambiguator()` — removes the menu immediately. Called when cursor leaves the ambiguous zone during drag, or on Escape/click-outside after release.

The menu reuses the Slot Picker's CSS and row rendering, with two visual states:
1. **Drag-active** (pointer down): slightly dimmed (opacity 0.85), "release to pick" hint
2. **Interactive** (pointer up): full opacity, rows respond to hover/click

### Phase 3: Ghost preview on row hover (post-release)

After the user releases and the menu becomes interactive:

1. **Hover a row** → insert ghost HTML from the drag session at `candidate.target` / `candidate.position` with preview styling (0.6 opacity, dashed teal outline)
2. **Leave a row** → remove the ghost preview element
3. **Click a row** → finalize: insert at that slot, build patch, notify server, dismiss menu, clean up drag session

Reuses insertion logic from `drop-preview.ts` but driven by hover events.

### Phase 4: Drag session lifecycle

Wire up the paused/cancelled states:

- `DRAG_END` with disambiguator open → don't call `executeDrop()`. Instead call `handleDragDisambiguatorRelease()` to transition the menu to interactive mode. The drag session stays alive but paused.
- Row click → call a new `finalizeDropAtSlot(target, position, session)` that does the insert + patch + cleanup (extracted from `executeDrop()`).
- Escape / click-outside → call `endSession(true)` to cancel.

## Edge Cases

### User releases then immediately drags again

Once released, the drag session is paused — there's no way to "resume" dragging. The user must either pick a slot or cancel (Escape / click outside), then start a new drag if needed.

### Menu flicker on zone boundaries

If the cursor oscillates across the edge of an ambiguous zone, the menu would flicker on/off. Mitigate with a small hysteresis: once the menu appears, require the cursor to move >10px outside the zone before dismissing. This is the same approach used for hover state debouncing elsewhere in the overlay.

### Ghost not ready when ambiguity is detected

If `DRAG_GHOST_READY` hasn't arrived yet when the cursor enters an ambiguous zone:
- Show the menu with text-only rows (no preview capability yet)
- When `DRAG_GHOST_READY` arrives, enable the preview-on-hover behavior
- The menu is still useful — it tells the user "there are multiple options here" even without previews

### Cursor is over the menu during drag

The menu is rendered in the overlay's shadow DOM. During drag (pointer down), `pointer-events: none` on the menu ensures it doesn't interfere with hit-testing on the page. After release (pointer up), `pointer-events: auto` is enabled so rows respond to hover/click.

### Canvas drops and replace mode

Both skip disambiguation entirely (unchanged from current behavior):
- Canvas drops use `injectDesignCanvas()` with its own positioning
- Replace mode targets a specific element, not a position

## Testing

- **Unit test:** `findAmbiguousSlots()` with DOM layouts that produce 2+ candidates
- **Unit test:** Menu transitions from drag-active → interactive on pointer-up
- **Integration test:** Drag over a nested same-rect structure → verify menu appears, preview suppressed
- **Integration test:** Drag away from ambiguous zone → verify menu disappears, preview resumes
- **E2E test:** Full flow: drag → menu appears → release → hover row → see preview → click → component placed at correct slot

## Out of Scope

- Disambiguation for **move** operations (rearranging existing elements) — same pattern applies but move has its own gesture; can be added later
- Slot picker for canvas-to-canvas drops — canvas drops have their own coordinate system
- "Resume drag" from the menu — too complex for the benefit; cancel + re-drag is sufficient
