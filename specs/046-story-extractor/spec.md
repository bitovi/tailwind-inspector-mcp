# 046 — `createStoryExtractor()` Function API

## Problem

`AdaptiveIframe` is a custom element that was designed to be a visible "adaptive" component — showing either a live iframe or a ghost clone. Over time it became an invisible extraction engine hidden with `!important` styles. The custom element ceremony (shadow DOM, attribute observation, `connectedCallback` lifecycle) no longer serves a purpose. The name no longer describes what it does.

Today's architecture:

```
<adaptive-iframe>          ← hidden custom element, extraction engine
  shadow DOM:
    <iframe>               ← loads Storybook story
    <div part="ghost">     ← dead HTML clone, never displayed

fires ghost-extracted event → { ghostHtml, ghostCss }

<ShadowGhost>              ← separate React component renders the preview
  shadow DOM:
    <style>{ghostCss}</style>
    <div>{ghostHtml}</div>
```

Problems:
- **Name mismatch**: "AdaptiveIframe" doesn't describe "extract ghost data from a Storybook story"
- **Custom element overhead**: Shadow DOM, attribute observation, `observedAttributes`, `connectedCallback`/`disconnectedCallback` — none needed for an invisible worker
- **Dead ghost element**: The internal `<div part="ghost">` is never displayed; all rendering goes through `<ShadowGhost>`
- **`debug` attribute hack**: The comparison page needs a visible iframe, solved with a custom-element-specific workaround
- **Consumers fight the element**: Both `SharedGhostExtractor` and `ComponentGroupItem` immediately force `position: absolute; width: 0; height: 0; opacity: 0` with `!important` to hide it
- **Event-based API**: Custom events + `addEventListener` require manual cleanup; callback-based API is simpler

## Solution

Replace `AdaptiveIframe` with a plain function: `createStoryExtractor()`.

```ts
function createStoryExtractor(opts?: StoryExtractorOptions): StoryExtractor
```

No custom element, no shadow DOM, no attribute observation. Just a function that creates a hidden iframe, loads Storybook stories, and calls you back with ghost data.

## API

### Types

```ts
interface StoryExtractorOptions {
  /** Element to append the iframe into. Defaults to document.body (hidden). */
  iframeContainer?: HTMLElement;
  /** Iframe width for layout computation (default: 800). */
  width?: number;
  /** Iframe height (default: 600). */
  height?: number;
}

interface GhostData {
  ghostHtml: string;
  ghostCss: string;
  storyBackground: string;
  naturalWidth: number;
  naturalHeight: number;
}

interface NavigateOptions {
  storyId: string;
  args?: Record<string, unknown>;
  onExtracted: (data: GhostData) => void;
  onLoaded?: () => void;
  onError?: (error: string) => void;
}

interface StoryExtractor {
  /** Load a story by full URL. Replaces any previous callbacks. */
  load: (src: string, callbacks: ExtractCallbacks) => void;
  /** Navigate to a story in-place via Storybook channel message (fast, no reload). */
  navigate: (options: NavigateOptions) => void;
  /** Push new arg values to the current story (no reload). Triggers onExtracted again. */
  updateArgs: (storyId: string, args: Record<string, unknown>) => void;
  /** Read the current ghost HTML (for caching outside the callback). */
  getGhostHtml: () => string;
  /** Read the current ghost CSS. */
  getGhostCss: () => string;
  /** Remove the iframe from the DOM. */
  teardown: () => void;
}

interface ExtractCallbacks {
  onExtracted: (data: GhostData) => void;
  onLoaded?: () => void;
  onError?: (error: string) => void;
}
```

### `iframeContainer` behavior

| `iframeContainer` | Iframe placement | Iframe visibility | Use case |
|---|---|---|---|
| omitted / undefined | `document.body` | Hidden (`opacity:0, position:fixed, z-index:-999999`) | Normal app — extraction only |
| `<div id="source-0">` | Appended to that element | Visible (`opacity:1, position:relative, width/height:100%`) | Comparison page — see the source |

When `iframeContainer` is provided, the iframe is styled to fill its container and is visible. This replaces the `debug` attribute hack.

## Usage patterns

### Batch extraction (replaces `SharedGhostExtractor`)

```ts
const ext = createStoryExtractor();

for (const story of stories) {
  await new Promise<void>((resolve) => {
    ext.navigate({
      storyId: story.id,
      onExtracted: (data) => {
        cache.set(story.id, data);
        resolve();
      },
      onError: () => resolve(),
    });
  });
}

ext.teardown();
```

The first call uses `load()` internally (full page load). Subsequent calls use Storybook's `setCurrentStory` channel message for fast in-place navigation — same optimization as today's `SharedGhostExtractor`.

### Live prop editing (replaces per-component `<adaptive-iframe>`)

```ts
const ext = createStoryExtractor({ width: cardWidth });

ext.load(buildArgsUrl(storyId, {}), {
  onExtracted: (data) => updatePreview(data),
  onLoaded: () => releaseQueueSlot(),
  onError: (msg) => showError(msg),
});

// User changes props — no reload, just postMessage
ext.updateArgs(storyId, { label: 'Save', variant: 'primary' });
// → onExtracted fires again with updated ghost

// Component unmounts
ext.teardown();
```

### Ghost comparison page

```ts
// One extractor per row — iframe placed visibly in the source pane
for (const [idx, story] of stories.entries()) {
  const sourcePane = document.getElementById(`source-${idx}`);
  const ghostPane = document.getElementById(`ghost-${idx}`);

  const ext = createStoryExtractor({
    iframeContainer: sourcePane,
  });

  ext.load(
    `/storybook/iframe.html?id=${story.id}&viewMode=story&vybit-ghost=1`,
    {
      onExtracted: ({ ghostHtml, ghostCss, storyBackground }) => {
        renderShadowGhost(ghostPane, ghostHtml, ghostCss, storyBackground);
      },
      onError: (msg) => {
        ghostPane.textContent = `Error: ${msg}`;
      },
    },
  );

  // ext is NOT torn down — iframe stays visible in the source pane
}
```

Each row gets its own extractor with its own iframe. The `iframeContainer` makes the iframe visible and positioned inside the source pane. No need for the `debug` attribute hack, no hidden elements cluttering the bottom of the page.

### Sequential loading on comparison page

The comparison page should still load one story at a time to avoid saturating the browser's connection pool. Each row gets its own extractor (so the iframe stays visible), but loading is serialized:

```ts
for (const [idx, story] of stories.entries()) {
  const sourcePane = document.getElementById(`source-${idx}`);
  const ghostPane = document.getElementById(`ghost-${idx}`);

  await new Promise<void>((resolve) => {
    const ext = createStoryExtractor({ iframeContainer: sourcePane });
    ext.load(
      `/storybook/iframe.html?id=${story.id}&viewMode=story&vybit-ghost=1`,
      {
        onExtracted: (data) => {
          renderShadowGhost(ghostPane, data.ghostHtml, data.ghostCss, data.storyBackground);
          resolve();
        },
        onError: () => resolve(),
      },
    );
    // ext is NOT torn down — iframe stays visible in the source pane
  });
}
```

## Internal architecture

### What moves from `AdaptiveIframe`

| Responsibility | Current location | New location |
|---|---|---|
| Create hidden iframe | `AdaptiveIframe.constructor()` | `createStoryExtractor()` |
| Load story by URL | `triggerLoad()` + `attributeChangedCallback` | `extractor.load(src, callbacks)` |
| Wait for `#storybook-root` content | `waitForStoryContent()` + MutationObserver + polling | Same logic, internal to extractor |
| Navigate via `setCurrentStory` | `navigateToStory()` | `extractor.navigate()` |
| Update args via `updateStoryArgs` | `updateArgs()` | `extractor.updateArgs()` |
| Extract ghost HTML | `getComponentHtml()` | `extractor.getGhostHtml()` |
| Collect CSS from stylesheets | `collectIframeCss()` | Internal, result in `GhostData.ghostCss` |
| `@property` fallbacks | Applied by consumers (`ShadowGhost`, comparison page) | Applied internally — `ghostCss` includes fallbacks |
| Find story root | `findStoryRoot()` + `findPortalContent()` | Same logic, private helper |
| Measure natural dimensions | `extractAndApply()` | Internal, result in `GhostData` |
| Report errors | `reportError()` + `iframe-error` event | `onError` callback |
| Cleanup | `disconnectedCallback()` | `extractor.teardown()` |

### What's deleted

- `AdaptiveIframe` class (custom element)
- Shadow DOM (`this.attachShadow()`)
- `<div part="ghost">` element
- `observedAttributes` / `attributeChangedCallback`
- `connectedCallback` / `disconnectedCallback`
- `syncIframeWidth` (set once at creation via `opts.width`)
- The `debug` attribute and its special-case code
- `adaptive-iframe-standalone.ts` bundle entry point
- `overlay/src/adaptive-iframe/index.ts` (custom element registration)
- Server route for `/adaptive-iframe.js`

### CSS handling

The `ghostCss` returned by `onExtracted` will include `@property` fallbacks pre-applied. Consumers (`ShadowGhost`, comparison page helper) no longer need to call `propertyRulesToFallbacks()` themselves — it's done once inside the extractor.

The `collectIframeCss()` and `propertyRulesToFallbacks()` functions remain as internal utilities.

### `hostStyles` removal

The `GhostData` type does not include `hostStyles`. It was only used by the now-deleted `applyStylesToHost()`. Existing code that passes `hostStyles` through the cache pipeline should be updated to remove it (can be done incrementally — just pass `{}` during migration).

## File plan

### New files

| File | Purpose |
|---|---|
| `overlay/src/story-extractor.ts` | `createStoryExtractor()` implementation |
| `overlay/src/story-extractor.test.ts` | Unit tests (jsdom — mock iframe, verify callbacks) |

### Modified files

| File | Change |
|---|---|
| `panel/src/components/DrawTab/hooks/SharedGhostExtractor.ts` | Use `createStoryExtractor()` instead of creating `<adaptive-iframe>` |
| `panel/src/components/DrawTab/components/ComponentGroupItem/ComponentGroupItem.tsx` | Use `createStoryExtractor()` for live editing |
| `panel/src/components/DrawTab/hooks/useIframeQueue.ts` | Delete — no longer needed (see concurrency section) |
| `panel/src/components/ShadowGhost/ShadowGhost.tsx` | Remove `propertyRulesToFallbacks()` call (now in extractor) |
| `test-app/ghost-comparison.html` | Rewrite to use `createStoryExtractor({ iframeContainer })` |
| `test-app/ghost-stitching.html` | Same rewrite |
| `server/app.ts` | Remove `/adaptive-iframe.js` route |
| `shared/css-utils.ts` | `propertyRulesToFallbacks()` stays (used by extractor internally) |

### Deleted files

| File | Reason |
|---|---|
| `overlay/src/adaptive-iframe/adaptive-iframe.ts` | Replaced by `story-extractor.ts` |
| `overlay/src/adaptive-iframe/index.ts` | Custom element registration no longer needed |
| `overlay/src/adaptive-iframe-standalone.ts` | Standalone bundle entry no longer needed |
| `overlay/dist/adaptive-iframe.js` | Built artifact of deleted entry |

### Kept files

| File | Reason |
|---|---|
| `overlay/src/adaptive-iframe/css-collector.ts` | Move to `overlay/src/css-collector.ts` (used by extractor) |

## Implementation phases

### Phase 1: Build `createStoryExtractor()` standalone

1. Create `overlay/src/story-extractor.ts` extracting iframe management + extraction logic from `AdaptiveIframe`
2. Move `css-collector.ts` to `overlay/src/css-collector.ts`
3. Build `overlay/dist/story-extractor.js` (IIFE bundle for standalone HTML pages)
4. Rewrite `ghost-comparison.html` to use `createStoryExtractor({ iframeContainer })`
5. Verify on `http://localhost:3333/ghost-comparison.html` — each row shows source iframe + extracted ghost side by side

### Phase 2: Integrate into panel

1. Rewrite `SharedGhostExtractor` to use `createStoryExtractor()`
2. Rewrite `ComponentGroupItem` live-editing to use `createStoryExtractor()`
3. Remove `useIframeSlot` / `useProbeSlot` hooks if the extractor's internal queue makes them unnecessary (or keep them if they're still useful for coordinating multiple extractors)
4. Delete `overlay/src/adaptive-iframe/` directory
5. Remove `/adaptive-iframe.js` server route
6. Run full test suite

### Phase 3: Cleanup

1. Remove `hostStyles` from `GhostData` type and all cache pipeline code
2. Remove `propertyRulesToFallbacks()` from `ShadowGhost` (extractor handles it)
3. Update specs that reference `adaptive-iframe`

## Concurrency model

One extractor = one iframe. No global queue needed. Concurrency is controlled by the caller:

- **Batch loading** (`SharedGhostExtractor`): One extractor, call `navigate()` in a loop with `await`. One iframe, stories load sequentially.
- **Live editing** (`ComponentGroupItem`): Create a second extractor when user clicks "Customize". Two iframes may briefly coexist (shared + live-edit), but the shared one is typically idle by then.
- **Comparison page**: One extractor per row (for visible iframes), `load()` called sequentially via `await`.

The `useIframeSlot` / `useProbeSlot` hooks in `useIframeQueue.ts` are no longer needed — the serialization is handled naturally by the caller awaiting one extractor at a time.

## Open questions

1. **Should `ghostCss` include `@property` fallbacks, or should `ShadowGhost` still apply them?** Proposed: extractor applies them. Rationale: every consumer needs them, so do it once at the source.

2. **Bundle format**: The comparison page needs to load `createStoryExtractor` from a `<script>` tag. Options:
   - IIFE bundle exposing `window.createStoryExtractor` (like today's `adaptive-iframe.js`)
   - ES module `<script type="module">` with import
   - Proposed: IIFE for simplicity, same as today
