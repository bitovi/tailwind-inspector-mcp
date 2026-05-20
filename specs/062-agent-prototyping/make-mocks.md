# Agent Prototyping: Making HTML Mockups

## Problem

AI agents iterating on VyBit UI need to produce quick HTML mockups that look like the real components. Today's mockups in `/specs` use ad-hoc CSS variables and handwritten styles that drift from the actual component implementations. There's no easy way for an agent to:

1. See the current visual state of a component (its rendered HTML + applied styles)
2. Produce a mockup that uses the same design tokens and patterns
3. Know which components already exist vs. what needs to be built from scratch

---

## Goals

1. **Consistent tokens everywhere** — Mockups, panel, and overlay all use the same design token values
2. **Component HTML snapshots** — Each Storybook component auto-generates an HTML representation agents can reference
3. **Agent skill** — A skill that grabs component snapshots + tokens and scaffolds a mockup file
4. **Overlay style accessibility** — Overlay's `--ov-*` tokens are available as a standalone CSS file for mockups

---

## Approach

### 1. Extract Shared Token Files

Today tokens live in three places with slightly different names:

| Source | Token format | Used by |
|--------|-------------|---------|
| `panel/src/index.css` | `--color-bit-*` (Tailwind `@theme`) | Panel React components |
| `overlay/src/styles.ts` | `--ov-*` (CSS string in JS) | Overlay Shadow DOM |
| `specs/060-prototyping/mockups/shared.css` | `--bit-*`, `--ov-*` (manually maintained) | HTML mockups |

**Proposal:** Create two canonical token CSS files that are the single source of truth:

```
shared/tokens/
  panel-tokens.css    ← exported from panel/src/index.css @theme block
  overlay-tokens.css  ← exported from overlay/src/styles.ts OVERLAY_CSS :host block
```

- `panel-tokens.css` defines `:root { --bit-bg: ...; --bit-surface: ...; }` — plain CSS variables (not Tailwind `@theme` format) so mockups can use them without a Tailwind build
- `overlay-tokens.css` defines `:root { --ov-toolbar-bg: ...; --ov-teal: ...; }` — extracted from the `:host {}` block in `OVERLAY_CSS`
- The mockup `shared.css` imports both: `@import '../../shared/tokens/panel-tokens.css'; @import '../../shared/tokens/overlay-tokens.css';`
- A build script (or manual step) regenerates these from the source files when tokens change

**Panel `@theme` stays canonical** — `panel/src/index.css` remains the source for panel tokens. `panel-tokens.css` is derived from it (a simple transform from `--color-bit-*` to `--bit-*`).

**Overlay `styles.ts` stays canonical** — `overlay/src/styles.ts` remains the source for overlay tokens. `overlay-tokens.css` is derived from the `:host {}` block.

### 2. Storybook HTML Snapshots

Each Storybook story can produce a static HTML snapshot of the rendered component. This gives agents a reference implementation to base mockups on.

**Options considered:**

| Option | Pros | Cons |
|--------|------|------|
| **A. Storybook `@storybook/addon-docs` HTML tab** | Built-in, shows JSX source | Shows React JSX, not raw HTML |
| **B. `renderToStaticMarkup()` in a test helper** | Pure HTML output, no React runtime | Extra test infrastructure |
| **C. Storybook interaction test + `innerHTML` capture** | Real rendered DOM | Complex setup |
| **D. Build-time snapshot script** | Generates `.html` files alongside stories | Needs headless browser |
| **E. Agent reads Storybook `build-storybook` output** | Already exists as static files | Hard to parse, full Storybook chrome |

**Recommended: Option B + D hybrid**

1. Each component's story file exports a `snapshot` story variant that renders the component with representative props
2. A script (`scripts/generate-snapshots.ts`) uses `renderToStaticMarkup()` for React components and `element.outerHTML` for Web Components
3. Output goes to `panel/snapshots/ComponentName.html` — self-contained HTML files with inlined tokens CSS
4. These snapshot files are what an agent skill reads

**Snapshot file format:**
```html
<!-- Auto-generated from ScaleScrubber.stories.tsx — DO NOT EDIT -->
<html>
<head>
  <link rel="stylesheet" href="../../shared/tokens/panel-tokens.css">
  <style>/* Tailwind utilities used by this component */</style>
</head>
<body>
  <div class="flex items-center gap-2 bg-bit-surface ...">
    <!-- rendered component HTML -->
  </div>
</body>
</html>
```

For **overlay Web Components**, the snapshot includes the Shadow DOM content:
```html
<!-- Auto-generated from VbBottomToolbar.stories.tsx — DO NOT EDIT -->
<html>
<head>
  <link rel="stylesheet" href="../../shared/tokens/overlay-tokens.css">
</head>
<body>
  <vb-bottom-toolbar selected-tool="select" instance-count="3">
    <template shadowrootmode="open">
      <style>/* component's shadow DOM styles */</style>
      <div class="bottom-toolbar">...</div>
    </template>
  </vb-bottom-toolbar>
</body>
</html>
```

### 3. Panel: Make Tailwind Work Correctly Everywhere

The panel already uses Tailwind v4 with `@theme` tokens correctly. To ensure mockups can replicate panel components:

1. **Document the Tailwind class vocabulary** — Which utility classes does the panel actually use? Generate a report from `grep -rohP 'class(Name)?="[^"]*"' panel/src/` to catalog the utility class usage patterns.
2. **Tailwind Play CDN (required for all mockups)** — Every mockup HTML file must include the Tailwind Play CDN script and a config block that maps project tokens to Tailwind colors:
   ```html
   <script src="https://cdn.tailwindcss.com"></script>
   <script>
     tailwindcss.config = {
       theme: { extend: { colors: {
         'bit-bg': '#2c2c2c',
         'bit-surface': '#383838',
         'bit-surface-hi': '#404040',
         'bit-border': '#3a3a3a',
         'bit-text': '#e5e5e5',
         'bit-text-mid': '#b3b3b3',
         'bit-muted': '#999999',
         'bit-orange': '#F5532D',
         'bit-teal': '#00848B',
         'bit-teal-dark': '#00464A',
         'bit-teal-mid': '#003D40',
         'bit-teal-hover': '#006b70',
         'bit-teal-light': '#5fd4da',
         'bit-green': '#2E7229',
         'bit-draft': '#fbbf24',
         'bit-committed': '#F5532D',
       }}}
     }
   </script>
   ```
   This gives agents real Tailwind utilities (`flex`, `gap-2`, `bg-bit-surface`, etc.) with project design tokens — zero build step, opens in any browser.
3. **Token CSS still imported** — `panel-tokens.css` is still imported via `shared.css` for CSS custom property access (`var(--bit-teal)` in hand-written CSS blocks). The CDN handles utility classes; token CSS handles custom properties.

### 4. Overlay: Isolate Styles for Mock Accessibility

The overlay's styles are currently embedded in `overlay/src/styles.ts` as a TypeScript string. To make them accessible to mockups:

1. **Extract `overlay-tokens.css`** (see section 1 above) — just the CSS custom properties
2. **Extract `overlay-components.css`** — the component-level CSS rules from `OVERLAY_CSS` (toolbar classes, drawer classes, etc.), excluding the `:host` token block
3. **Mockup pattern for overlay components:**
   ```html
   <link rel="stylesheet" href="../../shared/tokens/overlay-tokens.css">
   <link rel="stylesheet" href="../../shared/tokens/overlay-components.css">
   <div class="bottom-toolbar">
     <button class="bt-combo active">Select</button>
     <button class="bt-combo">Insert</button>
   </div>
   ```

### 5. Agent Skill: `make-mockup`

An agent skill in `.github/skills/make-mockup/` that:

1. **Inputs:** Component name or description of what to mock up
2. **Process:**
   - Reads the component's Storybook snapshot HTML (if it exists)
   - Reads the component's source code (`.tsx` or Web Component `.ts`)
   - Reads the relevant token CSS files
   - Reads the shared mockup CSS (`shared.css`)
3. **Outputs:** A self-contained `.html` file in `/specs/{spec-dir}/mockups/` that:
   - Imports token CSS files
   - Contains the component's HTML structure
   - Can be opened directly in a browser
   - Includes comments noting which real component it's based on

**Skill file structure:**
```
.github/skills/make-mockup/
  SKILL.md           ← instructions for the agent
  template.html      ← HTML template with token imports
  examples/          ← example mockup files
```

**SKILL.md would instruct the agent to:**
1. Run `npx tsx scripts/generate-snapshots.ts ComponentName` to generate a fresh snapshot → use as starting point
2. If no story exists for the target component, read the component source and manually translate JSX → HTML
3. Always include the Tailwind Play CDN `<script>` + token config block (see section 3)
4. Always import token CSS files for `var(--bit-*)` access (never hardcode color values)
5. Use Tailwind utility classes for layout (`flex`, `gap-2`, `p-4`, etc.) — not hand-written CSS
6. Use consistent class naming from `shared.css` for non-Tailwind patterns
7. Include a `<!-- Based on: ComponentName -->` comment for traceability

---

## Dependencies on Storybook Plan

This spec depends on [storybook.md](storybook.md) for:

- **Phase 0 (SB10 upgrade)** — Needed before snapshot generation scripts work reliably
- **Phase 1 (Web Component pattern)** — Needed to generate overlay component snapshots
- **Phase 2-5 (component extraction)** — Each extracted Web Component gets a snapshot

The token extraction (section 1) and agent skill (section 5) can start **immediately** — they don't depend on Storybook work.

---

## Implementation Order

### Can start now (no Storybook dependency):
1. Create `shared/tokens/panel-tokens.css` — extract from `panel/src/index.css`
2. Create `shared/tokens/overlay-tokens.css` — extract from `overlay/src/styles.ts`
3. Update `specs/060-prototyping/mockups/shared.css` to import token files
4. Create `.github/skills/make-mockup/SKILL.md` skill definition
5. Create `.github/skills/make-mockup/template.html` mockup template

### After Storybook Phase 1:
6. Build snapshot generation script (`scripts/generate-snapshots.ts`)
7. Add `panel/snapshots/` to `.gitignore`
8. Update make-mockup skill to run snapshot generation on demand

### After each Storybook phase:
9. New stories automatically supported — snapshot generation script picks them up at agent runtime

---

## Resolved Decisions

1. **Snapshot freshness → on-demand generation, not checked in.** Snapshots are generated at agent runtime by the `make-mockup` skill (runs `scripts/generate-snapshots.ts` for the target component). Output goes to a gitignored `panel/snapshots/` directory. No CI checks, no pre-commit hooks — the agent always works from a fresh snapshot. Token CSS files (`panel-tokens.css`, `overlay-tokens.css`) *are* checked in since they're small, change rarely, and are needed by humans opening mockups in a browser.

2. **Tailwind in mockups → Tailwind Play CDN with token config.** Every mockup includes `<script src="https://cdn.tailwindcss.com"></script>` plus a `tailwindcss.config` block that maps project tokens (`bit-bg`, `bit-surface`, etc.) to Tailwind colors. This gives agents real utility classes with project design tokens, zero build step. Token CSS is still imported for `var(--bit-*)` access in hand-written CSS.

3. **Overlay component CSS extraction → one file.** Extract all overlay component CSS rules into a single `overlay-components.css` file (~700 lines). Most mockups combine multiple overlay components (toolbar + drawer + tooltips + FAB), and the file is small enough that splitting provides no benefit. One extraction script, one output file, one `<link>` tag in mockups.

4. **Web Component declarative Shadow DOM → yes, modern browsers only.** Snapshot files use `<template shadowrootmode="open">` for Web Components. Mockups only need to work in modern browsers (Chrome, Firefox, Safari), so declarative Shadow DOM is fine.
