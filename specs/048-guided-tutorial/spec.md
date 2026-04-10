# 048 — Guided Tutorial Demo Page

## Goal

Transform the shared test-app/demo page from a component showcase into a step-by-step guided tutorial that teaches new users how to use VyBit. The page walks users through every major feature — selecting elements, sending messages, voice recording, text editing, inserting content, placing components, tweaking design, and reporting bugs — with auto-detection of completed steps.

## Motivation

- The current demo page is a wall of components with no guidance — users don't know what to do
- A guided tutorial turns the demo into an onboarding experience that sells VyBit in 5 minutes
- Each section teaches one feature, builds on the previous, and confirms completion before advancing
- Console output already shows the MCP tool calls — the tutorial frames *why* that matters

## Architecture

### Shared codebase

`demo/bootstrap.ts` imports `test-app/src/App.tsx` directly. Changing App.tsx changes both the demo and the dev test-app. **This will break E2E tests** — those will be updated afterward to follow the tutorial flow.

### Tutorial state

```
test-app/src/
  App.tsx                    ← Redesigned as tutorial layout
  TutorialSection.tsx        ← Reusable section wrapper component
  useTutorialProgress.ts     ← Hook: tracks step, persists to localStorage
```

- `useTutorialProgress` tracks `completedSteps` (Set) — no linear ordering
- Persists to `localStorage('vybit-tutorial-progress')` so progress survives refresh
- Exposes `completeStep(n)`, `resetProgress()`
- All sections are visible and expanded by default — users can explore in any order
- Completed sections show a checkmark and can optionally collapse, but never lock

### Tutorial event bridge (demo only)

`demo/bootstrap.ts` already listens to all BroadcastChannel messages. We add a parallel listener that dispatches `CustomEvent`s to `window`:

```ts
window.dispatchEvent(new CustomEvent('vybit-tutorial', {
  detail: { action: 'patch-committed' }
}));
```

The `useTutorialProgress` hook listens via `useEffect` on `window` and auto-advances when the expected event fires.

For the real dev test-app (no demo bus), the tutorial events won't fire, but the tutorial UI still renders. Users can manually click "Mark complete" on each step or just ignore the tutorial framing.

### Detection signals

| Step | Title | Detection | Fallback |
|------|-------|-----------|----------|
| 1 | Welcome to VyBit | — | "Next" button |
| 2 | Meet the Three Modes | — | "Next" button |
| 3 | Open the Panel | `REGISTER` message from panel role | "I opened it" button |
| 4 | Your First Change | `PATCH_COMMIT` received | "Done" button |
| 5 | Send a Voice Message | `MESSAGE_STAGE` with voice content | "Done" button |
| 6 | Edit Text In Place | `TEXT_EDIT_DONE` message | "Done" button |
| 7 | Describe What to Add | `MESSAGE_STAGE` with `insertMode` set | "Done" button |
| 8 | Sketch What to Add | `QUEUE_UPDATE` with design-kind patch | "Done" button |
| 9 | Place a Component | `COMPONENT_DROPPED` message | "Done" button |
| 10 | Build with Nested Components | `COMPONENT_DROPPED` (second time) | "Done" button |
| 11 | Fine-Tune the Design | `PATCH_STAGED` for class-change kind | "Done" button |
| 12 | Report a Bug | `BUG_REPORT_STAGE` message | "Done" button |

### TutorialSection component

```
┌─────────────────────────────────────────────────┐
│ ④  Your First Change                    ✓ Done  │  ← header (step badge + title + status)
├─────────────────────────────────────────────────┤
│                                                 │
│  Instructions text explaining what to do...     │  ← Instructions block
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │                                           │  │
│  │        Playground area                    │  │  ← Interactive content (children)
│  │        (elements to click/edit/draw on)   │  │
│  │                                           │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│                          [ Mark complete ]       │  ← Fallback button
└─────────────────────────────────────────────────┘
```

States:
- **Incomplete**: Expanded, visible, step badge is open circle
- **Completed**: Checkmark icon, subtle success accent — still expanded and interactive (user can redo)
- No locked/dimmed state — all sections accessible from the start

## Global default changes

### Default container → sidebar

In `overlay/src/index.ts`, change `getDefaultContainer()` fallback from `"popover"` to `"sidebar"`. This affects all environments (demo, dev, production), which is the intended behavior.

### Demo starts with panel closed

In `demo/bootstrap.ts`, remove `sessionStorage.setItem('tw-inspector-panel-open', '1')` so the panel starts closed and the user learns to open it in Step 3.

## Page layout

The page is a vertically scrolling list of tutorial sections. No sidebar nav, no header nav — just the content. A small floating "Reset Tutorial" button sits at the bottom-right (below the VyBit toggle button).

The page background is light (`bg-gray-50`). Each section is a white card with rounded corners and a subtle shadow. The current step's card has a teal left border accent.

## Files changed

| File | Change |
|------|--------|
| `overlay/src/index.ts` | `getDefaultContainer()` returns `"sidebar"` instead of `"popover"` |
| `demo/bootstrap.ts` | Remove auto-open sessionStorage; add tutorial event dispatching |
| `test-app/src/App.tsx` | Complete redesign as tutorial layout |

## New files

| File | Purpose |
|------|---------|
| `test-app/src/TutorialSection.tsx` | Section wrapper with expand/collapse, step badge, status |
| `test-app/src/useTutorialProgress.ts` | Hook for tutorial state + localStorage persistence |

## Verification

1. Visit demo URL — panel is closed, page shows tutorial sections
2. Click toggle button — sidebar opens, Step 3 auto-completes
3. Walk through all 12 steps — each auto-detects completion
4. Refresh mid-tutorial — progress persists from localStorage
5. Click "Reset Tutorial" — all steps reset
6. `cd demo && npm run build` succeeds
7. Deploy to GitHub Pages — tutorial works at subpath URL
