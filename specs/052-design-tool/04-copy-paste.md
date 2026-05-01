# 04 — Copy / Paste

> Cmd+C/V for selected elements. Copy captures ghost HTML + patches; paste enters the drop-zone flow.

## Problem

Duplicating elements requires re-placing them from the component catalog and re-applying all style changes. Copy/paste is a fundamental design tool operation.

## Solution

Standard keyboard shortcuts (Cmd+C, Cmd+V) that work on any selected element — ghost or real.

## Copy (Cmd+C)

When an element is selected and the user presses Cmd+C:

1. Capture `outerHTML` of the element (including any ghost children)
2. Capture computed styles needed for ghost rendering (extracted CSS)
3. Store in an in-memory clipboard (panel-side, not system clipboard)
4. Brief visual confirmation (toast or element flash)

```ts
interface VyBitClipboard {
  ghostHtml: string;
  ghostCss: string;
  sourceSelector: string;
  originalClasses: string;
  // Patches applied to this element that should carry over
  pendingPatches: Patch[];
}
```

## Paste (Cmd+V)

When the user presses Cmd+V with something in the clipboard:

1. Enter the same drop-zone flow as component placement — crosshair cursor, 4-zone indicators
2. User clicks to place → ghost HTML injected at the target position
3. A `component-drop` patch is created with the pasted HTML

If an insertion point is already locked (Browse mode), paste places immediately at that point.

## Cut (Cmd+X)

Copy + create a `delete-element` patch for the source element. The source is hidden, the clipboard is populated, and the user can paste elsewhere. If paste is never performed, Cmd+Z reverses the cut.

## Duplicate (Cmd+D)

Shortcut for copy + paste-as-next-sibling. No drop-zone flow — the duplicate appears immediately `after` the selected element.

## Scope

- **Single element**: Copies the element and its entire subtree
- **Multi-select** (future, spec 08): Copies all selected elements; paste inserts them in their original relative order

## Edge Cases

- **Pasting across pages/reloads**: Clipboard is in-memory only — cleared on page navigation. System clipboard integration (serialized ghost HTML) is a future enhancement.
- **Pasting a component with pending patches**: The patches are cloned with new IDs and associated with the new ghost element.
- **Paste into itself**: Prevented — same constraint as drag-to-move.
