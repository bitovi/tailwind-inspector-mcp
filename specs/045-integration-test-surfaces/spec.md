# 045 — Integration Test Surfaces

Three focused test surfaces for the most complex, bug-prone subsystems: **fiber walking**, **ghost extraction**, and **ghost stitching**. Each surface is designed so a human can spot-check visually *and* CI can assert programmatically.

---

## Motivation

Unit tests exist for serialization (`fiber-serialize.test.ts`), URL building (`useArgsUrl.test.ts`), and state machines (`useComponentCardState.test.ts`), but the *integration points* — where multiple layers combine — are untested:

1. **Fiber walking:** Given real JSX rendered to a DOM, does clicking a selector return the right component name, props, path label, and repeated siblings?
2. **Ghost extraction:** Given a Storybook story, does the adaptive iframe produce correct ghost HTML/CSS that visually matches the original?
3. **Ghost stitching:** Given a parent ghost with `⊞slot` markers and child component ghosts with custom props, does the stitched result render correctly?

These are the areas where bugs keep appearing — new component patterns, edge-case fiber trees, CSS that doesn't clone properly, slot markers that don't substitute.

---

## Surface 1: Fiber Walking — `getInfo(jsx, selector)`

### Concept

A Vitest integration test file that renders real React JSX into jsdom, then calls fiber-walking functions against CSS selectors. Each test is a self-contained scenario.

```ts
// overlay/src/fiber-integration.test.tsx
import { render } from '@testing-library/react';
import { getFiber, findComponentBoundary, buildPathLabel, extractComponentProps, findInlineRepeatedNodes, serializeProps } from './fiber';

function getInfo(container: HTMLElement, selector: string) {
  const el = container.querySelector(selector)!;
  const fiber = getFiber(el);
  const boundary = findComponentBoundary(fiber);
  const pathLabel = boundary ? buildPathLabel(fiber, boundary) : null;
  const props = boundary ? extractComponentProps(boundary.componentFiber) : null;
  const repeated = boundary ? findInlineRepeatedNodes(fiber, boundary.componentFiber) : [];

  // Walk ALL component boundaries from this element up to the root.
  // This is the key thing — for Component > Component > Component,
  // we want to verify every layer is reachable.
  const boundaries: Array<{ name: string; props: Record<string, unknown> | null }> = [];
  let current = fiber;
  while (current) {
    const b = findComponentBoundary(current);
    if (!b) break;
    boundaries.push({
      name: b.componentName,
      props: extractComponentProps(b.componentFiber),
    });
    current = b.componentFiber; // continue walking from this boundary's fiber
  }

  return { fiber, boundary, pathLabel, props, repeated, boundaries, el };
}

// Usage:
// const info = getInfo(container, '.badge-span');
// info.boundaries → [
//   { name: 'Badge', props: { color: 'red', children: 'Error' } },
//   { name: 'Card',  props: { title: 'Alert', ... } },
//   { name: 'Page',  props: { children: { __reactElement: true, ... } } },
// ]
```

### Test Cases

Each test renders JSX, queries a selector, and asserts structured output:

#### Basic Components

| # | Scenario | JSX | Selector | Key Assertions |
|---|----------|-----|----------|----------------|
| 1 | Simple component | `<Button variant="primary">Click</Button>` | `button` | `boundary.componentName === 'Button'`, props has `variant: 'primary'`, `children: 'Click'` |
| 2 | forwardRef component | `forwardRef(function Input(props, ref) {...})` | `input` | `boundary.componentName === 'Input'` |
| 3 | memo wrapper | `memo(function Tag({label}) {...})` | the tag element | `boundary.componentName === 'Tag'` |
| 4 | displayName override | Component with `displayName = 'CustomName'` | its DOM output | `boundary.componentName === 'CustomName'` |
| 5 | No component boundary | `<div><span>plain</span></div>` (no React component wrapper) | `span` | `boundary === null` |

#### Nesting — Component in Component in Component

The core scenario: when a user clicks a deeply nested DOM element, `findComponentBoundary` must find the *nearest* component, and walking `.return` further must reach each ancestor component correctly.

| # | Scenario | JSX | Selector | Key Assertions |
|---|----------|-----|----------|----------------|
| 6 | 2-deep: Card → Badge | `<Card title="T" description="D" tag="New" />` (Card renders Badge internally) | `.rounded-full` (the Badge span) | `boundary.componentName === 'Badge'`; walking `.return` from Badge boundary finds `Card` |
| 7 | 3-deep: Page → Card → Badge | `<Page><Card tag="New" .../></Page>` | Badge's `<span>` | First boundary = `Badge`, second = `Card`, third = `Page` — all three are reachable by repeated `findComponentBoundary` on `.return` |
| 8 | 3-deep with slots: Layout → Sidebar → NavItem | `<Layout><Sidebar><NavItem label="Home"/></Sidebar></Layout>` | NavItem's inner element | `boundary.componentName === 'NavItem'`; second boundary = `Sidebar`; third = `Layout` |
| 9 | Component renders another via prop: Button → Icon via leftIcon | `<Button leftIcon={<Icon name="star"/>}>Save</Button>` | the icon's `<svg>` | `boundary.componentName === 'Icon'`; parent boundary = `Button`; Button's props include `leftIcon` as serialized `{ __reactElement: true, componentName: 'Icon' }` |
| 10 | 4-deep: App → Dashboard → StatsCard → Badge | `<App><Dashboard><StatsCard metric="Users" badge="Live"/></Dashboard></App>` | Badge's span | Four reachable boundaries: Badge → StatsCard → Dashboard → App |
| 11 | Same component nested: Tree → Tree → Tree | `<Tree label="root"><Tree label="child"><Tree label="leaf"/></Tree></Tree>` | Leaf Tree's element | Three `Tree` boundaries, each with different `label` prop. Verifies fiber walking doesn't confuse same-name components at different depths |
| 12 | Component wrapping host elements: Card → div → Badge | Card renders `<div className="wrapper"><Badge .../></div>` — the `<div>` is a host element, not a component | Badge's span | Boundary skips the wrapper `<div>` (host element), lands on `Badge`, then jumps to `Card` |

#### Path Labels

| # | Scenario | JSX | Selector | Key Assertions |
|---|----------|-----|----------|----------------|
| 13 | Path through host elements | `<Button><span className="icon">★</span> Go</Button>` | `.icon` | `pathLabel.label` contains `Button > button[0] > span[0]` (indices through host elements) |
| 14 | Path through nested components | Click a deep leaf in the 4-deep case | the Badge span | Path label includes the component name at the boundary, then host element indices below it |

#### Props Extraction at Each Depth

| # | Scenario | JSX | Selector | Key Assertions |
|---|----------|-----|----------|----------------|
| 15 | Props at leaf | 3-deep: Page → Card → Badge(`color="red"`) | Badge span | `extractComponentProps(badgeBoundary)` → `{ color: 'red', children: ... }` |
| 16 | Props at middle | Same tree, examine Card | — | `extractComponentProps(cardBoundary)` → `{ title: ..., description: ..., tag: ... }` |
| 17 | Props at root | Same tree, examine Page | — | `extractComponentProps(pageBoundary)` → `{ children: <serialized Card element> }` |
| 18 | ReactNode props serialize correctly | `<Button leftIcon={<Icon name="star" size={16}/>}>Go</Button>` | — | Button's `leftIcon` prop serializes to `{ __reactElement: true, componentName: 'Icon', props: { name: 'star', size: 16 } }` |

#### Repeated / List Patterns

| # | Scenario | JSX | Selector | Key Assertions |
|---|----------|-----|----------|----------------|
| 19 | Simple repeated items | `<ul>{items.map(i => <Li key={i}>{i}</Li>)}</ul>` (5+ items) | first `<li>` | `repeated.length >= 5`, all `<li>` elements returned |
| 20 | Repeated nested components | `<List>{items.map(i => <Card key={i} .../>)}</List>` (5+ items) | Badge span inside first Card | Repeated nodes found for the Badge *or* the Card level (whichever has more same-type siblings) |
| 21 | Repeated with active outlier | Same list, but one Card has an extra `active` className | click the active Card's child | Still finds all siblings (≤1 outlier tolerance) |

#### Edge Cases

| # | Scenario | JSX | Selector | Key Assertions |
|---|----------|-----|----------|----------------|
| 22 | Fragment wrapper | `<><Badge .../><Badge .../></>` | first Badge's span | Boundary is `Badge`, not confused by Fragment |
| 23 | Context provider nesting | `<ThemeProvider><App><Button/></App></ThemeProvider>` | `button` | Boundary is `Button`, not `ThemeProvider` (providers are components but typically have no DOM) |
| 24 | Higher-order component | `const Enhanced = withTooltip(Button)` | `button` | Boundary name resolves through the HOC (may be `withTooltip(Button)` or `Button` depending on displayName) |

### File Location

```
overlay/src/fiber-integration.test.tsx
```

### Test Environment

Runs in the **root vitest config** — currently uses `environment: 'node'`, but these tests need jsdom + React rendering. Options:

- **Option A:** Add `// @vitest-environment jsdom` pragma at top of this file (Vitest supports per-file environment overrides).
- **Option B:** Move to `panel/` vitest config which already uses jsdom. But fiber code lives in `overlay/`. Cross-package import is fine since they share a workspace.

**Recommendation:** Option A — keep the test next to the code, use the pragma.

### Dependencies

- `@testing-library/react` (already in panel; add to root devDependencies or use `react-dom/client` directly)
- Simple test components defined inline in the test file (not imported from test-app)
- No Storybook, no server, no WebSocket

### Growing the Suite

When a new bug appears in fiber walking (e.g. a component wrapped in `React.lazy`, or an Angular-style host element), add a new row to this file. The pattern is always: render JSX → query selector → assert `getInfo` output.

---

## Surface 2: Ghost Extraction — Visual Comparison Page

### Concept

A **standalone HTML page** (served by the dev server) that loads stories **one at a time** through the adaptive-iframe extraction pipeline, displaying the source iframe and extracted ghost side by side in each row.

```
[ Source iframe (the one used for extraction) ] [ Ghost preview (shadow DOM) ] [ ✓/✗ status ]
```

A human opens the page to spot-check; Playwright can screenshot and compare.

### Key Constraint: Sequential Loading

We've hit resource contention issues loading many Storybook iframes in parallel (100s of HTTP requests per domain). Stories **must be loaded one at a time** — finish extracting one, then start the next.

The adaptive-iframe already supports this via `navigateToStory(storyId)` (sends `setCurrentStory` postMessage to reuse a single iframe). The comparison page should use this approach:

1. Create a **single `<adaptive-iframe>`** element
2. For each story in the fixture list, call `navigateToStory(storyId)`
3. Wait for the `ghost-extracted` event
4. Capture the ghost HTML/CSS and the source iframe state
5. Render the completed row, then move to the next story

### Debug Mode on `<adaptive-iframe>`

Today the adaptive-iframe's source iframe is invisible (`opacity: 0`, `position: fixed`, `z-index: -999999`). For the comparison page, we need to **see** that iframe alongside the ghost — but we don't want to load a *separate* display iframe (that doubles the load).

Add a `debug` attribute to `<adaptive-iframe>`:

```html
<adaptive-iframe src="..." debug></adaptive-iframe>
```

When `debug` is set:
- The hidden source iframe becomes **visible** and positioned **inline** (not fixed/offscreen)
- The host element renders both: source iframe on the left, ghost container on the right
- The iframe that does the extraction *is* the iframe the human sees — no duplication

Implementation sketch for `adaptive-iframe.ts`:

```ts
// In connectedCallback or attributeChangedCallback:
if (this.hasAttribute('debug')) {
  // Make the extraction iframe visible and inline instead of hidden
  Object.assign(this.hiddenIframe.style, {
    position: 'relative',
    left: 'auto',
    top: 'auto',
    opacity: '1',
    pointerEvents: 'auto',
    zIndex: 'auto',
  });
  // Append it inside the shadow DOM instead of document.body
  this.shadow.appendChild(this.hiddenIframe);
} else {
  // Normal behavior: hidden iframe on document.body
  document.body.appendChild(this.hiddenIframe);
}
```

The shadow DOM layout in debug mode:

```
<adaptive-iframe debug>
  #shadow-root
    <style>
      :host([debug]) { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      :host([debug]) iframe { position: relative; opacity: 1; ... }
    </style>
    <iframe>          ← the extraction iframe, now visible
    <div part="ghost"> ← the ghost clone, as usual
```

This way the comparison page doesn't need any special plumbing — it just sets `debug` on each adaptive-iframe and the side-by-side layout is automatic.

### Implementation

#### Page: `test-app/ghost-comparison.html`

A small page (vanilla TS, no React needed) that:

1. Fetches the story fixture list (hardcoded or from `/storybook/index.json`)
2. Creates one `<adaptive-iframe debug>` per row, but **only loads one at a time** (sequential queue)
3. For each story:
   a. Sets `src` (or calls `navigateToStory`) on the adaptive-iframe
   b. Waits for `ghost-extracted` event
   c. Marks the row as done, captures ghost HTML/CSS for the side-by-side
   d. Moves to the next story
4. Shows a progress bar: "3/7 stories extracted..."

#### Ghost Extraction Strategy

Uses `<adaptive-iframe debug>` directly — the extraction iframe *is* the display iframe. No separate loading strategy needed. The `debug` attribute makes the normally-hidden source iframe visible and inline.

#### Story Fixture List

A curated JSON array of stories to test, covering edge cases:

```ts
const GHOST_TEST_STORIES = [
  // Basic components
  { id: 'components-button--primary', label: 'Button (primary)' },
  { id: 'components-button--secondary', label: 'Button (secondary)' },
  { id: 'components-badge--blue', label: 'Badge (blue)' },

  // Components with slots / children
  { id: 'components-card--default', label: 'Card (has nested Badge)' },
  { id: 'components-button--with-icon', label: 'Button with leftIcon slot' },

  // Edge cases
  { id: 'components-icon--star', label: 'Icon (SVG content)' },
  { id: 'components-tag--default', label: 'Tag (simple)' },
];
```

As new components or edge cases appear, add rows here.

#### Page Layout

```
┌─────────────────────────────────────────────────────────┐
│  Ghost Extraction Test                  [3/7 extracted]  │
├─────────────────────────────────────────────────────────┤
│  Button (primary)                                ✓ Done  │
│  ┌──────────────────┐  ┌──────────────────┐              │
│  │  Source iframe    │  │  Ghost clone     │              │
│  │  (extraction src) │  │  (shadow DOM)    │              │
│  └──────────────────┘  └──────────────────┘              │
├─────────────────────────────────────────────────────────┤
│  Card (has nested Badge)                         ✓ Done  │
│  ┌──────────────────┐  ┌──────────────────┐              │
│  │  Source iframe    │  │  Ghost clone     │              │
│  │  (extraction src) │  │  (shadow DOM)    │              │
│  └──────────────────┘  └──────────────────┘              │
├─────────────────────────────────────────────────────────┤
│  Icon (SVG content)                          ⏳ Loading   │
│  ┌──────────────────┐  ┌──────────────────┐              │
│  │  Loading...       │  │  (waiting)       │              │
│  └──────────────────┘  └──────────────────┘              │
├─────────────────────────────────────────────────────────┤
│  Tag (simple)                                  · Queued   │
│  ...                                                     │
└─────────────────────────────────────────────────────────┘
```

Each row is an `<adaptive-iframe debug>` — the left pane is the actual extraction iframe, the right is the ghost clone. No duplicate iframes.

#### Playwright E2E Test

```ts
// test-app/e2e/ghost-comparison.spec.ts
test('ghost extraction matches storybook for all test stories', async ({ page }) => {
  await page.goto('http://localhost:3333/ghost-comparison.html');
  // Wait for all extractions to complete
  await page.waitForSelector('[data-status="done"]', { state: 'attached' });
  // Screenshot comparison
  await expect(page).toHaveScreenshot('ghost-comparison.png', { maxDiffPixels: 100 });
});
```

#### File Locations

```
test-app/ghost-comparison.html          ← the visual page
test-app/ghost-comparison.ts            ← script for the page (or inline)
test-app/e2e/ghost-comparison.spec.ts   ← Playwright screenshot test
```

#### Prerequisites

- Storybook running (port 6008 or 6007)
- Server running (port 3333, proxying Storybook)
- `overlay.js` built (for adaptive-iframe custom element)

---

## Surface 3: Ghost Stitching — Visual Comparison Page

### Concept

Similar to Surface 2, but tests **prop editing → ghost regeneration**. A page that:

1. Loads a set of **component + prop combinations** sequentially (one at a time, same resource constraint)
2. For each combo: builds the Storybook args URL, extracts ghost via `<adaptive-iframe debug>`, stitches slot markers, renders the result
3. Shows: `[ Source iframe w/ those args ] [ Stitched ghost ]`

Uses the same `debug` mode — the extraction iframe *is* the left-side display. For stitching cases (ReactNode slots with component values), the page additionally calls `stitchGhostSlots()` on the extracted ghost and shows the stitched result as a third column.

This tests the full chain: `argsToStorybookArgs()` → URL encoding → iframe load → ghost extract → `stitchGhostSlots()` → render.

### Fixture List

```ts
const STITCH_TEST_CASES = [
  // Simple prop overrides
  {
    label: 'Badge: color=red',
    storyId: 'components-badge--blue',
    args: { color: 'red', children: 'Error' },
  },
  {
    label: 'Button: variant=secondary',
    storyId: 'components-button--primary',
    args: { variant: 'secondary', children: 'Cancel' },
  },

  // ReactNode slot with text
  {
    label: 'Button: leftIcon as text SVG',
    storyId: 'components-button--primary',
    args: {
      children: 'Save',
      leftIcon: { type: 'text', value: '<svg>...</svg>' },
    },
  },

  // ReactNode slot with component (stitching)
  {
    label: 'Button: leftIcon = Icon(star)',
    storyId: 'components-button--primary',
    args: {
      children: 'Save',
      leftIcon: {
        type: 'component',
        componentName: 'Icon',
        storyId: 'components-icon--star',
        args: { name: 'star' },
        ghostHtml: '<svg class="w-4 h-4">...</svg>',  // pre-extracted or extracted live
        ghostCss: '',
      },
    },
  },

  // Nested stitching: Card → Badge with custom color
  {
    label: 'Card with red Badge',
    storyId: 'components-card--default',
    args: { title: 'Alert', description: 'Something happened', tag: 'Urgent' },
    // Card internally renders Badge — test that the ghost captures the composition
  },
];
```

### Page Layout

Same side-by-side pattern as Surface 2, with an optional third column for stitch cases:

```
┌──────────────────────────────────────────────────────────────────────┐
│  Ghost Stitching Test                                  [3/5 done]    │
├──────────────────────────────────────────────────────────────────────┤
│  Badge: color=red                                            ✓ Done  │
│  ┌──────────────┐  ┌──────────────┐                                  │
│  │ Source iframe │  │ Ghost clone  │  (no stitch — simple prop)      │
│  └──────────────┘  └──────────────┘                                  │
├──────────────────────────────────────────────────────────────────────┤
│  Button: leftIcon = Icon(star)                               ✓ Done  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ Source iframe │  │ Raw ghost    │  │ Stitched     │               │
│  │ (w/ ⊞marker) │  │ (has ⊞)     │  │ (Icon inlined│               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
├──────────────────────────────────────────────────────────────────────┤
│  Card with red Badge                                     ⏳ Loading   │
│  ...                                                                 │
└──────────────────────────────────────────────────────────────────────┘
```

For cases with ReactNode component slots, all three columns show:
1. **Source iframe** — what Storybook actually renders (with ⊞ markers as text)
2. **Raw ghost** — extracted HTML before stitching (markers visible)
3. **Stitched ghost** — after `stitchGhostSlots()` replaces markers with child ghosts

### Unit Test Layer (Vitest)

The pure stitching functions can also be tested without a browser — these complement the visual page:

```ts
// panel/src/components/DrawTab/utils/stitch-ghost-slots.test.ts
describe('stitchGhostSlots', () => {
  it('replaces a single slot marker with child ghostHtml', () => {
    const result = stitchGhostSlots(
      '<div><span>⊞iconLeft</span></div>',
      '.parent { color: red }',
      {
        iconLeft: {
          type: 'component',
          componentName: 'Icon',
          storyId: 'icon--star',
          ghostHtml: '<svg class="icon">★</svg>',
          ghostCss: '.icon { width: 16px }',
        },
      },
    );
    expect(result.ghostHtml).toBe('<div><span><svg class="icon">★</svg></span></div>');
    expect(result.ghostCss).toContain('.parent { color: red }');
    expect(result.ghostCss).toContain('.icon { width: 16px }');
  });

  it('handles nested slots (child that itself has slots)', () => { ... });
  it('leaves non-component ReactNodeArgValues alone', () => { ... });
  it('handles missing ghostHtml gracefully', () => { ... });
  it('deduplicates CSS from multiple children', () => { ... });
});

describe('argsToStorybookArgs', () => {
  it('converts text ReactNodeArgValue to raw string', () => { ... });
  it('converts component ReactNodeArgValue to ⊞marker', () => { ... });
  it('passes primitive args through', () => { ... });
});
```

#### File Locations

```
test-app/ghost-stitching.html                          ← visual page
test-app/ghost-stitching.ts                            ← script
test-app/e2e/ghost-stitching.spec.ts                   ← Playwright screenshot test
panel/src/components/DrawTab/utils/stitch-ghost-slots.test.ts  ← Vitest unit tests
```

---

## Summary: What Lives Where

| Surface | Unit Tests (Vitest) | Visual Page | E2E (Playwright) |
|---------|-------------------|-------------|-------------------|
| **Fiber walking** | `overlay/src/fiber-integration.test.tsx` | — | — |
| **Ghost extraction** | — | `test-app/ghost-comparison.html` | `test-app/e2e/ghost-comparison.spec.ts` |
| **Ghost stitching** | `panel/.../stitch-ghost-slots.test.ts` | `test-app/ghost-stitching.html` | `test-app/e2e/ghost-stitching.spec.ts` |

### Design Principles

1. **Easy to add cases.** Each surface is a list — add a row when you hit a new edge case.
2. **Human-inspectable.** The visual pages are useful standalone, not just for CI.
3. **Layered.** Pure functions get unit tests. Integration points get visual pages. Both get CI coverage.
4. **No mocking of the thing under test.** Fiber tests use real React rendering. Ghost tests use real Storybook. Stitch tests use real extraction.

---

## Implementation Order

1. **Fiber integration tests** — fastest to implement, no infrastructure needed, highest bug density
2. **Stitch unit tests** — pure functions, no browser needed, catches slot-marker bugs
3. **Ghost comparison page** — needs running Storybook, but high visual payoff
4. **Ghost stitching page** — builds on ghost comparison page, adds props
5. **Playwright screenshot tests** — added once pages are stable

---

## Open Questions

- **jsdom fiber compatibility:** Does `@testing-library/react` in jsdom create real `__reactFiber$` properties on DOM nodes? If not, we may need a thin `renderAndGetFiber()` helper that accesses React internals. (Likely yes — RTL uses `react-dom` which attaches fibers.)
- **Adaptive iframe in test pages:** Can we reuse the `<adaptive-iframe>` custom element outside the panel, or do we need a standalone extraction script?
- **Screenshot stability:** Ghost CSS may vary slightly between runs (e.g. Storybook injects different hashes). May need to strip dynamic class names before comparison.
