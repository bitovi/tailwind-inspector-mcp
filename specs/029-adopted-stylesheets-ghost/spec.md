# Adopted Stylesheets for Ghost Previews

## Problem

The adaptive iframe system clones story DOM and inlines computed styles onto every element to produce a "ghost" — a self-contained HTML snapshot that renders without external stylesheets. This approach has recurring issues:

1. **Allowlist drift.** We maintain two hand-curated property lists (`STYLE_PROPERTIES`, `CHILD_STYLE_PROPERTIES`). Missing a property (e.g. `align-items`, `gap`) causes silent rendering bugs that are hard to trace back to the cloner.
2. **Bloated ghost HTML.** Every child element gets ~40+ inline style declarations. A component with 20 elements produces thousands of CSS declarations that get cached to disk, sent over WebSocket, and parsed into DOM on drop.
3. **Lost cascade behavior.** Pseudo-classes (`:hover`, `:focus`), pseudo-elements (`::before`, `::after`), media queries, and animations are all lost — computed styles are a point-in-time snapshot of resolved values only.
4. **No theme reactivity.** If the user switches themes or updates CSS variables, cached ghosts show stale values.

## Proposed Solution

Replace inline style injection with **`adoptedStyleSheets`** — a browser API that lets multiple shadow roots share a single `CSSStyleSheet` object in memory.

Instead of:
- Clone innerHTML → walk every element → inline computed styles → serialize to `ghostHtml`

Do:
- Clone innerHTML (class names preserved) → adopt the story's CSS into the shadow root

### Core Idea

```
Storybook iframe (hidden, same-origin via proxy)
  │
  ├─ Collect all <style> and <link> CSS into a single CSSStyleSheet
  │
  └─ Share that sheet across all adaptive-iframe shadow roots
       via shadowRoot.adoptedStyleSheets = [sharedSheet]

Clone with cloneNode(true) — class names travel with the markup.
No inline style injection needed.
```

## How `adoptedStyleSheets` Works

```ts
// Create a stylesheet once
const sheet = new CSSStyleSheet();
await sheet.replace(cssText);  // or sheet.replaceSync(cssText)

// Share across multiple shadow roots — zero-copy, one object in memory
shadowRoot1.adoptedStyleSheets = [sheet];
shadowRoot2.adoptedStyleSheets = [sheet];
shadowRoot3.adoptedStyleSheets = [sheet];
```

- **Browser support:** Chrome 73+, Firefox 101+, Safari 16.4+. Fine for a dev tool.
- **Memory:** One stylesheet object shared by reference across all shadow roots.
- **Updates:** Calling `sheet.replace()` again updates all adopters instantly.

## Design

### CSS Collection

When the hidden Storybook iframe loads a story, collect all CSS:

```ts
function collectIframeCss(doc: Document): string {
  const parts: string[] = [];

  for (const sheet of doc.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        parts.push(rule.cssText);
      }
    } catch {
      // Cross-origin stylesheet — skip
    }
  }

  return parts.join('\n');
}
```

This runs once per story load (or once total if CSS is stable across stories).

### `:root` → `:host` Rewrite

CSS custom properties defined on `:root` in the Storybook iframe won't match inside a shadow DOM. Rewrite selectors:

```ts
function rewriteRootToHost(css: string): string {
  // Replace :root selectors with :host so CSS vars resolve inside shadow DOM
  return css.replace(/:root/g, ':host');
}
```

This is a simplification — a more robust approach would parse the CSS and rewrite only selector-position `:root` (not inside `var()` expressions), but `:root` inside `var()` doesn't occur in practice.

### Shared Stylesheet Manager

A singleton that maintains the shared `CSSStyleSheet` and provides it to all adaptive iframes:

```ts
class GhostStyleManager {
  private sheet = new CSSStyleSheet();
  private cssText = '';

  /** Update the shared stylesheet. All adopters see the change instantly. */
  async update(rawCss: string): Promise<void> {
    const rewritten = rewriteRootToHost(rawCss);
    if (rewritten === this.cssText) return; // no change
    this.cssText = rewritten;
    await this.sheet.replace(rewritten);
  }

  /** Return the shared sheet for a shadow root to adopt. */
  getSheet(): CSSStyleSheet {
    return this.sheet;
  }
}

export const ghostStyles = new GhostStyleManager();
```

### Adaptive Iframe Changes

In `AdaptiveIframe.extractAndApply()`:

**Before (current):**
1. `extractStyles(storyRoot)` → get computed styles for host
2. `applyStylesToHost(this, hostStyles)` → inline on host element
3. Clone `innerHTML` into ghost
4. `injectChildStyles(source, clone)` → walk + inline on every child
5. Emit `ghost-extracted` with `ghostHtml` (massive inlined HTML)

**After (proposed):**
1. `collectIframeCss(doc)` → get all CSS text from iframe
2. `ghostStyles.update(css)` → update shared sheet (one-time or incremental)
3. `this.shadowRoot.adoptedStyleSheets = [ghostStyles.getSheet()]`
4. `extractStyles(storyRoot)` → still extract root styles for host element sizing
5. `applyStylesToHost(this, hostStyles)` → inline on host (still needed for layout)
6. Clone `innerHTML` into ghost — **no `injectChildStyles()` call**
7. Emit `ghost-extracted` with lean `ghostHtml` (just markup + class names)

### Ghost Cache Changes

The ghost cache currently stores `ghostHtml` with all styles inlined. With this approach:

- **`ghostHtml`** becomes much smaller (just markup + class names)
- **`cssText`** (new field) stores the collected CSS from the Storybook iframe
- On cache restore, the `GhostStyleManager` is initialized with the cached `cssText`

```ts
interface GhostCacheEntry {
  storyId: string;
  argsHash: string;
  ghostHtml: string;           // now: lean HTML with class names only
  hostStyles: Record<string, string>;
  storyCssHash: string;        // hash of the CSS text (for cache invalidation)
  storyBackground?: string;
  componentName: string;
  componentPath?: string;
  extractedAt: number;
}
```

CSS text itself is stored once (not per-entry), keyed by hash:

```ts
// Separate cache: cssHash → cssText
// One entry covers all stories that share the same Storybook CSS bundle
```

### Drop Zone Changes

When a ghost is dropped into the target app, the HTML currently works because all styles are inlined. With adopted stylesheets, the dropped element needs the target app's own CSS (which is already present in the page). The ghost HTML only has class names, which resolve against whatever CSS is loaded.

This is actually **better** — the dropped component will pick up the target app's theme, CSS variables, and responsive behavior automatically.

## What This Fixes

| Issue | Current | With Adopted Stylesheets |
|-------|---------|-------------------------|
| Missing CSS properties | Silent rendering bugs | All properties work via cascade |
| Ghost HTML size | ~50-200KB per component | ~1-5KB per component |
| Pseudo-classes (`:hover`, `:focus`) | Lost | Work naturally |
| Pseudo-elements (`::before`) | Lost | Work naturally |
| CSS animations/transitions | Lost | Work naturally |
| Theme changes | Stale until re-extract | Live updates via `sheet.replace()` |
| Media queries in components | Lost | Work naturally |
| Ghost cache disk size | Large | Much smaller |

## Risks and Mitigations

### Different stories may have different CSS

Storybook lazily injects CSS per-story. Story A's stylesheet may not include Story B's component styles.

**Mitigation:** Accumulate CSS across story loads. Each time a new story loads, merge its CSS into the shared sheet. The sheet grows monotonically during a session. For cache, store the full accumulated CSS.

### Non-class selectors

Component libraries may use selectors like `button > span`, `[data-state="open"]`, or element selectors. These only work if the ghost DOM structure matches.

**Mitigation:** We already clone `innerHTML` faithfully — structure is preserved. Data attributes and element types travel with the clone. This is no worse than today.

### CSS specificity conflicts with panel CSS

The panel has its own Tailwind styles. Adopted Storybook CSS could conflict.

**Mitigation:** The adaptive iframe uses a shadow DOM — the adopted stylesheet is scoped to that shadow root and cannot leak into the panel.

### Large CSS bundles

A full Storybook CSS bundle could be 100KB+. 

**Mitigation:** It's a single shared object in memory (not duplicated per iframe). For disk cache, it's stored once (keyed by hash), not per ghost entry. Still likely smaller than the current per-element inlined approach.

### `@font-face` and asset URLs

CSS may reference fonts or images by relative URL. Inside the shadow DOM, those URLs need to resolve correctly.

**Mitigation:** When collecting CSS, rewrite relative URLs to absolute URLs against the Storybook origin. `@font-face` rules can be hoisted to document level since fonts are global.

## Implementation Plan

### Phase 1: Shared stylesheet + skip child inlining

1. Add `GhostStyleManager` to `overlay/src/adaptive-iframe/`
2. In `extractAndApply()`, collect iframe CSS and update the shared sheet
3. Set `adoptedStyleSheets` on the shadow root
4. Remove the `injectChildStyles()` call
5. Keep `extractStyles` + `applyStylesToHost` for the root element (host sizing)
6. Verify ghost previews render correctly for all test-app stories

### Phase 2: Cache integration

1. Add `storyCssHash` field to `GhostCacheEntry`
2. Store accumulated CSS text in a separate cache entry
3. On cache restore, initialize `GhostStyleManager` with cached CSS
4. Verify cached ghosts render correctly on cold start

### Phase 3: Theme reactivity (stretch)

1. When `CSS_VARS_SNAPSHOT` is received, update CSS variables in the shared sheet
2. All ghost previews update instantly without re-extraction
3. This ties into spec 027 (CSS var forwarding)

### Phase 4: Cleanup

1. Remove `CHILD_STYLE_PROPERTIES` list (no longer needed)
2. Remove `injectChildStyles()` function
3. Simplify `STYLE_PROPERTIES` to only the properties needed for host sizing
4. Remove `COMPONENT_INLINE_PROPS` from adaptive-iframe.ts

## Browser API Reference

```ts
// CSSStyleSheet (constructable)
const sheet = new CSSStyleSheet();
sheet.replaceSync(cssText);        // synchronous
await sheet.replace(cssText);      // async (supports @import)

// Adopting into shadow roots
shadowRoot.adoptedStyleSheets = [sheet1, sheet2];

// Updating — all adopters see the change
sheet.replaceSync(newCssText);
```
