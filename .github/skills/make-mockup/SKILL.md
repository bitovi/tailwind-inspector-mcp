---
name: make-mockup
description: Produce quick self-contained HTML mockups that look like real VyBit components. Use when asked to create a mockup, prototype a UI change, or visualize a spec. Reads component source + design tokens and outputs a browser-ready .html file in specs/.
---

# Skill: Make Mockup

Create self-contained HTML mockups of VyBit components that use the real design tokens and Tailwind utilities. Mockups open directly in a browser with no build step.

## When to Use

- User asks to mock up, prototype, or visualize a UI component or layout
- A spec needs a visual reference for a proposed change
- Iterating on component design before writing real implementation code

## When NOT to Use

- Building production components (use `create-react-modlet` for panel, write Web Components for overlay)
- Updating existing component code — edit the real source instead

## Inputs

- **Component name** or description of what to mock up
- **Spec directory** where the mockup should live (e.g. `specs/042-my-feature/mockups/`)

## Process

### Step 1: Gather Reference Material

1. **Read the component source code:**
   - Panel components: `panel/src/components/{ComponentName}/{ComponentName}.tsx`
   - Overlay components: `overlay/src/` (Web Components in TypeScript)
2. **Read the relevant token CSS files** from `shared/tokens/`:
   - `panel-tokens.css` — `--color-bit-*` custom properties for panel components
   - `overlay-tokens.css` — `--ov-*` custom properties for overlay components
   - `overlay-components.css` — overlay component CSS rules (toolbar, drawer, tooltip classes)
3. **Check for Storybook snapshots** in `panel/snapshots/` — if a snapshot exists for the component, use it as a starting point. If not, and a snapshot script exists, run:
   ```bash
   npx tsx scripts/generate-snapshots.ts ComponentName
   ```
4. **Read the Storybook stories** if they exist — stories show representative props and usage patterns.

### Step 2: Create the Mockup File

1. **Copy the template** from `.github/skills/make-mockup/template.html`
2. **Place the file** in the target spec's mockups directory: `specs/{spec-dir}/mockups/{mockup-name}.html`
3. **Adjust the `<link>` paths** — token CSS paths must be relative from the mockup file to `shared/tokens/`. For a file at `specs/042-feature/mockups/mockup.html`, that's `../../../shared/tokens/`.

### Step 3: Build the Mockup Content

1. **Translate component JSX/HTML** into plain HTML inside the `<body>`.
2. **Use Tailwind utility classes** for layout and spacing (`flex`, `gap-2`, `p-4`, `rounded-lg`, `bg-bit-surface`, etc.) — the Tailwind Play CDN handles these.
3. **Use `var(--color-bit-*)` or `var(--ov-*)`** in any `<style>` blocks for custom properties.
4. **For overlay components**, also import `overlay-components.css` to get component-level class names (`.bottom-toolbar`, `.bt-combo`, `.element-drawer`, etc.).
5. **Add a traceability comment** at the top: `<!-- Based on: ComponentName -->`
6. **Set the `<title>`** to something descriptive.

## Rules

### Always Do

- Include the **Tailwind Play CDN** `<script>` tag and token config block (see template)
- Import **token CSS files** via relative `<link>` tags for `var()` access
- Use **Tailwind utility classes** with project token names (`bg-bit-surface`, `text-bit-teal`, `border-bit-border`)
- Include `<!-- Based on: ComponentName -->` comment for traceability
- Use **Inter** as the font family (matches production UI)

### Never Do

- **Never hardcode color hex values** in mockup HTML — always use `var(--color-bit-*)`, `var(--ov-*)`, or Tailwind utility classes like `bg-bit-surface`
- **Never skip the CDN script** — without it, Tailwind classes won't work
- **Never use `@apply`** — mockups don't have a Tailwind build step
- **Never put mockups outside `specs/`** — they belong in `specs/{spec-dir}/mockups/`

## Tailwind Play CDN Config

Every mockup must include this block in `<head>`. It maps project design tokens to Tailwind color utilities:

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

This gives you utility classes like `bg-bit-surface`, `text-bit-teal`, `border-bit-border`, etc.

## Token CSS Files

| File | Custom property prefix | Use for |
|------|----------------------|---------|
| `shared/tokens/panel-tokens.css` | `--color-bit-*` | Panel component mockups |
| `shared/tokens/overlay-tokens.css` | `--ov-*` | Overlay component mockups |
| `shared/tokens/overlay-components.css` | (class names) | Overlay component CSS rules (`.bottom-toolbar`, `.bt-combo`, etc.) |

### Panel mockup imports

```html
<link rel="stylesheet" href="../../../shared/tokens/panel-tokens.css">
```

### Overlay mockup imports

```html
<link rel="stylesheet" href="../../../shared/tokens/overlay-tokens.css">
<link rel="stylesheet" href="../../../shared/tokens/overlay-components.css">
```

## File Placement

```
specs/
  042-my-feature/
    mockups/
      toolbar-redesign.html    ← mockup file
      component-grid.html      ← another mockup
    spec.md
```

## Example: Panel Component Mockup

```html
<!DOCTYPE html>
<!-- Based on: ScaleScrubber -->
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ScaleScrubber Mockup</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwindcss.config = {
      theme: { extend: { colors: {
        'bit-bg': '#2c2c2c', 'bit-surface': '#383838',
        'bit-surface-hi': '#404040', 'bit-border': '#3a3a3a',
        'bit-text': '#e5e5e5', 'bit-text-mid': '#b3b3b3',
        'bit-muted': '#999999', 'bit-orange': '#F5532D',
        'bit-teal': '#00848B', 'bit-teal-dark': '#00464A',
        'bit-teal-mid': '#003D40', 'bit-teal-hover': '#006b70',
        'bit-teal-light': '#5fd4da', 'bit-green': '#2E7229',
        'bit-draft': '#fbbf24', 'bit-committed': '#F5532D',
      }}}
    }
  </script>
  <link rel="stylesheet" href="../../../shared/tokens/panel-tokens.css">
  <style>
    body { margin: 0; background: var(--color-bit-bg); color: var(--color-bit-text); font-family: 'Inter', system-ui, sans-serif; }
  </style>
</head>
<body class="bg-bit-bg text-bit-text min-h-screen p-8">
  <div class="flex items-center gap-2 bg-bit-surface rounded-lg px-3 py-1.5 border border-bit-border">
    <span class="text-xs text-bit-text-mid select-none">px</span>
    <span class="text-sm font-medium">4</span>
  </div>
</body>
</html>
```

## Example: Overlay Component Mockup

```html
<!DOCTYPE html>
<!-- Based on: VbBottomToolbar -->
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Bottom Toolbar Mockup</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwindcss.config = {
      theme: { extend: { colors: {
        'bit-bg': '#2c2c2c', 'bit-surface': '#383838',
        'bit-surface-hi': '#404040', 'bit-border': '#3a3a3a',
        'bit-text': '#e5e5e5', 'bit-text-mid': '#b3b3b3',
        'bit-muted': '#999999', 'bit-orange': '#F5532D',
        'bit-teal': '#00848B', 'bit-teal-dark': '#00464A',
        'bit-teal-mid': '#003D40', 'bit-teal-hover': '#006b70',
        'bit-teal-light': '#5fd4da', 'bit-green': '#2E7229',
        'bit-draft': '#fbbf24', 'bit-committed': '#F5532D',
      }}}
    }
  </script>
  <link rel="stylesheet" href="../../../shared/tokens/overlay-tokens.css">
  <link rel="stylesheet" href="../../../shared/tokens/overlay-components.css">
</head>
<body style="margin:0; background:#111; padding:40px; display:flex; justify-content:center; align-items:end; min-height:100vh;">
  <div class="bottom-toolbar">
    <button class="bt-combo active">Select</button>
    <button class="bt-combo">Insert</button>
  </div>
</body>
</html>
```
