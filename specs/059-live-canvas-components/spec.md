# 059 — Live Canvas Components

## Problem

Today, when a component or element is placed on the design canvas, it is **rasterized to a PNG** via `rasterizeHtml()` and inserted as a Fabric.js `FabricImage`. This means:

1. The placed object is a static bitmap — its DOM is gone.
2. Resizing scales the image pixels (gets blurry), then re-rasterizes at the new size on `object:modified`.
3. The design tab (Picker) cannot inspect or edit it — there's no live DOM to read classes from, no element to preview changes on.
4. The design canvas is a pure annotation/wireframing surface with no connection to the editing workflow.

## Goal

Make components placed on the design canvas **live and editable** via the same Picker/design-tab controls used for page elements, while keeping them freely positionable and resizable.

## Key Principles

- **Resize = edit Tailwind `w-[]/h-[]` classes, not scale an image.** Dragging a resize handle adds or replaces `w-[Xpx]` / `h-[Xpx]` classes on the component's root element, so the component actually renders at the new size. This is the same class-editing mechanism as every other Picker control — resize handles are effectively a drag-based scrubber for width/height.
- **Positionable.** Components remain absolutely positioned on the canvas, draggable to any location.
- **Selectable → Editable.** Clicking a placed component selects it and populates the design tab's Picker with its Tailwind classes, exactly like clicking an element on the page.
- **Ghost HTML is the source of truth.** The placed component's `ghostHtml` + `ghostCss` (already stored in `_componentMeta`) drive the live rendering.

## Current Architecture (for reference)

```
User drags component → ghostHtml measured → rasterizeHtml(ghostHtml) → PNG dataUrl
  → FabricImage added to Fabric.js canvas → _componentMeta attached to Fabric object
  → On resize: object:modified → re-rasterize at new pixel dimensions → replace FabricImage
  → On submit: _componentMeta extracted → CanvasComponent[] sent with patch
```

### What `_componentMeta` contains today

```ts
{
  componentName: string;
  componentPath?: string;
  storyId: string;
  args?: Record<string, unknown>;
  ghostHtml: string;
  ghostCss?: string;
}
```

## Proposed Architecture

### Option A: Hybrid Canvas — HTML overlay + Fabric.js annotations

Keep Fabric.js for freehand drawing, shapes, and arrows. Render placed components as **live HTML elements** (via `ShadowGhost`) that float above the canvas in an absolutely-positioned overlay layer.

```
┌─────────────────────────────────────────┐
│  Canvas Container (relative)            │
│  ┌───────────────────────────────────┐  │
│  │  Fabric.js <canvas>              │  │  ← shapes, freehand, arrows
│  │  (z-index: 0)                    │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  Component Overlay Layer          │  │  ← live HTML components
│  │  (z-index: 1, pointer-events)    │  │
│  │  ┌──────────┐  ┌──────────┐      │  │
│  │  │ShadowGhost│  │ShadowGhost│     │  │
│  │  │(draggable │  │(draggable │     │  │
│  │  │ resizable)│  │ resizable)│     │  │
│  │  └──────────┘  └──────────┘      │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  Selection Handles Layer          │  │  ← resize handles, selection outline
│  │  (z-index: 2)                    │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

#### How it works

1. **Placement.** When a component is dropped, instead of rasterizing, create a `CanvasComponentItem` — a positioned `<div>` containing a `ShadowGhost`. Store position (`x`, `y`) and size (`width`, `height`) in React state.

2. **Rendering.** Each `CanvasComponentItem` renders:
   ```tsx
   <div
     style={{
       position: 'absolute',
       left: item.x,
       top: item.y,
       width: item.width,
       height: item.height,
       overflow: 'hidden',
     }}
   >
     <ShadowGhost ghostHtml={item.ghostHtml} ghostCss={item.ghostCss} />
   </div>
   ```

3. **Resize = edit Tailwind classes.** Changing the wrapper div's dimensions alone doesn't resize the component inside — a button with `px-4 py-2` stays the same size regardless of its container. Instead, resize handles update/add `w-[Xpx]` and `h-[Ypx]` classes on the **root element** of the component's `ghostHtml`. This means:
   - Dragging a resize handle is actually a class edit (same mechanism as the Picker).
   - The `ghostHtml` is mutated to include the new width/height classes, the `ShadowGhost` re-renders, and the component visually takes the new size.
   - `item.width` / `item.height` in state reflect the current values and keep resize handles positioned correctly.
   - The wrapper div uses these dimensions too, so overflow clipping and hit-testing stay accurate.
   - If the component's root element already has a `w-*` or `h-*` class, it is replaced. If not, one is added.

4. **Selection → Picker.** Clicking a `CanvasComponentItem`:
   - Sets it as the "selected canvas component"
   - Parses the Tailwind classes from `ghostHtml` (already have `class-parser.ts`)
   - Populates the Picker with those classes
   - The Picker's `onHover`/`onChange` callbacks modify the `ghostHtml` classes in-place and re-render the `ShadowGhost` live

5. **Drag to reposition.** Standard pointer-event-based drag (mousedown → track delta → update `x`/`y`).

6. **Submit.** Rasterize-at-submit: temporarily convert each live `CanvasComponentItem` back to a `FabricImage` (via the existing `rasterizeHtml()` pipeline), place them on the Fabric canvas at their positions, call `canvas.toDataURL()`, then remove them. This reuses the existing export path — live rendering is only for interaction. Also extract `CanvasComponent[]` metadata as today.

#### Advantages
- Live HTML means the Picker can read and write Tailwind classes directly.
- Resize edits Tailwind `w-[]/h-[]` classes on the root element — the same mechanism as any other Picker edit, just triggered by drag handles instead of scrubbers.
- `ShadowGhost` already provides CSS isolation via shadow DOM.
- No Fabric.js version/API coupling for component objects.
- Export is the same one-shot rasterize path that exists today — the only difference is *when* rasterization happens (submit-time vs. placement-time).

#### Challenges
- Two coordinate systems (Fabric objects vs. absolutely positioned HTML). Need to keep them coherent for z-ordering and selection.
- Pointer event routing: need to determine whether a click targets a Fabric object or an HTML component and dispatch accordingly.
- Resize must parse the root element's existing classes, replace/add `w-*`/`h-*` tokens, and re-serialize the `ghostHtml` string on every drag frame (should be fast — it's a regex replace on a small string).

---

### Option B: Fabric.js Custom Object — `LiveComponent`

Extend Fabric.js with a custom object type that renders live HTML inside a `<foreignObject>` or overlay div, managed by Fabric's transform/selection system.

This is significantly more complex and tightly coupled to Fabric.js internals. **Not recommended** unless the annotation layer needs tight z-interleaving with components (components behind shapes, etc.).

---

## Recommended: Option A

Option A is simpler, builds on existing primitives (`ShadowGhost`, `class-parser`), and cleanly separates concerns.

## Data Model

### `CanvasComponentItem` (new, panel-side state)

```ts
interface CanvasComponentItem {
  id: string;                          // UUID
  componentName: string;
  componentPath?: string;
  storyId: string;
  args?: Record<string, unknown>;
  ghostHtml: string;                   // mutable — updated by Picker edits
  ghostCss?: string;
  x: number;                           // px from canvas left
  y: number;                           // px from canvas top
  width: number;                       // CSS width (px)
  height: number;                      // CSS height (px)
}
```

### Selection State

```ts
type CanvasSelection =
  | { type: 'fabric' }                               // a Fabric.js object is selected
  | { type: 'component'; id: string }                 // a live component is selected
  | null;                                              // nothing selected
```

When `selection.type === 'component'`, the Picker is populated from the selected `CanvasComponentItem`'s `ghostHtml`.

## Interaction Flows

### Flow 1: Place a component

1. User arms a component (Place button or drag from DrawTab).
2. User clicks/drops on canvas.
3. Measure `ghostHtml` natural size → set as initial `width`/`height`.
4. Create `CanvasComponentItem`, add to state array.
5. Auto-select the new item.

### Flow 2: Select a placed component

1. User clicks on a `CanvasComponentItem` div.
2. Set `canvasSelection = { type: 'component', id }`.
3. Parse Tailwind classes from `ghostHtml` via the grammar parser.
4. Render Picker with those classes.
5. Deselect any Fabric.js object.

### Flow 3: Edit via Picker

1. User scrubs/selects a value in the Picker.
2. Picker calls `onHover(newClass)` → update the selected item's `ghostHtml` (swap the old class for the new class in the HTML string).
3. `ShadowGhost` re-renders live with the new class.
4. On commit, the final `ghostHtml` is stored in the `CanvasComponentItem`.

### Flow 4: Resize

1. User drags a resize handle.
2. Compute new pixel width/height from the drag delta.
3. Update the root element's Tailwind classes in `ghostHtml`:
   - If a `w-*` class exists, replace it with `w-[{newWidth}px]`.
   - If no `w-*` class exists, append `w-[{newWidth}px]`.
   - Same for `h-*` → `h-[{newHeight}px]`.
4. Update `item.width` / `item.height` in state (keeps handles positioned correctly).
5. `ShadowGhost` re-renders with the new classes → the component actually changes size.
6. No rasterization needed.

> **Note:** This is the same class-editing mechanism as the Picker — resize is just a specialized scrubber for `w-*` and `h-*`. The Picker's width/height controls and the resize handles should stay in sync.

### Flow 5: Reposition

1. User mousedowns on component (not on a resize handle).
2. Track pointer delta.
3. Update `item.x` / `item.y` in state.

### Flow 6: Drop component into a placed component (nested replace/insert)

On the live page today, the user can drag a Button onto a two-column layout and replace one of the columns. Because canvas components are now live HTML (via `ShadowGhost`), the same interaction should work on the canvas.

#### How it works

1. User drags a component from the DrawTab over a **placed** canvas component.
2. The canvas detects the drag is over a `CanvasComponentItem` (hit-test against the overlay divs).
3. The placed component's `ShadowGhost` shadow DOM becomes the drop target — the same `findTarget()` / `computeDropPosition()` / `getAxis()` geometry logic used by the overlay's `drag-drop.ts` runs against the shadow DOM's child elements.
4. Drop indicators (insert lines or replace outlines) render inside or over the `ShadowGhost`, showing the user exactly where the new component will land.
5. On drop:
   - **Replace:** The target child element inside the `ghostHtml` is replaced with the dropped component's `ghostHtml`. The parent `CanvasComponentItem`'s `ghostHtml` is updated in state and the `ShadowGhost` re-renders.
   - **Insert (before/after/first-child/last-child):** The dropped component's `ghostHtml` is inserted at the correct position within the parent's `ghostHtml`. Same state update + re-render.
6. The dropped component becomes a **nested child** inside the parent's `ghostHtml` — not a separate `CanvasComponentItem`. This mirrors how the live page works (the DOM is mutated in-place).

#### Data model impact

The parent `CanvasComponentItem` tracks its children via metadata so that submit can report them:

```ts
interface CanvasComponentItem {
  // ... existing fields ...
  /** Components nested inside this item's ghostHtml via drop-into */
  children?: CanvasChildComponent[];
}

interface CanvasChildComponent {
  componentName: string;
  componentPath?: string;
  storyId: string;
  args?: Record<string, unknown>;
  insertMode: InsertMode;        // 'replace' | 'before' | 'after' | 'first-child' | 'last-child'
  targetSelector?: string;       // CSS selector or index path identifying the replaced/target element
}
```

#### Selecting nested children

After a component is dropped into a parent, clicking on the nested child within the `ShadowGhost` should select *that child's* classes for editing in the Picker — same click-through behavior as on the live page. This is a Phase 3 concern (see "Nested selection" in Open Questions).

#### Constraints

- Drop-into only works on `CanvasComponentItem`s (live HTML), not on Fabric.js shapes/drawings.
- The dropped component's `ghostCss` must be merged into the parent's shadow DOM stylesheet so its classes resolve.
- Z-ordering: during a drag, the drop-target highlight layer must appear above the `ShadowGhost` content.

### Flow 7: Submit / Export

`canvas.toDataURL()` only captures Fabric.js objects — it can't see the HTML overlay layer. Rather than trying to composite two rendering systems, we **rasterize at submit time**:

1. For each `CanvasComponentItem`, call `rasterizeHtml(item.ghostHtml, item.width, item.height, item.ghostCss)` — the same function used today at placement time.
2. Create a temporary `FabricImage` from each resulting PNG and place it on the Fabric canvas at `(item.x, item.y)`.
3. Hide the HTML overlay layer.
4. Call `canvas.toDataURL()` — now the canvas contains both Fabric shapes and rasterized components.
5. Remove the temporary `FabricImage`s, restore the overlay layer.
6. Extract `CanvasComponent[]` from `CanvasComponentItem[]` state (same shape as today).
7. Include updated `ghostHtml` with any Picker edits applied.
8. Include `children` metadata so the agent knows about nested component drops.

This keeps the existing export pipeline intact — the only change is that rasterization happens at submit-time instead of at placement-time. Components are live HTML during editing, bitmaps only for the final screenshot.

## Editing `ghostHtml` Classes

The `ghostHtml` is a serialized HTML string. To edit classes:

1. **Parse:** The root element's `class` attribute contains the Tailwind classes. Extract with regex or DOM parsing.
2. **Modify:** Swap/add/remove class tokens using the same logic as `PATCH_PREVIEW` (the overlay already does this for live page elements).
3. **Re-serialize:** Update the `class` attribute in the HTML string.

A utility like `updateGhostClass(ghostHtml, oldClass, newClass): string` would handle this. This is analogous to what the overlay does when previewing a class change, but operating on an HTML string instead of a live DOM element.

## Implementation Plan

### Phase 1: Live rendering (no editing)
- [ ] Create `CanvasComponentItem` type and state management in `useFabricCanvas` (or a new `useCanvasComponents` hook)
- [ ] Replace rasterize-on-place with `ShadowGhost` overlay div
- [ ] Implement drag-to-reposition on overlay divs
- [ ] Implement resize handles that change `width`/`height`
- [ ] Ensure submit still exports correct `CanvasComponent[]` metadata
- [ ] Composite rasterization for the PNG export

### Phase 2: Selection + Picker integration
- [ ] Click-to-select a canvas component
- [ ] Parse `ghostHtml` classes and populate Picker
- [ ] Wire Picker `onHover`/`onChange` to update `ghostHtml` classes
- [ ] Live preview: `ShadowGhost` re-renders on class change

### Phase 3: Drop-into (nested components)
- [ ] Hit-test drags against `CanvasComponentItem` overlay divs
- [ ] Run `findTarget()` / `computeDropPosition()` against the `ShadowGhost` shadow DOM children
- [ ] Render insert indicators / replace outlines over the shadow DOM content
- [ ] On drop: mutate parent `ghostHtml` to insert/replace child HTML
- [ ] Merge dropped component's `ghostCss` into parent's shadow DOM stylesheet
- [ ] Track `children` metadata for submit/export
- [ ] Click-through selection of nested children for Picker editing

### Phase 4: Polish
- [ ] Z-ordering between Fabric objects and HTML components
- [ ] Keyboard shortcuts (Delete to remove, arrow keys to nudge)
- [ ] Copy/paste for canvas components
- [ ] Multi-select (stretch goal)

## Open Questions

1. **Z-interleaving:** Should components always be above Fabric shapes, or should users be able to layer them? (Always-above is simpler for Phase 1.)
2. **Nested selection:** If a component has multiple elements with Tailwind classes, should the user be able to click into the shadow DOM to select a specific child element? (Phase 1: edit root element only. Phase 3: click-through selection for nested children after drop-into.)
3. **Args editing:** Should the Picker also expose component `args` for editing (text content, variants, etc.)? This is orthogonal but complementary.
4. **Export format:** Should the final patch include the edited `ghostHtml` so the agent can see what visual changes the user made? (Yes — this is valuable context.)
5. **Drop-into depth limit:** Should nesting be recursive (drop into a component that was itself dropped into another)? Phase 3 targets single-level nesting; recursive nesting is a stretch goal.
6. **Ghost CSS merging:** When multiple components are nested, their `ghostCss` stylesheets could conflict. Scoping via unique prefixes or separate `<style>` blocks in the shadow DOM mitigates this.
7. **Undo for drop-into:** Dropping a component into another mutates the parent's `ghostHtml`. This should integrate with the canvas undo stack so Ctrl+Z reverts the nest operation.
