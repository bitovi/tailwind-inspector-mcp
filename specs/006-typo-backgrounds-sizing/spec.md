# Typography, Backgrounds & Sizing — Requirements

## Overview

Category sections rendered below the "Borders & Spacing" box model, enabling users to view, add, edit, and remove Tailwind classes for **Typography**, **Backgrounds**, and **Sizing**. These are the most commonly changed properties after spacing and borders.

See companion HTML prototypes:
- `typography-section.html` — Typography editing UI
- `backgrounds-section.html` — Backgrounds editing UI
- `sizing-section.html` — Sizing editing UI
- `add-remove-ux.html` — Add/remove interaction patterns (4 UX options compared side-by-side)

---

## Design Principles

1. **Show all sections always** — every category renders even if the element has no classes in it
2. **Box model dedup** — classes consumed by Borders & Spacing (margin, padding, border, outline, rounded) are never repeated below
3. **Active classes are highlighted** — existing classes on the element render as orange-tinted chips (current behavior)
4. **Addable properties are discoverable** — unused properties for a section are visible as ghost/placeholder controls
5. **Consistent controls** — scalar values get ScaleScrubber, colors get ColorGrid, enums get dropdown
6. **Removal is easy** — × button on every chip, visible on hover

---

## Section Header Design

Each section uses the same header pattern as the existing category headers in the Picker:

```
● TYPOGRAPHY
```

- Small teal dot (5px rounded, 50% opacity) + uppercase label
- Font: 9px semibold, tracking 1px, `--text-mid` color
- **"+" button** right-aligned in header (see "Adding Classes" section below)

---

## Typography Section

### Properties (most common, Phase 1)

| Property | Prefix(es) | Value Type | Theme Key | UI Control | Scale |
|----------|-----------|------------|-----------|------------|-------|
| Font size | `text-` (size subset) | scalar | `fontSize` | ScaleScrubber | text-xs → text-9xl |
| Font weight | `font-` | scalar | `fontWeight` | ScaleScrubber | font-thin → font-black |
| Text color | `text-` (color subset) | color | `colors` | ColorGrid | Full color palette |
| Text align | `text-left`, `text-center`, etc. | enum | null | Enum dropdown | left, center, right, justify |
| Line height | `leading-` | scalar | `lineHeight` | ScaleScrubber | leading-none → leading-loose |
| Letter spacing | `tracking-` | scalar | `letterSpacing` | ScaleScrubber | tracking-tighter → tracking-widest |

### Display Rules

1. **When element has existing typography classes**: Each recognized class renders as its appropriate control (scrubber for scalar, chip for enum, color swatch for color)
2. **When element has no typography classes**: Section still renders with ghost slots showing available property names (font-size, font-weight, text-color, text-align, line-height, letter-spacing) — all faded/muted
3. **Text prefix disambiguation**: `text-` can mean size, color, or align. The parser already handles this — size gets ScaleScrubber, color gets ColorGrid, align gets enum dropdown.

### Typography Scale Values

**Font size** (themeKey: `fontSize`):
```
text-xs  text-sm  text-base  text-lg  text-xl  text-2xl
text-3xl  text-4xl  text-5xl  text-6xl  text-7xl  text-8xl  text-9xl
```

**Font weight** (themeKey: `fontWeight`):
```
font-thin  font-extralight  font-light  font-normal  font-medium
font-semibold  font-bold  font-extrabold  font-black
```

**Line height** (themeKey: `lineHeight`):
```
leading-none  leading-tight  leading-snug  leading-normal
leading-relaxed  leading-loose
leading-3  leading-4  leading-5  leading-6  leading-7  leading-8  leading-9  leading-10
```

**Letter spacing** (themeKey: `letterSpacing`):
```
tracking-tighter  tracking-tight  tracking-normal
tracking-wide  tracking-wider  tracking-widest
```

**Text align** (enum group):
```
text-left  text-center  text-right  text-justify
```

---

## Backgrounds Section

### Properties (most common, Phase 1)

| Property | Prefix | Value Type | Theme Key | UI Control | Scale |
|----------|--------|------------|-----------|------------|-------|
| Background color | `bg-` (color subset) | color | `colors` | ColorGrid | Full color palette |
| Background opacity | `bg-opacity-` | scalar | `opacity` | ScaleScrubber | 0, 5, 10, 15, ... 95, 100 |

### Display Rules

1. **bg-color** renders as a color swatch chip showing the current color — clicking opens the full ColorGrid
2. **bg-opacity** renders as a ScaleScrubber with 0–100 scale
3. When empty, ghost slots show "bg-color" and "bg-opacity" as addable items

### Note on Tailwind v4

Tailwind v4 prefers the opacity modifier syntax (`bg-red-500/50`) over the separate `bg-opacity-*` class. For Phase 1, we support the `bg-opacity-*` class form. Modifier syntax support is deferred.

---

## Sizing Section

### Properties (most common, Phase 1)

| Property | Prefix | Value Type | Theme Key | UI Control | Scale |
|----------|--------|------------|-----------|------------|-------|
| Width | `w-` | scalar | `spacing` | ScaleScrubber | Spacing scale (0–96 + auto, full, screen, etc.) |
| Height | `h-` | scalar | `spacing` | ScaleScrubber | Same |
| Min width | `min-w-` | scalar | `spacing` | ScaleScrubber | Same |
| Max width | `max-w-` | scalar | `spacing` | ScaleScrubber | Same |
| Min height | `min-h-` | scalar | `spacing` | ScaleScrubber | Same |
| Max height | `max-h-` | scalar | `spacing` | ScaleScrubber | Same |
| Size | `size-` | scalar | `spacing` | ScaleScrubber | Same (sets w + h simultaneously) |

### Display Rules

1. All sizing properties use ScaleScrubber with the spacing scale
2. When empty, ghost slots show property names (w, h, min-w, max-w, min-h, max-h, size)
3. `size-` is a shorthand for width+height — if `size-*` is set, `w-*` and `h-*` ghost slots should indicate this

---

## Adding Classes

### Interaction: "+" Button per Section

Each section header has a small `+` button, right-aligned:

```
● TYPOGRAPHY                                    [+]
```

**Clicking `+`** opens a dropdown of available (not yet set) properties for that section:
- Each item shows the property name and prefix (e.g., "Font weight — font-*")
- Selecting an item adds a **ghost ScaleScrubber/ColorGrid/enum** for that property, initialized to no value
- The user then scrubs/picks a value to set the class
- If dismissed without picking a value, the ghost control disappears

### Alternative: Ghost Slots Always Visible

Instead of (or in addition to) the `+` button, unused properties appear as **ghost chips** below the active ones:
- Rendered in `--text-muted` color with dashed border
- Clicking a ghost chip opens the appropriate editor (scrubber/color grid/dropdown)
- Once a value is set, the ghost chip promotes to an active chip

See `add-remove-ux.html` for visual comparison of both approaches.

---

## Removing Classes

Every active chip/scrubber gets a **× button** visible on hover:

```
┌───────────────────┐
│  text-lg        × │   ← × appears on hover
└───────────────────┘
```

- The × is positioned at the right edge of the chip
- Clicking × sends `CLASS_COMMIT` with `oldClass: <current>, newClass: ''`
- The overlay removes the class from the element
- The chip reverts to a ghost slot (if ghost slots are shown) or disappears (if using `+` button approach)

---

## Enum Editing

Enum properties (text-align, font-style, text-decoration, text-transform, display, position, etc.) use a **dropdown** instead of a scrubber.

### Interaction

1. Click the enum chip (e.g., `text-center`)
2. A dropdown appears below/above with all valid alternatives
3. **Hover** an alternative → `CLASS_PREVIEW` sent to overlay (live preview on page)
4. **Click** an alternative → `CLASS_COMMIT` sent (value locked)
5. **Click away** or **Escape** → dropdown closes, reverts to original value

### Enum Groups

| Group | Values |
|-------|--------|
| Display | `block`, `inline-block`, `inline`, `flex`, `inline-flex`, `grid`, `inline-grid`, `table`, `hidden`, `contents` |
| Position | `static`, `fixed`, `absolute`, `relative`, `sticky` |
| Text align | `text-left`, `text-center`, `text-right`, `text-justify` |
| Font style | `italic`, `not-italic` |
| Text decoration | `underline`, `overline`, `line-through`, `no-underline` |
| Text transform | `uppercase`, `lowercase`, `capitalize`, `normal-case` |
| Overflow | `overflow-auto`, `overflow-hidden`, `overflow-visible`, `overflow-scroll` |

---

## Box Model Deduplication

Classes consumed by the Borders & Spacing box model are **excluded** from category sections:

### Excluded prefixes (all directional variants):
- **Margin**: `m-`, `mx-`, `my-`, `mt-`, `mr-`, `mb-`, `ml-`, `ms-`, `me-`
- **Padding**: `p-`, `px-`, `py-`, `pt-`, `pr-`, `pb-`, `pl-`, `ps-`, `pe-`
- **Border width**: `border-`, `border-x-`, `border-y-`, `border-t-`, `border-r-`, `border-b-`, `border-l-`
- **Border color**: `border-<color>` classes
- **Border style**: `border-solid`, `border-dashed`, etc.
- **Outline**: `outline-`, `outline-offset-`
- **Border radius**: `rounded-`, `rounded-t-`, `rounded-r-`, `rounded-b-`, `rounded-l-`, `rounded-tl-`, `rounded-tr-`, `rounded-br-`, `rounded-bl-`

### Implementation
In `Picker.tsx`, after `groupByCategory()`, filter each group to remove classes whose prefix matches any box-model prefix. Build a `BOX_MODEL_PREFIXES` set from `LAYER_PREFIXES` in `layerUtils.ts` plus all `rounded-*` prefixes.

---

## Data Flow

### Editing an existing class
1. User hovers ScaleScrubber → `onHover(newClass)` → `CLASS_PREVIEW` sent to overlay
2. User clicks → `CLASS_COMMIT` sent → overlay updates DOM + server queues for AI agent
3. Chip updates to reflect new value

### Adding a new class
1. User clicks `+` or ghost slot → editor appears (scrubber/color grid/dropdown)
2. User interacts → `CLASS_PREVIEW` sent with `oldClass: ''` (empty = add, not replace)
3. User commits → `CLASS_COMMIT` with `oldClass: '', newClass: <chosen>`
4. Overlay adds class to element's classList

### Removing a class
1. User clicks × on chip → `CLASS_COMMIT` with `oldClass: <current>, newClass: ''`
2. Overlay removes class from element's classList
3. Chip reverts to ghost or disappears

---

## Relevant Files

| File | Purpose |
|------|---------|
| `panel/src/Picker.tsx` | Render loop — add dedup filter, always-show sections, removal ×, enum dropdown |
| `overlay/src/class-parser.ts` | `PREFIX_MAP` — verify all typography/bg/sizing prefixes are covered |
| `panel/src/components/getScaleValues.ts` | Add `lineHeight`, `letterSpacing`, `opacity` theme key lookups |
| `panel/src/components/ScaleScrubber/ScaleScrubber.tsx` | Add "no initial value" state for newly added classes |
| `panel/src/components/ColorGrid.tsx` | Used for text-color and bg-color editing |
| `panel/src/components/BoxModel/layerUtils.ts` | `LAYER_PREFIXES` — source for dedup exclusion list |
| `overlay/src/patcher.ts` | Handle empty `newClass` (removal) and empty `oldClass` (addition) |

---

## Verification

1. Select element with `text-lg font-bold text-red-500 text-center leading-relaxed tracking-wide` → Typography section shows all 6 with correct controls
2. Select element with `bg-blue-500 bg-opacity-75` → Backgrounds shows color swatch + opacity scrubber
3. Select element with `w-64 h-32` → Sizing shows width and height scrubbers; other sizing slots shown as ghosts
4. Select element with `p-4 m-2 rounded-lg text-lg` → box model shows p/m/rounded, Typography shows text-lg only (no duplication)
5. Select element with no classes → all sections render with ghost slots
6. Click × on `text-lg` → class removed, ghost slot appears
7. Click ghost `font-weight` → scrubber appears → scrub to `font-bold` → class added
8. Click `text-center` enum → dropdown shows left/center/right/justify → hover previews live → click commits

---

## Phase 2 Expansion (future)

After Phase 1 ships, expand each section and add new sections:

### Typography additions
- `font-family` (font-sans, font-serif, font-mono)
- `text-decoration` (underline, line-through, no-underline)
- `text-transform` (uppercase, lowercase, capitalize)
- `whitespace` (whitespace-normal, whitespace-nowrap, etc.)
- `word-break`, `line-clamp`, `text-indent`, `list-style`

### Backgrounds additions
- `bg-gradient` (bg-gradient-to-r + from/via/to stops)
- `bg-image`, `bg-size`, `bg-position`, `bg-repeat`
- `bg-clip`, `bg-origin`, `bg-attachment`

### New sections
- **Layout** — display, position, z-index, overflow, visibility, float
- **Flexbox & Grid** — flex-direction, justify, align, gap, grid-cols/rows
- **Effects** — shadow, opacity, mix-blend-mode
- **Transforms** — scale, rotate, translate, skew
- **Transitions** — transition, duration, delay, ease, animate

---

## Further Considerations

1. **Tailwind v4 opacity modifier syntax** (`bg-red-500/50`) — parser doesn't handle slash-modifiers yet. Defer or add alongside `bg-opacity-*`?
2. **Variant-prefixed classes** (sm:, hover:, dark:) — currently skipped by parser. Show as read-only? Or enable adding variants?
3. **Arbitrary values** (w-[350px]) — not parsed. Show as plain read-only chips? Enable adding via type-to-search?
4. **Large category subdivision** — Layout has ~15 sub-properties. Should we group display/position/overflow as sub-sections?
