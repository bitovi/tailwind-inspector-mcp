# 02 — Drag to Move / Reparent

> Drag any element on the page to reorder or reparent it. Produces a `move-element` patch. This is foundational — it makes element insertion (spec 01) and the whole sketching flow feel like a design tool.

## Problem

Currently, element placement is a one-shot operation — click to drop, done. If you want to rearrange elements, you have to delete and re-place them, or wait for the agent. A design tool lets you grab anything and move it.

## Solution

Add drag-to-move for **any element on the page** — both ghost elements (newly placed) and real DOM elements (framework-rendered). Reuse the existing drop-zone indicator system for targeting.

## Drag Initiation

The user **selects an element first** (normal select flow), then uses a **drag handle** near the element to initiate the move.

| Trigger | Details |
|---------|---------|
| **Drag handle near selected element** | Appears in/near the element toolbar. Grab it, drag to destination. |

Using select-then-drag avoids conflicts with click-to-select. The user always knows what they're about to move because it's already selected and highlighted.

When the user starts a drag:
1. The element gets a semi-transparent "pickup" appearance (opacity: 0.3)
2. A thumbnail follows the cursor (scaled-down rasterization or CSS clone)
3. The element toolbar hides during the drag

## Drop Zone Behavior

Reuses the existing `drop-zone.ts` 4-zone logic:

- 0–25% along layout axis → `before` (insert as previous sibling)
- 25–50% → `first-child` (prepend inside target)
- 50–75% → `last-child` (append inside target)
- 75–100% → `after` (insert as next sibling)

Visual indicators (teal lines / dashed borders) appear on hover, same as Insert mode.

### Disambiguation on Drop

When the user releases over an area where **multiple elements overlap** (same-rect scenario), show the existing element disambiguation picker (spec 049) so they can choose exactly which element to drop into. This is especially important for nested containers.

### Scrollable Containers

Drag-to-move must work well across **scrollable containers**. When dragging near the edge of a scrollable parent:
- Auto-scroll the container in the drag direction
- Continue showing drop-zone indicators as the container scrolls
- Handle the case where source and target are in different scroll contexts

**Constraints:**
- Cannot drop an element inside itself or its own descendants
- Cannot drop at the element's current position (no-op)

## Delete

With drag-to-move in place, we also need **element deletion**. When an element is selected:
- A delete button in the element toolbar (or keyboard shortcut: Backspace/Delete)
- For ghost elements: remove the ghost DOM node + discard the patch
- For real elements: produce a `delete-element` patch for the agent

## Patch Type

New patch kind: `move-element`

```ts
interface MoveElementPatch {
  kind: 'move-element';
  sourceSelector: string;       // CSS selector for the element being moved
  sourceComponentPath?: string;  // file path if known
  targetSelector: string;       // CSS selector for the drop target
  targetComponentPath?: string;
  insertPosition: 'before' | 'after' | 'first-child' | 'last-child';
  ghostHtml: string;            // outerHTML of the moved element (for preview)
}
```

## Live Preview

On drop:
1. **Hide** the original element (`display: none` + `data-tw-moved`)
2. **Inject** its ghost HTML at the new position (same as component placement)
3. The ghost gets `data-tw-dropped-patchId` for tracking

If the patch is discarded, the original is restored and the ghost removed.

## Agent Instructions

The agent receives:

```
Move the element matching `{sourceSelector}` from its current location
to {insertPosition} the element matching `{targetSelector}`.

Source file: {sourceComponentPath}
Target file: {targetComponentPath}

The element's current HTML:
{ghostHtml}
```

## Ghost Element Moves (simpler case)

When dragging a ghost element (one placed in this session but not yet committed), no `move-element` patch is needed. Instead:
- Update the existing `component-drop` patch's `targetSelector` and `insertPosition`
- Physically move the ghost DOM node to the new position

This avoids creating move patches that reference elements the agent hasn't created yet.

## Relationship to Drag-Drop Placement (spec 00)

Drag-drop placement (spec 00) is built first — it establishes the cross-iframe drag infrastructure, auto-scroll, and drop-zone-while-dragging system. Drag-to-move extends that same system: instead of dragging from the panel's component list, you're dragging from the element's position on the page. The drop-zone targeting and visual indicators are shared.

## Edge Cases

- **Cross-component moves**: Source and target live in different component files. The agent needs both file paths. The patch includes `sourceComponentPath` and `targetComponentPath`.
- **Moving into a ghost container**: Valid — the ghost container's `component-drop` patch already describes where it will be created; the move patch references it by selector.
- **Cancellation**: Escape during drag returns the element to its original position, no patch created.
- **Undo**: Cmd+Z after a move reverses it (see spec 09-undo-redo).
