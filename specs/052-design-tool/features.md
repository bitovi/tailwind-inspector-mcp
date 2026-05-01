# 052 — Design Tool

Turn VyBit from a styling inspector into an effortless interface sketcher — closer to Sketch/Figma, but operating on real DOM elements with Tailwind classes and producing agent-ready patches.

## Feature Index (priority order)

### Priority 1 — Structural Foundation

These are the minimum set to replace the current Fabric.js canvas with real DOM element sketching. Drag-drop is the foundational interaction — we build it first, then everything else uses it.

| # | Feature | File | Summary |
|---|---------|------|---------|
| 1 | [Drag-Drop Placement (replace arm-and-place)](#1-drag-drop-placement) | [00-drag-drop-placement.md](./00-drag-drop-placement.md) | **First step.** Replace the current arm → crosshair → click-to-place flow with drag-from-panel-to-page. User drags a component (or primitive) from the panel directly onto the page, seeing drop-zone indicators while dragging. Builds the cross-iframe drag infrastructure that drag-to-move and everything else depends on. |
| 2 | [Generic Element Insertion](#2-generic-element-insertion) | [01-generic-element-insertion.md](./01-generic-element-insertion.md) | **V1: Two elements only** — a static block div and an absolute positioned div. Replaces Fabric.js rectangle drawing with real DOM. Uses drag-drop placement (spec 00). Extended palette later. |
| 3 | [Drag to Move / Reparent](#3-drag-to-move--reparent) | [02-drag-to-move.md](./02-drag-to-move.md) | Drag **any element** on the page (ghost or real) via a drag handle on the selected element. Extends the drag-drop infrastructure from spec 00. Includes element deletion. Disambiguation picker on drop for overlapping targets. |
| 4 | [Resize via Drag Handles](#4-resize-via-drag-handles) | [03-resize-handles.md](./03-resize-handles.md) | Corner/edge handles on any selected element that map to Tailwind `w-*`, `h-*`, `min-h-*`, snapping to the Tailwind scale. Open questions around layout interaction and temporary "canvas size." |
| 5 | [Copy / Paste](#5-copy--paste) | [04-copy-paste.md](./04-copy-paste.md) | Cmd+C/V for selected elements. Copy captures ghost HTML + patches; paste enters the drop-zone flow. |

### Priority 2 — Text & Content Editing

| # | Feature | File | Summary |
|---|---------|------|---------|
| 6 | [Inline Text Editing](#6-inline-text-editing) | [05-inline-text-editing.md](./05-inline-text-editing.md) | `contentEditable` on real elements. Double-click or toolbar button. Text button inserts default text for empty elements. Text button also works in Insert mode to place a new text element. |

### Priority 3 — Layout & Spacing UX

| # | Feature | File | Summary |
|---|---------|------|---------|
| 7 | [Canvas Mode for Containers](#7-canvas-mode-for-containers) | [06-canvas-mode.md](./06-canvas-mode.md) | Temporary `min-h` on newly inserted containers so users can work inside them, with an explicit toggle to shrink-to-content. |

### Priority 4 — Polish & Power Features

| # | Feature | File | Summary |
|---|---------|------|---------|
| 8 | [Multi-Select & Group Operations](#8-multi-select--group-operations) | [08-multi-select.md](./08-multi-select.md) | Shift+click or marquee-select. Move/copy/delete as a group. Wrap selection in a new container. |
| 9 | [Component Variant Quick Swap](#9-component-variant-quick-swap) | [13-variant-swap.md](./13-variant-swap.md) | Select a placed component → see variant options from same Storybook component → one-click swap. |
| 10 | [Undo / Redo](#10-undo--redo) | [09-undo-redo.md](./09-undo-redo.md) | Cmd+Z/Shift+Cmd+Z for all element-level operations (stage, unstage, move, text edit, resize). |
| 11 | [Element Tree / Layer Panel](#11-element-tree--layer-panel) | — | Sidebar DOM tree with drag-to-reorder, visibility toggles, and selection sync. Extends spec 049 disambiguation. |
| 12 | [SVG / Line Drawing Layer](#12-svg--line-drawing-layer) | — | Simplified freehand/shape tools as an SVG layer behind or in front of elements. Lines, arrows, curves for annotation. |

### Priority 5 — Advanced

| # | Feature | File | Summary |
|---|---------|------|---------|
| 13 | [Responsive Breakpoint Preview](#13-responsive-breakpoint-preview) | — | Toggle viewport widths, apply breakpoint-prefixed classes (`md:`, `lg:`) through the design panel. |
| 14 | [Constraint-Based Positioning](#14-constraint-positioning) | — | Drag-to-position for absolute/fixed elements with Tailwind `top-*`/`left-*` snapping. Position mode selector. |

### Deferred (use Design tab instead)

| Feature | Reason |
|---------|--------|
| Flexbox / Grid Quick Controls | The existing Design tab already handles flex direction, justify/align, gap, wrap. No need for a separate floating toolbar right now. |

---

## Open Design Decisions

| Question | Options | Current Lean |
|---|---|---|
| Where do generic elements live? | Built into panel vs. "VyBit Primitives" Storybook | Built into panel — no Storybook dependency for basic sketching |
| Fabric.js canvas vs. live DOM? | Keep Fabric for freehand/SVG; all element work in live DOM | Live DOM for elements, Fabric only for annotation/SVG |
| Resize semantics | Arbitrary px → nearest Tailwind class, or Tailwind scale snapping only? | Snap to Tailwind scale, show class in tooltip |
| Temporary canvas size | Explicit toggle vs. auto-shrink when children overflow | Explicit toggle — auto-shrink is confusing |
| Text editing trigger | Double-click vs. dedicated button vs. both | Both — double-click for discoverability, button for toolbar users |
| Drag initiation | Click-hold-drag vs. toolbar handle vs. modifier key | Drag handle on selected element (safe, no click conflict) |
| Empty element text | Insert default text vs. Text tool in Insert mode | Both — one for editing empty elements, one for inserting new text |
| Resize in flex/grid | Explicit size fights layout — show warning? Suggest min/max? | Show live preview, let user see the result and undo |
