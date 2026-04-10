# 047 — Static Demo for GitHub Pages

## Goal

Ship a serverless, static build of VyBit that runs entirely in the browser on GitHub Pages. Visitors click elements, scrub Tailwind values, see live previews, and see console logs showing exactly what the MCP agent would receive — all without a running server.

## Motivation

- **Marketing**: let people experience VyBit without cloning, installing, or running services
- **Credibility**: a live interactive demo is worth more than a video or screenshot
- **Low friction onboarding**: visitors understand the product in 30 seconds

## Architecture

### Single-page, Shadow DOM isolation

One HTML page hosts everything. No iframes, no multi-page build.

```
┌─ demo page ─────────────────────────────────────────┐
│                                                      │
│  test-app markup (normal DOM)                        │
│  ┌─ shadow host: overlay ──────────────────────┐     │
│  │  highlight boxes, click handlers, toggle    │     │
│  └─────────────────────────────────────────────┘     │
│  ┌─ shadow host: panel ──── right sidebar ─────┐     │
│  │  React panel app + scoped CSS               │     │
│  └─────────────────────────────────────────────┘     │
│                                                      │
└──────────────────────────────────────────────────────┘
```

- The **overlay** already runs in Shadow DOM — no changes needed
- The **panel** mounts into a new Shadow DOM host, pinned to the right edge, with its CSS injected via `adoptedStyleSheets` or a `<style>` tag
- Full CSS isolation: test-app, overlay, and panel styles cannot conflict

### What replaces the server

| Server feature | Static replacement |
|---|---|
| WebSocket relay | In-memory `EventTarget` bus (`demo/bus.ts`) |
| `POST /css` (Tailwind compilation) | `@tailwindcss/browser` running client-side |
| `GET /tailwind-config` | Static JSON snapshot embedded at build time |
| Patch queue (`server/queue.ts`) | In-memory queue in the browser |
| `GET /overlay.js` | Bundled inline — same page |
| `GET /panel/*` | Bundled inline — same page |
| MCP tools | Console-logged mock (no real agent) |
| Storybook proxy | Removed entirely |
| Ghost cache | Removed entirely |

### Message bus (`demo/bus.ts`)

Replaces both `overlay/src/ws.ts` and `panel/src/ws.ts` with a shared in-memory bus.

```ts
// Matches the existing ws.ts API shape
const handlers = new Set<(msg: any) => void>();

export function send(data: object) {
  // Simulate async server relay
  queueMicrotask(() => {
    for (const handler of handlers) handler(data);
  });
}

export function onMessage(handler: (msg: any) => void): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

export function sendTo(role: string, data: object) {
  send({ ...data, to: role });
}

export function isConnected() { return true; }
export function connect() {}
```

Both overlay and panel import this module instead of their real `ws.ts`.

### Tailwind compilation (`demo/tailwind-browser.ts`)

Replaces overlays `POST /css` fetch with a client-side call to `@tailwindcss/browser`.

```ts
import { compile } from '@tailwindcss/browser';

let compiler: Awaited<ReturnType<typeof compile>>;

export async function generateCss(classes: string[]): Promise<string> {
  if (!compiler) {
    compiler = await compile(`@import "tailwindcss";`);
  }
  return compiler.build(classes);
}
```

The overlay's `patcher.ts` currently does `fetch('/css', { body: { classes } })`. The demo build replaces this with a direct call to `generateCss()`.

### MCP console logger (`demo/mock-mcp.ts`)

When a patch is committed, log what `implement_next_change` would return:

```ts
export function logMcpChange(patch: Patch) {
  console.log(
    '%c🤖 MCP tool call: implement_next_change',
    'color: #00848B; font-weight: bold; font-size: 14px',
  );
  console.log({
    changeId: patch.id,
    kind: patch.kind,
    element: {
      tag: patch.target?.tag,
      classes: patch.target?.classes,
      innerText: patch.target?.innerText?.slice(0, 80),
    },
    change: {
      originalClass: patch.originalClass,
      newClass: patch.newClass,
      property: patch.property,
    },
    instructions: [
      `Find the <${patch.target?.tag}> element with class "${patch.originalClass}"`,
      `Change "${patch.originalClass}" to "${patch.newClass}"`,
      `Then call mark_change_implemented with changeId "${patch.id}"`,
    ],
  });
}
```

After logging, auto-transition the patch to `implemented` with a brief delay to simulate agent work.

## What's in / what's out

### In scope (demo features)

- Click any element → see its Tailwind classes as chips
- Scrub scalar values (padding, margin, font-size, etc.)
- Pick colors from the color grid
- Live DOM preview while scrubbing
- Stage and commit changes
- Console log of MCP tool calls on commit
- Auto-"implement" after a short delay (simulate agent)
- Responsive — panel collapses on small screens

### Out of scope (removed for demo)

- MCP agent loop (no real agent — console log only)
- Storybook integration (proxy, ghost cache, draw tab)
- Bug report tool
- Screenshot capture
- Voice messages / audio context
- Design canvas / inline draw
- Component drop / insert mode
- `GET /patches` REST endpoint
- Multi-user WebSocket relay

## Build

### Directory structure

```
demo/
  bus.ts              ← in-memory message bus (replaces ws.ts)
  tailwind-browser.ts ← client-side Tailwind compilation
  mock-mcp.ts         ← console.log MCP tool calls
  mock-queue.ts       ← in-memory patch queue
  bootstrap.ts        ← entry point: mounts overlay + panel + test-app
  vite.config.ts      ← build config for the static demo
  index.html          ← single HTML shell
```

### Build pipeline

```bash
cd demo && npx vite build
# → demo/dist/index.html + assets
# Deploy demo/dist/ to GitHub Pages
```

Vite config:
- Aliases `overlay/src/ws` → `demo/bus.ts`
- Aliases `panel/src/ws` → `demo/bus.ts`
- Aliases the `/css` fetch in `patcher.ts` → `demo/tailwind-browser.ts`
- Bundles test-app components inline
- Inline `@tailwindcss/browser` (it's designed for browser use)

### GitHub Pages deployment

A GitHub Actions workflow:
1. `npm ci`
2. `cd demo && npm run build`
3. Deploy `demo/dist/` to GitHub Pages via `actions/deploy-pages`

Triggered on push to `main` (or a `demo` branch).

## Implementation Plan

### Phase 1: Message bus + static test app

**Goal:** A deployable page with the test-app and overlay working, using the in-memory bus instead of WebSocket.

1. Create `demo/` directory with `index.html`, `vite.config.ts`, `package.json`
2. Create `demo/bus.ts` — in-memory message bus matching `ws.ts` API
3. Create `demo/bootstrap.ts` — entry point that:
   - Renders test-app components into the page
   - Initializes overlay (click handlers, highlight, Shadow DOM)
   - Wires overlay to use `bus.ts` instead of WS
4. Configure Vite aliases so overlay imports resolve to `demo/bus.ts`
5. Verify: page loads, overlay toggle appears, clicking elements dispatches `ELEMENT_SELECTED` through the bus

### Phase 2: Panel in Shadow DOM

**Goal:** The panel renders in a Shadow DOM sidebar and receives messages from the overlay via the bus.

1. Create a Shadow DOM host element pinned to the right edge (e.g. `width: 360px; position: fixed; right: 0; top: 0; height: 100vh`)
2. Mount the panel's React app into the shadow root
3. Inject panel CSS into the shadow root (via `<style>` or `adoptedStyleSheets`)
4. Wire panel to use `demo/bus.ts` — on `ELEMENT_SELECTED`, panel renders chips
5. Hide panel features that require server (Draw tab, Storybook reconnect, bug report)
6. Verify: click element → panel shows chips for that element's classes

### Phase 3: Client-side Tailwind compilation

**Goal:** Live preview works entirely in the browser.

1. Add `@tailwindcss/browser` as a dependency
2. Create `demo/tailwind-browser.ts` wrapping `compile()` + `build()`
3. Replace the overlay's `fetch('/css')` call in `patcher.ts` with a call to `generateCss()` (via Vite alias or a thin adapter)
4. Replace `fetch('/tailwind-config')` with a static JSON snapshot of the default Tailwind v4 theme (built at build time or hardcoded)
5. Verify: scrubbing a value previews the change live in the DOM

### Phase 4: Patch queue + MCP console logging

**Goal:** Users can stage, commit changes, and see what the AI agent would receive.

1. Create `demo/mock-queue.ts` — in-memory patch queue (port the essentials from `server/queue.ts`)
2. Wire `PATCH_STAGED` / `PATCH_COMMIT` / `DISCARD_DRAFTS` messages through the bus into the mock queue
3. Broadcast `QUEUE_UPDATE` back through the bus so the panel's queue UI updates
4. Create `demo/mock-mcp.ts` — on commit, `console.log` the MCP payload
5. After logging, auto-transition patch to `implemented` after ~2s delay
6. Verify: stage a change → commit → see console log → patch shows as implemented

### Phase 5: Polish + deploy

**Goal:** Production-ready demo on GitHub Pages.

1. Add a banner/header explaining what VyBit is and how to use the demo
2. Pre-open the panel on load (skip requiring the user to find the toggle)
3. Auto-select an interesting element on first load so visitors immediately see chips
4. Add a "View MCP output" hint pointing to the browser console
5. Create `.github/workflows/demo.yml` — build and deploy to GitHub Pages
6. Add link to the live demo in the project README
7. Test on Chrome, Safari, Firefox; verify `@tailwindcss/browser` works in all three

### Phase 6 (stretch): In-page MCP log viewer

**Goal:** Non-technical visitors see the MCP output without opening DevTools.

1. Add a small collapsible log panel at the bottom of the page
2. Mirror `console.log` calls into this panel with syntax-highlighted JSON
3. Show a "copy to clipboard" button per log entry
