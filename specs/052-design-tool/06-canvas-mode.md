# 06 — Canvas Mode for Containers

> Temporary `min-h` on newly inserted containers so users can work inside them, with an explicit toggle to shrink-to-content.

## Problem

When sketching a layout, users add a container and then populate it with children. But an empty flex/grid container collapses to zero height, making it impossible to drop children into it. The user needs the container to be "big" temporarily, then shrink to fit its content.

## Solution

When a layout container is inserted (from the Primitives palette), auto-apply a temporary `min-h-[300px]` and show a visual badge indicating this is a working size, not the final size.

## Behavior

### On Insert
1. Container primitive is placed with its default classes + `min-h-[300px]`
2. A badge appears at the top-right of the container: **"Canvas size"** with a collapse icon
3. The `min-h` class is tracked as a "canvas mode" property (not a regular style patch)

### While Working
- The container has enough space to receive child drops via the drop-zone system
- Children placed inside render normally within the container's flow
- The badge persists as a reminder

### Shrink to Content
| Trigger | Behavior |
|---------|----------|
| **Click the badge** | Remove `min-h`, container shrinks to content height |
| **Keyboard shortcut** (Cmd+Shift+0) | Same — toggle canvas mode off |
| **Re-click the badge** | Toggle canvas mode back on |

### On Commit
If canvas mode is still active when the user commits patches, the `min-h` is **not included** in the patch sent to the agent. The container is committed with only its intended classes.

Alternatively, a confirmation prompt: "This container has a canvas size applied. Shrink to content before committing?"

## Visual Design

The badge is rendered by the overlay (shadow DOM), positioned via `getBoundingClientRect()`:

```
┌─────────────────────────────────[Canvas size ↕]──┐
│                                                    │
│           (empty container, 300px tall)            │
│                                                    │
└────────────────────────────────────────────────────┘
```

After toggling off:
```
┌──────────────────────────────────────────────────┐
│ Child 1 │ Child 2 │ Child 3                      │
└──────────────────────────────────────────────────┘
```

## Applies To

Only layout container primitives: Column, Row, Grid 2-col, Grid 3-col, Section. Not applied to content elements (Heading, Button, etc.) or custom Storybook components.
