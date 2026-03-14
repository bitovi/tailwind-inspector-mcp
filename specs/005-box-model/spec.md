# Box Model Editor — Requirements

## Overview

A visual box model editor component (like Chrome DevTools) for editing Tailwind spacing, border, and outline classes on a selected element. See `box-model-hover-grow.html` for the interactive prototype that demonstrates the behavior described here.

## Layout

- Concentric rectangles from outside in: **margin → outline → border → padding → content**
- Each layer ("ring") is a nested `<div>` with uniform padding on all sides — this padding is the visual ring thickness
- Each layer is labeled at its **top-left corner** with the layer name (or shorthand class when a value exists)
- The content box (innermost) is a fixed-height rectangle with a white fill and subtle border

## Hover-Grow Interaction

The signature interaction: hovering a ring causes it to physically expand, creating room for its editable slot controls.

### Ring sizing
- **Rest size** (`--ring-rest: 26px`): default padding for every ring — enough to show the layer label but slots are compact
- **Hover size** (`--ring-hover: 44px`): padding when directly hovered — provides room for slot controls to be comfortably clickable
- Transition: `200ms cubic-bezier(0.25, 0.46, 0.45, 0.94)` (smooth ease-out)

### Isolation rule (only one ring grows at a time)
- When the cursor is **directly over a layer** (not over any child layer), that layer's padding transitions to `--ring-hover`
- If a **child layer** is hovered instead, the parent reverts to `--ring-rest` — achieved with `:has(.bm-layer:hover)` selector
- This means exactly one ring is expanded at any time; all others stay at rest

### Effect on slot groups
- Slot groups (top, right, bottom, left, corners) are positioned absolutely within their ring
- Top/bottom groups have `height` matching the ring padding; left/right groups have `width` matching it
- These dimensions transition in sync with the ring, so slot controls grow/shrink along with their ring band

## Behavioral Dimensions

The box model component's visual state is driven by the combination of these independent dimensions. Understanding all of them is essential for implementation.

### Dimension 1 — Class state (per layer)

What Tailwind classes exist on the selected element for a given layer (e.g., padding)?

| Value | Example | Description |
|-------|---------|-------------|
| `none` | _(no padding classes)_ | Layer has no matching Tailwind classes |
| `shorthand` | `p-2` | A single all-sides class |
| `axis` | `px-2 py-4` | One or both axis classes, no shorthand |
| `individual` | `pt-2 pr-4 pb-6 pl-8` | One or more individual side classes, no shorthand/axis |
| `mixed` | `p-2 pt-5` | Shorthand + side/axis overrides |

### Dimension 2 — Ring hover state

Is the user's cursor **directly** over this layer's ring band?

| Value | Description |
|-------|-------------|
| `not-hovered` | Cursor is elsewhere |
| `ring-hovered` | Cursor is on this ring's band (not on a nested child ring) |

### Dimension 3 — Hover target (when ring is hovered)

**Only applies when Dimension 2 = `ring-hovered`.** What specific element within the ring is the cursor over?

| Value | Description |
|-------|-------------|
| `background` | Cursor is on the ring fill, not on any label or slot |
| `shorthand-label` | Cursor is on the top-left label text (e.g., `p-2`) |
| `slot` | Cursor is on a specific directional slot (e.g., `t`, `r`, `x`) |

### Dimension 4 — Target slot value state (when hovering a slot)

**Only applies when Dimension 3 = `slot`.** Does the hovered slot have an active Tailwind value?

| Value | Description |
|-------|-------------|
| `placeholder` | No class set for this direction (shows axis/side abbreviation like `t`, `x`) |
| `has-value` | An active class exists (shows value like `t-10`, `r-20`) |

### Dimension 5 — Editing state

Is a ScaleScrubber or enum picker currently active somewhere in this layer?

| Value | Description |
|-------|-------------|
| `idle` | No editor open |
| `scrubber-active` | A slot has been clicked and is showing an inline scrubber |

### Dimension 6 — Other-ring hover (isolation context)

Is a **different** ring currently the one being hovered? Determines whether this ring is "suppressed."

| Value | Description |
|-------|-------------|
| `none` | No other ring is hovered (or nothing is hovered at all) |
| `other-ring` | A parent, child, or sibling ring is hovered — this ring must stay at rest and hide its non-value slots |

---

## Behavioral Rules by Dimension Combination

Each rule specifies: **ring size**, **label appearance**, **slot visibility**, and **slot/label styling**.

### Rule 1 — Idle, no classes (`class:none` + `hover:not-hovered`)

| Aspect | Behavior |
|--------|----------|
| Ring size | Rest (`26px`) |
| Label | Plain layer name (e.g., "padding") in muted label color |
| Slots | All hidden (`opacity: 0; pointer-events: none`) |

### Rule 2 — Idle, shorthand class (`class:shorthand` + `hover:not-hovered`)

| Aspect | Behavior |
|--------|----------|
| Ring size | Rest |
| Label | Replaced with full class name (e.g., `p-2`) in **bold accent color** |
| Slots | All directional slots hidden |

### Rule 3 — Idle, axis classes (`class:axis` + `hover:not-hovered`)

| Aspect | Behavior |
|--------|----------|
| Ring size | Rest |
| Label | Plain layer name (e.g., "padding") — no single shorthand to show |
| Slots | Axis slots that have values (`x`, `y`) are **always visible** with `has-val` styling (bold accent, no background/border, zero padding). Individual side slots remain hidden. |

### Rule 4 — Idle, individual side classes (`class:individual` + `hover:not-hovered`)

| Aspect | Behavior |
|--------|----------|
| Ring size | Rest |
| Label | Plain layer name |
| Slots | Each side slot with a value is **always visible** with `has-val` styling. Sides/axes without values remain hidden. |

### Rule 5 — Idle, mixed classes (`class:mixed` + `hover:not-hovered`)

| Aspect | Behavior |
|--------|----------|
| Ring size | Rest |
| Label | Shows the shorthand (e.g., `p-2`) in bold accent — same as Rule 2 |
| Slots | Side/axis slots that **override** the shorthand are always visible with `has-val` styling (e.g., `t-5`). Non-overridden sides hidden. |

### Rule 6 — Hovered ring, no classes (`class:none` + `hover:ring-hovered` + `target:background`)

| Aspect | Behavior |
|--------|----------|
| Ring size | Grows to hover size (`44px`) |
| Label | Layer name brightens (label-hover color) |
| Slots | All placeholder slots **fade in** (`opacity: 1; pointer-events: auto`), shown as muted text (e.g., `y`, `t`, `r`, `b`, `x`, `l`) |

### Rule 7 — Hovered ring, shorthand class (`class:shorthand` + `hover:ring-hovered` + `target:background`)

| Aspect | Behavior |
|--------|----------|
| Ring size | Grows to hover size |
| Label | Shorthand label (e.g., `p-2`) stays visible in accent — gains `cursor: pointer` |
| Slots | All directional placeholder slots fade in alongside the shorthand |

### Rule 8 — Hovered ring, individual/axis/mixed (`class:individual|axis|mixed` + `hover:ring-hovered` + `target:background`)

| Aspect | Behavior |
|--------|----------|
| Ring size | Grows to hover size |
| Label | Layer name (or shorthand if mixed) |
| Slots with values | Gain padding (`2px 5px`) to become **chip-like**, signaling clickability |
| Slots without values | Fade in as placeholders |

### Rule 9 — Hovering the shorthand label (`target:shorthand-label`)

**Requires**: `class:shorthand` or `class:mixed` (label only shows class name when a shorthand exists)

| Aspect | Behavior |
|--------|----------|
| Ring size | Already at hover size (cursor is inside the ring) |
| Label styling | **Teal hover treatment**: text → `--teal`, background → `--teal-dim`, border → `rgba(0,132,139,0.30)` |
| Cursor | `pointer` |
| Click action | Opens ScaleScrubber bound to the shorthand prefix (e.g., `p-*`) |

### Rule 10 — Hovering a placeholder slot (`target:slot` + `slot:placeholder`)

| Aspect | Behavior |
|--------|----------|
| Slot styling | **Teal hover treatment**: teal text, teal-dim background, teal border |
| Cursor | `pointer` |
| Click action | Opens ScaleScrubber bound to the slot's prefix (e.g., `pt-*` for slot `t`) |

### Rule 11 — Hovering a has-value slot (`target:slot` + `slot:has-value`)

| Aspect | Behavior |
|--------|----------|
| Slot styling | **Teal hover treatment** (overrides the accent color): teal text, teal-dim background, teal border |
| Cursor | `pointer` |
| Click action | Opens ScaleScrubber initialized to the slot's current value |

### Rule 12 — Scrubber active (`editing:scrubber-active`)

While any scrubber is active, **all hover-grow behavior across the entire box model is frozen**. No ring changes size, no slots appear or disappear — everything stays exactly as it was at the moment the scrubber opened, until the user commits or cancels the edit.

| Aspect | Behavior |
|--------|----------|
| Active slot | White background, teal border, teal box-shadow. Prefix in `--text-mid`, value in bold. Cursor: `ew-resize`. |
| Active ring | Stays pinned at hover size for the duration of the edit |
| Active slot group | Stays pinned visible (`is-active` class → `opacity: 1; pointer-events: auto`) |
| All other rings | **Frozen at rest size** — hover events are suppressed (no grow, no slot reveal, no label color changes) |
| Dismissal | Escape or blur → revert to pre-edit value, close scrubber, unfreeze hover behavior |
| Commit | Value accepted → update class, close scrubber, unfreeze hover behavior |

### Rule 13 — Suppressed by other-ring hover (`other-ring:other-ring`)

**Only applies when `editing:idle`** — this rule is irrelevant while a scrubber is active (Rule 12 takes precedence).

| Aspect | Behavior |
|--------|----------|
| Ring size | Forced to rest (even if it was just hovered) |
| Slots without values | Forced hidden (`opacity: 0; pointer-events: none`) |
| Slots with values | Revert to compact `has-val` styling (zero padding) — remain visible but not chip-like |
| Label | Reverts to non-hover color |

## Slot Positions

Each layer (margin, border, padding) has directional slots arranged around its ring edges:

| Position | Slot group | Controls |
|----------|-----------|----------|
| Top center | `sg-top` | `y` (axis shortcut), `t` (top value) |
| Right center | `sg-right` | `r` (right value) |
| Bottom center | `sg-bottom` | `b` (bottom value) |
| Left center | `sg-left` | `x` (axis shortcut), `l` (left value) |

**Border layer** has additional corner-positioned slots:
| Position | Slot group | Control |
|----------|-----------|---------|
| Top-right corner | `sg-tr` | `color` |
| Bottom-left corner | `sg-bl` | `style` |

**Outline layer** has:
| Position | Slot group | Control |
|----------|-----------|---------|
| Bottom-right corner | `sg-br` | `offset` |

## Editing

- Clicking **any slot or label** replaces it inline with a `ScaleScrubber` control (no modal, no popover)
- The scrubber is initialized to the current value if a class exists, or empty if none
- **Clicking the shorthand label** (e.g., `p-2` at top-left) → opens a scrubber bound to `p-*` (the all-sides shorthand)
- **Clicking an axis slot** (`x`, `y`) → opens a scrubber bound to `px-*` / `py-*` (or `mx-*`, `my-*`, etc.)
- **Clicking a side slot** (`t`, `r`, `b`, `l`) → opens a scrubber bound to `pt-*`, `pr-*`, `pb-*`, `pl-*`, etc.
- Committing a value updates (or adds) the corresponding class; cancelling (Escape / blur) reverts
- If a more-specific class is set while a shorthand exists, both coexist (e.g., `p-2 pt-5`)
- Border `color` and `style` slots replace inline with an enum picker instead of a scrubber

### Scrubbing state appearance
- When a slot is being scrubbed, it gets a distinct "active editor" style:
  - White background, teal border, subtle teal box-shadow
  - Prefix text in `--text-mid`, value in bold
  - Small directional arrow indicator
  - Cursor: `ew-resize`
- The slot group containing the active scrubber stays pinned visible (`is-active` class) even if the mouse leaves the ring

## Color Palette (per layer)

Each ring has a consistent color scheme applied to its fills, borders, labels, and value text:

| Layer | Fill | Border | Accent (values) | Label (idle) | Label (hover) |
|-------|------|--------|------------------|--------------|---------------|
| Margin | `rgba(245,83,45,0.10)` | `rgba(245,83,45,0.45)` | `#C73D1A` | `rgba(185,55,20,0.35)` | `rgba(185,55,20,0.60)` |
| Outline | `rgba(139,79,240,0.10)` | `rgba(139,79,240,0.45)` | `#6932C3` | `rgba(105,50,195,0.35)` | `rgba(105,50,195,0.60)` |
| Border | `rgba(56,120,245,0.10)` | `rgba(56,120,245,0.45)` | `#1950D2` | `rgba(25,80,210,0.35)` | `rgba(25,80,210,0.60)` |
| Padding | `rgba(0,132,139,0.12)` | `rgba(0,132,139,0.50)` | `#005A5F` | `rgba(0,90,95,0.35)` | `rgba(0,90,95,0.60)` |

- **Label name** (e.g., "padding") uses the muted label color, brightening on hover
- **Value text** (e.g., `p-2`, `t-10`) always uses the bolder accent color
- **Interactive hover** (any clickable element): overrides to teal (`--teal` / `--teal-dim` background)

## Scope

Layers managed by this component:
- **Margin**: `m`, `mx`, `my`, `mt`, `mr`, `mb`, `ml`
- **Outline**: `outline`, `outline-offset`
- **Border**: `border`, `border-x`, `border-y`, `border-t`, `border-r`, `border-b`, `border-l`, `border-color`, `border-style`
- **Padding**: `p`, `px`, `py`, `pt`, `pr`, `pb`, `pl`
- _(Content box: `w`, `h`, `min-w`, `max-w`, `min-h`, `max-h`, `size` — future)_

## Prototype Gaps (to fix before or during implementation)

1. **Shorthand label not hoverable** (Rule 9): The `p-2` in the top-left of the padding ring (`.bm-name .val`) does not show an interactive hover state. It needs the same teal hover treatment as `.slot-item:hover` — teal text, teal-dim background, subtle teal border, `cursor: pointer`. Without this, users don't realize they can click the shorthand to edit all sides at once.
2. **Axis class state not demonstrated**: No prototype panel shows the `px-2 py-4` case (Rule 3). Need a fourth column showing how axis slots appear at rest and on hover.
3. **Mixed class state not demonstrated**: No prototype panel shows `p-2 pt-5` (Rule 5) — shorthand label + overriding side slot visible simultaneously.
4. **Hover freeze during scrubbing not demonstrated** (Rule 12): No prototype shows that all hover-grow is suppressed while a scrubber is active — rings should not change size or reveal slots when the user moves the mouse during a scrub.
5. **No commit/cancel demonstration**: No prototype shows dismissal (Escape/blur) unfreezing hover behavior.
