# 000 — Edit Mode Redesign (Bottom Toolbar + Drag-Drop)

## Problem

The current Select / Insert mode toggle creates a heavyweight modal switch that users must manage before doing anything. Insert mode has multiple sub-flows (describe, draw, place component) crammed into a single state. Component placement requires an arm-and-place flow (click Place → crosshair → click page) that feels indirect. The panel header wastes space showing a "picking element" status bar.

Drag-drop placement (spec `00`) eliminates the need for arm-and-place, but exposing it alongside the existing Select / Insert toggle creates UX confusion — two competing ways to place components.

## Solution

Replace the Select / Insert toggle with a single **Edit** mode and a persistent **bottom toolbar** pinned to the viewport. The bottom toolbar contains Select and Insert tools. On element select, a compact **element drawer** appears below the element with two actions: "Describe change" (free-text description queued for the AI agent) and "Edit text" (inline text editing). Component placement is primarily drag-drop, with click-to-place as a secondary path via the Insert tool.

### Before → After

| Before | After |
|---|---|
| Panel header: `Select \| Insert \| Bug \| Theme` toggle | Panel header: `Edit \| Bug \| Theme` icons (no toggle bar) |
| Select mode = page clicks inspect elements | Edit mode + Select tool (in bottom toolbar) |
| Insert mode = page clicks set insertion point | Edit mode + Insert tool (in bottom toolbar) |
| Place tab > Place button arms crosshair cursor | Place button visible only when a target is engaged (element selected or insertion point set) |
| Floating toolbar with always-visible message input | Element drawer with two-button chooser → reveal textarea or inline edit on demand |
| Text tool in bottom toolbar | Text editing triggered from element drawer "Edit text" button |
| Panel opens showing mode toggle bar | Panel opens in Edit mode, no tool pre-selected |

## Edit Mode — Panel Layout

The panel header shows icon buttons (not a segmented toggle):
- **Edit** (pencil icon) — default mode on open
- **Bug Report** (bug icon) — unchanged
- **Theme** (palette icon) — unchanged

When Edit is active, the panel body shows two tabs:
- **Design** — Tailwind property chips, scrubbers, color pickers, box model (same as today's Select → Design tab)
- **Components** — Component list with draggable thumbnails, Draw/Screenshot Canvas button (same as today's Insert → Place tab). Place buttons appear on component rows only when a target is engaged (element selected or insertion point set).

Both tabs are always accessible regardless of which tool is active in the bottom toolbar. A user can select an element (Design tab populates), then switch to the Components tab and drag a component — no mode switch needed.

## Bottom Toolbar

A persistent floating bar pinned to the bottom-center of the **page area** (not the full viewport — avoids overlapping the panel). Contains tool icons:

| Tool | Icon | Behavior |
|---|---|---|
| **Select** | Cursor arrow | Page clicks select elements → Design tab populates, element drawer appears below element |
| **Insert** | Plus | Page clicks set an insertion point → element drawer appears at that gap |

> **Note:** Text editing is triggered from the element drawer's "Edit text" button, not from a separate bottom toolbar tool.

### Bottom toolbar positioning
- Width: auto (only as wide as its contents)
- Horizontal: centered in the page area (viewport minus panel width)
- Vertical: pinned near the bottom of the viewport
- Draggable: if the user drags it, it stays in that relative position to the bottom-center of the page. Eventually snaps back to center.

### Default state
When the panel opens, Edit mode is active but **no tool is selected** in the bottom toolbar. The user must click a tool to begin interacting. This replaces showing the mode buttons in the panel body when nothing is happening.

## Element Drawer (Element-Attached)

A compact teal drawer anchored **below** the selected element (positioned with `@floating-ui/dom`). Appears on element select. Uses tight spacing for power users (8px border-radius, 5-6px padding, 11px font).

### State A — Selected (two buttons)

When an element is first selected, the drawer shows two equal action buttons:

```
[≡ Describe change] [Aa Edit text]
```

- **Describe change** — opens a textarea to describe a code change (State B)
- **Edit text** — enters inline text editing mode (State C)

No message input visible yet — clean starting point with clear options.

### State B — Describe Change

User clicked "Describe change". Drawer transforms:

```
[textarea (full width, starts ~3 lines tall).....]
[← back]                              [mic] [Queue]
```

- Textarea auto-grows as user types
- **← back** returns to State A (safe — textarea is empty or has only draft text that hasn't been committed)
- **mic** — voice input (future)
- **Queue** — submits the description as a queued change, returns to State A

### State C — Edit Text (inline editing)

User clicked "Edit text". Outline turns solid orange, text node highlighted with orange "value" tag. Drawer transforms based on dirty state:

**C-Clean (just entered, nothing modified):**
```
[← back]  [✎ Editing text]
```

**C-Dirty (text has been modified):**
```
[✎ Editing text]          [✕ Discard] [Queue]
```

Key behavior:
- **← back** is only shown when clean (safe to leave — nothing to lose)
- Once text is modified, **← is removed** — user must explicitly Discard or Queue
- **Discard** reverts the text and returns to State A
- **Queue** commits the text change as a queued patch and returns to State A
- No confirmation dialog needed — the structural guard rail prevents accidental loss

### Escape / navigation hierarchy

- **Escape** in State B or C-Clean → returns to State A
- **Escape** in C-Dirty → no action (must explicitly Discard or Queue)
- **Escape** in State A → deselects element, drawer disappears
- **← back** always goes one level up (same as Escape when available)

## Component Placement Flows

### Primary: Drag-Drop
1. User grabs a component thumbnail from the Components tab
2. Drags across the iframe boundary onto the page
3. Teal drop indicators show valid positions
4. Release to drop — ghost HTML injected, patch created

Works regardless of which tool is active in the bottom toolbar. Dragging implies intent.

### Secondary: Click-to-Place (via Place button)
1. User selects an element (Select tool) or sets an insertion point (Insert tool)
2. Place buttons appear on component rows in the Components tab
3. User clicks Place on a component → placed at the engaged target

This preserves the "draw what to add" flow (open canvas from Components tab). The "describe what to add" flow now uses the element drawer's "Describe change" button.

## What Gets Removed

- **Select / Insert segmented toggle** in the panel header
- **"Picking element" status bar** in the panel header
- **Text tool** in the bottom toolbar (text editing is triggered from element drawer)
- **Crosshair cursor** as a panel-level armed state
- **Insert mode hover indicators** (insertion lines while hovering with no component) — only show during drag or when Insert tool is active
- **Mode buttons shown in panel body** on first open (replaced by empty state or helpful message)
- **Always-visible Place buttons** — Place buttons become conditional (see below)
- **Always-visible message input** — replaced by "Describe change" button in element drawer

### Place button visibility change
Place buttons on component rows are **hidden by default** and only appear when a target is engaged:
- Select tool: element selected → Place buttons visible
- Insert tool: insertion point set → Place buttons visible
- No tool / picking (orange) state → Place buttons hidden

## What Stays Unchanged

- Draw / Screenshot Canvas (moves into Components tab)
- Patch queue footer

## Implementation Phases

### Phase 1: Bottom toolbar + tool consolidation
- Create bottom toolbar component in the overlay (vanilla DOM, shadow DOM)
- Move Select/Insert tool selection from panel header to bottom toolbar
- Remove Select / Insert toggle from panel header, replace with Edit icon
- Remove "picking element" status bar

### Phase 2: Element drawer
- Build teal element drawer in the overlay (below selected element, `@floating-ui/dom`)
- State A: two-button chooser (`[Describe change]` `[Edit text]`)
- State B: describe change textarea + controls row (`[← back] ... [mic] [Queue]`)
- State C: inline text editing with clean/dirty sub-states
- Wire "Queue" to patch staging
- Implement dirty-state guard (← removed when text modified)

### Phase 3: Panel tab restructure
- Merge Design and Components into the Edit mode body
- Remove the tab-switching logic that was mode-dependent
- Ensure both tabs are always accessible

### Phase 4: Drag-drop as primary placement
- Make thumbnail the drag handle (already implemented in spec `00`)
- Fix the iframe drag-drop flow (pointer capture issues from spec `00`)
- Conditionally show Place buttons only when a target is engaged
- Keep click-to-place as secondary path

### Phase 5: Clean up
- Remove arm/disarm state machine
- Remove crosshair cursor logic
- Remove Text tool from bottom toolbar (now lives in element drawer)
- Update E2E tests
- Update tutorial text for new UX

## Out of Scope

The following are **not** changing in this spec. The mock shows them for layout context only:

- **Panel popout/popover button** (sidebar vs popup toggle in the panel header)
- **Panel tab styling** (Design / Components tab bar appearance and layout)
- **Design tab contents** (property chips, scrubbers, color pickers, box model)
- **Components tab contents** (search box, component rows, draw canvas button) — aside from Place button visibility
- **Panel footer** (patch queue counts)
- **Bug Report mode** — identical behavior
- **Theme mode** — identical behavior
- **Component args/customize drawer**

## Open Questions

1. **Empty state when no tool selected** — What does the page area look like when Edit mode is active but no tool is chosen? Just the normal page with no interaction? A subtle prompt?
2. **Keyboard shortcuts** — Should S/I activate the tools? Escape to deselect?
3. **Bottom toolbar in popup mode** — When the panel is a popup window, the bottom toolbar still lives in the page. Does it behave identically?
4. **Component search** — Currently in the Components tab. Stays as-is?
5. **Mic button** — Voice input for the "Describe change" textarea. Future feature or Phase 2?

## Companion Files

- [000-edit-mode-redesign-mock.html](000-edit-mode-redesign-mock.html) — Visual mock of the new layout
- [003-cohesive-controls-brainstorm.html](003-cohesive-controls-brainstorm.html) — 5-layout brainstorm for element controls
- [004-teal-drawer-concept.html](004-teal-drawer-concept.html) — Teal drawer with header row
- [005-two-button-drawer.html](005-two-button-drawer.html) — Two-button drawer (spacious)
- [006-two-button-drawer-tight.html](006-two-button-drawer-tight.html) — **Current design** — Two-button drawer with tight spacing, clean/dirty sub-states
