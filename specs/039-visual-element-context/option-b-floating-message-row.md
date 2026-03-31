# Option B — Floating Message Row Anchored to Canvas (During-Drawing Context)

## Status

Draft — design option for discussion

---

## Problem

When a user inserts a draw canvas, they need a way to add a message that provides narrative context for the AI agent. The natural time to write this is **while drawing** — when intent is freshest and the user knows exactly what they intend to communicate. However, the draw canvas occupies DOM space inside the page, and a message form inside the canvas iframe would be constrained to that space and disconnected from the overlay's staging infrastructure.

### Current behavior

```
User inserts canvas → draws → submits
→ No opportunity to add a descriptive message while drawing
→ AI agent receives only an image, no narrative context
```

---

## Prior Art & Existing Infrastructure

The overlay already has a fully functional message row (`msg-row`) in `overlay/src/element-toolbar.ts`. It:

- Creates a `<textarea>` with auto-resize and a send button
- Sends `MESSAGE_STAGE` to the server when submitted
- Positions itself using `positionBothMenus()` with Floating UI
- Lives in the shadow DOM alongside the element toolbar

`@floating-ui/dom` is already a dependency — no new packages needed.

The canvas iframe communicates with the overlay via `postMessage`. The `handleDesignSubmitted()` function in `overlay/src/design-canvas-manager.ts` already handles the "submitted" lifecycle transition.

`patchManager.stageMessage()` in `panel/src/hooks/usePatchManager.ts` handles the server write. Messages become `kind: 'message'` patches and are committed alongside the design patch.

---

## Solution Overview

Render a **floating message row anchored to the bottom edge** of the active `<vb-design-canvas>` wrapper using Floating UI. The message row:

- Uses the **same overlay message row** (`msg-row`) that already exists for normal element selection
- Floats above the page content in the shadow DOM — does not affect page layout
- Is anchored to the bottom of the canvas wrapper via `computePosition()`
- Automatically repositions when the canvas is resized (via `ResizeObserver`)
- Disappears after the canvas is submitted (frozen image replaces the iframe)

---

## Architecture

```
Page DOM (normal flow)
  <body>
    ...
    <vb-design-canvas data-tw-design-canvas>   ← canvas wrapper (in flow)
      <iframe src="/panel/?mode=design">        ← drawing surface
      <div class="resize-handle-bottom">
      <div class="resize-handle-corner">
    </vb-design-canvas>
    <next-element>...                           ← normal page content below
    ...

Shadow DOM (overlay — position: fixed, z-index: 2147483647)
  <div class="element-toolbar">                ← per-element floating toolbar
  <div class="msg-row" data-canvas-anchor>     ← NEW: anchored to canvas bottom
    <textarea placeholder="add your message">
    <button class="msg-send">
```

**Key principle:** The `msg-row` gets a **canvas-anchored** positioning mode that uses Floating UI `computePosition()` instead of the normal toolbar-relative positioning. A `ResizeObserver` on the canvas wrapper keeps the row aligned as the user drags resize handles.

---

## Implementation

### Overlay: `overlay/src/design-canvas-manager.ts`

#### 1. Show floating message row on canvas injection

After injecting the canvas wrapper into the DOM, call `showCanvasMessageRow()`:

```typescript
import { showCanvasMessageRow, hideCanvasMessageRow } from './element-toolbar.ts';

// In injectDesignCanvas(), after wrapper is inserted:
showCanvasMessageRow(wrapper, state.currentBoundary, state.shadowRoot);
```

#### 2. Hide floating message row on submission

In `handleDesignSubmitted()`, call `hideCanvasMessageRow()` after freezing the canvas:

```typescript
export function handleDesignSubmitted(msg: { image?: string }): void {
  // ... existing freeze logic (replace iframe with img) ...

  hideCanvasMessageRow();
}
```

Also call `hideCanvasMessageRow()` in `handleDesignClose()` (user cancelled without submitting):

```typescript
export function handleDesignClose(wrapper: HTMLElement): void {
  // ... existing restore logic ...

  hideCanvasMessageRow();
}
```

---

### Overlay: `overlay/src/element-toolbar.ts`

#### 3. Extract `createMsgRow()` shared helper

The existing msg-row creation code in `showDrawButton()` (~L250–340) should be extracted into a standalone `createMsgRow(boundary, shadowRoot)` helper. Both the normal element selection flow and the canvas-anchored flow call this same function — no duplication.

```typescript
function createMsgRow(
  boundary: ComponentBoundary | null,
  shadowRoot: ShadowRoot,
): HTMLElement {
  // ... move existing msg-row creation logic here ...
  // Returns the constructed <div class="msg-row"> element
}
```

#### 4. `showCanvasMessageRow()` — new export

```typescript
let canvasMsgRow: HTMLElement | null = null;
let canvasMsgRowObserver: ResizeObserver | null = null;

export function showCanvasMessageRow(
  canvasWrapper: HTMLElement,
  boundary: ComponentBoundary | null,
  shadowRoot: ShadowRoot,
): void {
  // Clean up any previous canvas row
  hideCanvasMessageRow();

  const msgRow = createMsgRow(boundary, shadowRoot);
  msgRow.setAttribute('data-canvas-anchor', 'true');
  shadowRoot.appendChild(msgRow);
  canvasMsgRow = msgRow;

  // Position the row below the canvas wrapper
  positionCanvasMsgRow(canvasWrapper, msgRow);

  // Reposition on resize (user drags resize handles)
  canvasMsgRowObserver = new ResizeObserver(() => {
    positionCanvasMsgRow(canvasWrapper, msgRow);
  });
  canvasMsgRowObserver.observe(canvasWrapper);
}
```

#### 5. `hideCanvasMessageRow()` — new export

```typescript
export function hideCanvasMessageRow(): void {
  canvasMsgRowObserver?.disconnect();
  canvasMsgRowObserver = null;
  canvasMsgRow?.remove();
  canvasMsgRow = null;
}
```

#### 6. `positionCanvasMsgRow()` — internal helper

```typescript
import { computePosition, shift, flip } from '@floating-ui/dom';

function positionCanvasMsgRow(
  canvasWrapper: HTMLElement,
  msgRow: HTMLElement,
): void {
  computePosition(canvasWrapper, msgRow, {
    placement: 'bottom-start',
    middleware: [
      shift({ padding: 8 }),   // stay within viewport horizontally
      flip(),                   // move above canvas if bottom is too close to edge
    ],
  }).then(({ x, y }) => {
    Object.assign(msgRow.style, {
      position: 'fixed',
      left: `${x}px`,
      top: `${y}px`,
    });
  });
}
```

---

### Panel changes

**None required.** The message is staged via the existing `MESSAGE_STAGE` WebSocket path. The server receives it identically regardless of which UI triggered the send.

### Server changes

**None required.** `MESSAGE_STAGE` handling in `server/websocket.ts` is already generic — the source of the message (element toolbar row vs. canvas-anchored row) is irrelevant.

---

## User Flow — Detailed

```
1. User selects an element in the page
2. User clicks "Design" button in toolbar → design canvas injected into DOM
3. Overlay calls showCanvasMessageRow(wrapper, ...) → floating row appears below canvas
4. User draws in canvas iframe
5. (Optional) User types context in the floating msg-row and clicks send ▶
   → MESSAGE_STAGE sent over WebSocket
   → kind: 'message' patch staged
6. User clicks "Queue as Change" in canvas toolbar
   → canvas freezes (iframe → img)
   → hideCanvasMessageRow() called → floating row removed
7. User commits the staged patches
   → AI agent receives design image + narrative message in implement_next_change
```

**Visual layout during drawing:**

```
  ┌─────────────────────────────────────────────────────┐
  │  (page content above)                               │
  │                                                     │
  │  ┌─ vb-design-canvas ────────────────────────────┐  │
  │  │                                               │  │
  │  │   [Fabric.js canvas toolbar]                  │  │
  │  │                                               │  │
  │  │   [Drawing surface]                           │  │
  │  │                                               │  │
  │  └────────────────────────────────────────── ◢  ─┘  │
  │                                                     │
  │  ┌─ msg-row (floating, shadow DOM) ──────────────┐  │  ← floats above page
  │  │ What this design shows...            [ ▶ ]   │  │
  │  └────────────────────────────────────────────┘  │
  │                                                     │
  │  (page content below canvas — pushed down by        │
  │   canvas in normal flow, unaffected by msg-row)     │
  │                                                     │
  └─────────────────────────────────────────────────────┘
```

The message row sits visually between the canvas bottom edge and the next page element, but it floats in the overlay's shadow DOM — it does not affect page layout and does not push content further down.

---

## Edge Cases

### Canvas resize

The `ResizeObserver` on the canvas wrapper automatically repositions the msg-row whenever the user drags the bottom or corner resize handles. No scroll or animation frame logic required — `ResizeObserver` fires after layout paint.

### Viewport bottom edge

Floating UI's `flip()` middleware moves the msg-row **above** the canvas bottom edge when there is insufficient space below (e.g., the canvas extends to the bottom of the viewport). `shift()` keeps it within the horizontal viewport bounds.

```
Normal (space below):              Flipped (tight viewport bottom):
  ┌──── canvas ──────┐               ┌─ msg-row (flipped above) ─┐
  └──────────────────┘               └───────────────────────────┘
  ┌─ msg-row ────────┐               ┌──── canvas ───────────────┐
  └──────────────────┘               └───────────────────────────┘
```

### Multiple simultaneous canvases

Only one canvas msg-row is shown at a time — the most recently injected canvas's row. If a second canvas is inserted while the first is still active, `showCanvasMessageRow()` calls `hideCanvasMessageRow()` internally before creating the new row, so no duplicate rows appear.

Context for the first canvas can still be added after it freezes using Option A's click-to-select behavior (if both options are implemented together).

### Canvas scrolled off screen

The msg-row is positioned with `position: fixed` in the shadow DOM. If the canvas wrapper is scrolled out of the viewport, the floating row follows it off screen. Users can scroll to the canvas to reach the message row. This matches the behavior of the element toolbar itself.

### Existing element toolbar coexistence

The canvas-anchored msg-row is independent of the normal per-element msg-row that appears when the user selects a non-canvas element. Both can technically be visible simultaneously (e.g., the user selected an element outside the canvas, then clicked Design). In practice, inserting a canvas replaces the selection context — the element toolbar should be dismissed when `injectDesignCanvas()` is called.

### User dismisses canvas without submitting

`handleDesignClose()` is called when the user cancels or removes the canvas without submitting. This path already exists and must call `hideCanvasMessageRow()` to clean up any staged row. Message patches staged before cancellation remain in the queue until the user discards them; this is acceptable and consistent with how other staged patches behave.

---

## Affected Files

| File | Change |
|------|--------|
| `overlay/src/element-toolbar.ts` | Extract `createMsgRow()` helper; add `showCanvasMessageRow()`, `hideCanvasMessageRow()`, `positionCanvasMsgRow()` |
| `overlay/src/design-canvas-manager.ts` | Call `showCanvasMessageRow()` after injection; call `hideCanvasMessageRow()` after submission and close |

No changes to `shared/types.ts`, `panel/`, or `server/`.

---

## Pros & Cons

### Pros

- **Right timing** — context is written while drawing, when intent is freshest; no need to re-click afterward
- **Single workflow** — draw + describe + submit without revisiting the element
- **Minimal scope** — only two overlay files change; no panel, server, or shared type modifications
- **Reuses existing infrastructure** — same `msg-row`, same `MESSAGE_STAGE` WS path, same `kind: 'message'` patch kind; no new UI components to design or test
- **Natural visual position** — the message row sits directly below the canvas, matching the user's visual focus during drawing
- **Floating UI already present** — `@floating-ui/dom` is already a dependency; no additional installs

### Cons

- **Context disappears after submit** — the floating row is removed when the canvas freezes; no way to add or edit context afterward (Option A's select behavior would be required to cover the post-submit case)
- **Discoverability** — the floating row may not be noticed by users who are focused on the drawing; it's always visible but not prominent
- **Dual input areas** — having both canvas drawing tools and a message box simultaneously visible can feel noisy, especially on smaller viewports
- **ResizeObserver complexity** — edge cases around rapid resize, scroll containers, and cross-origin iframes (canvas is same-origin, but worth noting) require careful testing
- **Canvas-only** — does not help with standalone `<img>`, `<canvas>`, or `<video>` elements outside the design canvas flow (Option A covers these)
- **No panel feedback** — user cannot see staged messages from the canvas flow without switching to the panel; the overlay-only staging provides no confirmation UI

---

## Comparison with Option A

| Concern | Option A (visual selection) | Option B (this spec) |
|---------|----------------------------|----------------------|
| When context is written | After submission | While drawing |
| Infrastructure changes | 5+ files (shared types, overlay, panel, server) | 2 overlay files only |
| Panel changes | Yes (MessageView, tab filtering) | None |
| Covers `<img>`, `<video>` | Yes | No |
| Re-replace frozen canvas | Yes (complex) | No |
| Discoverability | High (user must click to select) | Medium (always visible) |
| Implementation effort | Medium–High | Low–Medium |

Option A and Option B are **complementary**. A full implementation would combine them:

- **Option B** for during-drawing context (the primary authoring moment)
- **Option A** for post-submit context, `<img>` / `<video>` elements, and re-replace

Either option can be implemented independently without conflicting with the other.
