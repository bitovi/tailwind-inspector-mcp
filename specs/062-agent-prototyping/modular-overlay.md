# Modular Overlay — Light DOM Web Components + Centralized CSS

## Problem

The overlay currently has **two competing styling architectures**:

1. **`OVERLAY_CSS` in `styles.ts`** — a single stylesheet injected into the overlay shadow root. Contains tokens, element toolbar, bottom toolbar, drawer, picker, and all other overlay component styles. This is the **original** and **complete** system.

2. **Shadow DOM Web Components** (`vb-modal-container`, `vb-sidebar-container`, `vb-popover-container`, `vb-bottom-toolbar`) — each creates its own shadow root and duplicates styles from `OVERLAY_CSS` (plus some unique additions).

This duplication creates real problems:
- **Bottom toolbar has TWO copies of its CSS** — one in `OVERLAY_CSS` (lines ~1192–1300) and one in `vb-bottom-toolbar.ts` (~140 lines). They can drift.
- **Container styles only exist in Web Component files** — not in `OVERLAY_CSS`. This means other code can't use the same class names.
- **Token definitions are triplicated** — in `OVERLAY_CSS` `:host` block, in `shared-styles.ts`, and in `shared/tokens/overlay-tokens.css`.
- **A button shouldn't own its styles** — it should inherit from the shared stylesheet.

## Insight

Everything in the overlay lives inside **one shadow root** (`#tw-visual-editor-host`). That shadow root already has a `<style>` element with `OVERLAY_CSS`. Any element inside that shadow root inherits those styles — **unless it creates its own shadow DOM**, which blocks inheritance.

Our Web Components are **blocking their own parent's styles** by creating shadow roots, then **re-declaring the same styles** inside their own shadows. That's the core problem.

## Solution: Light DOM Web Components

Remove `attachShadow()` from overlay Web Components. Keep the `class extends HTMLElement` for logic encapsulation (methods, attributes, events, lifecycle). Let styling come from the parent shadow root's `OVERLAY_CSS`.

**This is already proven** — `vb-design-canvas` uses light DOM (`this.appendChild()`, no shadow root) and works perfectly today.

### Architecture

```
#tw-visual-editor-host
  #shadow-root (the ONE shadow boundary)
    <style>OVERLAY_CSS (tokens + ALL component rules)</style>

    <vb-modal-container>               ← light DOM WC
      <div class="container-modal">    ← styled by OVERLAY_CSS
        <div class="drag-handle">...</div>
        <iframe>...</iframe>
      </div>
    </vb-modal-container>

    <vb-sidebar-container>             ← light DOM WC
      <div class="container-sidebar">
        <iframe>...</iframe>
      </div>
    </vb-sidebar-container>

    <vb-bottom-toolbar>                ← light DOM WC
      <div class="bottom-toolbar">    ← styled by OVERLAY_CSS (already there!)
        <button class="bt-combo">Select</button>
        <button class="bt-combo">Insert</button>
      </div>
    </vb-bottom-toolbar>

    <div class="el-toolbar">...</div>  ← plain DOM (stays as-is)
    <div class="el-picker">...</div>   ← plain DOM (stays as-is)
```

### What Web Components give us (without shadow DOM)

- **Custom element names** — `<vb-modal-container>`, queryable with `querySelector('vb-modal-container')`
- **Lifecycle** — `connectedCallback()`, `disconnectedCallback()`, `attributeChangedCallback()`
- **Methods** — `open(url)`, `close()`, `isOpen()`
- **Attribute observation** — `static get observedAttributes()`
- **Event encapsulation** — `this.addEventListener(...)`, `this.dispatchEvent(new CustomEvent(...))`
- **Internal state** — private fields, local variables
- **`display: contents`** — component wrapper doesn't affect layout

### What we deliberately give up

- **Style isolation** — not needed (everything is already in one shadow root)
- **Scoped class names** — not needed (we use intentional class names in `OVERLAY_CSS`)

## Implementation

### Phase 1: Merge missing container styles into `OVERLAY_CSS`

Container styles (`.container-modal`, `.container-sidebar`, `.container-popover`) currently only exist in the Web Component files. Add them to `OVERLAY_CSS` in `styles.ts`.

**Do NOT add bottom toolbar styles** — they're already in `OVERLAY_CSS` (lines ~1192–1300).

Files to modify:
- `overlay/src/styles.ts` — add container CSS rules to `OVERLAY_CSS`

### Phase 2: Convert Web Components to light DOM

For each of the 4 Web Components:

1. Remove `this.shadow = this.attachShadow({ mode: 'open' })`
2. Remove `<style>` element injection (no more per-component styles)
3. Change `this.shadow.appendChild(x)` → `this.appendChild(x)`
4. Change `this.shadow.querySelector(x)` → `this.querySelector(x)`
5. Add `this.style.display = 'contents'` in `connectedCallback()` (so the custom element doesn't affect layout)
6. Remove `private shadow: ShadowRoot` field

Files to modify:
- `overlay/src/web-components/vb-modal-container.ts`
- `overlay/src/web-components/vb-sidebar-container.ts`
- `overlay/src/web-components/vb-popover-container.ts`
- `overlay/src/web-components/vb-bottom-toolbar.ts`

### Phase 3: Clean up duplicated style infrastructure

- Delete `overlay/src/web-components/shared-styles.ts` (no longer needed — there are no per-component styles)
- Update `shared/tokens/overlay-tokens.css` to match the canonical tokens in `OVERLAY_CSS` `:host` block (these serve different audiences: `.css` file for mockups, `:host` block for runtime)

Files to modify:
- Delete `overlay/src/web-components/shared-styles.ts`
- `shared/tokens/overlay-tokens.css` — update to match full token set from `OVERLAY_CSS`

### Phase 4: Update Storybook stories

Overlay component stories need a parent that provides `OVERLAY_CSS` (since light DOM components don't carry their own styles). Two approaches:

**Option A: Storybook decorator** — A decorator that wraps each story in a shadow DOM host with `OVERLAY_CSS`:

```typescript
// panel/.storybook/overlay-decorator.ts
import { OVERLAY_CSS } from '../../overlay/src/styles';

export function withOverlayStyles(storyFn) {
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = OVERLAY_CSS;
  shadow.appendChild(style);

  const content = storyFn();
  if (content instanceof HTMLElement) {
    shadow.appendChild(content);
  }
  return host;
}
```

**Option B: `<vb-overlay-host>` helper** — A minimal Web Component that only exists to provide the style context:

```typescript
export class VbOverlayHost extends HTMLElement {
  connectedCallback() {
    const shadow = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = OVERLAY_CSS;
    shadow.appendChild(style);
    // Move children into shadow root so they get styled
    while (this.firstChild) {
      shadow.appendChild(this.firstChild);
    }
  }
}
```

**Recommendation: Option B** — it mirrors the real runtime environment (a shadow root that provides `OVERLAY_CSS`) and works naturally in story `render()` functions.

### Phase 5: Future overlay components

With this pattern established, **any new overlay UI** (element toolbar buttons, group picker rows, depth picker, etc.) can be:

- **Plain DOM with CSS classes** — for simple elements (buttons, separators, badges)
- **Light DOM Web Components** — for elements that need lifecycle/methods/events (pickers, drawers, containers)

All styled by `OVERLAY_CSS`. No new shadow DOMs needed.

## What this enables

### For Storybook
- Stories render light DOM Web Components inside `<vb-overlay-host>`
- Same `OVERLAY_CSS` styles as production
- Can also story plain DOM patterns (just class names + HTML) — e.g., toolbar buttons, picker rows

### For mockups (make-mocks.md)
- `shared/tokens/overlay-tokens.css` provides CSS custom properties
- Future `shared/tokens/overlay-components.css` can be generated from `OVERLAY_CSS`
- Mockup HTML uses the same class names as production
- Agents reference one canonical source of truth

### For new features
- No need to create a Web Component for every UI element
- Just add CSS rules to `OVERLAY_CSS` and create DOM with class names
- Use Web Components only when you need behavioral encapsulation

## Sidebar special case

The sidebar manipulates `document.body` (creates `#tw-page-wrapper`, moves page content). This happens **outside** the shadow root — it's page-level DOM restructuring.

With light DOM, the sidebar's visual panel (the iframe container on the right) renders inside the overlay shadow root and gets styled by `OVERLAY_CSS`. The page restructuring logic stays unchanged — it directly manipulates `document.body`.

No issues here.

## Migration checklist

- [ ] Add `.container-modal`, `.container-sidebar`, `.container-popover` styles to `OVERLAY_CSS`
- [ ] Convert `vb-modal-container` to light DOM
- [ ] Convert `vb-sidebar-container` to light DOM
- [ ] Convert `vb-popover-container` to light DOM
- [ ] Convert `vb-bottom-toolbar` to light DOM
- [ ] Remove duplicate bottom toolbar styles from `vb-bottom-toolbar.ts` (already in `OVERLAY_CSS`)
- [ ] Delete `overlay/src/web-components/shared-styles.ts`
- [ ] Create `<vb-overlay-host>` Storybook helper
- [ ] Update existing container/toolbar stories to use `<vb-overlay-host>`
- [ ] Verify overlay build (`esbuild`)
- [ ] Verify Storybook build
- [ ] Manual test: modal open/close/drag/resize
- [ ] Manual test: sidebar open/close/page restructure
- [ ] Manual test: popover open/close
- [ ] Manual test: bottom toolbar tool switching
