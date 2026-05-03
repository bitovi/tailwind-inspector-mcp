# 053 — Flex Item Controls

## Summary

Add dedicated controls for flex **item** (child) properties in the Flexbox section of the Design tab. Today the panel has rich diagram-based controls for flex **container** properties (direction, wrap, justify, align, gap) but flex item classes (`flex-1`, `self-center`, `grow`, `basis-*`, `order-*`) render as plain chips with no grouped UI. This spec adds a composite "Flex Item" control block that appears when the selected element lives inside a flex container.

## Motivation

When a user selects a child element inside a flex container, the most common edits are:

1. **How does this item grow/shrink?** — `flex-1`, `flex-auto`, `flex-initial`, `flex-none`
2. **Should it override the parent's alignment?** — `self-auto`, `self-start`, `self-center`, etc.
3. **What's its ideal size?** — `basis-0`, `basis-auto`, `basis-1/2`, `basis-{size}`
4. **Fine-tune grow/shrink independently** — `grow`, `grow-0`, `shrink`, `shrink-0`
5. **Reorder it** — `order-1` through `order-12`, `order-first`, `order-last`, `order-none`

Currently these render as scattered enum/scalar chips. A grouped visual control (like the flex container block) makes them discoverable, understandable, and faster to edit.

## Tailwind Classes Covered

### Flex Shorthand (`flex` property)
| Class | CSS | Description |
|-------|-----|-------------|
| `flex-1` | `flex: 1 1 0%` | Grow and shrink, ignoring initial size |
| `flex-auto` | `flex: 1 1 auto` | Grow and shrink, considering initial size |
| `flex-initial` | `flex: 0 1 auto` | Shrink but don't grow |
| `flex-none` | `flex: none` | Don't grow or shrink |

### Flex Grow (`flex-grow` property)
| Class | CSS |
|-------|-----|
| `grow` | `flex-grow: 1` |
| `grow-0` | `flex-grow: 0` |

### Flex Shrink (`flex-shrink` property)
| Class | CSS |
|-------|-----|
| `shrink` | `flex-shrink: 1` |
| `shrink-0` | `flex-shrink: 0` |

### Flex Basis (`flex-basis` property)
| Class | CSS |
|-------|-----|
| `basis-0` | `flex-basis: 0px` |
| `basis-auto` | `flex-basis: auto` |
| `basis-full` | `flex-basis: 100%` |
| `basis-{size}` | `flex-basis: {size}` — uses spacing scale |
| `basis-1/2`, `basis-1/3`, etc. | Fractional widths |

### Align Self (`align-self` property)
| Class | CSS |
|-------|-----|
| `self-auto` | `align-self: auto` |
| `self-start` | `align-self: flex-start` |
| `self-end` | `align-self: flex-end` |
| `self-center` | `align-self: center` |
| `self-stretch` | `align-self: stretch` |
| `self-baseline` | `align-self: baseline` |

### Order (`order` property)
| Class | CSS |
|-------|-----|
| `order-first` | `order: -9999` |
| `order-last` | `order: 9999` |
| `order-none` | `order: 0` |
| `order-1` … `order-12` | `order: 1` … `order: 12` |

---

## Detection: `isFlexChild`

**When to show the flex item controls:**

The panel should detect `isFlexChild` when the selected element's **parent** is a flex container. The overlay already sends parent class info via `ELEMENT_SELECTED`. Detection logic:

```
isFlexChild = true when:
  1. Parent element has display: flex or inline-flex (class or computed)
  2. OR the selected element already has flex-item classes
     (flex-1, flex-auto, self-*, basis-*, grow, shrink, order-*)
  3. OR pending/staged flex-item properties exist
```

This mirrors the existing `isFlexParent` pattern but checks the parent's context instead.

---

## UI Design

### Layout in the Flexbox Section

When `isFlexChild` is true, a **Flex Item** block renders in the flexbox section. If the element is ALSO a flex parent (nested flex), both blocks appear — container controls first, then item controls separated by a divider.

```
┌─────────────────────────────────────────┐
│ ● FLEXBOX & GRID                    [+] │
│─────────────────────────────────────────│
│                                         │
│  ┌── Flex Container (if isFlexParent) ──┤
│  │ [Dir] [Wrap] [Justify] [Align]       │
│  │ ─────────────────────────────        │
│  │ [  GapModel  ]                       │
│  └──────────────────────────────────────│
│  ─── divider ───                        │
│  ┌── Flex Item (if isFlexChild) ────────┤
│  │                                      │
│  │  FLEX          ALIGN SELF            │
│  │  ┌──┐┌──┐     ┌──────────────┐      │
│  │  │ 1││au│     │ Align Self   │      │
│  │  └──┘└──┘     │  Diagram     │      │
│  │  ┌──┐┌──┐     │  Picker      │      │
│  │  │in││no│     └──────────────┘      │
│  │  └──┘└──┘                            │
│  │  ─────────────────────               │
│  │  GROW/SHRINK                         │
│  │  ┌────────┐ ┌──────────┐             │
│  │  │grow  ▾ │ │shrink  ▾ │             │
│  │  └────────┘ └──────────┘             │
│  │  ─────────────────────               │
│  │  BASIS         ORDER                 │
│  │  ┌──────────┐ ┌──────────┐           │
│  │  │basis  ⇔  │ │order  ▾  │           │
│  │  └──────────┘ └──────────┘           │
│  └──────────────────────────────────────│
│                                         │
│  [other flexbox chips…]                 │
└─────────────────────────────────────────┘
```

### Control Details

#### 1. Flex Shorthand — 2×2 Button Grid (enum selector)

Four buttons in a 2×2 grid, styled like the existing `FlexDirectionSelect` / `FlexWrapSelect` 60×60 diagram boxes but smaller (48×32 each). Each shows a mini visual metaphor:

| Button | Visual | Description |
|--------|--------|-------------|
| `flex-1` | Three equal bars filling the container | "Fill equally" |
| `flex-auto` | Bars sized by content, stretching to fill | "Auto-fill" |
| `flex-initial` | Bars sized by content, space at end | "Content-sized" |
| `flex-none` | Fixed bars, no grow/shrink | "Rigid" |

- Hover → preview on the element
- Click → stage the class
- Active state: teal border + teal dim background (matches existing diagram selects)
- The 2×2 grid keeps it compact; these are mutually exclusive values

#### 2. Align Self — Diagram Picker (reuse `FlexDiagramPicker`)

Reuses the same diagram approach as `FlexAlignSelect` but shows the **single item highlighted** against siblings:

| Option | Visual |
|--------|--------|
| `self-auto` | Item follows parent's align-items (dimmed, no override indicator) |
| `self-start` | Highlighted item pinned to cross-axis start |
| `self-end` | Highlighted item pinned to cross-axis end |
| `self-center` | Highlighted item centered on cross axis |
| `self-stretch` | Highlighted item stretches full cross axis |
| `self-baseline` | Highlighted item aligned to text baseline |

The trigger is a 60×60 diagram box (matching the existing flex controls' size). The dropdown is a grid of 6 diagram cells. The diagrams should rotate based on the parent's flex direction (like `FlexJustifySelect` already does).

#### 3. Grow / Shrink — Toggle Chips

Simple two-state toggles, rendered as a pair of compact chip-style controls:

- **Grow**: `grow` (on) / `grow-0` (off) — toggle between them
- **Shrink**: `shrink` (on) / `shrink-0` (off)

Styled as existing enum chips with the on/off states. These are secondary controls (the flex shorthand above covers the common cases), so they're presented below with a smaller visual weight.

#### 4. Basis — ScaleScrubber

Uses the existing `ScaleScrubber` component since `basis-*` maps to the spacing theme scale (`themeKey: 'spacing'`). Drag to scrub through spacing values, dropdown for the full list including fractional values like `basis-1/2`, `basis-1/3`, etc.

The scrubber shows: `basis-auto` / `basis-0` / `basis-4` / `basis-full` / `basis-1/2` etc.

#### 5. Order — ScaleScrubber or Dropdown

Order uses numeric values (`order-1` through `order-12`) plus named values (`order-first`, `order-last`, `order-none`). A small dropdown/scrubber control works here:

- Named values at the top: `first`, `last`, `none`
- Numeric values: `1` through `12`
- Scrub through numeric range, or click to open dropdown

---

## Control Group: `flex-item`

### propertyRules.ts Changes

Add `controlGroup: 'flex-item'`, `propertyKey`, and `enumAlts` to the flex item entries so the Picker can group them like it does for `flex-container`:

```typescript
// Flex shorthand
'flex-1':       { category: 'flexbox', themeKey: null, valueType: 'enum', addable: true,
                  controlGroup: 'flex-item', propertyKey: 'flex',
                  enumAlts: ['flex-1', 'flex-auto', 'flex-initial', 'flex-none'] },
'flex-auto':    { category: 'flexbox', themeKey: null, valueType: 'enum',
                  controlGroup: 'flex-item', propertyKey: 'flex',
                  enumAlts: ['flex-1', 'flex-auto', 'flex-initial', 'flex-none'] },
'flex-initial': { category: 'flexbox', themeKey: null, valueType: 'enum',
                  controlGroup: 'flex-item', propertyKey: 'flex',
                  enumAlts: ['flex-1', 'flex-auto', 'flex-initial', 'flex-none'] },
'flex-none':    { category: 'flexbox', themeKey: null, valueType: 'enum',
                  controlGroup: 'flex-item', propertyKey: 'flex',
                  enumAlts: ['flex-1', 'flex-auto', 'flex-initial', 'flex-none'] },

// Grow
'grow':   { category: 'flexbox', themeKey: null, valueType: 'enum', addable: true,
            controlGroup: 'flex-item', propertyKey: 'flex-grow',
            enumAlts: ['grow', 'grow-0'] },
'grow-0': { category: 'flexbox', themeKey: null, valueType: 'enum',
            controlGroup: 'flex-item', propertyKey: 'flex-grow',
            enumAlts: ['grow', 'grow-0'] },

// Shrink
'shrink':   { category: 'flexbox', themeKey: null, valueType: 'enum', addable: true,
              controlGroup: 'flex-item', propertyKey: 'flex-shrink',
              enumAlts: ['shrink', 'shrink-0'] },
'shrink-0': { category: 'flexbox', themeKey: null, valueType: 'enum',
              controlGroup: 'flex-item', propertyKey: 'flex-shrink',
              enumAlts: ['shrink', 'shrink-0'] },

// Align self
'self-auto':     { category: 'flexbox', themeKey: null, valueType: 'enum', addable: true,
                   controlGroup: 'flex-item', propertyKey: 'align-self',
                   enumAlts: ['self-auto', 'self-start', 'self-end', 'self-center', 'self-stretch', 'self-baseline'] },
'self-start':    { ... controlGroup: 'flex-item', propertyKey: 'align-self', ... },
'self-end':      { ... controlGroup: 'flex-item', propertyKey: 'align-self', ... },
'self-center':   { ... controlGroup: 'flex-item', propertyKey: 'align-self', ... },
'self-stretch':  { ... controlGroup: 'flex-item', propertyKey: 'align-self', ... },
'self-baseline': { ... controlGroup: 'flex-item', propertyKey: 'align-self', ... },

// Basis
'basis-': { category: 'flexbox', themeKey: 'spacing', valueType: 'scalar',
            controlGroup: 'flex-item', addable: true },

// Order
'order-': { category: 'flexbox', themeKey: null, valueType: 'enum',
            controlGroup: 'flex-item', addable: true },
```

### Picker.tsx Changes

Mirror the `isFlexParent` pattern:

```typescript
const flexItemPropertyKeys = CONTROL_GROUP_PROPERTY_KEYS.get('flex-item') ?? new Set();
const flexItemRuleKeys     = CONTROL_GROUP_RULE_KEYS.get('flex-item') ?? new Set();

const isFlexChild = section === 'flexbox' && (
  parentIsFlexContainer ||                    // from ELEMENT_SELECTED msg
  parsedClasses.some(c => flexItemPropertyKeys.has(c.property)) ||
  [...flexItemRuleKeys].some(k => pendingPrefixes.has(k) || stagedPendingPrefixes.has(k.replace(/-$/, '')))
);
```

When `isFlexChild`, render the composite `FlexItemControls` component and filter flex-item classes from the regular chip list.

---

## New Components

### `FlexItemControls`
**Path:** `panel/src/components/FlexItemControls/`

Top-level composite component. Orchestrates the sub-controls:

```tsx
<FlexItemControls
  flexToken={...}
  selfToken={...}
  growToken={...}
  shrinkToken={...}
  basisToken={...}
  orderToken={...}
  parentFlexDirection={'row' | 'column' | ...}
  onPreview={handlePreview}
  onRevert={handleRevert}
  onStage={handleStage}
/>
```

### `FlexShorthandSelect`
**Path:** `panel/src/components/FlexShorthandSelect/`

2×2 grid of mini diagram boxes for `flex-1`, `flex-auto`, `flex-initial`, `flex-none`.

### `AlignSelfSelect`
**Path:** `panel/src/components/AlignSelfSelect/`

60×60 diagram trigger → dropdown with 6 align-self diagrams. Reuses `FlexDiagramPicker` infrastructure and `DiagramCell`. Diagrams highlight the **selected item** with a distinct color/opacity while sibling items are dimmed.

### Grow/Shrink, Basis, Order

These can use existing components:
- **Grow/Shrink**: Rendered as enum chip pairs (reuse existing chip rendering with `enumAlts`)
- **Basis**: `ScaleScrubber` with `themeKey: 'spacing'` (already exists)
- **Order**: Enum chip or dropdown (reuse existing enum dropdown pattern)

---

## Implementation Plan

### Phase 1: Data Layer
1. Update `propertyRules.ts` — add `controlGroup: 'flex-item'`, `propertyKey`, `enumAlts` to all flex-item classes
2. Update overlay `ELEMENT_SELECTED` message to include parent element's display class (if not already)
3. Add `isFlexChild` detection logic to `Picker.tsx`

### Phase 2: Core Controls
4. Create `FlexShorthandSelect` component (2×2 diagram grid)
5. Create `AlignSelfSelect` component (diagram picker)
6. Create `FlexItemControls` composite component
7. Wire into `Picker.tsx` — render when `isFlexChild`, filter chips

### Phase 3: Secondary Controls
8. Add grow/shrink toggle chips within `FlexItemControls`
9. Add basis `ScaleScrubber` within `FlexItemControls`
10. Add order dropdown within `FlexItemControls`

### Phase 4: Polish
11. Stories for all new components
12. Unit tests (vitest + @testing-library/react)
13. Handle edge case: element is both flex parent AND flex child (nested flex)
14. Keyboard accessibility for the diagram pickers

---

## Open Questions

1. **Parent context from overlay**: Does `ELEMENT_SELECTED` already include the parent's classes? If not, the overlay needs to send `parentClasses` or `parentDisplay` so the panel can detect `isFlexChild`.
2. **Nested flex**: When an element is both a flex parent and flex child, should both control blocks always show, or should there be a toggle?
3. **Grid items**: Should this spec also cover grid item classes (`col-span-*`, `place-self-*`)? Deferred for now — can be a follow-up spec using the same `controlGroup` pattern.

---

## Prototype

See [flex-item-controls-prototype.html](flex-item-controls-prototype.html) for a visual mockup of the proposed controls.
