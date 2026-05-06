# 00 — Drag-Drop Placement (Replace Arm-and-Place)

> **First feature to build.** Replace the arm → crosshair → click-to-place flow with drag-from-panel-to-page. This builds the foundational drag infrastructure that everything else depends on.

## Problem

The current placement flow is multi-step and indirect: click a component's "Place" button → component is "armed" → cursor becomes crosshair → click on the page to place. This works, but it doesn't feel like a design tool. Drag-and-drop is the natural interaction — grab something from the palette, drop it where you want it.

More importantly, building drag-drop placement first creates the **cross-iframe drag coordination, auto-scroll, and drop-zone-while-dragging** infrastructure that drag-to-move (spec 02) and everything else will reuse.

## Solution

User drags a component thumbnail (or primitive element) from the panel directly onto the page. Drop-zone indicators appear as they hover over page elements, and the component is placed on release.

## Interaction Flow

1. User sees component list in the panel (Place tab)
2. User **mousedown + drag** on a component thumbnail
3. A semi-transparent drag preview follows the cursor
4. As the cursor moves over the page, **drop-zone indicators** appear (same teal lines/borders as today)
5. User releases → component ghost HTML is injected at the indicated position
6. Patch created: `component-drop` (same as today)

## Technical Challenge: Cross-Iframe Drag

The panel lives in an iframe (`/panel/`), and the page is the parent document. The drag must cross this boundary. The panel can also be opened as a popup window (`window.open()`), which adds a second cross-window challenge.

### Chosen Approach: "Escape the Iframe" + postMessage

After prototyping all options (see `cross-window-drag-test.html`), the chosen approach uses **two paths that converge on the same overlay rendering code**:

#### Iframe path (sidebar / modal / popover containers)

1. Panel detects mousedown + 5px drag threshold on a component thumbnail
2. Panel sends `DRAG_START` via `window.parent.postMessage()` with component metadata
3. Overlay receives it and sets `pointer-events: none` on the panel iframe element
4. Now all pointermove events fire on the parent document — overlay captures them directly
5. Overlay renders drag preview + drop-zone indicators in a single coordinate space
6. On pointerup, overlay places the ghost and removes `pointer-events: none` from the iframe

This gives us the same single-document experience that Figma/Webflow have natively.

#### Popup path (popup container / `window.open()`)

1. Panel detects mousedown + 5px drag threshold (same as iframe)
2. Panel sends `DRAG_START` via `window.opener.postMessage()` with component metadata
3. Popup keeps receiving `mousemove` via implicit pointer capture (browser behavior: mousedown holder keeps getting events even when cursor leaves the window)
4. Panel sends `DRAG_MOVE` via `window.opener.postMessage()` with `screenX`/`screenY` on each mousemove
5. Overlay translates screen coords to page client coords: `clientX ≈ screenX - window.screenX - (window.outerWidth - window.innerWidth)`
6. Overlay renders drag preview + drop-zone indicators using translated coordinates
7. On mouseup, panel sends `DRAG_END` via postMessage, overlay places the ghost

#### Why not the alternatives

| Approach | Problem |
|----------|---------|
| **HTML5 Drag and Drop API** | Can't customize drag preview, `dragover` fires at ~4Hz on some browsers, choppy indicators |
| **WebSocket on every pointermove** | Unnecessary latency vs postMessage; WS routes through the server for no reason |
| **postMessage only (no escape)** | Works for popup, but for iframes the escape approach is smoother — no coordinate translation needed |

#### Convergence

Both paths feed into the same overlay code:
- `startDragSession(componentMeta)` — creates preview, sets up state
- `updateDragPosition(clientX, clientY)` — moves preview, computes drop zones
- `endDragSession(clientX, clientY)` — places ghost or cancels

The only difference is the event source: parent document pointermove (iframe) vs postMessage (popup).

## Drop-Zone Indicators While Dragging

Reuse the existing `drop-zone.ts` 4-zone logic, but triggered **continuously during drag** (on every pointer move) rather than on hover-and-click:

- 0–25% along layout axis → `before`
- 25–50% → `first-child`
- 50–75% → `last-child`
- 75–100% → `after`

Visual indicators (teal lines / dashed borders) update in real-time as the cursor moves.

## Auto-Scroll During Drag

When dragging near the edge of a scrollable container (or the viewport):
- **Edge zone**: ~40px inset from scroll container edges
- **Speed curve**: Linear ramp — faster the closer to the edge (2–15px per `requestAnimationFrame`)
- **Outermost first**: The viewport / outermost scrollable container scrolls first. If the user pauses and moves toward an inner scrollable's edge, that container takes over.
- Continue updating drop-zone indicators as content scrolls
- Stop scrolling immediately when cursor moves away from the edge zone or drag ends

### Scroll container detection

On each pointermove during drag, walk up from the element under the cursor finding all scrollable ancestors (elements where `scrollHeight > clientHeight` or `scrollWidth > clientWidth`). For each one, check if the pointer is within the edge zone. Scroll the outermost matching container.

**Note:** The sidebar container wraps the page in `#tw-page-wrapper` with `overflow: auto` — this is the main scroll container, not `document.scrollingElement`. Auto-scroll must target this wrapper.

## Drag Preview

A lightweight visual following the cursor during drag:
- Scaled-down thumbnail of the component (or a simple rectangle for primitives)
- Semi-transparent (opacity ~0.6)
- Shows the component name as a label
- Rendered in the overlay's shadow DOM (parent document) so it's always on top

## Keyboard Accessibility Fallback

Drag-drop is inherently pointer-based. The existing arm-and-place flow (or a simplified version) should remain as a keyboard-accessible alternative:
- Keyboard users can still use the Place button → arrow keys to pick position → Enter to confirm
- This can be a secondary flow, not the primary UX

## What This Replaces

| Current Flow | New Flow |
|---|---|
| Click "Place" → component armed (orange state) → crosshair cursor on page → click to place | Drag component from panel → hover shows drop zones → release to place |
| Click "Insert" → browse mode → lock position → click component → placed | Drag component from panel → drop at position |
| `COMPONENT_ARM` / `COMPONENT_DISARM` messages | `postMessage` with `DRAG_START` / `DRAG_MOVE` / `DRAG_END` |
| Drag onto selected element to replace | Drag onto selected element to replace (same, via drop-zone `replace` position) |

The existing Insert mode state machine (off → browsing → placing) simplifies significantly — there's no "armed" intermediate state.

## Ghost Extraction Timing

Today, ghost HTML is extracted lazily via a Storybook iframe probe. Drag-drop needs ghost data at drag-start time.

**Approach:** Extract on drag-start, show a placeholder preview until it resolves.

1. On mousedown + threshold, fire `DRAG_START` immediately with `componentName` and `storyId`
2. Overlay shows a generic drag preview (component name label, no thumbnail)
3. Panel kicks off ghost extraction in parallel if not already cached
4. When ghost HTML is ready, panel sends `DRAG_GHOST_READY` via postMessage with `ghostHtml` and `ghostCss`
5. Overlay upgrades the drag preview to show the actual thumbnail
6. If user drops before ghost is ready, the drop is queued and fires once extraction completes

## Patch Output

Same `component-drop` patch as today. The drag-drop is a UX change, not a data model change.

## Implementation Phases

1. **Drag detection in panel** — mousedown+drag on component thumbnails, send drag-start message
2. **Drag preview in overlay** — render a following visual in the parent document
3. **Drop-zone indicators during drag** — adapt `drop-zone.ts` to update on pointer-move instead of hover
4. **Auto-scroll** — detect edge proximity during drag, scroll containers
5. **Drop and placement** — on pointer-up, place the ghost HTML at the indicated position
6. **Cleanup** — retire the arm/disarm flow, simplify Insert mode state machine

## Open Questions

All resolved:

- **Keep arm/place alongside drag-drop?** → No, replace immediately.
- **Components needing prop configuration?** → Users can drag a component into a prop.
- **Primitives and Storybook components share same system?** → Yes, from day one.
- **Cross-iframe approach?** → "Escape the iframe" for iframe containers, postMessage for popup container. Both converge on the same overlay rendering code. Validated with `cross-window-drag-test.html`.
- **Ghost extraction timing?** → Extract on drag-start, show placeholder preview until ready.
- **Replace mode?** → Supported from day one via drag-to-replace.
- **Auto-scroll: which container scrolls?** → Outermost scrollable container first. User moves toward inner scrollable edge to scroll that one.

