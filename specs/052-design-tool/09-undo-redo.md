# 09 — Undo / Redo

> Cmd+Z / Cmd+Shift+Z for all element-level operations.

## Problem

The Fabric.js canvas has undo/redo, but element editing operations (patch stage, move, text edit, resize) don't. Users need to experiment fearlessly.

## Solution

A global undo/redo stack that tracks all user actions and can reverse them.

## Tracked Actions

| Action | Undo Behavior |
|--------|--------------|
| Stage a class-change patch | Unstage it, revert preview |
| Stage a component-drop patch | Remove ghost element |
| Stage a move-element patch | Move element back to original position |
| Stage a text-change patch | Revert innerHTML |
| Resize (stage width/height patch) | Revert to previous dimensions |
| Delete element | Re-insert ghost at original position |
| Commit patches | Uncommit (move back to staged) |

## Implementation

An action stack maintained in the panel:

```ts
interface UndoAction {
  id: string;
  type: 'patch-stage' | 'patch-unstage' | 'commit' | 'text-edit' | 'move' | 'delete';
  // Data needed to reverse the action
  reverseData: unknown;
  // Data needed to re-apply the action (for redo)
  forwardData: unknown;
}
```

Stack has a max depth (50 actions). Performing a new action after undoing clears the redo stack (standard behavior).

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **Cmd+Z** | Undo last action |
| **Cmd+Shift+Z** | Redo last undone action |

## Constraints

- Undo is **local only** — cannot undo actions the agent has already implemented
- Once patches are committed and the agent picks them up (`implementing` status), they leave the undo stack
- Undo/redo buttons also available in the panel header (for discoverability)
