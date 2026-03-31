# 041 — Draggable Overlay Toolbar

## Problem

When users click the `N +` button to open the group picker and use "Add more" to select additional elements, the overlay toolbar and its popout menu often cover the elements they want to click. There is no way to move the toolbar out of the way — it's rigidly anchored to the selected element via `@floating-ui/dom`.

## Current Behavior

The overlay toolbar is a dark bar positioned above (or below, if flipped) the selected element:

```
┌──────────────────────────────────────────────────────────┐
│ [⊞ Select] │ [1 +] │ [Insert] │ [Design] [Text] [Replace] │
└──────────────────────────────────────────────────────────┘
                        ▲ selected element ▲
┌──────────────────────────────┐
│ [add your message      ] 🎤 ➤ │
└──────────────────────────────┘
```

Clicking `1 +` opens a picker popover anchored to the button:

```
                    ┌──────────────────────────┐
                    │ [1] element selected      │
                    │ Add more                  │
                    │ [☐] All exact matches (5) │
                    │ [☐] (3) +ring-2           │
                    └──────────────────────────┘
[⊞ Select] │ [1 +] │ [Insert] │ [Design] [Text] [Replace]
                        ▲ selected element ▲
```

The toolbar, picker, and message row are all `position: fixed` and auto-positioned by `positionBothMenus()` (which uses `computePosition` from `@floating-ui/dom`). On scroll/resize, they snap back to the element. There is no way to reposition them manually.

## Proposed Design

Add a **drag handle** to the **left edge** of the toolbar, before the Select button. Dragging it moves the entire toolbar complex (toolbar + message row) as a unit. The picker popout follows automatically because it's anchored to the `N +` button inside the toolbar.

### After

```
┌────────────────────────────────────────────────────────────────┐
│ ⠿ │ [⊞ Select] │ [1 +] │ [Insert] │ [Design] [Text] [Replace] │
└────────────────────────────────────────────────────────────────┘
 ↑
 drag handle (grip dots, cursor: move)
```

### Drag Handle

- **Position**: First child of `.el-toolbar`, to the left of the Select button
- **Visual**: 2×3 grid of small dots (same pattern as the modal container's drag handle), `fill: #585b70`
- **Size**: `12px × 28px` (matches button height), `cursor: move`
- **Hover**: `background: #333` (same as button hover)
- **Border radius**: `5px 0 0 5px` (rounded left edge, flush with adjacent button)

### Drag Behavior

- **What moves**: The toolbar (`el-toolbar`) and message row (`msg-row`) move together as a unit. The message row snaps directly below the toolbar (with a 4px gap) rather than maintaining its original offset from the selected element. Both use `position: fixed` with explicit `left`/`top`.
- **Picker follows**: The picker popout is positioned via `positionWithFlip(anchorBtn, picker)` where `anchorBtn` is the `N +` button inside the toolbar. Since the button moves with the toolbar, the picker tracks automatically on next open.
- **Scroll/resize**: Once dragged, the toolbar stays in its manually-set position — `positionBothMenus()` calls in scroll/resize handlers are skipped when the toolbar has been dragged.
- **Reset**: The drag state resets when a **new selection** starts (i.e. `showDrawButton()` is called). During "Add more" clicks, only `updateSelection()` runs (not `showDrawButton()`), so the dragged position persists while adding elements.
- **No persistence**: Drag offset is not saved to `sessionStorage` or `localStorage`. A new element selection always starts at the floating-ui anchor position.

## Implementation

### Phase 1: Drag Handle + Logic

1. **`toolbarDragged` flag** — Add a module-level `let toolbarDragged = false` in `element-toolbar.ts`. Export `isToolbarDragged()`.

2. **`setupToolbarDrag(handle, toolbar)` function** — Same pattern as `ModalContainer.setupDrag()`:
   - `mousedown` on handle: record `startX`, `startY`, current `toolbar.style.left/top`. Set `toolbarDragged = true`.
   - `mousemove` on `document`: compute delta, apply to toolbar. Then snap `state.msgRowEl` directly below the toolbar (`toolbar.getBoundingClientRect().bottom + 4px`), left-aligned.
   - `mouseup` on `document`: remove listeners.

3. **Add handle element** in `showDrawButton()` — Create `<div class="drag-handle">` with grip dots SVG, wire to `setupToolbarDrag()`, insert as first child of toolbar.

4. **Reset** — Set `toolbarDragged = false` at the top of `showDrawButton()` (called on each new selection).

### Phase 2: Guard Auto-Repositioning

5. **Guard scroll/resize** in `index.ts` — Wrap `positionBothMenus()` calls in scroll and resize handlers with `if (!isToolbarDragged())`.

6. **Guard textarea auto-grow** — The `createMsgRow()` callback `() => positionBothMenus(...)` should also check `!isToolbarDragged()`.

### Phase 3: Styling

7. **CSS** — Add to the `el-toolbar` section in `styles.ts`:
   ```css
   .el-toolbar .drag-handle {
     width: 12px;
     height: 28px;
     cursor: move;
     display: flex;
     align-items: center;
     justify-content: center;
     flex-shrink: 0;
     border-radius: 5px 0 0 5px;
     opacity: 0.5;
     transition: opacity 120ms ease-out, background 120ms ease-out;
   }
   .el-toolbar .drag-handle:hover {
     background: #333;
     opacity: 1;
   }
   ```

8. **SVG** — Add `DRAG_GRIP_SVG` to `svg-icons.ts`: a 6-circle 2×3 dot grid, `fill: #585b70`.

## Relevant Files

| File | Changes |
|------|---------|
| `overlay/src/element-toolbar.ts` | `toolbarDragged` flag, `isToolbarDragged()`, `setupToolbarDrag()`, drag handle DOM in `showDrawButton()`, guard in `createMsgRow` callback |
| `overlay/src/index.ts` | Import `isToolbarDragged`, guard scroll/resize `positionBothMenus()` calls |
| `overlay/src/styles.ts` | `.drag-handle` CSS in toolbar section |
| `overlay/src/svg-icons.ts` | `DRAG_GRIP_SVG` constant |

**Reference**: `overlay/src/containers/ModalContainer.ts` — `setupDrag()` pattern.

## Verification

1. **Drag moves toolbar + message row** — Click an element, drag the grip handle. Both toolbar and message row translate together.
2. **Picker follows** — Open the `N +` picker, drag toolbar. Close and re-open picker — it appears next to the `N +` button in its new position.
3. **Drag persists during Add More** — Open picker → "Add more" → click elements. Toolbar stays in dragged position.
4. **New selection resets** — After dragging, click a different element. Toolbar returns to floating-ui anchor position.
5. **Scroll/resize after drag** — Scroll page with toolbar dragged. Toolbar stays put. Start a fresh selection (not dragged), scroll — toolbar follows element as before.
6. **Build** — `esbuild --watch` produces no errors.

## Prototype

See `specs/041-draggable-toolbar/prototype.html` for a standalone interactive mockup.
