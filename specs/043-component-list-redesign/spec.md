# 043 — Component List Redesign

Redesign the component browser panel from large preview cards to **compact rows with smart ghost thumbnails**. See [component-list-redesign.html](component-list-redesign.html) for visual prototypes.

## Goals

1. Faster scanning — compact rows show more components without scrolling
2. Better performance — lazy loading, ghost caching, potential single-iframe reuse
3. Clearer actions — explicit Customize and Insert/Replace buttons on every row
4. Progressive detail — expand rows to see full-size preview + props editor together

---

## Implementation Phases

### Phase 1: UI/UX Redesign (commit checkpoint)

Redesign the visual layout and interaction model. Keep current loading behavior (all visible components load via IntersectionObserver).

Changes:
- **Compact row layout** — thumbnail (56×40) + name + "N props" meta + two buttons
- **Thumbnail scaling** — `transform: scale()` to fit ghost into 56×40 thumb
- **Two explicit buttons per row** — "Customize" and "Insert"/"Replace"
- **3-state Insert/Replace button** — gray (idle), teal (ready), orange (arming)
- **Customize / thumbnail click** — expands drawer with full-size preview + props editor together
- **Remove hover-only affordances** — buttons always visible

Does NOT change:
- Ghost extraction mechanism (still one iframe per component, queued)
- IntersectionObserver loading (still loads all visible components)
- Cache strategy (keep existing ghost-cache)

### Phase 2: Single Iframe Reuse

Replace the one-iframe-per-component queue with a single shared iframe that navigates between stories via `setCurrentStory` postMessage.

- Faster extraction (skip full Storybook bootstrap per component)
- Lower memory (one iframe instead of N)
- If this doesn't work reliably → fall back to Phase 2b

### Phase 2b: Click-to-Preview (fallback)

If single iframe reuse fails, switch to lazy click-to-preview:
- Placeholder thumbnails by default
- Click Customize or thumbnail → triggers ghost extraction → auto-expands
- IntersectionObserver still loads visible components, but with lower priority

---

## 1. Thumbnail Scaling

### Algorithm

After `ghost-extracted`, measure the ghost's natural dimensions and compute an adaptive scale factor:

```
scale = min(thumbWidth / ghostWidth, thumbHeight / ghostHeight, 1.0)
```

- **Cap at 1.0** — never enlarge small components
- Apply via CSS `transform: scale(${scale})` + `transform-origin: top left`
- The `.thumb` container clips with `overflow: hidden`

### Thumb dimensions

Default: `56 × 40 px` (fits well in a compact row alongside name + meta text).

### Example scale values

| Component       | Natural px | Scale |
|-----------------|-----------|-------|
| Tag (48 × 22)   | 48 × 22   | **1.0** (fits without shrink) |
| Badge (62 × 28) | 62 × 28   | **0.90** |
| Button (120 × 36)| 120 × 36 | **0.47** |
| Card (300 × 180) | 300 × 180 | **0.19** |
| Navbar (800 × 56)| 800 × 56  | **0.07** |

### Edge case: very large components

When `scale < 0.15`, the ghost becomes an unreadable smear. Options:
1. Show a **blurred silhouette** (apply CSS `filter: blur(1px)` to the scaled ghost)
2. Show a **shape outline** (border-only rectangle matching the aspect ratio)
3. Just accept the tiny rendering — the name next to it gives context

### Implementation

**Dimensions are measured inside the adaptive-iframe** at extraction time, before the ghost ever reaches the panel. This avoids needing an extra off-screen ShadowGhost render just to measure natural size.

In `overlay/src/adaptive-iframe/adaptive-iframe.ts`, right before dispatching `ghost-extracted`, read the rendered component's dimensions from the iframe document:

```ts
const root = this.iframeDoc.querySelector('#storybook-root');
const firstChild = root?.firstElementChild as HTMLElement | null;
const naturalWidth = firstChild?.scrollWidth ?? 0;
const naturalHeight = firstChild?.scrollHeight ?? 0;

this.dispatchEvent(new CustomEvent('ghost-extracted', {
  detail: { ghostHtml, ghostCss, hostStyles: styles, storyBackground, naturalWidth, naturalHeight },
}));
```

The panel receives `naturalWidth`/`naturalHeight` in the event detail and computes scale without any extra DOM measurement:

```ts
const scale = Math.min(THUMB_W / naturalWidth, THUMB_H / naturalHeight, 1.0);
// Apply to the thumb-inner wrapper
innerRef.current.style.transform = `scale(${scale})`;
innerRef.current.style.width = `${THUMB_W / scale}px`;
innerRef.current.style.height = `${THUMB_H / scale}px`;
```

---

## 2. Performance: Single Iframe Reuse

### Current architecture

Each `ComponentGroupItem` mounts its own hidden `<adaptive-iframe>`, queued one-at-a-time via `useIframeQueue` (`IFRAME_QUEUE_CONCURRENCY = 1`). Each loads `/storybook/iframe.html?id=...` — a full page load per component.

```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ Badge    │  │ Button   │  │ Card     │  │ Tag      │
│ iframe#1 │  │ iframe#2 │  │ iframe#3 │  │ iframe#4 │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
Queue concurrency = 1, sequential full-page loads
Problem: each iframe = full Storybook bootstrap (~200ms+)
```

### Proposed: SharedGhostExtractor

A single hidden iframe extracts all ghosts sequentially:

```
┌────────────────────────────────────────────────────┐
│ SharedGhostExtractor (single hidden iframe)        │
│                                                    │
│  load story A → extract ghost → cache              │
│  navigate to B → extract ghost → cache             │
│  navigate to C → extract ghost → cache             │
└────────────────────────────────────────────────────┘
```

### Storybook navigation strategies

1. **URL change** (`iframe.src = ...?id=new-story`) — full page reload each time. This is what happens today. Storybook **does not** use pushState for story switching inside `iframe.html`.

2. **`setCurrentStory` postMessage** (SB7+) — re-renders the story in-place without full page reload:
   ```ts
   iframe.contentWindow.postMessage({
     key: 'storybook-channel',
     event: { type: 'setCurrentStory', args: [{ storyId: 'components-button--primary' }] }
   }, '*');
   ```
   This is how Storybook's own panel navigates. If it works for ghost extraction, one iframe handles all components.

3. **`updateStoryArgs` postMessage** — works within the same story to change args without reload. Already used by our `useArgsUrl` hook.

### Verification needed

Before implementing single-iframe reuse:

- [ ] Does `setCurrentStory` work when `?vybit-ghost=1` is in the initial URL?
- [ ] Are stylesheets correctly swapped between stories? (CSS from story A may linger)
- [ ] Does `css-collector.ts` re-collect correctly after an in-place story switch?
- [ ] Angular Storybook compatibility (SB10)?
- [ ] Does `storybook-root` content change trigger the existing `MutationObserver` in `adaptive-iframe.ts`?

### Fallback

If `setCurrentStory` breaks extraction, keep the current one-iframe-per-component queue with aggressive caching. The compact row layout still improves UX even without the iframe optimization.

---

## 3. Lazy Loading

### Current behavior

`useComponentCardState` uses IntersectionObserver (200px margin) to trigger ghost extraction when a card scrolls into view. The 5-phase state machine: idle → cached/probing → probe-done → loading → ready.

### Proposed changes

1. **Placeholder thumbnails** — components start with a dashed "preview" placeholder instead of an empty card
2. **Click-to-load** — clicking a row triggers extraction if not yet loaded (fallback for components that haven't scrolled into view)
3. **Loading spinner** — the 56×40 thumb shows a spinner while extracting
4. **Ghost cache** — `Map<string, CachedGhost>` keyed by `${storyId}:${JSON.stringify(sortedArgs)}`

### Cache strategy

```ts
interface CachedGhost {
  ghostHtml: string;
  ghostCss: string;
  naturalWidth: number;
  naturalHeight: number;
  scale: number;  // precomputed
}

// Key: storyId + sorted args hash
const ghostCache = new Map<string, CachedGhost>();
```

**Invalidation:**
- On Storybook HMR (`STORY_CHANGED` event from channel) → clear affected entries
- On args change → re-extract with new args, update cache
- Consider `sessionStorage` persistence (ghost HTML is ~2–10 KB per component)

### Loading priority

1. Visible components (IntersectionObserver) — extract in viewport order
2. Clicked component — jump to front of queue
3. All others — remain as placeholders until scrolled/clicked

---

## 4. UX: Insert/Replace Button — 3-State Model

### Problem

"Armed" is internal jargon. The button's appearance should communicate what happens when you click it based on the current page context.

### Three states

| State | Color | Label | When | Behavior |
|-------|-------|-------|------|----------|
| **Gray** (idle) | Same as Customize | "Insert" / "Replace" | No page selection | Click → enters orange arming mode |
| **Teal** (ready) | Teal border + text | "Replace" / "Insert" | Page has a selection target | All rows turn teal. Click = immediate action. That row reverts to gray, others stay teal. |
| **Orange** (arming) | Filled orange | "Inserting" / "Replacing" | User clicked gray button | Sticky — stays orange after placing. User can keep inserting/replacing elsewhere. Click again to deactivate (back to gray). |

### Label logic

- If page has a selected element → button says **"Replace"** (all rows, teal)
- If no page selection → button says **"Insert"** (all rows, gray)
- After user clicks gray Insert → that button says **"Inserting"** (orange)

### Row highlight

No row border/background changes for button states. The button color change alone is sufficient to communicate state. Row highlighting is reserved for the expand drawer (background elevation).

### Internal code

The internal state name can remain `armed` for backward compatibility. Only the rendered UI text and button styling changes.

---

## 5. UX: "N props" vs "N variants"

### Problem

The old "N variants" label confused variants (= Storybook stories) with props (= `argTypes`).

### Solution

- Row meta text shows **"N props"** — the count of configurable `argTypes` from Storybook
- The ⚙ button opens the props editor
- When props are changed, the ghost re-renders and the thumbnail updates

---

## 6. UX: Expand Drawer — Preview + Props Together

### Interaction model

| Action | Result |
|--------|--------|
| **Click thumbnail** | Expands drawer with full-size preview + props editor |
| **Click "Customize"** | Same — expands drawer with preview + props |
| **Click "▲ Collapse"** | Collapses drawer (Customize button becomes "▲ Collapse" while open) |
| **Click "Insert"/"Replace"** | Arms/acts depending on button state (does NOT expand) |
| **Click elsewhere** | Collapses expanded row back to compact |

### Expand behavior

- Row header stays visible — shows "▲ Collapse" + Insert/Replace button
- Preview area opens below with full-size ghost (capped to panel width)
- Props editor appears immediately below the preview (not a separate toggle)
- Only one row expanded at a time (accordion behavior)
- If ghost not loaded yet, expanded area shows spinner while extraction runs, then auto-expands

### Key difference from previous design

Clicking the component row does **not** arm/select it. The two actions are completely separate:
- **Customize / thumbnail** → expand for preview + props editing
- **Insert / Replace button** → arm/select for placement

---

## 7. User Flow

```
1. Scan        — compact rows with ghost thumbnails
2. Quick act   — click teal "Replace" button → immediate replacement (no expand needed)
3. Customize   — click thumbnail or "Customize" → preview + props drawer opens
4. Tweak       — edit props → ghost re-renders live in drawer
5. Arm         — click "Insert" (gray→orange) → click page to place → stays orange for repeat
6. Deactivate  — click orange "Inserting" button again → back to gray
```

**Fastest path (element selected, teal state):** One click on any teal "Replace" button → done. Click a different teal button to swap.

**Customize-first path:** Thumbnail → tweak props → then click Insert/Replace when ready.

---

## Files Affected

### Phase 1 (UI/UX)

| File | Change |
|------|--------|
| `panel/src/components/DrawTab/components/ComponentGroupItem/` | Refactor to compact row + expand drawer |
| `panel/src/components/DrawTab/components/ComponentCardPreview/` | Add thumbnail scaling logic (transform:scale) |
| `panel/src/components/DrawTab/components/ComponentCardFooter/` | Replace with inline row buttons (Customize + Insert/Replace) |
| `panel/src/components/DrawTab/DrawTab.tsx` | Update arming logic for 3-state button model |
| `panel/src/components/ShadowGhost/` | No changes (still renders ghost HTML+CSS in shadow DOM) |
| `overlay/src/adaptive-iframe/adaptive-iframe.ts` | Expose `naturalWidth`/`naturalHeight` in `ghost-extracted` event detail |

### Phase 2 (Single Iframe)

| File | Change |
|------|--------|
| `panel/src/components/DrawTab/hooks/useIframeQueue.ts` | Replace with SharedGhostExtractor |
| `panel/src/components/DrawTab/hooks/useArgsUrl.ts` | Add `setCurrentStory` postMessage support |
| `overlay/src/adaptive-iframe/css-collector.ts` | Verify re-collection after in-place story switch |

### Phase 2b (Click-to-Preview fallback)

| File | Change |
|------|--------|
| `panel/src/components/DrawTab/hooks/useComponentCardState.ts` | Add click-to-load trigger, placeholder states |

---

## Open Questions

1. **Single iframe reuse** (Phase 2) — does `setCurrentStory` postMessage work reliably for ghost extraction across SB7/SB8/SB10? Does `css-collector.ts` re-collect correctly after in-place story switch?
2. **Very large components** — is a blurred silhouette at `scale < 0.15` better than showing nothing?
3. **Ghost cache persistence** — should ghost HTML persist to `sessionStorage` for reload survival, or is in-memory sufficient?
4. **Accordion expand** — should expanding a row auto-scroll it into view if partially off-screen?

## Resolved Decisions

- **No separate insert/replace colors** — the button label ("Insert" vs "Replace") is enough. Color encodes state (gray/teal/orange), not mode.
- **No row border highlighting for armed state** — button color change alone is sufficient.
- **"N props" stays static** — meta text never changes to "Click page to place" or "Replaces \<X\>". The button text is the only state indicator.
- **Preview + props always open together** — clicking thumbnail or Customize always shows both. No separate ⚙ toggle.
- **Phase 1 keeps current loading** — no lazy/click-to-load changes until Phase 2/2b.
