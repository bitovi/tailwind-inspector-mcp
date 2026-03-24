# CSS Variable Forwarding — Requirements

## Overview

Panel preview elements (color swatches, shadow preview squares, gradient bars) currently render using inline `style={{ backgroundColor: '#ef4444' }}` — hardcoded hex values resolved server-side or in the overlay. This means the panel doesn't see the user's actual design token values; it approximates them.

The goal is to make panel previews reflect the **live values** of the target app's design tokens by:

1. Forwarding the target app's CSS custom properties to the panel
2. Using `POST /css` to generate scoped utility CSS on demand
3. Injecting both into a `<style>` block in the panel so preview elements can use real Tailwind class names like `class="bg-destructive"` instead of `style={{ backgroundColor: hex }}`

---

## Why This Matters

Most modern design systems (shadcn/ui, Radix Themes, etc.) define colors as CSS custom properties:

```css
:root {
  --destructive: 0 84.2% 60.2%;  /* bare HSL channels */
}
```

Tailwind config maps utility classes to those variables:

```js
destructive: { DEFAULT: 'hsl(var(--destructive))' }
```

The panel runs in its own iframe at `localhost:3333/panel`. The target app's CSS is not loaded there. So today:

- The overlay resolves `var(--destructive)` → `hsl(0 84.2% 60.2%)` → `#ef4444` using `getComputedStyle` + a temporary DOM element
- That hex value is sent to the panel and used as an inline style

This works but is fragile: it breaks if the variable value is in an unexpected format, if the element is inside a scoped context (e.g. `.dark`), or if the color is animated/theme-switched.

---

## Design Philosophy

1. **Live values, not approximations** — The panel should always show what the browser actually renders for the target app, not a server-computed approximation.
2. **Scope carefully** — Injected CSS must not bleed into the panel's own UI. Preview elements must be sandboxed.
3. **Don't over-fetch** — CSS is generated on demand for the specific classes needed at the time of selection, not preloaded for all possible classes.
4. **Graceful fallback** — If CSS generation or variable forwarding fails, fall back to the current hex-based approach.

---

## Data Flow

```
Target app DOM
  │
  ├─ [overlay] snapshot all --* CSS custom properties from :root
  │    getComputedStyle(document.documentElement)
  │    → { '--destructive': '0 84.2% 60.2%', '--primary': '221.2 83.2% 53.3%', ... }
  │
  ├─ [overlay → panel WS] send CSS_VARS_SNAPSHOT message
  │    { type: 'CSS_VARS_SNAPSHOT', vars: Record<string, string> }
  │
  └─ [panel] on element selection, call POST /css with all classes from element
       → server runs compiler.build(['bg-destructive', 'text-white', ...])
       → returns generated utility CSS (includes .bg-destructive { background-color: ... })
       │
       └─ [panel] inject into scoped <style> block:
            :root { --destructive: 0 84.2% 60.2%; --primary: ...; }
            + generated utility CSS
            → preview elements can use class="bg-destructive" directly
```

---

## Implementation Plan

### Step 1: Overlay — Snapshot CSS Custom Properties

When the overlay connects to the WebSocket, and again on each element selection, collect all CSS custom properties from `:root`:

```ts
function snapshotCssVars(): Record<string, string> {
  const vars: Record<string, string> = {};
  const style = getComputedStyle(document.documentElement);
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule instanceof CSSStyleRule && rule.selectorText === ':root') {
          for (const prop of rule.style) {
            if (prop.startsWith('--')) {
              vars[prop] = style.getPropertyValue(prop).trim();
            }
          }
        }
      }
    } catch {
      // Cross-origin stylesheets are not readable — skip silently
    }
  }
  return vars;
}
```

Send on connect and on each `ELEMENT_SELECTED`:

```ts
sendTo('panel', {
  type: 'CSS_VARS_SNAPSHOT',
  vars: snapshotCssVars(),
});
```

**Note:** This must run in the target app's DOM context, not the shadow DOM. The overlay already runs there.

### Step 2: Panel — Receive and Store CSS Vars

In `panel/src/ws.ts`, handle the new `CSS_VARS_SNAPSHOT` message type and store the vars in a module-level ref or React state that persists across element selections.

```ts
let cssVarsSnapshot: Record<string, string> = {};

onMessage('CSS_VARS_SNAPSHOT', (msg) => {
  cssVarsSnapshot = msg.vars;
});
```

### Step 3: Panel — Generate and Inject Scoped CSS

When an element is selected (`ELEMENT_SELECTED`):

1. Extract all Tailwind classes from the incoming `classes` string
2. Call `POST /css` with those classes
3. Combine the generated utility CSS with a `:root { ... }` block built from the stored CSS vars snapshot
4. Inject into a dedicated `<style id="vybit-target-css">` tag in `document.head`, replacing any previous injection

```ts
async function injectTargetCss(classes: string[], cssVars: Record<string, string>) {
  const { css: utilityCSS } = await fetch('/css', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ classes }),
  }).then(r => r.json());

  const rootBlock = Object.entries(cssVars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');

  const combined = `:root {\n${rootBlock}\n}\n\n${utilityCSS}`;

  let styleEl = document.getElementById('vybit-target-css') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'vybit-target-css';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = combined;
}
```

### Step 4: Panel — Switch Preview Elements to Class Names

Once the scoped CSS is injected, preview elements can use real class names instead of inline hex:

**Before:**
```tsx
<div style={{ backgroundColor: colorHex }} />
```

**After:**
```tsx
<div className={`bg-${colorName}`} />
```

**Applies to:**
- `ColorCell` in `ColorGrid.tsx` — each color swatch cell
- Solid color swatch in `GradientEditor.tsx`
- `ShadowLayerRow.tsx` — color swatch within shadow/ring row
- Gradient stops in gradient bar

**Not applicable:**
- The `boxShadow` inline style on shadow preview squares — `box-shadow` has no equivalent Tailwind class that includes the inferred pixel values we compute; those remain inline.

### Step 5: Update `shared/types.ts` — New Message Type

Add `CSS_VARS_SNAPSHOT` to the shared WebSocket message union:

```ts
interface CssVarsSnapshotMessage {
  type: 'CSS_VARS_SNAPSHOT';
  vars: Record<string, string>;
}
```

---

## Edge Cases

| Case | Handling |
|------|----------|
| Cross-origin stylesheets (e.g. CDN fonts) | `try/catch` around `cssRules` access — skip silently |
| Dark mode / `.dark` scopes | Vars on `:root` only. Dark-mode vars (inside `.dark { ... }`) are **not** captured in phase 1. Phase 2 could snapshot the active element's computed vars instead. |
| `POST /css` fails | Fall back to existing hex-based `style={{}}` rendering |
| Tailwind v3 vs v4 | Both adapters implement `generateCssForClasses` — no change needed at the call site |
| Classes with special characters (e.g. `bg-[#abc123]`) | Pass through verbatim to `POST /css`; the compiler handles arbitrary values |
| Panel `<style>` injection conflicts | Single `id="vybit-target-css"` tag — always replaced, never appended |
| No vars yet (first load race) | `injectTargetCss` called only after `CSS_VARS_SNAPSHOT` received; use empty object as fallback |

---

## What Stays the Same

- The `resolveConfigCssVars()` / `normalizeToHex()` logic in the overlay (`overlay/src/index.ts`) can be **removed** once this feature ships — its only job was working around the panel's lack of CSS context.
- The `resolveColorHex()` function in `useGradientState.ts` can be simplified to a direct lookup (no hex conversion needed) or removed if class names are used everywhere.
- `POST /css` endpoint and `generateCssForClasses` implementations are unchanged.

---

## Out of Scope

- **Dark mode / theme-switching**: Capturing dark-mode CSS vars requires snapshotting the element's own computed styles, not just `:root`. Deferred to a follow-up.
- **Fonts and non-color utilities**: The CSS injection approach works for all Tailwind utilities, but this spec focuses on color preview correctness. Typography/spacing preview improvements are separate.
- **Caching generated CSS**: `POST /css` is fast (in-memory compiler). Caching is not needed in phase 1.
