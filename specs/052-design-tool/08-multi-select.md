# 08 — Multi-Select & Group Operations

> Shift+click or marquee-select multiple elements. Move/copy/delete as a group. Wrap in a container.

## Problem

Design tools let you select multiple elements and act on them together. Currently VyBit only supports single-element selection.

## Solution

Extend the selection model to support multiple simultaneous selections.

## Selection Methods

| Method | Behavior |
|--------|----------|
| **Shift+click** | Add/remove element from selection |
| **Marquee drag** | Hold Shift and drag on empty space → rubber-band rectangle selects all elements it intersects |
| **Cmd+A** | Select all children of the current parent container |

## Visual Feedback

- Each selected element gets the teal highlight outline
- A group bounding box (dashed teal) surrounds the entire selection
- Selection count badge: "3 selected"

## Group Operations

| Action | Behavior |
|--------|----------|
| **Delete** (Backspace/Delete) | Delete all selected elements (individual `delete-element` patches) |
| **Copy** (Cmd+C) | Copy all selected elements to clipboard |
| **Paste** (Cmd+V) | Paste all elements, preserving relative order |
| **Drag** | Move all selected elements together (individual `move-element` patches with same target) |
| **Wrap** (Cmd+G) | Wrap selection in a new `<div class="flex flex-col gap-4">` container |
| **Unwrap** (Cmd+Shift+G) | Remove parent container, promote children to grandparent |

## Design Panel Behavior

When multiple elements are selected:
- Show **shared** classes (classes present on all selected elements) as editable chips
- Show **mixed** indicator for classes that differ
- Changes apply to all selected elements simultaneously

## Constraints

- Multi-select only works for elements that share the same parent (siblings)
- Cross-parent multi-select is a future enhancement
- Resize handles are hidden during multi-select (ambiguous which element to resize)
