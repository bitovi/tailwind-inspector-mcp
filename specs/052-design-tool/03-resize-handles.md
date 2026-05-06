# 03 — Resize via Drag Handles

> Corner/edge handles on any selected element that map to Tailwind size classes, snapping to the Tailwind scale.

## Problem

Setting element dimensions currently requires finding the right property in the design panel and scrubbing/typing a value. A design tool lets you grab an edge and drag.

## Solution

Show resize handles around any selected element. Dragging a handle maps the resulting pixel size to the nearest Tailwind class and applies it as a live preview.

## Handle Placement

```
  ┌──────[top]──────┐
  │                  │
[left]            [right]
  │                  │
  └──────[bottom]────┘
          + [corner] (bottom-right)
```

- **Right edge** → `w-*`
- **Bottom edge** → `h-*`
- **Bottom-right corner** → both `w-*` and `h-*`
- Left/top edges: out of scope for v1 (would imply position changes)

## Snap Behavior

Dragging snaps to the nearest Tailwind spacing scale value. As the user drags, a tooltip shows the current class:

```
w-64 (256px)
```

The Tailwind scale is loaded from the server's compiled theme (same data the ScaleScrubber uses). Arbitrary values (`w-[350px]`) are supported as a fallback when between scale stops, but scale values are preferred with a "magnetic" snap zone of ±8px.

## Modifier Keys

| Key Held | Behavior |
|----------|----------|
| None | Sets `w-*` / `h-*` |
| Option (⌥) | Sets `min-w-*` / `min-h-*` |
| Shift (⇧) | Sets `max-w-*` / `max-h-*` |

A small badge near the handle shows which property is being set.

## Patch Output

Resize produces a standard class-change patch — same as editing via the design panel. The `PATCH_PREVIEW` → `PATCH_STAGE` flow is reused.

## Implementation

Resize handles are rendered by the **overlay** (in the shadow DOM), positioned absolutely over the selected element using `getBoundingClientRect()`. They reposition on scroll/resize via the existing `repositionOnScroll()` mechanism.

The drag interaction:
1. `mousedown` on handle → record starting rect + property being set
2. `mousemove` → compute new dimension → find nearest Tailwind class → send `PATCH_PREVIEW`
3. `mouseup` → send `PATCH_STAGE` with the final class

## Interaction with Layout

### What happens when you resize inside a container?

Resizing an element that lives inside a flex/grid container raises questions:

- **Flex child:** Setting an explicit `w-*` on a flex child overrides flex sizing. This may push siblings around or cause overflow. The user needs to see this happening live (preview shows the layout shift).
- **Grid child:** Setting `w-*` on a grid child may cause it to overflow its track. The user may need to resize the grid track instead.
- **Normal flow:** Setting `h-*` on a block element is straightforward, but `w-*` on a block element that's `width: auto` (full width) may feel wrong — maybe we show the computed width and suggest `max-w-*` instead.

**Principle:** Show the live result during drag. If the layout breaks or shifts unexpectedly, the user sees it immediately and can release + undo.

### Temporary "Canvas Size" Resize

A common pattern: the user inserts a container, wants to make it big *temporarily* to have space to work inside, then shrink it to content when done. See [06-canvas-mode.md](./06-canvas-mode.md) for the full design, but the resize handle should integrate with this:

- If canvas mode is active on the element, resize sets the *temporary* dimension (visual only, not patched)
- If canvas mode is not active, resize sets the real Tailwind class (patched)
- A visual badge distinguishes "canvas size" from "real size"

This is still an open UX question — see Open Questions below.

## Interaction with Design Panel

When a resize handle is being dragged, the corresponding property chip in the design panel updates in real-time (ScaleScrubber value changes). Releasing the handle is equivalent to confirming a scrubber change.

## Constraints

- Handles only appear when exactly one element is selected (not during multi-select)
- Handles are hidden during drag-to-move operations
- Minimum size: `w-4` / `h-4` (16px) — cannot resize below this

## Open Questions

- How do we handle resize on elements inside flex/grid containers where explicit sizing fights the layout model?
- Should resize default to `min-h-*` instead of `h-*` for containers (so they can grow with content)?
- How does temporary "canvas size" interact with resize handles vs. the canvas mode toggle?
- If a user resizes a container large, adds children, then "collapses" — what if the children don't fit? Overflow, scroll, or prevent collapse?
