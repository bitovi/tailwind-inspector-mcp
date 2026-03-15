# Inline Design Canvas — Requirements

## Overview

An inline drawing canvas that lets users visually mock up a UI feature and submit the sketch to an AI agent via the MCP server. The user selects an element, inserts a resizable canvas as a sibling or child, draws shapes/text/colors to communicate their intent, and submits. The server queues the base64 PNG image alongside DOM context so an agent can retrieve it and understand *what* to build and *where* in the component tree it belongs.

## Motivation

The current MCP workflow is text-only: users describe what they want, and the AI agent applies Tailwind class changes. But some ideas are far easier to communicate visually — a new card layout, a rearranged toolbar, an added sidebar. By letting users sketch directly in the page next to the element they're working on, we bridge the gap between intent and implementation.

## Vocabulary

| Term | Definition |
|------|-----------|
| **Design Canvas** | A Fabric.js-powered `<canvas>` inside a React component, embedded in an iframe. Supports freehand drawing, shapes, text, and color fills. |
| **Canvas Wrapper** | A light-DOM `<div>` injected by the overlay as a sibling or child of the selected element. Contains the iframe, resize handles, and a small control bar. |
| **Design Mode** | A separate view of the panel app (`?mode=design`) that renders the Design Canvas + submit controls instead of the Picker. |
| **Design Request** | The queued payload sent to the server: base64 PNG image + element context (component name, tag, classes, DOM snippet). |

---

## User Flow

```
1. User clicks element in the page
      │
      ▼
2. Panel shows existing Picker UI with an "Insert Design" button in the header
      │
      ▼
3. User clicks "Insert Design"
      │  └── panel sends INSERT_DESIGN_CANVAS → overlay
      ▼
4. Overlay injects a Canvas Wrapper into the light DOM
   (as sibling after the selected element, by default)
      │  └── overlay sends DESIGN_CANVAS_INSERTED → panel
      │  └── overlay sends ELEMENT_CONTEXT → design iframe (component name, DOM context)
      ▼
5. User draws in the canvas — shapes, text, colors, freehand
      │
      ▼
6. User clicks "Submit Design" inside the canvas
      │  └── canvas calls fabricCanvas.toDataURL('png')
      │  └── design iframe sends DESIGN_SUBMIT → server (base64 image + context)
      ▼
7. Server queues the Design Request with auto-incremented ID + timestamp
      │
      ▼
8. AI agent calls get_design_requests MCP tool
      │  └── receives { id, timestamp, image, context }
      ▼
9. Agent interprets the sketch + context and generates code
```

---

## Architecture

### Rendering Strategy: Iframe in Light DOM

The design canvas renders inside an `<iframe>` that loads the panel app in design mode (`/panel/?mode=design`). This approach:

- **Keeps the overlay bundle small** — Fabric.js (~300KB) only loads inside the iframe, not in the overlay IIFE
- **Provides style isolation** — the canvas UI doesn't inherit or conflict with the target page's styles
- **Reuses the panel build system** — the design canvas is a React component built by Vite alongside the existing panel
- **Follows the established pattern** — the inspector panel already renders in an iframe (Sidebar/Modal/Popover containers)

### Injection into Light DOM

Unlike the inspector panel (which lives in Shadow DOM or a popup), the canvas wrapper is injected into the **actual page DOM** so it participates in the document flow and appears inline with the target element.

```
┌─────────────────── Page DOM ───────────────────────┐
│                                                     │
│  <div class="card">              ← selected element │
│    <h2>Card Title</h2>                              │
│    <p>Card content...</p>                           │
│  </div>                                             │
│                                                     │
│  ┌── Canvas Wrapper (injected as next sibling) ──┐  │
│  │  [Control bar: Close │ Child/Sibling toggle]  │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │            <iframe>                     │  │  │
│  │  │     Design Canvas (Fabric.js)           │  │  │
│  │  │     ┌───┐  ○  "Add to cart"  ──────     │  │  │
│  │  │     │   │                               │  │  │
│  │  │     └───┘        [Submit Design]        │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  │  ═══════════ resize handle (bottom) ═══════   │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  <div class="card">              ← next element     │
│    ...                                              │
│  </div>                                             │
└─────────────────────────────────────────────────────┘
```

---

## Canvas Wrapper (Overlay-Injected)

The overlay creates a wrapper `<div>` with the following structure:

### Control Bar

A small toolbar at the top of the wrapper:

| Control | Behavior |
|---------|----------|
| **Close (×)** | Removes the canvas wrapper from the DOM entirely |
| **Sibling / Child toggle** | Switches insertion mode. "Sibling" = `insertAfter(selectedEl)`. "Child" = `selectedEl.prepend()`. Toggling re-injects the wrapper. |

### Sizing

- **Default width**: matches `currentTargetEl.getBoundingClientRect().width` (fills the same column)
- **Default height**: 300px
- **Minimum size**: 200px × 150px

### Resize Handles

Reuses the mousedown/mousemove/mouseup resize pattern from `SidebarContainer.ts`:

- **Bottom edge**: vertical resize (cursor: `ns-resize`)
- **Right edge**: horizontal resize (cursor: `ew-resize`)
- **Bottom-right corner**: both axes (cursor: `nwse-resize`)

### Visual Styling

- 2px dashed border in `bv-teal` (#00848B) to clearly distinguish the canvas area from page content
- Control bar background: `bv-surface` with `bv-border` bottom border
- Slight box shadow to lift the wrapper visually

---

## Design Canvas Component

### Library: Fabric.js v6+

**Why Fabric.js:**

| Criterion | Fabric.js v6 | Excalidraw | tldraw |
|-----------|-------------|------------|--------|
| Bundle size | ~300KB | ~2MB | ~1.5MB |
| License | MIT | MIT | Apache-2.0 |
| React integration | Wrap `<canvas>`, imperative API | Full React component | Full React component |
| Shape primitives | Rect, Circle, Line, Path, Text, Groups | Hand-drawn aesthetic shapes | Polished vector shapes |
| Image export | `canvas.toDataURL()` built-in | `exportToBlob()` | `getSvg()` / screenshot |
| Customization | Full control over toolbar, theme, behavior | Opinionated UI (can override) | Opinionated UI |
| Dependency weight | Standalone | React + many deps | React + many deps |

Fabric.js is the right choice for v1: lightweight, MIT-licensed, gives us full control over the toolbar UI (matching Bitovi design tokens), and has built-in `toDataURL()` for image capture.

### Toolbar

A horizontal toolbar above the canvas with drawing tools and options:

```
[ ✎ ] [ □ ] [ ○ ] [ ╱ ] [ → ] [ T ] [ ⊘ ] │ 🎨 color │ [ ↶ ] [ ↷ ] [ 🗑 ] │ [ Submit Design ]
```

| Tool | Icon | Behavior |
|------|------|----------|
| **Freehand** | ✎ | Pencil/brush mode. Draws paths on mousedown+drag. |
| **Rectangle** | □ | Click+drag to draw a filled/stroked rectangle. |
| **Circle** | ○ | Click+drag to draw a filled/stroked ellipse. |
| **Line** | ╱ | Click+drag to draw a straight line. |
| **Arrow** | → | Click+drag to draw a line with an arrowhead. |
| **Text** | T | Click to place an editable text box. Double-click to edit. |
| **Eraser** | ⊘ | Click an object to remove it from the canvas. |
| **Color** | 🎨 | Opens a small palette using the Bitovi brand color tokens plus standard colors. Sets fill/stroke for next object and selected objects. |
| **Undo** | ↶ | Reverts last canvas action (state stack). |
| **Redo** | ↷ | Re-applies last undone action. |
| **Clear** | 🗑 | Clears all objects from the canvas (with confirmation). |
| **Submit Design** | button | Captures canvas as PNG and sends to server. |

### Color Palette

The palette includes Bitovi brand tokens for consistency with the panel theme, plus general-purpose colors:

**Brand colors:**
- `bv-teal` (#00848B), `bv-orange` (#F5532D)

**General colors:**
- Black, White, Gray-300, Gray-500, Gray-700
- Red-500, Orange-500, Yellow-500, Green-500, Blue-500, Purple-500
- Transparent (no fill)

### Canvas Behavior

- **Object selection**: click to select, drag handles to resize/rotate
- **Multi-select**: Shift+click or drag-selection box
- **Delete selected**: Backspace/Delete key removes selected objects
- **Pan**: not needed for v1 (canvas is the viewport)
- **Zoom**: not needed for v1
- **Auto-resize**: canvas fills the iframe viewport, which fills the wrapper

---

## Message Types

### New Messages

Added to `overlay/src/messages.ts`:

```ts
/** Panel → Overlay: request to inject a design canvas */
interface InsertDesignCanvasMessage {
  type: 'INSERT_DESIGN_CANVAS'
  to: 'overlay'
  insertMode: 'sibling' | 'child'  // where to inject relative to selected element
}

/** Overlay → Design iframe: element context for the canvas */
interface ElementContextMessage {
  type: 'ELEMENT_CONTEXT'
  to: 'design'
  componentName: string
  instanceCount: number
  target: {
    tag: string
    classes: string
    innerText: string   // first 60 chars
  }
  context: string       // HTML snippet from buildContext()
}

/** Design iframe → Server: submit the sketch */
interface DesignSubmitMessage {
  type: 'DESIGN_SUBMIT'
  // no 'to' field — server-handled
  image: string         // base64 PNG data URL
  componentName: string
  target: {
    tag: string
    classes: string
    innerText: string
  }
  context: string       // HTML snippet showing where this element sits in the tree
  insertMode: 'sibling' | 'child'
  canvasWidth: number   // pixel dimensions of the submitted canvas
  canvasHeight: number
}
```

### Message Flow Diagram

```
  Panel                    Overlay                   Design iframe           Server
    │                        │                           │                     │
    │  INSERT_DESIGN_CANVAS  │                           │                     │
    │───────────────────────>│                           │                     │
    │                        │── inject wrapper+iframe ──│                     │
    │                        │                           │                     │
    │                        │   ELEMENT_CONTEXT         │                     │
    │                        │──────────────────────────>│                     │
    │                        │                           │                     │
    │                        │                           │  (user draws)       │
    │                        │                           │                     │
    │                        │                           │   DESIGN_SUBMIT     │
    │                        │                           │────────────────────>│
    │                        │                           │                     │── queue
    │                        │                           │                     │
    │                        │                           │              MCP: get_design_requests
    │                        │                           │                     │──> Agent
```

---

## Design Queue (Server)

### Data Model

Modeled after the existing change queue (`server/queue.ts`):

```ts
interface DesignRequest {
  id: number                // auto-incremented
  timestamp: string         // ISO 8601
  image: string             // base64 PNG data URL
  componentName: string     // React component containing the target element
  target: {
    tag: string             // e.g. "div", "button"
    classes: string         // full class string of the selected element
    innerText: string       // first 60 chars
  }
  context: string           // HTML snippet showing DOM neighborhood
  insertMode: 'sibling' | 'child'
  canvasWidth: number
  canvasHeight: number
  applied: boolean          // false until agent marks it
}
```

### Queue API

```ts
// server/design-queue.ts

addDesignRequest(payload: Omit<DesignRequest, 'id' | 'timestamp' | 'applied'>): DesignRequest
getDesignRequests(): DesignRequest[]          // returns all where applied === false
markDesignApplied(ids: number[]): void        // sets applied = true for given IDs
clearDesignRequests(): void                   // removes all entries
```

In-memory storage (same as change queue). No persistence — cleared on server restart.

---

## MCP Tools

### `get_design_requests`

Returns pending design requests for the AI agent to process.

```json
{
  "name": "get_design_requests",
  "description": "Get pending design sketches submitted by the user. Each request contains a base64 PNG image of the user's sketch, the component and element context where the design should be inserted, and whether it should be a sibling or child.",
  "inputSchema": {
    "type": "object",
    "properties": {}
  }
}
```

**Returns:**
```json
[
  {
    "id": 1,
    "timestamp": "2026-03-14T12:00:00.000Z",
    "image": "data:image/png;base64,iVBOR...",
    "componentName": "ProductCard",
    "target": {
      "tag": "div",
      "classes": "flex flex-col gap-4 p-6",
      "innerText": "Premium Headphones $299.99 Add to cart"
    },
    "context": "<section class=\"grid grid-cols-3\">\n  <div class=\"flex flex-col gap-4 p-6\"> <!-- TARGET -->\n    ...\n  </div>\n  <div class=\"flex flex-col gap-4 p-6\" />\n  ...\n</section>",
    "insertMode": "sibling",
    "canvasWidth": 400,
    "canvasHeight": 300
  }
]
```

### `mark_design_applied`

Marks design requests as processed by the agent.

```json
{
  "name": "mark_design_applied",
  "description": "Mark design requests as applied after the agent has processed them.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "ids": {
        "type": "array",
        "items": { "type": "number" },
        "description": "IDs of design requests to mark as applied."
      }
    },
    "required": ["ids"]
  }
}
```

### `clear_design_requests`

Clears all design requests from the queue.

```json
{
  "name": "clear_design_requests",
  "description": "Remove all design requests from the queue.",
  "inputSchema": {
    "type": "object",
    "properties": {}
  }
}
```

---

## Panel Integration

### App.tsx Routing

The panel app checks `URLSearchParams` on load:

```
/panel/                    → Picker (existing inspector UI)
/panel/?mode=design        → DesignMode (canvas + submit)
```

`DesignMode` is a separate top-level view that:
1. Connects to the WebSocket server (same as Picker)
2. Registers as `'design'` role (new role, distinct from `'panel'`)
3. Listens for `ELEMENT_CONTEXT` message to receive target element metadata
4. Renders the `DesignCanvas` component full-viewport
5. Renders "Submit Design" button that triggers image capture + `DESIGN_SUBMIT`

### "Insert Design" Button

Added to the Picker header bar (alongside the existing container switcher):

```
┌──────────────────────────────────────────────────────┐
│  ProductCard (3 instances)     [🖌 Design] [◫ ▣ ◨]  │
└──────────────────────────────────────────────────────┘
```

- 🖌 icon + "Design" label
- Clicking sends `INSERT_DESIGN_CANVAS` to overlay
- Button is disabled when no element is selected

---

## Context Forwarding

The design iframe needs to know which element it's attached to so it can include that context when submitting. Two options were considered:

| Approach | Pros | Cons |
|----------|------|------|
| URL query params | Simple, no extra messages | Context can be large (HTML snippets); URL length limits |
| **WebSocket message** | No size limit; reuses existing WS infra | Requires new message type + timing coordination |

**Decision: WebSocket message.** After the overlay creates the iframe and it connects to WS, the overlay sends an `ELEMENT_CONTEXT` message to the `'design'` role. This carries the full component name, target element metadata, and DOM context snippet (from `buildContext()`).

---

## File Changes

### New Files

| File | Description |
|------|-------------|
| `panel/src/DesignMode.tsx` | Top-level design mode view (canvas + submit button + WS handling) |
| `panel/src/components/DesignCanvas/index.ts` | Re-exports |
| `panel/src/components/DesignCanvas/DesignCanvas.tsx` | Fabric.js canvas wrapper + toolbar |
| `panel/src/components/DesignCanvas/DesignCanvas.test.tsx` | Unit tests |
| `panel/src/components/DesignCanvas/DesignCanvas.stories.tsx` | Storybook stories |
| `panel/src/components/DesignCanvas/types.ts` | Shared types (tool enum, color palette) |
| `server/design-queue.ts` | Design request queue (add, get, mark applied, clear) |

### Modified Files

| File | Change |
|------|--------|
| `panel/package.json` | Add `fabric` (v6+) dependency |
| `panel/src/App.tsx` | URL param routing: `mode=design` → `DesignMode` |
| `panel/src/Picker.tsx` | Add "Insert Design" button in header |
| `overlay/src/messages.ts` | Add `INSERT_DESIGN_CANVAS`, `ELEMENT_CONTEXT`, `DESIGN_SUBMIT` types |
| `overlay/src/index.ts` | Handle `INSERT_DESIGN_CANVAS`: inject canvas wrapper + iframe into light DOM |
| `server/index.ts` | Handle `DESIGN_SUBMIT` WS message; register `'design'` WS role; add 3 MCP tools |

---

## Implementation Phases

### Phase 1: Design Canvas Component

Build the drawing editor as a React component inside the panel package.

1. Add `fabric` (v6+, MIT, ~300KB) to `panel/package.json`
2. Create `DesignCanvas` modlet at `panel/src/components/DesignCanvas/`
3. Create `panel/src/DesignMode.tsx` — top-level view wrapping DesignCanvas + submit
4. Modify `panel/src/App.tsx` — `mode=design` URL param → render DesignMode

**Verification:** Storybook stories render; toolbar tools create shapes on canvas; `toDataURL()` returns valid base64.

### Phase 2: Message Types & Overlay Injection

Wire up the overlay to insert the design canvas inline in the page.

5. Add new message types to `overlay/src/messages.ts`
6. Add "Insert Design" button to `panel/src/Picker.tsx`
7. Implement canvas wrapper injection in `overlay/src/index.ts` (light DOM insert, resize handles, control bar)

**Verification:** Clicking "Insert Design" injects a visible, resizable iframe after the selected element. Switching child/sibling moves it. Close removes it.

### Phase 3: Design Submission Flow

Capture the drawing as an image and deliver it to the server.

8. Implement submit handler in `DesignMode.tsx` — `toDataURL()` → `DESIGN_SUBMIT`
9. Add `DESIGN_SUBMIT` handler in `server/index.ts`
10. Create `server/design-queue.ts`

**Verification:** Drawing + submit → server logs show queued request with base64 image and correct element context.

### Phase 4: MCP Tools

Expose design requests to AI agents.

11. Add `get_design_requests` MCP tool
12. Add `mark_design_applied` MCP tool
13. Add `clear_design_requests` MCP tool

**Verification:** Submit a design, call `get_design_requests` via MCP, confirm image + context returned. Call `mark_design_applied`, confirm it no longer appears in pending.

---

## Decisions & Rationale

| Decision | Rationale |
|----------|-----------|
| **Fabric.js v6** over Excalidraw/tldraw | ~300KB vs ~2MB; sufficient for v1 needs (shapes, text, colors, freehand); full toolbar control to match Bitovi theme |
| **Iframe approach** | Reuses panel build system; style isolation from target page; keeps overlay bundle small |
| **Light DOM injection** | Canvas must participate in page flow to appear inline with the target element (Shadow DOM would not flow with content) |
| **Sibling insertion default** | Least disruptive to existing layout; child insertion available via toggle |
| **Base64 PNG via WebSocket** | Simple; no file upload infrastructure; AI vision models handle reasonable image sizes |
| **Separate `'design'` WS role** | Keeps design iframe messages distinct from panel inspector messages; server can route independently |
| **HTML element editing excluded from v1** | Focus on drawing primitives; HTML editing is a future enhancement once the pipeline is proven |
| **In-memory queue** | Matches existing change queue pattern; persistence is out of scope for v1 |

---

## Edge Cases & Constraints

### Canvas Wrapper in Light DOM

- **CSS conflicts**: The wrapper div uses inline styles (not classes) to avoid collisions with the target page's stylesheet. Border, padding, background are all set via `element.style`.
- **Layout disruption**: Inserting a block-level div as a sibling may shift content below. This is intentional — the canvas should be visible in the flow. If the parent is `display: flex` or `grid`, the wrapper may need explicit `flex-basis: 100%` / `grid-column: 1 / -1` to span correctly.
- **Removing the canvas**: Close button removes the wrapper from the DOM and reverts any layout adjustments the overlay made.
- **Multiple canvases**: Users can insert multiple design canvases on the same page. Each tracks its own target element and submits independently.

### Image Size

- Canvas dimensions are sent with the `DESIGN_SUBMIT` payload so the agent knows the sketch resolution.
- No server-side size cap for v1. If images become problematically large, a future iteration could cap resolution or apply JPEG compression.
- WebSocket frame size: the default WS max payload may need to be increased in the server config for large base64 strings (a 1000×600 canvas at PNG quality is ~200–500KB base64).

### Context Accuracy

- The DOM context snippet (`buildContext()`) reflects the state of the page at canvas insertion time, not at submit time. If the user modifies other elements between inserting and submitting, the context may be stale. Acceptable for v1.
- `innerText` is truncated to 60 characters (existing behavior) to keep payloads manageable.

### Fiber Integration

- The design canvas wrapper is **not** a React component on the page — it's raw DOM injected by the overlay. React fiber walking will skip it. This is intentional; the wrapper is ephemeral tooling UI, not part of the application component tree.
- If the user selects a different element while a canvas is open, the canvas remains attached to its original element. The new selection opens normally in the Picker sidebar.

---

## Future Enhancements (Out of Scope for v1)

- **Smart insertion heuristics**: Auto-detect whether child or sibling makes more sense based on the parent's display type and existing children
- **HTML element mode**: Let users drag pre-built HTML components (buttons, cards, inputs) onto the canvas alongside drawn shapes
- **Canvas templates**: Pre-built layout sketches (hero section, card grid, nav bar) that users can start from
- **Annotation mode**: Draw on top of a screenshot of the existing element rather than a blank canvas
- **Collaborative sketching**: Multiple users draw on the same canvas via WebSocket broadcast
- **Persistent storage**: Save design requests to disk (or SQLite) so they survive server restarts
- **Image compression**: Auto-compress large canvases before sending; use JPEG for photos, PNG for vector-like drawings
