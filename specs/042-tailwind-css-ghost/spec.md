# 042 — Iframe CSS Ghost Rendering

## Problem

Ghost previews currently work by inlining computed styles onto every cloned DOM element. This approach has fundamental flaws:

1. **Cannot distinguish author-set vs layout-derived sizing.** `getComputedStyle` always resolves to pixels. A button with `w-12` (author intent: fixed 48px width) looks the same as a `<td>` that happened to compute to 114px from table layout math. We can't know which to inline and which to skip — inlining layout-derived widths locks the ghost to the extraction viewport width and prevents reflow.

2. **Two diverging code paths.** `extractAndApply()` (live iframe preview) uses full baseline-comparison, while `getComponentHtml()` previously used a hand-picked property list (`CHILD_STYLE_PROPERTIES`). Even after unifying them, the root problem remains: computed styles are a lossy snapshot.

3. **Bloated HTML.** Every element gets 30-60 inline style declarations. A calendar component produces thousands of CSS declarations that travel through WebSocket, cache, and DOM.

4. **Lost cascading behavior.** `:hover`, `:focus`, `::before`, `::after`, media queries, transitions, and animations are all lost — they can't be captured as computed styles.

5. **No theme reactivity.** Cached ghosts show stale colors/fonts if the target project changes theme variables.

This spec supersedes the inline-style approach and builds on spec 029 (adopted stylesheets) which identified the same problems.

## Proposed Solution

Replace inline style injection with **CSS collected directly from the Storybook iframe's `document.styleSheets`**. The ghost HTML keeps its original class names (Tailwind utilities, component library classes, etc.) with no inline styles on children. A collected CSS string travels alongside the HTML and is injected as a scoped stylesheet wherever the ghost is rendered.

### Core Idea

```
Storybook iframe (hidden, same-origin via proxy)
  │
  ├─ cloneNode(true) → raw HTML with all class names preserved
  │     (no injectChildStyles, no CHILD_STYLE_PROPERTIES)
  │
  ├─ Collect all CSS from document.styleSheets
  │     (filter out Storybook framework .sb-* rules and @font-face)
  │
  └─ ghostCss = collected CSS (Tailwind + component library CSS)
       │
       ├─ Panel card preview: inject CSS in shadow DOM
       ├─ Overlay cursor preview: inject CSS in ghost container
       ├─ Target app drop: inject CSS as <style> tag (covers classes not in app's build)
       └─ Cache: store ghostCss alongside ghostHtml
```

### Why Iframe CSS Collection?

We evaluated two alternatives:

**Spec 029 (adopted stylesheets):** Proposed the same CSS collection idea with `adoptedStyleSheets`. We use the same collection approach but simplify rendering — injecting `<style>` tags inside shadow DOM wrappers instead of requiring the `adoptedStyleSheets` API. The outcome is equivalent.

**`POST /css` (Tailwind-only compilation):** Would compile only Tailwind classes via the server. This misses non-Tailwind CSS entirely — component libraries like react-day-picker (`.rdp-*` classes), Tanstack Query (`.go3489*`), CSS modules, etc. Iframe collection captures everything with zero server round-trips.

### Empirical Data

Measured across stories on a real Storybook (Carton project, port 6006):

| Story | Tailwind | Component CSS | Storybook Junk | Total |
|---|---|---|---|---|
| Button | 43.4KB (544 rules) | 0KB | 6.7KB | 50.7KB |
| Badge | 43.4KB (544 rules) | 0KB | 6.7KB | 50.7KB |
| Calendar | 43.4KB (544 rules) | 8.8KB (60 rules, `.rdp-*`) | 6.7KB | 59.5KB |
| CaseDetails | 43.4KB (544 rules) | 55.2KB (343 rules, `.rdp-*` + `.go34*`) | 6.7KB | 105.9KB |

Key findings:
- **Tailwind CSS is identical across all stories** (same fingerprint: 44403:544). Vite builds it once.
- **Storybook framework CSS is constant** (~6.7KB, all `.sb-*` prefixed). Easy to filter.
- **Component CSS varies per story** — lazy-loaded by Vite when a component's module imports it.
- After filtering Storybook junk: **~44-99KB of useful CSS per story**.

## Architecture

### Data Flow

```
                        ┌─────────────────────┐
                        │  Storybook Iframe    │
                        │  (hidden, overlay)   │
                        └──────────┬──────────┘
                                   │
                          cloneNode(true)
                          collectIframeCss()
                                   │
                                   ▼
                        ┌─────────────────────┐
                        │  ghost-extracted     │
                        │  { ghostHtml,        │
                        │    ghostCss,         │
                        │    hostStyles,       │
                        │    storyBackground } │
                        └──────────┬──────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │               │
                    ▼              ▼               ▼
             ┌────────────┐ ┌──────────┐  ┌──────────────┐
             │ Panel       │ │ Cache    │  │ Overlay      │
             │ CardPreview │ │ Server   │  │ (cursor +    │
             │ (shadow DOM │ │ (stores  │  │  drop)       │
             │  + <style>) │ │  ghostCss│  │ (<style>     │
             │             │ │  field)  │  │  injection)  │
             └────────────┘ └──────────┘  └──────────────┘
```

### CSS Collection

Collect all CSS from the iframe's stylesheets, filtering out Storybook framework junk. Runs in the overlay (has access to the iframe document):

```ts
function collectIframeCss(doc: Document): string {
  const parts: string[] = [];

  for (const sheet of doc.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        const text = rule.cssText;
        // Skip Storybook framework CSS
        if (text.includes('.sb-') || text.includes('#storybook-')) continue;
        // Skip Storybook font faces (Nunito Sans)
        if (text.includes('Nunito Sans')) continue;
        parts.push(text);
      }
    } catch {
      // Cross-origin stylesheet — skip (shouldn't happen with proxy)
    }
  }

  return parts.join('\n');
}
```

This collects Tailwind utilities, component library CSS (`.rdp-*`, etc.), CSS custom property definitions, `@keyframes`, `@media` queries — everything the component needs.

### `:root` → `:host` Rewrite

CSS custom properties defined on `:root` in the iframe won't resolve inside a shadow DOM. Rewrite selectors:

```ts
function rewriteRootToHost(css: string): string {
  return css.replace(/:root/g, ':host');
}
```

This ensures Tailwind v4 theme tokens (`--color-*`, `--spacing-*`, etc.) and component library variables (`--rdp-accent-color`, etc.) resolve correctly inside the shadow DOM.

### Scoped Rendering (Shadow DOM)

Ghost HTML is rendered inside a shadow DOM to isolate the collected CSS from the panel's own Tailwind build:

```tsx
function GhostPreview({ ghostHtml, ghostCss }: { ghostHtml: string; ghostCss: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const shadow = hostRef.current.shadowRoot ?? hostRef.current.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>${ghostCss}</style>
      <div style="pointer-events:none">${ghostHtml}</div>
    `;
  }, [ghostHtml, ghostCss]);

  return <div ref={hostRef} />;
}
```

**Why shadow DOM:** The collected CSS contains standard Tailwind selectors (`.px-4`, `.flex`, etc.) that would collide with the panel's own Tailwind build. Shadow DOM provides complete CSS isolation — no risk of leaking in either direction.

### CSS Deduplication Across Stories

The Tailwind CSS sheet is identical across all stories (same Vite build). Only the component-specific CSS varies. To avoid storing ~44KB of identical Tailwind CSS per ghost entry:

1. **Phase 1 (simple):** Store `ghostCss` per entry. Duplicated Tailwind CSS across entries is harmless and keeps implementation simple.
2. **Phase 2 (optimization):** Split into `sharedCss` (Tailwind, stored once keyed by hash) + `componentCss` (per-entry, only the component-specific sheets). Ghost cache reconstructs the full CSS on read.

Phase 1 is sufficient — even with duplication, ~50KB per entry is much less than the current ~200KB of inline styles.

## Type Changes

### `GhostCacheEntry` (shared/types.ts)

```ts
export interface GhostCacheEntry {
  storyId: string;
  argsHash: string;
  ghostHtml: string;        // raw HTML with class names, no inline styles
  ghostCss?: string;         // NEW — collected CSS from iframe (Tailwind + component CSS)
  hostStyles: Record<string, string>;
  storyBackground?: string;
  componentName: string;
  componentPath?: string;
  extractedAt: number;
}
```

### `ComponentArmMessage` (shared/types.ts)

```ts
export interface ComponentArmMessage {
  type: 'COMPONENT_ARM';
  to: 'overlay';
  componentName: string;
  storyId: string;
  ghostHtml: string;
  ghostCss?: string;         // NEW — CSS for overlay cursor preview + drop injection
  componentPath?: string;
  args?: Record<string, unknown>;
  insertMode?: 'replace';
}
```

### `ghost-extracted` Event Detail

```ts
interface GhostExtractedDetail {
  ghostHtml: string;          // raw HTML with classes, no inline styles
  ghostCss: string;           // NEW — collected iframe CSS
  hostStyles: Record<string, string>;
  storyBackground?: string;
}
```

### Patch (shared/types.ts)

```ts
// Component-drop fields:
ghostHtml?: string;
ghostCss?: string;            // NEW — injected alongside ghost in target app
```

## File Changes

### Overlay

**`overlay/src/adaptive-iframe/adaptive-iframe.ts`**
- Add `collectIframeCss(doc)` function.
- `getComponentHtml()`: Return `root.cloneNode(true).outerHTML` — no inline style injection. Remove `extractStyles` and `injectChildStyles` calls from this method.
- `extractAndApply()`: Still uses `extractStyles()` + `applyStylesToHost()` for **host element sizing** (the adaptive-iframe custom element needs inline styles on itself to participate in panel layout). Add `collectIframeCss()` call. Emit `ghostCss` in the `ghost-extracted` event.
- Remove `injectChildStylesDeep()` function and `COMPONENT_INLINE_PROPS` constant (already removed).

**`overlay/src/adaptive-iframe/style-cloner.ts`**
- `extractStyles()`: Keep — still needed for host element sizing.
- `applyStylesToHost()`: Keep — still needed for host element sizing.
- `injectChildStyles()`: Remove from ghost production path. May still be needed temporarily for the live iframe preview in the adaptive-iframe shadow DOM during extraction.
- `SKIP_CHILD_PROPS`: Revert to skipping width/height — only used for the hidden extraction preview, not for ghostHtml output.
- `CHILD_STYLE_PROPERTIES` / `STYLE_PROPERTIES`: Can be cleaned up in Phase 4.

**`overlay/src/drop-zone.ts`**
- When receiving `COMPONENT_ARM`, store `ghostCss` alongside `ghostHtml`.
- When rendering the cursor-follower ghost, inject `ghostCss` as a `<style>` tag inside the ghost container.
- When dropping the component into the target app, inject `ghostCss` as a `<style id="vybit-ghost-css-{componentName}">` tag into the page head. This ensures all classes resolve — both Tailwind utilities and component library CSS — even if the target app's own build doesn't include them.

### Panel

**`panel/src/components/DrawTab/components/ComponentGroupItem/ComponentGroupItem.tsx`**
- On `ghost-extracted` event: receive `ghostCss` from the event detail.
- Store `ghostCss` in state.
- Pass `ghostCss` to `ComponentCardPreview`.
- Include `ghostCss` in `onGhostExtracted` callback for cache storage.
- Include `ghostCss` in `onArm` callback for the `COMPONENT_ARM` message.

**`panel/src/components/DrawTab/components/ComponentCardPreview/ComponentCardPreview.tsx`**
- Accept `ghostCss` prop.
- Render ghost HTML inside a shadow DOM wrapper with the collected CSS as a `<style>` tag.
- Shadow DOM provides full CSS isolation from the panel's own styles.

**`panel/src/components/DrawTab/hooks/useComponentCardState.ts`**
- Add `ghostCss: string | null` to `CardState`.
- Store `ghostCss` on `GHOST_EXTRACTED` action (no separate compilation step needed — CSS comes directly from the iframe).
- Clear `ghostCss` on args change.

**`panel/src/hooks/useGhostCache.ts`**
- `getCachedGhost()` returns `ghostCss` from cache entry.
- `submitToCache()` accepts `ghostCss` parameter.

**`panel/src/components/DrawTab/DrawTab.tsx`**
- Pass `cachedGhostCss` alongside `cachedGhostHtml` to `ComponentGroupItem`.
- Include `ghostCss` in the `COMPONENT_ARM` message.

### Server

**`server/ghost-cache.ts`**
- Add `ghostCss` field to cache entry storage.
- No other server changes needed — no `POST /css` call required.

### Shared

**`shared/types.ts`**
- Add `ghostCss` to `GhostCacheEntry`, `ComponentArmMessage`, and component-drop patch fields.

## Migration

### Phase 1: Panel Preview (this spec)

Focus on the panel card preview only:

1. Add `collectIframeCss()` to adaptive-iframe
2. Modify `getComponentHtml()` to emit raw HTML (no inline styles on children)
3. Emit `ghostCss` in `ghost-extracted` event
4. `ComponentCardPreview` renders ghost in shadow DOM with collected CSS
5. Cache stores `ghostCss`

**Verification:** Component cards in Place/Replace tab render identically to Storybook for all test-app stories (Button, Calendar, Badge, etc.) and the external Storybook components (Carton).

### Phase 2: Overlay Cursor + Drop

6. `COMPONENT_ARM` carries `ghostCss`
7. Overlay cursor preview injects `ghostCss`
8. Drop injects `ghostCss` into target app as `<style>` tag — ensures all classes resolve, including Tailwind utilities and component library CSS that may not be in the target app's own build

**Verification:** Armed cursor shows correct ghost preview. Dropped component renders correctly in target app even for classes not in the app's Tailwind build.

### Phase 3: Cleanup

9. Remove `injectChildStyles()` from the ghost production path
10. Remove `SKIP_CHILD_PROPS`, `CHILD_STYLE_PROPERTIES` complexity
11. Remove inline style code accumulated during debugging (GhostDebug logs, etc.)
12. Simplify `applyStylesToHost()` — only needed for host element layout, not ghost rendering

### Phase 4: Optimization (stretch)

13. Deduplicate shared Tailwind CSS across cache entries (store once, keyed by hash)
14. Optionally compress `ghostCss` before storing in cache (gzip — 44KB Tailwind compresses well)

## Risks and Mitigations

### Cross-Origin Stylesheets

If Storybook loads CSS from a different origin, `sheet.cssRules` throws a `SecurityError`.

**Mitigation:** Our Storybook proxy serves the iframe on the same origin as the server. All stylesheets should be accessible. If any cross-origin sheet is encountered, skip it — component CSS is typically bundled inline by Vite, not loaded from CDNs.

### CSS Size

The full collected CSS is ~50-100KB per story depending on component dependencies.

**Mitigation:**
- Still much smaller than the current approach (inline styles produce ~200KB+ for complex components)
- Shared across all consumers (panel, overlay, drop) — collected once per extraction
- Compresses well in cache (Tailwind utilities are highly repetitive)
- Shadow DOM ensures no performance impact from unused rules

### Storybook Framework CSS Leaking Through

The `.sb-*` filter might miss some Storybook framework rules that don't use the `sb-` prefix.

**Mitigation:** The Storybook framework CSS is rendered inside shadow DOM alongside the ghost — any Storybook rules that leak through won't match ghost HTML elements (no `.sb-*` classes in component markup). They're harmless dead rules. We can refine the filter iteratively.

### Hover/Focus Pseudo-classes in Panel

Collected CSS includes hover/focus styles. In the panel preview, these could trigger visual changes.

**Mitigation:** The ghost preview container has `pointer-events: none`. Hover/focus states won't trigger inside the shadow DOM.

### Different Tailwind Versions (Target App vs Storybook)

The target app and Storybook may use different Tailwind versions or configs where the same class name resolves differently.

**Mitigation:** The ghost CSS from the iframe is authoritative — it's what the component was designed to look like. At drop time, the injected `ghostCss` takes precedence for the ghost element. After the agent implements the component in source code, the target app's own Tailwind build takes over on next rebuild.

### Component CSS Not Yet Loaded

Storybook lazy-loads CSS per component. If `collectIframeCss()` runs before the component's CSS is injected, it'll be missing.

**Mitigation:** `extractAndApply()` already waits for the story to render before extracting. By the time we collect CSS, Vite has injected all necessary `<style>` tags for the component and its dependencies.

## Testing

- All existing `ComponentGroupItem` tests continue to pass
- Panel card previews for Button, Calendar, Badge match Storybook rendering
- Panel card previews for Carton components (CaseDetails, etc.) render correctly including non-Tailwind CSS (.rdp-*, .go34*)
- Cached ghosts render identically to live-extracted ghosts
- No CSS leakage from ghost into panel UI (shadow DOM isolation)
- Drop into target app renders correctly — including Tailwind classes not in the app's own build
- Args changes produce updated ghost with correct CSS
- Empty cache → load stories → cache populated with `ghostCss` → reload → cached ghosts render correctly
- Cross-origin stylesheets are gracefully skipped without breaking extraction
