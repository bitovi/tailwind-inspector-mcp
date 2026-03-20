# Shadows & Rings Editor — Requirements

## Overview

A visual editor section for Tailwind v4's four box-shadow layer types: **shadow**, **inset-shadow**, **ring**, and **inset-ring**. Each type supports size/width, color, and opacity — and all four compose into a single CSS `box-shadow` declaration. The UI groups them into a compact section with a live-preview square, per-layer controls, and add/remove capabilities.

See companion HTML prototype:
- `shadow-editor.html` — Full dark-themed interactive prototype with all states

---

## Design Philosophy

1. **Play, not build** — Assume classes already exist. The UI reads what's on the element and lets the user fine-tune size, color, and opacity. Adding new layers via `[+]` is secondary.
2. **Live preview always** — Every hover/scrub sends `PATCH_PREVIEW` to the overlay so the user sees the result on the real page in real time.
3. **Four layers, one section** — Shadow, inset-shadow, ring, and inset-ring all render under one "Shadows & Rings" section header, because they're all `box-shadow` layers in CSS.
4. **Compound classes, single row** — A shadow's size (e.g. `shadow-lg`) and color (e.g. `shadow-blue-500/50`) are separate Tailwind classes, but the UI groups them into one visual row.

---

## Tailwind v4 Class Vocabulary

### Shadow (outer drop shadow)

| Purpose | Classes | Notes |
|---------|---------|-------|
| **Size** | `shadow-2xs` `shadow-xs` `shadow-sm` `shadow-md` `shadow-lg` `shadow-xl` `shadow-2xl` | Keyword scale, not numeric |
| **Color** | `shadow-{color}` e.g. `shadow-blue-500` | From theme colors palette |
| **Opacity** | `shadow-xl/20` or `shadow-blue-500/50` | Modifier on size or color class |
| **Remove** | `shadow-none` | Explicit reset — different from removing the class |

### Inset Shadow

| Purpose | Classes | Notes |
|---------|---------|-------|
| **Size** | `inset-shadow-2xs` `inset-shadow-xs` `inset-shadow-sm` | Smaller scale than outer shadow |
| **Color** | `inset-shadow-{color}` e.g. `inset-shadow-indigo-500` | From theme colors palette |
| **Opacity** | `inset-shadow-sm/50` or `inset-shadow-indigo-500/50` | Modifier on size or color |
| **Remove** | `inset-shadow-none` | Explicit reset |

### Ring (solid outline via box-shadow)

| Purpose | Classes | Notes |
|---------|---------|-------|
| **Width** | `ring` `ring-0` `ring-1` `ring-2` `ring-4` `ring-8` | Numeric scale (px) |
| **Color** | `ring-{color}` e.g. `ring-blue-500` | From theme colors palette |
| **Opacity** | `ring-blue-500/50` | Modifier on color class |
| **Remove** | `ring-0` | Width zero = no ring |

### Inset Ring (solid outline inset via box-shadow)

| Purpose | Classes | Notes |
|---------|---------|-------|
| **Width** | `inset-ring` `inset-ring-0` `inset-ring-1` `inset-ring-2` `inset-ring-4` `inset-ring-8` | Numeric scale (px) |
| **Color** | `inset-ring-{color}` e.g. `inset-ring-blue-500` | From theme colors palette |
| **Opacity** | `inset-ring-blue-500/50` | Modifier on color class |
| **Remove** | `inset-ring-0` | Width zero = no inset ring |

### Key Distinctions

- **`shadow-none` vs removing `shadow-*` classes**: `shadow-none` explicitly sets `box-shadow: 0 0 #0000`, overriding any inherited shadows. Removing the class just removes the declaration, allowing inherited shadows to show through.
- **`ring-0` vs removing `ring-*` classes**: Same distinction — `ring-0` explicitly zeroes out the ring width.
- **`ring-{color}` disambiguation**: `ring-blue-500` is a color, `ring-2` is a width. The parser must disambiguate by checking if the value is a known color name or a number.

---

## Current State & Gaps

### Parser (propertyRules.ts)

| Current Entry | Problem |
|---------------|---------|
| `'shadow-': { category: 'effects', themeKey: null, valueType: 'enum' }` | Treats all shadow-* as a single enum. No color support, no opacity support, no size/color split. |
| `'ring-': { category: 'color', themeKey: 'colors', valueType: 'color' }` | Only sees ring as a color. Misses ring width classes (`ring`, `ring-2`, `ring-4`). |
| No `inset-shadow-` entry | Completely unhandled — falls through to `inset-` (layout positioning) |
| No `inset-ring-` entry | Completely unhandled |

### Parser Changes Needed

1. **Add `inset-shadow-` prefix** — category: `effects`, needs size/color disambiguation
2. **Add `inset-ring-` prefix** — category: `effects`, needs width/color disambiguation
3. **Disambiguate `shadow-`** — Like `text-` disambiguation: `shadow-lg` = size (enum), `shadow-blue-500` = color, `shadow-none` = enum
4. **Disambiguate `ring-`** — `ring-2` = width (scalar), `ring-blue-500` = color, `ring-0` = width
5. **Handle opacity modifiers** — `/50` suffix on shadow and ring colors
6. **Make all four a composite group** — One `ShadowEditor` composite renders all shadow/ring layers together
7. **Add exact matches** — `ring` (shorthand, 1px), `inset-ring` (shorthand, 1px)

### Proposed propertyRules Changes

```typescript
// Shadow — composite group leader
'shadow-': {
  category: 'effects',
  themeKey: null,
  valueType: 'enum',  // parser will disambiguate size vs color
  renderMode: 'shadow-editor',
  isComposite: true,
  compositeRelatedPrefixes: [
    'shadow-', 'inset-shadow-', 'ring-', 'inset-ring-',
  ],
  compositeExactMatches: ['ring', 'inset-ring'],
},

// Inset shadow
'inset-shadow-': {
  category: 'effects',
  themeKey: null,
  valueType: 'enum',  // parser disambiguates
},

// Ring (exact match for bare `ring` = 1px)
'ring': {
  category: 'effects',
  themeKey: null,
  valueType: 'enum',
},

// Ring with value
'ring-': {
  category: 'effects',
  themeKey: null,
  valueType: 'enum',  // parser disambiguates width vs color
},

// Inset ring (exact match for bare `inset-ring` = 1px)
'inset-ring': {
  category: 'effects',
  themeKey: null,
  valueType: 'enum',
},

// Inset ring with value
'inset-ring-': {
  category: 'effects',
  themeKey: null,
  valueType: 'enum',  // parser disambiguates width vs color
},
```

### Disambiguation Logic (in class-parser.ts)

Similar to the existing `text-` disambiguation:

```typescript
// shadow-* → size keyword OR color
function disambiguateShadow(value: string): { valueType: ValueType; themeKey: string | null } {
  const SHADOW_SIZES = ['2xs','xs','sm','md','lg','xl','2xl','none'];
  if (SHADOW_SIZES.includes(value)) return { valueType: 'enum', themeKey: null };
  return { valueType: 'color', themeKey: 'colors' };
}

// inset-shadow-* → size keyword OR color
function disambiguateInsetShadow(value: string): { valueType: ValueType; themeKey: string | null } {
  const INSET_SHADOW_SIZES = ['2xs','xs','sm','none'];
  if (INSET_SHADOW_SIZES.includes(value)) return { valueType: 'enum', themeKey: null };
  return { valueType: 'color', themeKey: 'colors' };
}

// ring-* → width number OR color
function disambiguateRing(value: string): { valueType: ValueType; themeKey: string | null } {
  const RING_WIDTHS = ['0','1','2','4','8'];
  if (RING_WIDTHS.includes(value)) return { valueType: 'scalar', themeKey: null };
  return { valueType: 'color', themeKey: 'colors' };
}

// inset-ring-* → same as ring
function disambiguateInsetRing(value: string) { return disambiguateRing(value); }
```

---

## UI Design

### Section Header

```
● SHADOWS & RINGS                                    [+]
```

Same pattern as other sections: teal dot + uppercase label + add button.

### Layer Rows

Each active layer renders as a compact row with controls and an inline preview:

```
┌────────────────────────────────────────────────────┐
│  SHADOW                                            │
│  ┌─────────────┐  ┌──┐  ┌──────────┐  ┌─┐  ×  │
│  │ ◂ lg ▸      │  │■ │  │ ◂ 50% ▸  │  │ │     │
│  └─────────────┘  └──┘  └──────────┘  └─┘     │
│  size         color  opacity     preview     │
│                                                    │
│  RING                                              │
│  ┌─────────────┐  ┌──┐  ┌──────────┐  ┌─┐  ×  │
│  │ ◂ 2 ▸       │  │■ │  │ ◂ 100% ▸ │  │ │     │
│  └─────────────┘  └──┘  └──────────┘  └─┘     │
└────────────────────────────────────────────────────┘
```

**Four control zones per row:**

1. **Size/Width scrubber** — ScaleScrubber showing the keyword size (shadow: `2xs`→`2xl`) or numeric width (ring: `0`→`8`). Includes `none`/`0` at the start. Hover previews live.

2. **Color swatch** — Small colored square showing the current shadow/ring color. Click to expand a ColorGrid below the row. Defaults to "current" (inherit) if no color class is set.

3. **Opacity scrubber** — ScaleScrubber from 0% to 100% in steps of 5 or 10. Only enabled when a color is explicitly set (since default shadows use their own built-in opacity). Hover previews live.

4. **Inline preview square** — A small (26×26px) square showing only this layer's individual box-shadow contribution. Lets the user see each layer's effect in isolation. The combined result is visible on the actual page element via live preview.

5. **Remove button (×)** — Removes the entire layer (all related classes for that layer type). Visible on row hover.

No raw class tags are shown below the controls — the controls already provide full editing capability over the underlying classTokens, and showing them would be redundant noise. The combined effect of all layers is always visible on the real page element via live preview.

### Row Labels & Sub-headers

Small mono labels above each row identify the layer type:

| Label | Layer |
|-------|-------|
| `SHADOW` | Outer shadow (`shadow-*`) |
| `INSET SHADOW` | Inset shadow (`inset-shadow-*`) |
| `RING` | Outer ring (`ring-*`) |
| `INSET RING` | Inset ring (`inset-ring-*`) |

### Ghost Rows (Addable Layers)

When a layer type is not present on the element, it renders as a ghost row — a single faded line showing the layer name with a `[+]` to add it:

```
┌────────────────────────────────────────────────────┐
│  SHADOW                                            │
│  ┌─────────────┐  ┌──┐  ┌────────────────┐   ×   │
│  │ ◂ lg ▸      │  │■ │  │  ◂ 100% ▸      │       │
│  └─────────────┘  └──┘  └────────────────┘        │
│                                                    │
│  ┄ inset shadow ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  [+]      │
│  ┄ ring ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  [+]      │
│  ┄ inset ring ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  [+]      │
└────────────────────────────────────────────────────┘
```

Clicking `[+]` on a ghost row adds a sensible default:
- Shadow → `shadow-md`
- Inset shadow → `inset-shadow-sm`
- Ring → `ring-2`
- Inset ring → `inset-ring-2`

### Color Grid Expansion

When the user clicks a color swatch, the ColorGrid expands inline below that row (same pattern as existing ColorGrid in Backgrounds). The grid uses the full Tailwind color palette. Hovering a color previews it live via `PATCH_PREVIEW`.

The opacity modifier is attached to the color class: `shadow-blue-500/50`. When no explicit color is set, the opacity scrubber is disabled (the built-in shadow opacity is baked into the shadow size definitions).

### "None" vs "Remove" UX

Two distinct actions need clear affordances:

1. **Set to none** — Available in the size scrubber scale: the first option is `none` (for shadow/inset-shadow) or `0` (for ring/inset-ring). This adds `shadow-none`, `inset-shadow-none`, `ring-0`, or `inset-ring-0` to the class list. Useful for overriding inherited shadows.

2. **Remove layer (×)** — The × button removes all classes for that layer type from the element entirely. This is different from "none" because it doesn't add an override — it just removes the declarations.

Visual distinction:
- When set to `none`/`0`, the row stays visible with the size scrubber showing "none"/"0", but color and opacity controls are dimmed/disabled.
- When removed via ×, the row disappears and becomes a ghost row with `[+]`.

---

## Data Model

### Shadow Layer State

Each of the 4 layer types has the same shape:

```typescript
interface ShadowLayerState {
  type: 'shadow' | 'inset-shadow' | 'ring' | 'inset-ring';
  sizeClass: string | null;      // e.g. "shadow-lg", "ring-2", null
  colorClass: string | null;     // e.g. "shadow-blue-500", "ring-red-600", null
  opacity: number | null;        // e.g. 50 (from /50 modifier), null if no modifier
  isNone: boolean;               // true if shadow-none, inset-shadow-none, ring-0, inset-ring-0
}
```

### Parsing Existing Classes → Layer States

When an element is selected, the parser must:

1. Collect all shadow-related classes from the element
2. Group them by layer type (shadow, inset-shadow, ring, inset-ring)
3. Within each group, separate size/width from color
4. Extract opacity modifiers

Example: `shadow-lg shadow-blue-500/50 ring-2 ring-red-600` →

```typescript
[
  { type: 'shadow', sizeClass: 'shadow-lg', colorClass: 'shadow-blue-500', opacity: 50, isNone: false },
  { type: 'ring', sizeClass: 'ring-2', colorClass: 'ring-red-600', opacity: null, isNone: false },
]
```

### Patch Generation

Each control change generates a patch for the specific class being modified:

| User Action | Patch |
|-------------|-------|
| Scrub shadow size from `lg` to `xl` | Replace `shadow-lg` → `shadow-xl` |
| Pick shadow color `blue-500` | Add `shadow-blue-500` (or replace existing shadow color) |
| Scrub opacity from 100% to 50% | Modify color class: `shadow-blue-500` → `shadow-blue-500/50` |
| Click × on shadow row | Remove `shadow-lg` and `shadow-blue-500/50` |
| Click none in size scrubber | Replace `shadow-lg` → `shadow-none`, remove color class |
| Click [+] on ghost ring row | Add `ring-2` |

---

## Size/Width Scales

### Shadow Sizes (keyword scale)

```
none → 2xs → xs → sm → md → lg → xl → 2xl
```

The scrubber presents these as an ordered list. "none" is at the start (explicit reset). Scrubbing left from `2xs` wraps to `none`.

### Inset Shadow Sizes

```
none → 2xs → xs → sm
```

Smaller scale than outer shadow.

### Ring Widths (numeric)

```
0 → 1 → 2 → 4 → 8
```

Plus the bare `ring` shorthand (= 1px). The scrubber treats this as a numeric scale.

### Inset Ring Widths

```
0 → 1 → 2 → 4 → 8
```

Same as ring. Plus bare `inset-ring` shorthand (= 1px).

---

## Interaction Patterns

### Hover Preview

All controls follow the standard preview pattern:
- **Hover/scrub** → `PATCH_PREVIEW` → overlay previews the change live
- **Leave** → `PATCH_REVERT` → overlay reverts to original
- **Click/commit** → `PATCH_STAGE` → change is staged

### Color + Opacity Coupling

When the user changes a shadow color, the opacity modifier (if any) transfers to the new color class:
- Current: `shadow-blue-500/50`, user picks `red-600` → result: `shadow-red-600/50`
- Current: `shadow-blue-500` (no opacity), user picks `red-600` → result: `shadow-red-600`

When the user changes opacity, only the modifier changes:
- Current: `shadow-blue-500/50`, user scrubs to 75% → result: `shadow-blue-500/75`

### "None" Behavior

When the user selects `none` (shadow/inset-shadow) or `0` (ring/inset-ring):
1. The size class changes to `shadow-none` / `inset-shadow-none` / `ring-0` / `inset-ring-0`
2. Any color class for that layer is removed (color is meaningless when shadow is none)
3. The color swatch and opacity scrubber become disabled/dimmed
4. The layer row remains visible (not a ghost row) because the `*-none`/`*-0` class is actively on the element

### Remove Behavior

When the user clicks ×:
1. All classes for that layer type are removed from the element
2. The row becomes a ghost row with [+]
3. Live preview shows the element without that shadow layer

---

## Component Architecture

### New Composite: `ShadowEditor`

A new composite component analogous to `GradientEditor`:

```
panel/src/components/ShadowEditor/
  index.ts
  ShadowEditor.tsx        ← Main composite component
  ShadowEditor.test.tsx
  ShadowEditor.stories.tsx
  ShadowLayerRow.tsx       ← Single layer row (size + color + opacity + preview)
  types.ts                 ← ShadowLayerState, etc.
```

### Picker.tsx Integration

- Add `'shadow-editor'` to the `RenderMode` union
- The `isCompositeConsumed()` function identifies shadow/ring classes as consumed by ShadowEditor
- `ShadowEditor` renders in the "Effects" section (or a new "Shadows & Rings" section below Effects)

### Section Ordering

```typescript
const ALL_SECTIONS = [
  'borders',        // BoxModel + CornerModel
  'sizing',         // Width, height, etc.
  'typography',     // Font, text, leading, tracking
  'color',          // Backgrounds + gradient
  'shadows',        // NEW: Shadow, inset-shadow, ring, inset-ring
  'flexbox',        // Flex direction, justify, align
  'effects',        // Opacity (shadow moved out)
  'layout',         // Display, position, z-index
];
```

---

## Implementation Phases

### Phase 1: Parser + Basic Controls

1. Add `inset-shadow-`, `inset-ring-`, `ring` (exact), `inset-ring` (exact) to `propertyRules.ts`
2. Add disambiguation logic for `shadow-`, `ring-`, `inset-shadow-`, `inset-ring-` in `class-parser.ts`
3. Create `ShadowEditor` composite component
4. Wire up `ShadowLayerRow` with size ScaleScrubber (enum values)
5. Preview square with actual CSS box-shadow

### Phase 2: Color + Opacity

1. Add color swatch with expandable ColorGrid per layer row
2. Wire up color preview: hover color → `PATCH_PREVIEW` with `shadow-{color}`
3. Add opacity scrubber (0–100% in steps of 5)
4. Handle opacity modifier on color classes (`/50` syntax)
5. Color + opacity coupling (transfer modifier when color changes)

### Phase 3: None/Remove + Ghost Rows

1. "None"/"0" in size scrubber with proper class management (remove color when none)
2. × remove button with full layer class cleanup
3. Ghost rows for absent layers with [+] to add defaults
4. Disabled state for color/opacity when layer is "none"

### Phase 4: Polish

1. Preview square animation (smooth transitions on hover)
2. Storybook stories for all states
3. Keyboard accessibility (arrow keys in scrubbers, Escape to close ColorGrid)
4. E2E tests

---

## Ring/Shadow Prefix Disambiguation: Detailed Rules

The `ring-` and `shadow-` prefixes currently lack disambiguation. Here's the precise logic, modeled on the existing `text-` disambiguation:

### `shadow-{value}` disambiguation

```
INPUT: "shadow-blue-500/50"
1. Strip opacity: value = "blue-500", opacity = 50
2. Is value in SHADOW_SIZES? No.
3. Is value a known color? Yes → { valueType: 'color', themeKey: 'colors' }

INPUT: "shadow-lg"
1. No opacity modifier.
2. Is value "lg" in SHADOW_SIZES? Yes → { valueType: 'enum', themeKey: null }

INPUT: "shadow-none"
1. Is value "none" in SHADOW_SIZES? Yes → { valueType: 'enum', themeKey: null }
```

### `ring-{value}` disambiguation

```
INPUT: "ring-blue-500"
1. Is value "blue-500" in RING_WIDTHS? No.
2. Is value a known color? Yes → { valueType: 'color', themeKey: 'colors' }

INPUT: "ring-2"
1. Is value "2" in RING_WIDTHS? Yes → { valueType: 'scalar', themeKey: null }

INPUT: "ring-0"
1. Is value "0" in RING_WIDTHS? Yes → { valueType: 'scalar', themeKey: null }
```

Same logic applies for `inset-shadow-` and `inset-ring-`.

---

## Accessibility

- Size scrubber: Left/Right arrows step through the scale
- Color grid: Arrow key navigation through the palette
- Opacity scrubber: Left/Right arrows step in 5% increments
- × button: focusable, activates on Enter/Space
- [+] button: focusable, adds default layer on Enter/Space
- Layer rows: Tab order flows through size → color → opacity → × per row
- Screen reader: layer type label announced before controls
