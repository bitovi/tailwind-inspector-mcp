# 07 — Flexbox / Grid Quick Controls

> Floating mini-toolbar near selected containers with one-click direction, justify/align, gap, and wrap controls.

## Problem

The design panel already has flexbox/grid controls, but they're buried in the property list. When arranging children inside a container, the user needs instant access to layout direction, alignment, and gap — without scrolling through the side panel.

## Solution

A floating **layout toolbar** that appears near a selected container element when it has flex or grid display. Provides the most common layout controls as visual one-click buttons.

## Toolbar Contents

### For `flex` containers:

| Control | Options | Interaction |
|---------|---------|-------------|
| **Direction** | `→` `↓` `←` `↑` | Toggle between row/col/row-reverse/col-reverse |
| **Justify** | visual 5-option picker | start, center, end, between, around |
| **Align** | visual 5-option picker | start, center, end, stretch, baseline |
| **Gap** | scrubber | Drag to set `gap-*` |
| **Wrap** | toggle | `flex-wrap` on/off |

### For `grid` containers:

| Control | Options | Interaction |
|---------|---------|-------------|
| **Columns** | number stepper | `grid-cols-{n}` (1–6) |
| **Gap** | scrubber | Drag to set `gap-*` |
| **Justify Items** | visual picker | start, center, end, stretch |
| **Align Items** | visual picker | start, center, end, stretch |

## Positioning

The toolbar floats **inside** the selected container, anchored to the top edge, centered horizontally. If the container is too small, it floats above it (same flip logic as `@floating-ui/dom` used by the element toolbar).

## Relationship to Design Panel

The floating toolbar is a **shortcut** — every control maps 1:1 to a property chip in the design panel. Changing a value in the floating toolbar updates the design panel in real-time, and vice versa. Same `PATCH_PREVIEW` → `PATCH_STAGE` flow.

## Visibility Rules

- Only appears when a container with `flex` or `grid` display is selected
- Hidden during drag-to-move, resize, and text editing
- Can be dismissed with Escape (re-appears on next selection)
- Togglable via a button in the element toolbar ("Layout" icon)

## Implementation

Rendered by the overlay in shadow DOM (same approach as resize handles and element toolbar). Uses the existing scrubber and chip components from the panel, embedded via an iframe or re-implemented as lightweight overlay DOM.

Simpler v1: just the **direction toggle** and **gap scrubber** — the two most common operations. Expand later.
