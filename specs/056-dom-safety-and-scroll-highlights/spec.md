# 056 — DOM Safety Helpers + Scroll-Aware Highlight Positioning

## Problem

### 1. Selection/hover outlines thrash on scroll

The selection highlight (`.highlight-overlay`) and hover preview (`.hover-target-outline`) are appended to the shadow root with `position: fixed` and positioned using `getBoundingClientRect()` values captured at creation time.

`position: fixed` coordinates are relative to the viewport. When the user scrolls, the highlight stays at its old viewport coordinates until JS repositions it. This produces a visible thrash: the outline lags behind the element and snaps to the new position on the next `repositionHighlights()` call.

The fix is to reparent highlight elements into the element's **scrollable ancestor** and use `position: absolute` with container-relative math. This way the browser's layout engine moves the highlight during scroll — no JS scroll listener needed.

### 2. Reparenting breaks DOM traversal

Reparenting highlights into the user's DOM creates a new hazard: any code that traverses the user's DOM (reading children, siblings, parent chains, or running `querySelectorAll`) could encounter the injected highlight elements and produce wrong results.

**Concrete breakages identified (26 call sites across 7 files):**

- **`adjustForEdgeChild`** — checks `previousElementSibling` / `nextElementSibling` to decide whether a drop should become `first-child`/`last-child`. A vybit element as the first or last child prevents this promotion, so the drop indicator renders as a line instead of a full container outline.
- **`findChildInGap`** — builds `Array.from(container.children)` to detect cursor position in CSS gaps. A vybit child shifts all indices and corrupts gap/padding detection.
- **`getChildIndex` / `isSamePosition`** — count and index children to compute move positions and no-op detection. Vybit children inflate counts and shift indices, causing moves to land at the wrong position and preventing no-op short-circuiting.
- **`nextSibling` references in drag-move and drop-preview** — these record the original next sibling as a revert reference. If a vybit element is next, revert places the moved element at the wrong position.
- **`buildLevel` / `buildInsertLevel` / `buildDeleteLevel` in context.ts** — iterate children to build context strings sent to the AI agent. Vybit children appear as real elements in those strings.
- **`findExactMatches` in grouping.ts** — `document.querySelectorAll(tag)` scans the whole document; body-level vybit elements with no class could match classless tag queries.

### 3. No convention for "overlay elements in user DOM"

Several overlay elements already live directly in `document.body` (not the shadow root): drag previews, move indicators, cursor labels, drop arrows, and injected `<style>` elements. There is no consistent way to identify them, so every DOM-walking function has ad-hoc filtering (e.g., checking `shadowHost.contains(el)`) that misses the body-level elements.

## Goal

1. Create a `dom-helpers` module that provides DOM read operations filtered to exclude vybit-injected elements.
2. Establish a `data-vybit-overlay` attribute as the universal marker for all overlay-owned elements in the user DOM.
3. Migrate the 26 affected call sites to use the helpers.
4. Implement scroll-aware highlight positioning (reparenting into scroll containers).
5. Create an agent skill that enforces use of the helpers in future overlay code.

## Background: Scroll-Aware Positioning Pattern

From the [bitovi/jira-timeline-report](https://github.com/bitovi/jira-timeline-report) codebase (`src/canjs/ui/simple-tooltip/simple-tooltip.js`), the correct approach is:

**Step 1 — Find the scroll container:**
```ts
function findScrollingContainer(element: HTMLElement): HTMLElement {
  let cur: HTMLElement | null = element.parentElement;
  while (cur && cur.scrollHeight === cur.clientHeight) {
    cur = cur.parentElement;
  }
  return cur ?? document.body;
}
```

**Step 2 — Reparent the overlay element into the container:**
```ts
container.appendChild(overlayEl); // scrolls with content natively
```

**Step 3 — Position using container-relative math:**
```ts
const containerRect = container.getBoundingClientRect();
const elementRect = el.getBoundingClientRect();
const scrollAdj = container === document.body ? 0 : container.scrollTop;

overlayEl.style.top  = `${elementRect.top  - containerRect.top  + scrollAdj}px`;
overlayEl.style.left = `${elementRect.left - containerRect.left}px`;
```

Result: the overlay element scrolls with its container via CSS alone. `getBoundingClientRect()` is only called on initial placement and `window` resize — not on every scroll frame.

## Design

### Phase 1 — `overlay/src/dom-helpers.ts`

A new module that exports filtered DOM read operations. All functions require the shadow host to be initialized (imported from `overlay-state`).

```ts
/** Attribute placed on every overlay-owned element inserted into the user DOM. */
export const VYBIT_ATTR = 'data-vybit-overlay';

/**
 * Returns true if `el` is an overlay-owned element (either inside the shadow
 * host or marked with data-vybit-overlay).
 */
export function isVybitElement(el: Element): boolean;

/**
 * Returns the children of `el` that belong to the user's DOM
 * (excludes elements marked with data-vybit-overlay).
 */
export function getUserChildren(el: Element): HTMLElement[];

/**
 * Returns the child nodes of `el` that belong to the user's DOM.
 * Text nodes are always considered user nodes.
 */
export function getUserChildNodes(el: Element): ChildNode[];

/** First user-owned child element, or null. */
export function getFirstUserChild(el: Element): HTMLElement | null;

/** Last user-owned child element, or null. */
export function getLastUserChild(el: Element): HTMLElement | null;

/**
 * Next user-owned sibling element, skipping any vybit elements.
 * Equivalent to nextElementSibling but ignores vybit elements.
 */
export function getNextUserSibling(el: Element): HTMLElement | null;

/**
 * Previous user-owned sibling element, skipping any vybit elements.
 */
export function getPrevUserSibling(el: Element): HTMLElement | null;

/**
 * document.querySelectorAll filtered to exclude vybit elements.
 */
export function queryUserElements(
  selector: string,
  root?: Element | Document,
): HTMLElement[];

/**
 * document.elementFromPoint that skips vybit elements.
 * Temporarily hides the topmost vybit hit and retries until a user
 * element is found (or null if nothing is underneath).
 */
export function userElementFromPoint(x: number, y: number): HTMLElement | null;
```

**`isVybitElement` logic:**
```ts
export function isVybitElement(el: Element): boolean {
  return el.hasAttribute(VYBIT_ATTR) || state.shadowHost.contains(el);
}
```

**`userElementFromPoint` logic (hide-and-retry):**
```ts
export function userElementFromPoint(x: number, y: number): HTMLElement | null {
  const hidden: HTMLElement[] = [];
  let el: Element | null;
  while ((el = document.elementFromPoint(x, y)) !== null) {
    if (!isVybitElement(el)) return el as HTMLElement;
    (el as HTMLElement).style.visibility = 'hidden';
    hidden.push(el as HTMLElement);
  }
  hidden.forEach(e => (e.style.visibility = ''));
  return null;
}
```
> Note: This is safe because vybit elements all have `pointer-events: none` — but temporarily hiding ensures `elementFromPoint` skips them correctly regardless.

### Phase 2 — Mark all overlay-owned elements in user DOM

Every element the overlay inserts into the user DOM (outside the shadow root) must have `data-vybit-overlay` set at creation time.

**Elements to mark and where:**

| Element | File | Current line |
|---------|------|-------------|
| Drop-zone locked indicator | overlay/src/drop-zone.ts | ~271 |
| Drop-zone arrow left/right | overlay/src/drop-zone.ts | ~360, ~432 |
| Cursor label | overlay/src/drop-zone.ts | ~268 |
| Drag preview | overlay/src/drag-drop.ts | ~234 |
| Drag indicator | overlay/src/drag-drop.ts | ~244 |
| Replace outline | overlay/src/drag-drop.ts | ~254 |
| Move indicator | overlay/src/drag-move.ts | ~143 |
| Drop-preview ghost element | overlay/src/drop-preview.ts | ~108 |
| Ghost elements (`data-tw-dropped-*`) | overlay/src/drop-zone.ts, drag-drop.ts, index.ts | various |
| Injected `<style>` (preview/committed CSS) | overlay/src/patcher.ts | ~48, ~178 |
| Injected `<style>` (drop CSS) | overlay/src/drop-zone.ts | ~320 |
| Injected `<style>` (story iframe) | overlay/src/story-extractor.ts | ~254 |
| Hidden story iframe | overlay/src/story-extractor.ts | ~131 |
| Hidden adaptive iframe | overlay/src/adaptive-iframe/adaptive-iframe.ts | ~90 |
| Screenshot ghost | overlay/src/screenshot.ts | ~64 |

> Ghost elements (`data-tw-dropped-*`) are a special case — they are user-facing content placed by the agent. Do **not** mark them with `data-vybit-overlay`. The overlay's own drop-preview/indicator elements surrounding the ghost should be marked, but the ghost itself should remain unmarked so the user's DOM traversal (via `getUserChildren`) includes ghosts as real elements.

### Phase 3 — Migrate 26 Call Sites

Migrate in priority order. Each change is small (1–3 lines).

#### P1 — Insertion / Drop Flow (highest impact)

These directly affect where components get inserted and where the insertion indicator appears.

| # | File | Line(s) | Function | Change |
|---|------|---------|----------|--------|
| 1 | shared/drop-geometry.ts | L59 | `adjustForEdgeChild` | `target.previousElementSibling` → `getPrevUserSibling(target)` |
| 2 | shared/drop-geometry.ts | L62 | `adjustForEdgeChild` | `target.nextElementSibling` → `getNextUserSibling(target)` |
| 3 | overlay/src/drop-zone.ts | L301 | `findTarget` | `document.elementFromPoint(x, y)` → `userElementFromPoint(x, y)` |
| 4 | overlay/src/drop-zone.ts | L540 | `findChildInGap` | `Array.from(container.children)` → `getUserChildren(container)` |
| 5 | overlay/src/drag-move.ts | L106 | `startMoveGesture` | `currentTargetEl.nextSibling` → `getNextUserSibling(currentTargetEl)` |
| 6 | overlay/src/drag-move.ts | L416 | `revertMove` | `parent.children[idx]` → `getUserChildren(parent)[idx]` |
| 7 | overlay/src/drag-move.ts | L417 | `revertMove` | `parent.children.length` → `getUserChildren(parent).length` |
| 8 | overlay/src/drag-move.ts | L470 | `isSamePosition` | `target.previousElementSibling === source` → `getPrevUserSibling(target) === source` |
| 9 | overlay/src/drag-move.ts | L472 | `isSamePosition` | `target.nextElementSibling === source` → `getNextUserSibling(target) === source` |
| 10 | overlay/src/drag-move.ts | L474 | `isSamePosition` | `target.firstElementChild === source` → `getFirstUserChild(target) === source` |
| 11 | overlay/src/drag-move.ts | L476 | `isSamePosition` | `target.lastElementChild === source` → `getLastUserChild(target) === source` |
| 12 | overlay/src/drag-move.ts | L487–492 | `getChildIndex` | `Array.from(parent.children)` → `getUserChildren(parent)` |
| 13 | overlay/src/drag-drop.ts | L320 | `resolveDropTarget` | `document.elementFromPoint(...)` → `userElementFromPoint(...)` |
| 14 | overlay/src/drop-preview.ts | L270 | `createMovePreview` init | `sourceEl.nextSibling` → `getNextUserSibling(sourceEl)` |
| 15 | overlay/src/drop-preview.ts | L290 | `createMovePreview.activate` | `s.sourceEl.nextSibling` → `getNextUserSibling(s.sourceEl)` |

#### P2 — Context Generation (affects AI agent accuracy)

These build the text context strings sent to the AI agent describing the DOM structure. Vybit children appearing in context strings would confuse the agent.

| # | File | Line(s) | Function | Change |
|---|------|---------|----------|--------|
| 16 | overlay/src/context.ts | L82 | `buildLevel` | `Array.from(el.children)` → `getUserChildren(el)` |
| 17 | overlay/src/context.ts | L136 | `renderSiblingNode` | `el.children.length > 0` → `getUserChildren(el).length > 0` |
| 18 | overlay/src/context.ts | L145 | `getInnerText` | `Array.from(el.childNodes)` → `getUserChildNodes(el)` |
| 19 | overlay/src/context.ts | L190 | `renderSiblingWithDeepText` | `el.children.length > 0` → `getUserChildren(el).length > 0` |
| 20 | overlay/src/context.ts | L209 | `renderTargetExpanded` | `Array.from(el.children)` → `getUserChildren(el)` |
| 21 | overlay/src/context.ts | L224 | `renderTargetExpanded` | `child.children.length > 0` → `getUserChildren(child).length > 0` |
| 22 | overlay/src/context.ts | L293 | `buildInsertLevel` | `Array.from(el.children)` → `getUserChildren(el)` |
| 23 | overlay/src/context.ts | L372 | `buildDeleteLevel` | `Array.from(el.children)` → `getUserChildren(el)` |

#### P3 — Grouping (low real-world risk, good hygiene)

| # | File | Line(s) | Function | Change |
|---|------|---------|----------|--------|
| 24 | overlay/src/grouping.ts | L139 | `findExactMatches` | `document.querySelectorAll(tag)` → `queryUserElements(tag)` |
| 25 | overlay/src/grouping.ts | L146 | `findExactMatches` | `document.querySelectorAll(selector)` → `queryUserElements(selector)` |
| 26 | overlay/src/grouping.ts | L215 | `computeNearGroups` | `document.querySelectorAll(sel)` → `queryUserElements(sel)` |

### Phase 4 — Scroll-Aware Highlight Positioning

**Gate:** Phases 1–3 complete and passing.

Changes in `overlay/src/element-highlight.ts`:

**Add `findScrollingContainer`:**
```ts
function findScrollingContainer(el: HTMLElement): HTMLElement {
  let cur: HTMLElement | null = el.parentElement;
  while (cur && cur.scrollHeight === cur.clientHeight) {
    cur = cur.parentElement;
  }
  return cur ?? document.body;
}
```

**Rewrite `highlightElement`:**
```ts
export function highlightElement(el: HTMLElement): void {
  const container = findScrollingContainer(el);
  const containerRect = container.getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  const scrollAdj = container === document.body ? window.scrollY : container.scrollTop;
  const scrollAdjX = container === document.body ? window.scrollX : container.scrollLeft;

  const overlay = document.createElement('div');
  overlay.className = 'highlight-overlay';
  overlay.setAttribute(VYBIT_ATTR, '');
  overlay.style.position = 'absolute';
  overlay.style.top  = `${rect.top  - containerRect.top  + scrollAdj  - 4}px`;
  overlay.style.left = `${rect.left - containerRect.left + scrollAdjX - 4}px`;
  overlay.style.width  = `${rect.width  + 8}px`;
  overlay.style.height = `${rect.height + 8}px`;
  container.style.position = container.style.position || 'relative'; // ensure absolute works
  container.appendChild(overlay);
}
```

**Rewrite `showHoverPreview`:** Same approach — find scroll container, reparent, container-relative math.

**Update `repositionHighlights`:** No longer needs to be called on `scroll` events. It is still called on `resize` (window resize changes all `getBoundingClientRect` values). The scroll listener in `index.ts` (or wherever `repositionHighlights` is called on scroll) should be removed.

**Update `clearHighlights`:** Currently queries shadow root. After this change, highlights are in scroll containers throughout the page. Use a shared array (`state.activeHighlightEls`) to track and remove them, or query `document.querySelectorAll('[data-vybit-overlay].highlight-overlay')`.

**CSS change in `overlay/src/styles.ts`:** Remove `position: fixed` from `.highlight-overlay` and `.hover-target-outline` (both are now set inline as `position: absolute`).

### Phase 5 — Agent Skill (`.github/skills/dom-safety/SKILL.md`)

A skill that agents must read before modifying any file in `overlay/src/` or `shared/`.

Contents:
- **Why this exists** — brief explanation of the vybit-element-in-user-DOM problem
- **The golden rule** — "never use raw DOM traversal APIs on user DOM; always use dom-helpers"
- **`VYBIT_ATTR` convention** — when and how to mark elements you create
- **Function reference table** — every export from `dom-helpers.ts` with one-line description
- **Before/after examples** — side-by-side showing raw API vs helper
- **Ghost element exception** — `data-tw-dropped-*` elements are user content and must NOT be marked
- **Checklist** — a short list to run through before submitting overlay code changes

## Affected Files

| File | Change |
|------|--------|
| `overlay/src/dom-helpers.ts` | **NEW** — 10 exports |
| `shared/drop-geometry.ts` | 2 call sites (P1) |
| `overlay/src/drop-zone.ts` | 2 call sites (P1) + mark 3 element types (P2) |
| `overlay/src/drag-move.ts` | 8 call sites (P1) + mark 1 element type (P2) |
| `overlay/src/drag-drop.ts` | 1 call site (P1) + mark 3 element types (P2) |
| `overlay/src/drop-preview.ts` | 2 call sites (P1) + mark 1 element type (P2) |
| `overlay/src/context.ts` | 8 call sites (P2) |
| `overlay/src/grouping.ts` | 3 call sites (P3) |
| `overlay/src/element-highlight.ts` | Rewrite highlight + hover positioning (P4) |
| `overlay/src/styles.ts` | Remove `position: fixed` from highlight rules (P4) |
| `overlay/src/patcher.ts` | Mark injected `<style>` elements (P2) |
| `overlay/src/index.ts` | Mark injected `<style>` elements (P2) |
| `overlay/src/story-extractor.ts` | Mark hidden iframe (P2) |
| `overlay/src/adaptive-iframe/adaptive-iframe.ts` | Mark hidden iframe (P2) |
| `overlay/src/screenshot.ts` | Mark screenshot ghost (P2) |
| `.github/skills/dom-safety/SKILL.md` | **NEW** — agent skill |

## Verification

### Automated
1. `cd panel && npm test` — all existing unit tests pass
2. `PW_PROJECT=test-app npx playwright test --config e2e/playwright.config.ts --project test-app` — all E2E tests pass

### Manual
3. **Select + scroll** — select an element → scroll the page → outline stays on the element without thrashing
4. **Inner scroll** — select an element inside a scrollable `<div>` (e.g., `overflow: auto; height: 200px`) → scroll that div → outline follows
5. **Insert near edges** — enter insert/browse mode → hover before the first child of a container → indicator shows the full-container dashed outline (not a line before first child)
6. **Insert in gap** — hover in a CSS gap between children → indicator appears at the correct gap
7. **Drag revert** — drag an element to a new position → drag back → element returns to exact original position
8. **No-op drag** — drag an element and drop it on itself → no move occurs
9. **AI context** — commit a patch involving an element in an `overflow: auto` container → verify the MCP context string doesn't contain vybit element references
