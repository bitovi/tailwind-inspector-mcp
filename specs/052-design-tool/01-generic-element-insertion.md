# 01 — Generic Element Insertion

> Built-in palette of insertable elements — no Storybook dependency. Start simple: a static block and an absolutely positioned block.

## Problem

The current insert flow requires a running Storybook with real components. Users who want to sketch a layout from scratch have nothing to work with until they've built components. A design tool needs generic building blocks available immediately.

## V1 Scope — Two Element Types

The initial goal is to **replace the current Fabric.js canvas drawing** with real DOM elements. People mostly want to draw rectangles and position them — so we start with exactly two primitives:

### 1. Static Block (`div`)
- A plain `<div>` that participates in normal document flow
- Inserted as a sibling/child of the selected element (same as component placement)
- User resizes it after insertion (see [03-resize-handles.md](./03-resize-handles.md))
- Use the Design tab to add flexbox, padding, colors, etc.

### 2. Absolute Block (`div`)
- A `<div>` with `position: absolute` that can be **dragged freely** within its nearest positioned container
- If the parent isn't `position: relative`, we auto-add `relative` to the parent (as a staged patch)
- User drags it around within the container, setting `top-*` / `left-*` Tailwind classes
- Enables the "freeform sketch" pattern: add a big container, drop absolute blocks inside, drag them where you want

### Why Just These Two

These two cover the core sketching patterns:
- **Static block** = "I want a box in the flow here" (layout building)
- **Absolute block** = "I want a box positioned exactly here" (freeform drawing)

The existing Design tab already handles flexbox, grid, spacing, colors, borders, etc. — users can style either element type after placement. This replaces most of what people use the Fabric.js canvas for today.

## Data Shape

```ts
interface Primitive {
  id: string;            // "static-block" | "absolute-block"
  name: string;          // display name
  ghostHtml: string;     // the HTML snippet
  defaultClasses: string; // Tailwind classes applied by default
}
```

Primitives are defined as a static array in the panel — no server round-trip, no Storybook iframe rendering.

## Insertion Flow

1. User is in Insert mode → Place tab is visible
2. Panel shows two sections: **Primitives** (always available) and **Components** (requires Storybook)
3. User clicks a primitive → same `COMPONENT_ARM` message flow, but `ghostHtml` comes from the static primitive definition instead of story extraction
4. Drop-zone crosshair appears → user clicks to place
5. Ghost HTML injected into page DOM (same as component placement)
6. Patch created: `component-drop` with the primitive's ghost HTML

## Thumbnail Rendering

Primitives can use simple CSS-rendered previews (styled divs in the panel) rather than rasterized screenshots. This avoids the Storybook iframe + `html-to-image` pipeline entirely.

## Future: Extended Primitive Library

Once the two core blocks are working, expand the palette incrementally:

| Category | Examples |
|----------|----------|
| Layout containers | flex column, flex row, grid 2-col/3-col, section, card |
| Content blocks | heading, paragraph, image placeholder, divider |
| Form controls | button, input, select, checkbox+label, textarea |

These are just ghost HTML snippets with Tailwind classes — no Storybook story needed. Priority TBD based on user feedback.

## Future: User-Defined Primitives

Allow users to select an element on the page, click "Save as Primitive," and add it to a custom section. Stored as ghost HTML in the server's cache. Out of scope for v1.
