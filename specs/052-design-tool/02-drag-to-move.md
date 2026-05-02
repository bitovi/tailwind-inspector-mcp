# 02 — Drag to Move / Reparent

> Drag any element on the page to reorder or reparent it. Produces a `move-element` patch. This is foundational — it makes element insertion (spec 01) and the whole sketching flow feel like a design tool.

## Problem

Currently, element placement is a one-shot operation — click to drop, done. If you want to rearrange elements, you have to delete and re-place them, or wait for the agent. A design tool lets you grab anything and move it.

## Solution

Add drag-to-move for **any element on the page** — both ghost elements (newly placed) and real DOM elements (framework-rendered). Reuse the existing drop-zone indicator system for targeting.

## Existing Infrastructure (as of implementation)

The codebase already provides:

- **`drop-zone.ts`** — 4-zone hit testing (`computeDropPosition`, `getAxis`, `findTarget`), indicator rendering (`renderIndicator`), selector building (`buildSelector`), and ghost ancestor tracking (`findGhostAncestor`, `injectGhostCss`). Uses a discriminated-union `DropZoneMode` state machine.
- **`drag-drop.ts`** — Cross-iframe/popup drag-from-panel-to-page for component placement. Has auto-scroll, preview thumbnails, and reuses `drop-zone` geometry. Provides `initDragDrop()` and `isDragActive()`.
- **`element-drawer.ts`** — Compact drawer below selected element (State A: two buttons, State B: describe change, State C: text editing). This is where the drag handle will be added.
- **`element-toolbar.ts`** — `showDrawButton()` delegates to `showElementDrawer()`. Has `setupToolbarDrag()` for toolbar repositioning (different from element move).
- **Delete** — Already implemented via `Delete`/`Backspace` key in `index.ts`. Ghost elements are removed + patch discarded; real elements get `data-tw-deleted` + `display:none` + `delete-element` patch. Server handles `REVERT_DELETE` on discard.
- **`context.ts`** — `buildContext()`, `buildDeleteContext()`, `buildInsertContext()` for generating agent-facing HTML context.
- **`shared/types.ts`** — `PatchKind` union, `Patch` interface, all WS message types.
- **`shared/mcp-format.ts`** — `formatCommitForMcp()` renders patches into agent instructions.
- **`server/websocket.ts`** — Handles `DISCARD_DRAFTS` with `REVERT_DELETE` broadcast for delete-element patches.

## Drag Initiation

The user **selects an element first** (normal select flow), then **mousedown + drag on the element itself** initiates the move. A 5px movement threshold distinguishes drag from click.

When the user starts a drag:
1. The element gets a semi-transparent "pickup" appearance (opacity: 0.3)
2. The element drawer hides during the drag
3. Drop-zone indicators appear as the cursor moves over potential targets

## Drop Zone Behavior

Reuses the existing `drop-zone.ts` 4-zone logic via `computeDropPosition()`:

- 0–25% along layout axis → `before` (insert as previous sibling)
- 25–50% → `first-child` (prepend inside target)
- 50–75% → `last-child` (append inside target)
- 75–100% → `after` (insert as next sibling)

Visual indicators (teal lines / dashed borders) rendered via `renderIndicator()` from `drop-zone.ts`.

### Auto-Scroll

Reuses the auto-scroll pattern from `drag-drop.ts`: when dragging near the edge of a scrollable container, auto-scroll in the drag direction.

**Constraints:**
- Cannot drop an element inside itself or its own descendants
- Cannot drop at the element's current position (no-op)

## Delete (already implemented)

Already working via `Delete`/`Backspace` key handler in `overlay/src/index.ts`:
- Ghost elements → remove DOM node + `DISCARD_DRAFTS`
- Real elements → hide + stage `delete-element` patch
- Server broadcasts `REVERT_DELETE` on discard to restore visibility

## Patch Type

New patch kind added to the `PatchKind` union: `'move-element'`

The move-element patch reuses the existing `Patch` interface fields:

```ts
// In shared/types.ts — PatchKind gains 'move-element'
export type PatchKind = '...' | 'move-element';

// Patch fields used for move-element:
{
  kind: 'move-element',
  elementKey: string,        // buildSelector(sourceEl) — CSS selector for moved element
  ghostHtml: string,         // outerHTML of the moved element
  insertMode: string,        // 'before' | 'after' | 'first-child' | 'last-child'
  context: string,           // buildContext() of the drop target for agent navigation
  component: { name },       // source component name
  target: { tag, classes, innerText }, // drop target element info
  parentComponent?: { name },// React/Angular component owning the drop target
  // sourceSelector and targetSelector carried in elementKey and context
}
```

## Live Preview

On drop:
1. **Move** the DOM element to the new position (direct DOM manipulation)
2. Mark with `data-tw-moved="<patchId>"` for tracking
3. Stage a `move-element` patch via `PATCH_STAGED`

If the patch is discarded, the server broadcasts `REVERT_MOVE` → overlay moves the element back to its original position (tracked via `data-tw-moved-parent` and `data-tw-moved-index`).

## Agent Instructions (via mcp-format.ts)

```
Move the element from its current location to {insertMode} the target element.

- **Component:** `{componentName}`
- **Element:** `<{tag}>` 
- **Move to:** {insertMode} the target
- **Element HTML:**
```html
{ghostHtml}
```
- **Context HTML:**
```html
{context}
```
```

## Ghost Element Moves (simpler case)

When dragging a ghost element (one placed in this session but not yet committed), no `move-element` patch is needed. Instead:
- Physically move the ghost DOM node to the new position
- Update the existing `component-drop` patch by discarding and re-staging with the new target

## Edge Cases

- **Self-drop prevention**: Cannot drop an element inside itself or its descendants — checked via `el.contains(target)`.
- **Same-position no-op**: If target+position matches the element's current location, no patch is created.
- **Cancellation**: Escape during drag returns the element to its original position, no patch created.
- **Cross-component moves**: Source and target may live in different component files. The context HTML gives the agent enough info to locate both.
