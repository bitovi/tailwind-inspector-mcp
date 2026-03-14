# Storybook Integration

## Overview

The MCP server already serves both pieces at known URLs:
- `http://localhost:3333/overlay.js` — the click inspector overlay
- `http://localhost:3333/panel` — the React panel UI

These two pieces communicate exclusively through WebSocket, so they're already decoupled from each other — exactly the shape that fits Storybook.

---

## Option 1: Zero-code quick path

Add one line to `.storybook/preview-head.html`:

```html
<script src="http://localhost:3333/overlay.js"></script>
```

Then open `http://localhost:3333/panel` in a separate browser window (or pin the URL in a browser side panel). The overlay works inside Storybook's story iframe, the panel connects to the same MCP server. No code changes needed.

**Limitation**: the panel lives outside Storybook's chrome, so it's a two-window workflow.

---

## Option 2: Proper Storybook addon

A new package (e.g. `storybook-addon/`) with two entry points:

**`preview.ts`** — runs inside the story iframe, injecting the overlay:
```ts
const s = document.createElement('script');
s.src = 'http://localhost:3333/overlay.js';
document.head.appendChild(s);
```

**`manager.tsx`** — runs in Storybook's manager chrome, rendering the panel as a tab:
```tsx
import { addons, types } from '@storybook/manager-api';
import { AddonPanel } from '@storybook/components';

addons.register('tailwind-inspector', () => {
  addons.add('tailwind-inspector/panel', {
    type: types.PANEL,
    title: 'Tailwind Inspector',
    render: ({ active }) => (
      <AddonPanel active={active}>
        <iframe
          src="http://localhost:3333/panel"
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      </AddonPanel>
    ),
  });
});
```

This makes the panel appear as a first-class tab in Storybook's bottom panel — the same row as "Actions", "Controls", etc.

The addon would live as a `storybook-addon/` directory alongside the existing `overlay/`, `panel/`, and `server/` directories, and could eventually be published as `tailwind-inspector/storybook-addon`.

---

## Key considerations

**Overlay in an iframe**: Storybook renders each story inside a sandboxed `<iframe>`. The overlay is injected into that iframe's document — and because it relies on the React fiber tree rooted at the iframe's `document`, that works correctly. The toggle button and shadow DOM UI all render inside the iframe too, which is fine visually.

**Panel WS URL**: The panel's `ws.ts` derives the WebSocket URL from `window.location.origin`. When served from `http://localhost:3333/panel`, it correctly resolves to `ws://localhost:3333`. No change needed there.

**Cross-origin iframe**: The panel iframe in the manager is loaded from `localhost:3333` while Storybook typically runs at `localhost:6006`. This is fine for local dev since both are `localhost`. The iframe is passive display only (no postMessage communication), so browser blocking is not a concern.

**CSP**: Some Storybook setups add a `Content-Security-Policy`. If in place, `frame-src` and `script-src` would need `localhost:3333` added.

---

## Addon structure (Option 2)

```
storybook-addon/
  package.json
  src/
    preview.ts       # injects overlay.js into story iframe
    manager.tsx      # registers panel tab in Storybook chrome
  tsconfig.json
```

**Effort estimate:**

| Layer | Effort |
|---|---|
| `preview.ts` (inject overlay) | ~5 lines |
| `manager.tsx` (panel iframe) | ~20 lines |
| `addon package.json` + build config | ~30 min boilerplate |
| Storybook preset file | ~10 lines |
